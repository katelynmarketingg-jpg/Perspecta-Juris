// ─────────────────────────────────────────────────────────────────────────
//  Planejamento Previdenciário Automático — motor de análise (EC 103/2019)
//  ESTIMATIVO. Parâmetros editáveis. Validar com advogado previdenciarista.
// ─────────────────────────────────────────────────────────────────────────
import { PARAMS, diasEntre, tempoStr, decompoeTempo, fmtData, brl, num, corrigirINPC, fatorPrevidenciario } from './legalCalc'

const REFORMA = new Date('2019-11-13T00:00:00Z')
const DIA = 86400000

const parse = (iso) => iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')) : null
const addMonths = (d, m) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + m); return x }
const anosEntre = (d1, d2) => (d2 - d1) / (365.25 * DIA)
const isoOf = (d) => d.toISOString().slice(0, 10)

// idade em anos completos numa data
function idadeEm(nascimento, ref) {
  let a = ref.getUTCFullYear() - nascimento.getUTCFullYear()
  const mo = ref.getUTCMonth() - nascimento.getUTCMonth()
  if (mo < 0 || (mo === 0 && ref.getUTCDate() < nascimento.getUTCDate())) a--
  return a
}

// dias de contribuição a partir dos vínculos até uma data limite
function diasAte(vinculos, limite) {
  let dias = 0
  for (const v of vinculos) {
    const ini = parse(v.inicio); if (!ini) continue
    let fim = parse(v.fim) || limite
    if (fim > limite) fim = limite
    if (fim <= ini) continue
    dias += Math.round((fim - ini) / DIA)
  }
  return dias
}

// meses de carência (competências) aproximados
function carenciaMeses(vinculos) {
  let meses = 0
  for (const v of vinculos) {
    const ini = parse(v.inicio), fim = parse(v.fim)
    if (!ini || !fim || fim <= ini) continue
    meses += Math.max(1, Math.round((fim - ini) / DIA / 30))
  }
  return meses
}

// exigências por regra em função do ano
const exigPontos    = (ano, fem) => fem ? Math.min(100, 86 + (ano - 2019)) : Math.min(105, 96 + (ano - 2019))
const idadeProgress = (ano, fem) => {
  const base = fem ? 56 : 61, cap = fem ? 62 : 65
  const inc = Math.max(0, ano - 2019) * 0.5
  return Math.min(cap, base + inc)
}

// ── Análise principal ──────────────────────────────────────────────────────
export function analisarPlanejamento(segurado, vinculos, extra = {}) {
  const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const nascimento = parse(segurado.nascimento)
  const fem = segurado.sexo === 'F'
  const tempoMin = fem ? 30 : 35            // tempo p/ regras de TC
  const carenciaMin = fem ? 15 : (extra.filiadoAntesReforma === false ? 20 : 15)

  // ── Métricas gerais ──
  const tempoHojeDias = diasAte(vinculos, hoje) + num(extra.tempoServicoMilitarDias) + num(extra.tempoRegimeProprioDias)
  const tempoReformaDias = diasAte(vinculos, REFORMA)
  const idadeHoje = nascimento ? idadeEm(nascimento, hoje) : 0
  const carencia = carenciaMeses(vinculos)

  // segmentação por tipo de atividade
  let diasComum = 0, diasEspecial = 0, diasRural = 0
  const salarios = []       // salários corrigidos pela INPC (art. 29-B)
  for (const v of vinculos) {
    const d = diasAte([v], hoje)
    if (v.atividade === 'especial') diasEspecial += d
    else if (v.atividade === 'rural') diasRural += d
    else diasComum += d
    if (num(v.salario) > 0) {
      const anoRef = (parse(v.fim) ?? parse(v.inicio) ?? hoje).getUTCFullYear()
      salarios.push(corrigirINPC(num(v.salario), anoRef))   // atualiza para valor presente
    }
  }
  // Média de 100% dos salários de contribuição corrigidos (EC 103, art. 26)
  const media = salarios.length ? salarios.reduce((a, b) => a + b, 0) / salarios.length : 0

  // ── Detecção de pendências ──
  const alertas = []
  // lacunas no CNIS
  const ordenados = [...vinculos].filter(v => v.inicio && v.fim).sort((a, b) => parse(a.inicio) - parse(b.inicio))
  for (let i = 1; i < ordenados.length; i++) {
    const gap = (parse(ordenados[i].inicio) - parse(ordenados[i - 1].fim)) / DIA
    if (gap > 45) alertas.push({ tipo: 'lacuna', texto: `Lacuna de ${Math.round(gap / 30)} meses entre ${fmtData(ordenados[i - 1].fim)} e ${fmtData(ordenados[i].inicio)}.` })
  }
  // concomitância
  for (let i = 0; i < ordenados.length; i++) {
    for (let j = i + 1; j < ordenados.length; j++) {
      const aFim = parse(ordenados[i].fim), bIni = parse(ordenados[j].inicio)
      if (bIni < aFim) { alertas.push({ tipo: 'concomitancia', texto: `Períodos concomitantes: ${fmtData(ordenados[j].inicio)} sobrepõe vínculo anterior. Tempo não é somado em dobro.` }); break }
    }
  }
  // contribuições abaixo do mínimo
  const abaixoMin = vinculos.filter(v => num(v.salario) > 0 && num(v.salario) < PARAMS.salarioMinimo)
  if (abaixoMin.length) alertas.push({ tipo: 'abaixo-minimo', texto: `${abaixoMin.length} competência(s) abaixo do salário mínimo — avaliar complementação, agrupamento ou descarte.` })
  // especial sem PPP
  const especialSemDoc = vinculos.filter(v => v.atividade === 'especial' && !v.ppp)
  if (especialSemDoc.length) alertas.push({ tipo: 'doc-especial', texto: `${especialSemDoc.length} período(s) especial(is) sem PPP/LTCAT informado — risco de indeferimento.` })
  // rural
  const rural = vinculos.filter(v => v.atividade === 'rural')
  if (rural.length) alertas.push({ tipo: 'rural', texto: 'Tempo rural exige início de prova material contemporânea (autodeclaração + documentos).' })
  // pendências manuais
  vinculos.filter(v => v.pendencia).forEach(v => alertas.push({ tipo: 'pendencia', texto: `Vínculo ${fmtData(v.inicio)}–${fmtData(v.fim)}: ${v.pendencia}` }))

  // ── Estimativa de RMI por coeficiente ──
  const anosContribHoje = tempoHojeDias / 365
  // Coeficiente da RMI — EC 103/2019, art. 26, §2 (regra geral):
  // 60% da média + 2 p.p. por ano de contribuição que exceder 20 anos (homem)
  // ou 15 anos (mulher, §5). Teto de 100%.
  const coefBase = (anos) => Math.min(1, 0.60 + 0.02 * Math.max(0, anos - (fem ? 15 : 20)))
  // Aposentadoria especial — art. 26, §2, IV c/c §5: excedente contado sobre 15 anos.
  const coefEspecial = (anos) => Math.min(1, 0.60 + 0.02 * Math.max(0, anos - 15))
  const clampBenef = (v) => Math.max(PARAMS.salarioMinimo, Math.min(PARAMS.tetoINSS, v))
  const rmi = (coef) => media ? clampBenef(media * coef) : 0

  // ── Simulação forward p/ achar data provável (assume contribuição contínua) ──
  function projetar(fnAtende, maxMeses = 480) {
    if (fnAtende(hoje)) return { data: hoje, jaTem: true }
    for (let m = 1; m <= maxMeses; m++) {
      const d = addMonths(hoje, m)
      if (fnAtende(d)) return { data: d, jaTem: false }
    }
    return { data: null, jaTem: false }
  }
  const tempoAnosEm = (d) => (tempoHojeDias + Math.max(0, (d - hoje) / DIA)) / 365

  // ── Cenários (regras) ──
  const cenarios = []

  // 1) Direito adquirido (ATC pré-reforma)
  {
    const tempoReforma = tempoReformaDias / 365
    const ok = tempoReforma >= tempoMin
    // Regra antiga: SB = média × fator previdenciário (Lei 8.213, art. 29, I), na data da Reforma.
    const idadeReforma = nascimento ? idadeEm(nascimento, REFORMA) : 0
    const fpATC = ok ? fatorPrevidenciario(idadeReforma, tempoReforma, { fem }) : null
    // Com 85/95 pontos (art. 29-C) o fator é afastado (100% da média). Usa-se o mais vantajoso.
    const pontosReforma = idadeReforma + tempoReforma
    const semFator = pontosReforma >= (fem ? 85 : 95)
    const coefATC = semFator ? 1.0 : (fpATC ?? 1.0)
    cenarios.push({
      regra: 'Direito adquirido (Aposentadoria por Tempo de Contribuição até 13/11/2019)',
      elegivelAgora: ok, dataProvavel: ok ? REFORMA : null,
      requisitos: [{ label: `Tempo de contribuição até 13/11/2019`, exigido: `${tempoMin} anos`, atual: `${tempoReforma.toFixed(2)} anos`, ok }],
      rmi: ok ? rmi(coefATC) : 0,
      vantagens: ['Sem idade mínima', semFator ? 'Atingiu 85/95 pontos (art. 29-C): 100% da média, sem fator.' : `Aplica fator previdenciário (${fpATC ? fpATC.toFixed(4) : '—'}).`],
      desvantagens: [semFator ? 'Regra antiga preservada.' : 'Sem 85/95 pontos, o fator previdenciário reduz a RMI.'],
      obs: ok ? 'Segurado JÁ REUNIA os requisitos antes da Reforma — direito adquirido preservado.' : `Faltavam ${(tempoMin - tempoReforma).toFixed(2)} anos em 13/11/2019.`,
    })
  }

  // 2) Regra dos pontos
  {
    const atende = (d) => {
      const t = tempoAnosEm(d), id = idadeEm(nascimento, d)
      return t >= tempoMin && (id + t) >= exigPontos(d.getUTCFullYear(), fem)
    }
    const proj = projetar(atende)
    const exigHoje = exigPontos(hoje.getUTCFullYear(), fem)
    const pontosHoje = idadeHoje + anosContribHoje
    cenarios.push({
      regra: 'Regra de transição — Pontos (idade + tempo)',
      elegivelAgora: proj.jaTem, dataProvavel: proj.data,
      requisitos: [
        { label: 'Tempo de contribuição', exigido: `${tempoMin} anos`, atual: `${anosContribHoje.toFixed(2)} anos`, ok: anosContribHoje >= tempoMin },
        { label: `Pontos (${hoje.getUTCFullYear()})`, exigido: `${exigHoje}`, atual: `${pontosHoje.toFixed(1)}`, ok: pontosHoje >= exigHoje },
      ],
      rmi: rmi(coefBase(proj.data ? tempoAnosEm(proj.data) : anosContribHoje)),
      vantagens: ['Sem redutor por idade', 'Pontuação sobe 1 ponto/ano.'],
      desvantagens: ['RMI = 60% da média + 2%/ano acima do mínimo.'],
      obs: proj.jaTem ? 'Requisitos de pontos já cumpridos.' : proj.data ? `Projeção assume contribuição contínua até ${fmtData(isoOf(proj.data))}.` : 'Não alcançável em 40 anos na projeção.',
    })
  }

  // 3) Idade mínima progressiva
  {
    const atende = (d) => {
      const t = tempoAnosEm(d), id = idadeEm(nascimento, d)
      return t >= tempoMin && id >= idadeProgress(d.getUTCFullYear(), fem)
    }
    const proj = projetar(atende)
    const idExig = idadeProgress(hoje.getUTCFullYear(), fem)
    cenarios.push({
      regra: 'Regra de transição — Idade mínima progressiva',
      elegivelAgora: proj.jaTem, dataProvavel: proj.data,
      requisitos: [
        { label: 'Tempo de contribuição', exigido: `${tempoMin} anos`, atual: `${anosContribHoje.toFixed(2)} anos`, ok: anosContribHoje >= tempoMin },
        { label: `Idade mínima (${hoje.getUTCFullYear()})`, exigido: `${idExig} anos`, atual: `${idadeHoje} anos`, ok: idadeHoje >= idExig },
      ],
      rmi: rmi(coefBase(proj.data ? tempoAnosEm(proj.data) : anosContribHoje)),
      vantagens: ['Idade mínima sobe 6 meses/ano até o teto.'],
      desvantagens: ['RMI = 60% + 2%/ano acima do mínimo.'],
      obs: proj.jaTem ? 'Requisitos já cumpridos.' : proj.data ? `Projeção até ${fmtData(isoOf(proj.data))}.` : 'Não alcançável na projeção.',
    })
  }

  // 4) Pedágio 50%
  {
    const faltavaReforma = tempoMin - (tempoReformaDias / 365)
    const elegivelPedagio = faltavaReforma > 0 && faltavaReforma <= 2
    const pedagio = Math.max(0, faltavaReforma) * 0.5
    const alvo = tempoMin + pedagio
    const atende = (d) => elegivelPedagio && tempoAnosEm(d) >= alvo
    const proj = elegivelPedagio ? projetar(atende) : { data: null, jaTem: false }
    // Benefício = média × fator previdenciário (art. 17 EC 103) na data de aposentadoria
    const dRef = proj.data ?? hoje
    const fpPedagio = elegivelPedagio ? fatorPrevidenciario(idadeEm(nascimento, dRef), tempoAnosEm(dRef), { fem }) : null
    cenarios.push({
      regra: 'Regra de transição — Pedágio de 50%',
      elegivelAgora: proj.jaTem, dataProvavel: proj.data,
      requisitos: [
        { label: 'Faltava ≤ 2 anos em 13/11/2019', exigido: '≤ 2 anos', atual: `${faltavaReforma.toFixed(2)} anos`, ok: elegivelPedagio },
        { label: 'Tempo total (com pedágio)', exigido: `${alvo.toFixed(2)} anos`, atual: `${anosContribHoje.toFixed(2)} anos`, ok: anosContribHoje >= alvo },
      ],
      rmi: elegivelPedagio && fpPedagio ? rmi(fpPedagio) : 0,
      vantagens: ['Permite aposentar cedo para quem estava próximo em 2019.', fpPedagio ? `Fator previdenciário estimado: ${fpPedagio.toFixed(4)}.` : 'Aplica fator previdenciário.'],
      desvantagens: ['Aplica fator previdenciário (pode reduzir a RMI).'],
      obs: elegivelPedagio ? (proj.jaTem ? 'Pedágio já cumprido.' : `Falta cumprir o pedágio (${pedagio.toFixed(2)} anos).`) : 'Não elegível: não estava a ≤ 2 anos do mínimo em 13/11/2019.',
    })
  }

  // 5) Pedágio 100%
  {
    const faltavaReforma = tempoMin - (tempoReformaDias / 365)
    const pedagio = Math.max(0, faltavaReforma)
    const alvoTempo = tempoMin + pedagio
    const idadeMin = fem ? 57 : 60
    const atende = (d) => tempoAnosEm(d) >= alvoTempo && idadeEm(nascimento, d) >= idadeMin
    const proj = projetar(atende)
    cenarios.push({
      regra: 'Regra de transição — Pedágio de 100%',
      elegivelAgora: proj.jaTem, dataProvavel: proj.data,
      requisitos: [
        { label: 'Idade mínima', exigido: `${idadeMin} anos`, atual: `${idadeHoje} anos`, ok: idadeHoje >= idadeMin },
        { label: 'Tempo total (com pedágio)', exigido: `${alvoTempo.toFixed(2)} anos`, atual: `${anosContribHoje.toFixed(2)} anos`, ok: anosContribHoje >= alvoTempo },
      ],
      rmi: rmi(1.0), // 100% da média, sem redutor
      vantagens: ['Benefício = 100% da média (sem redutor).', 'Não aplica fator previdenciário.'],
      desvantagens: ['Exige pagar em dobro o tempo que faltava.'],
      obs: proj.jaTem ? 'Requisitos cumpridos.' : proj.data ? `Projeção até ${fmtData(isoOf(proj.data))}.` : 'Não alcançável na projeção.',
    })
  }

  // 6) Aposentadoria por idade (regra permanente)
  {
    const idadeMin = fem ? 62 : 65
    const atende = (d) => idadeEm(nascimento, d) >= idadeMin && tempoAnosEm(d) >= carenciaMin
    const proj = projetar(atende)
    cenarios.push({
      regra: 'Aposentadoria por idade (regra permanente pós-Reforma)',
      elegivelAgora: proj.jaTem, dataProvavel: proj.data,
      requisitos: [
        { label: 'Idade mínima', exigido: `${idadeMin} anos`, atual: `${idadeHoje} anos`, ok: idadeHoje >= idadeMin },
        { label: 'Tempo mínimo/carência', exigido: `${carenciaMin} anos`, atual: `${anosContribHoje.toFixed(2)} anos`, ok: anosContribHoje >= carenciaMin },
      ],
      rmi: rmi(coefBase(proj.data ? tempoAnosEm(proj.data) : anosContribHoje)),
      vantagens: ['Regra estável, exige menos tempo de contribuição.'],
      desvantagens: ['Exige idade mais alta; RMI 60% + 2%/ano.'],
      obs: proj.jaTem ? 'Requisitos cumpridos.' : proj.data ? `Projeção até ${fmtData(isoOf(proj.data))}.` : 'Não alcançável na projeção.',
    })
  }

  // 7) Aposentadoria especial (se houver tempo especial)
  //    ATENÇÃO: NÃO exige idade mínima — basta o tempo de exposição + carência.
  //    (Sem a regra de pontos/idade que constava na EC 103; parâmetro editável.)
  if (diasEspecial > 0) {
    const graus = vinculos.filter(v => v.atividade === 'especial').map(v => num(v.grau) || 25)
    const grauMin = Math.min(...graus)
    const anosEsp = diasEspecial / 365
    const CARENCIA_ESP = 180
    const tempoOk = anosEsp >= grauMin
    const carenciaOk = carencia >= CARENCIA_ESP
    const ok = tempoOk && carenciaOk
    cenarios.push({
      regra: `Aposentadoria especial (${grauMin} anos de exposição) — sem idade mínima`,
      elegivelAgora: ok, dataProvavel: ok ? hoje : null,
      requisitos: [
        { label: 'Tempo de exposição a agente nocivo', exigido: `${grauMin} anos`, atual: `${anosEsp.toFixed(2)} anos`, ok: tempoOk },
        { label: 'Carência (contribuições)', exigido: `${CARENCIA_ESP}`, atual: `${carencia}`, ok: carenciaOk },
        { label: 'Idade mínima', exigido: 'Não exigida', atual: '—', ok: true },
      ],
      rmi: ok ? rmi(coefEspecial(anosContribHoje)) : 0,
      vantagens: [
        'Tempo reduzido: 15, 20 ou 25 anos conforme o agente nocivo.',
        'SEM idade mínima e SEM regra de pontos — basta o tempo especial + carência (ADI 6.309).',
        'RMI = 60% da média + 2% por ano acima de 15 (EC 103, art. 26, §2, IV c/c §5).',
      ],
      desvantagens: [
        'Exige comprovação da exposição por PPP/LTCAT.',
        'Vedada a continuidade em atividade nociva após a concessão.',
      ],
      obs: ok
        ? '✅ Requisitos cumpridos — concessão sem exigência de idade mínima.'
        : (!tempoOk ? `Faltam ${(grauMin - anosEsp).toFixed(2)} anos de atividade especial.` : `Faltam ${CARENCIA_ESP - carencia} contribuições de carência.`),
    })
  }

  // ── Melhor cenário: elegível mais cedo; entre elegíveis, maior RMI ──
  const comData = cenarios.filter(c => c.dataProvavel)
  let melhor = null
  const elegiveisAgora = comData.filter(c => c.elegivelAgora)
  if (elegiveisAgora.length) {
    melhor = elegiveisAgora.reduce((a, b) => (b.rmi > a.rmi ? b : a))
  } else if (comData.length) {
    melhor = comData.reduce((a, b) => (parse(isoOf(b.dataProvavel)) < parse(isoOf(a.dataProvavel)) ? b : a))
  }

  // situação geral
  let situacao = 'Ainda não pode se aposentar'
  if (elegiveisAgora.length) situacao = 'Já pode se aposentar'
  else if (melhor?.dataProvavel) situacao = `Pode se aposentar a partir de ${fmtData(isoOf(melhor.dataProvavel))}`

  return {
    resumo: {
      nome: segurado.nome, sexo: fem ? 'Feminino' : 'Masculino',
      idade: idadeHoje, nascimento: segurado.nascimento,
      tempoTotalDias: tempoHojeDias, tempoTotalStr: tempoStr(tempoHojeDias),
      tempoDecompos: decompoeTempo(tempoHojeDias),
      tempoReformaStr: tempoStr(tempoReformaDias),
      carencia, media,
      diasComum, diasEspecial, diasRural,
      comumStr: tempoStr(diasComum), especialStr: tempoStr(diasEspecial), ruralStr: tempoStr(diasRural),
      qtdeVinculos: vinculos.length,
    },
    cenarios, melhor, situacao, alertas,
    disclaimer: 'Planejamento ESTIMATIVO gerado automaticamente. Projeções assumem contribuição contínua e parâmetros editáveis. Deve ser validado por advogado(a) previdenciarista antes de qualquer requerimento.',
  }
}

export { fmtData, brl }
