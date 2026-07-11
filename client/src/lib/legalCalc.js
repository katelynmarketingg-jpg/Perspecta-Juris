// ─────────────────────────────────────────────────────────────────────────
//  Perspecta Juris — Motor de Cálculos Jurídicos
//  Todos os resultados são ESTIMATIVOS e devem ser conferidos por
//  profissional habilitado. Índices e parâmetros são editáveis.
// ─────────────────────────────────────────────────────────────────────────

// ── Parâmetros atualizáveis (edite conforme a legislação vigente) ──────────
export const PARAMS = {
  salarioMinimo: 1621.00,      // 2026 (Portaria Interministerial MPS/MF nº 13/2026)
  tetoINSS: 8475.55,           // 2026 (Portaria Interministerial MPS/MF nº 13/2026)
  reformaData: '2019-11-13',   // EC 103/2019
}

// Parâmetros previdenciários salvos pelo admin (atualização anual assistida)
const PREV_KEY = 'pj_prev_params'
export function getPrevParams() {
  try { return JSON.parse(localStorage.getItem(PREV_KEY) ?? 'null') } catch { return null }
}
export function salvarPrevParams(patch) {
  const cur = getPrevParams() ?? {}
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() }
  try { localStorage.setItem(PREV_KEY, JSON.stringify(next)) } catch {}
  _aplicarPrevOverrides()
  return next
}
export function limparPrevParams() {
  try { localStorage.removeItem(PREV_KEY) } catch {}
  _aplicarPrevOverrides()
}
// Metadados dos parâmetros (para painel e lembrete anual)
export function paramsInfo() {
  const o = getPrevParams()
  return {
    ano: o?.ano ?? 2024,                    // ano de referência da tábua/índices
    updatedAt: o?.updatedAt ?? null,
    salarioMinimo: PARAMS.salarioMinimo,
    tetoINSS: PARAMS.tetoINSS,
    inpcAno: o?.inpcAno ?? null,
    personalizado: !!o,
  }
}
// true se os parâmetros são de um ano anterior ao atual (sugere atualização)
export function parametrosDesatualizados() {
  return paramsInfo().ano < new Date().getFullYear()
}

// ── Helpers de formatação e parsing ───────────────────────────────────────
export const brl = (n) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const num = (v) => {
  if (typeof v === 'number') return v
  if (v == null || v === '') return 0
  let s = String(v).trim().replace(/[^\d.,-]/g, '')
  if (s.includes(',')) {
    // Formato pt-BR: pontos = milhar, vírgula = decimal (1.234,56)
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = (s.match(/\./g) || []).length
    if (dots > 1) {
      s = s.replace(/\./g, '')                       // 1.234.567 = milhar
    } else if (dots === 1) {
      const after = s.split('.')[1] ?? ''
      if (after.length === 3) s = s.replace('.', '')  // 1.500 = milhar (3 casas)
      // caso contrário mantém como decimal: 0.16, 1.4, 0.1667
    }
  }
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}
export const pct = (v) => num(v) / 100

// ── Fator previdenciário (Lei 8.213/91, art. 29, §7-§9 + Anexo) ─────────────
// FP = (Tc × a / Es) × [1 + (Id + Tc × a) / 100],  a = 0,31
// Es = expectativa de sobrevida na idade (tábua IBGE, média única ambos os sexos).
// Tábua Completa de Mortalidade IBGE 2024 — Ambos os Sexos (oficial).
// E(X) = expectativa de sobrevida (anos) à idade X. Média nacional única (Lei 8.213, art. 29, §8).
const TABUA_DEFAULT = {
  45:35.3,46:34.4,47:33.5,48:32.6,49:31.8, 50:30.9,51:30.0,52:29.2,53:28.3,54:27.5,
  55:26.6,56:25.8,57:25.0,58:24.2,59:23.4, 60:22.6,61:21.8,62:21.0,63:20.3,64:19.5,
  65:18.8,66:18.0,67:17.3,68:16.6,69:15.9, 70:15.2,71:14.6,72:13.9,73:13.2,74:12.5,
  75:11.9,76:11.3,77:10.7,78:10.1,79:9.5,  80:9.0,81:8.5,82:8.0,83:7.5,84:7.1,
  85:6.6,86:6.3,87:5.9,88:5.6,89:5.3,90:5.0,
}
export let TABUA_IBGE = { ...TABUA_DEFAULT }
function esIBGE(idade) {
  const keys = Object.keys(TABUA_IBGE).map(Number)
  const min = keys[0], max = keys[keys.length - 1]
  if (idade <= min) return TABUA_IBGE[min]
  if (idade >= max) return TABUA_IBGE[max]
  const i = Math.floor(idade), frac = idade - i
  const a = TABUA_IBGE[i] ?? TABUA_IBGE[min], b = TABUA_IBGE[i + 1] ?? a
  return a + frac * (b - a)
}
export function fatorPrevidenciario(idade, tc, { fem = false, professor = false } = {}) {
  const a = 0.31
  const bonus = professor ? (fem ? 10 : 5) : (fem ? 5 : 0)   // art. 29, §9
  const tcAj = num(tc) + bonus
  const es = esIBGE(num(idade))
  if (!es || tcAj <= 0) return null
  return (tcAj * a / es) * (1 + (num(idade) + tcAj * a) / 100)
}

// ── Correção dos salários pela INPC (Lei 8.213/91, art. 29-B) ───────────────
// Fatores acumulados aproximados (de julho de cada ano até o presente).
// APROXIMADOS/EDITÁVEIS — para cálculo exato, use a tabela oficial do INSS.
// Fatores INPC calculados da série oficial do IBGE (número-índice, apisidra t/1736 v/2289).
// Referência: junho/2026. Fator = índice atual / índice de julho do ano.
const INPC_DEFAULT = {
  1994:8.4647,1995:6.6735,1996:5.8098,1997:5.5409,1998:5.3244,1999:5.1118,2000:4.8106,2001:4.4642,
  2002:4.0926,2003:3.4589,2004:3.2538,2005:3.083,2006:2.9969,2007:2.8764,2008:2.6744,2009:2.5575,
  2010:2.4487,2011:2.2913,2012:2.1748,2013:2.0444,2014:1.9227,2015:1.751,2016:1.5982,2017:1.5657,
  2018:1.5111,2019:1.4648,2020:1.4264,2021:1.2985,2022:1.1791,2023:1.1389,2024:1.0945,2025:1.0411,2026:1.0311,
}
export let INPC_FATOR = { ...INPC_DEFAULT }
export function corrigirINPC(valor, ano) {
  const y = Number(ano)
  const f = INPC_FATOR[y] ?? (y < 1994 ? INPC_FATOR[1994] : 1)
  return num(valor) * f
}

// Aplica os overrides salvos pelo admin sobre PARAMS/TABUA/INPC.
function _aplicarPrevOverrides() {
  const o = getPrevParams()
  TABUA_IBGE = { ...TABUA_DEFAULT }
  INPC_FATOR = { ...INPC_DEFAULT }
  PARAMS.salarioMinimo = 1621.00
  PARAMS.tetoINSS = 8475.55
  if (!o) return
  if (o.salarioMinimo) PARAMS.salarioMinimo = Number(o.salarioMinimo)
  if (o.tetoINSS) PARAMS.tetoINSS = Number(o.tetoINSS)
  if (o.tabua && Object.keys(o.tabua).length) TABUA_IBGE = { ...TABUA_DEFAULT, ...o.tabua }
  if (o.inpc && Object.keys(o.inpc).length) INPC_FATOR = { ...INPC_DEFAULT, ...o.inpc }
}
if (typeof localStorage !== 'undefined') { try { _aplicarPrevOverrides() } catch {} }

const two = (n) => String(n).padStart(2, '0')

// meses inteiros entre duas datas ISO (yyyy-mm-dd)
export function mesesEntre(d1, d2) {
  if (!d1 || !d2) return 0
  const a = new Date(d1), b = new Date(d2)
  if (isNaN(a) || isNaN(b)) return 0
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) m -= 0 // meses de calendário; ajuste fino opcional
  return Math.max(0, m)
}

// dias entre datas
export function diasEntre(d1, d2) {
  if (!d1 || !d2) return 0
  const a = new Date(d1), b = new Date(d2)
  if (isNaN(a) || isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

// converte total de dias em {anos, meses, dias} (padrão previdenciário: ano=365, mês=30)
export function decompoeTempo(dias) {
  const anos = Math.floor(dias / 365)
  const resto = dias - anos * 365
  const meses = Math.floor(resto / 30)
  const d = resto - meses * 30
  return { anos, meses, dias: d }
}
export const tempoStr = (dias) => {
  const t = decompoeTempo(dias)
  return `${t.anos} ano(s), ${t.meses} mês(es) e ${t.dias} dia(s)`
}
export const tempoDecimal = (dias) => dias / 365 // anos com fração

export const fmtData = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}

// ── Índices de correção (fatores acumulados de REFERÊNCIA – edite/confira) ──
// Estes fatores são estimativos. O usuário pode sempre informar a taxa
// acumulada manualmente no campo correspondente.
export const INDICES = [
  { value: 'manual',  label: 'Informar taxa acumulada manualmente' },
  { value: 'ipca',    label: 'IPCA (IBGE)' },
  { value: 'ipca-e',  label: 'IPCA-E (IBGE)' },
  { value: 'inpc',    label: 'INPC (IBGE)' },
  { value: 'igpm',    label: 'IGP-M (FGV)' },
  { value: 'tr',      label: 'TR (Taxa Referencial)' },
  { value: 'selic',   label: 'SELIC (acumulada — já engloba juros)' },
  { value: 'poupanca',label: 'Poupança' },
  { value: 'tjsp',    label: 'Tabela Prática TJSP' },
  { value: 'jf',      label: 'Manual de Cálculos da Justiça Federal' },
]

// ── Catálogo de ramos ──────────────────────────────────────────────────────
export const RAMOS = [
  { value: 'civel',         label: 'Cível',          color: '#3b82f6', icon: '⚖️' },
  { value: 'trabalhista',   label: 'Trabalhista',    color: '#f59e0b', icon: '👷' },
  { value: 'previdenciario',label: 'Previdenciário', color: '#10b981', icon: '👵' },
  { value: 'tributario',    label: 'Tributário',     color: '#ef4444', icon: '🏛️' },
  { value: 'familia',       label: 'Família',        color: '#ec4899', icon: '👨‍👩‍👧' },
  { value: 'sucessorio',    label: 'Sucessório',     color: '#8b5cf6', icon: '📜' },
  { value: 'penal',         label: 'Penal',          color: '#6b7280', icon: '⛓️' },
  { value: 'consumidor',    label: 'Consumidor',     color: '#06b6d4', icon: '🛒' },
  { value: 'imobiliario',   label: 'Imobiliário',    color: '#84cc16', icon: '🏠' },
  { value: 'bancario',      label: 'Bancário',       color: '#f97316', icon: '🏦' },
  { value: 'empresarial',   label: 'Empresarial',    color: '#14b8a6', icon: '🏢' },
  { value: 'administrativo',label: 'Administrativo', color: '#64748b', icon: '📋' },
  { value: 'honorarios',    label: 'Honorários',     color: '#a855f7', icon: '💼' },
  { value: 'processual',    label: 'Processual',     color: '#0ea5e9', icon: '📁' },
]

const DISCLAIMER = 'Resultado ESTIMATIVO. Confira índices, marcos e critérios com a decisão/contrato aplicável. Deve ser validado por profissional habilitado.'

// ── Utilitário para bloco de correção + juros + multa + honorários + custas ─
function blocoAtualizacao(v) {
  const principal = num(v.valor)
  const meses = v.dataInicial && v.dataFinal ? mesesEntre(v.dataInicial, v.dataFinal) : num(v.meses)
  const taxaCorr = pct(v.taxaAcumulada)                    // correção acumulada %
  const correcao = principal * taxaCorr
  const corrigido = principal + correcao

  const jurosMensal = pct(v.jurosMes)
  const composto = v.jurosTipo === 'composto'
  let juros = 0
  if (v.indice === 'selic') {
    juros = 0 // SELIC já engloba juros
  } else if (composto) {
    juros = corrigido * (Math.pow(1 + jurosMensal, meses) - 1)
  } else {
    juros = corrigido * jurosMensal * meses
  }
  const comJuros = corrigido + juros

  const multa = comJuros * pct(v.multa)
  const base = comJuros + multa
  const honor = base * pct(v.honorarios)
  const custas = num(v.custas)
  const pagamentos = num(v.pagamentos)
  const total = base + honor + custas - pagamentos

  const linhas = [
    { label: 'Valor principal', value: brl(principal) },
    { label: `Correção monetária (${(taxaCorr * 100).toFixed(2)}%)`, value: brl(correcao) },
    { label: `Juros ${composto ? 'compostos' : 'simples'} (${(jurosMensal * 100).toFixed(2)}% × ${meses}m)`, value: brl(juros) },
  ]
  if (multa)  linhas.push({ label: `Multa (${(pct(v.multa) * 100).toFixed(2)}%)`, value: brl(multa) })
  if (honor)  linhas.push({ label: `Honorários (${(pct(v.honorarios) * 100).toFixed(2)}%)`, value: brl(honor) })
  if (custas) linhas.push({ label: 'Custas', value: brl(custas) })
  if (pagamentos) linhas.push({ label: 'Pagamentos/descontos', value: '- ' + brl(pagamentos) })

  const memoria = [
    `Principal: ${brl(principal)}`,
    v.indice === 'selic'
      ? `SELIC acumulada ${(taxaCorr * 100).toFixed(2)}% → correção = ${brl(principal)} × ${(taxaCorr * 100).toFixed(2)}% = ${brl(correcao)} (SELIC engloba juros)`
      : `Correção: ${brl(principal)} × ${(taxaCorr * 100).toFixed(2)}% = ${brl(correcao)} → corrigido = ${brl(corrigido)}`,
    v.indice === 'selic' ? '' :
      composto
        ? `Juros compostos: ${brl(corrigido)} × [(1+${(jurosMensal * 100).toFixed(2)}%)^${meses} − 1] = ${brl(juros)}`
        : `Juros simples: ${brl(corrigido)} × ${(jurosMensal * 100).toFixed(2)}% × ${meses} meses = ${brl(juros)}`,
    multa ? `Multa: ${brl(comJuros)} × ${(pct(v.multa) * 100).toFixed(2)}% = ${brl(multa)}` : '',
    honor ? `Honorários: ${brl(base)} × ${(pct(v.honorarios) * 100).toFixed(2)}% = ${brl(honor)}` : '',
    custas ? `Custas: ${brl(custas)}` : '',
    pagamentos ? `Descontos/pagamentos: − ${brl(pagamentos)}` : '',
    `TOTAL = ${brl(total)}`,
  ].filter(Boolean)

  const criterios = [
    `Índice: ${INDICES.find(i => i.value === v.indice)?.label ?? v.indice ?? '—'}`,
    `Período: ${v.dataInicial ? fmtData(v.dataInicial) : '—'} a ${v.dataFinal ? fmtData(v.dataFinal) : '—'} (${meses} meses)`,
    `Juros: ${(jurosMensal * 100).toFixed(2)}% a.m. (${composto ? 'compostos' : 'simples'})`,
  ]
  return { headline: { label: 'Valor total atualizado', value: brl(total) }, linhas, memoria, criterios }
}

// campos reutilizáveis do bloco de atualização
const camposAtualizacao = [
  { name: 'valor', label: 'Valor original', type: 'currency', required: true },
  { name: 'dataInicial', label: 'Data inicial (termo a quo)', type: 'date' },
  { name: 'dataFinal', label: 'Data final (atualização)', type: 'date' },
  { name: 'indice', label: 'Índice de correção', type: 'select', options: INDICES, default: 'ipca-e' },
  { name: 'taxaAcumulada', label: 'Índice acumulado no período (%)', type: 'percent', help: 'Ex.: soma dos índices do período. Consulte a tabela oficial.' },
  { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
  { name: 'jurosTipo', label: 'Tipo de juros', type: 'select', options: [{ value: 'simples', label: 'Simples' }, { value: 'composto', label: 'Compostos' }], default: 'simples' },
  { name: 'multa', label: 'Multa (%)', type: 'percent' },
  { name: 'honorarios', label: 'Honorários (%)', type: 'percent' },
  { name: 'custas', label: 'Custas (R$)', type: 'currency' },
  { name: 'pagamentos', label: 'Pagamentos parciais (R$)', type: 'currency' },
]

// ════════════════════════════════════════════════════════════════════════════
//  CATÁLOGO DE CALCULADORAS
// ════════════════════════════════════════════════════════════════════════════
export const CALCULADORAS = [

  // ─────────────────────────── CÍVEL ───────────────────────────
  {
    id: 'atualizacao-divida', ramo: 'civel', titulo: 'Atualização monetária de dívida',
    descricao: 'Corrige um valor por índice + juros + multa + honorários + custas, abatendo pagamentos.',
    casos: 'Cobrança, indenização, contratos, execução e cumprimento de sentença.',
    baseLegal: 'Correção: índice oficial. Juros de mora: art. 406 CC / Súmula 54 STJ. Honorários: art. 85 CPC.',
    campos: camposAtualizacao,
    compute: blocoAtualizacao,
  },
  {
    id: 'juros-moratorios', ramo: 'civel', titulo: 'Juros moratórios',
    descricao: 'Calcula juros de mora simples ou compostos sobre um valor atualizado.',
    casos: 'Atraso no pagamento de obrigação contratual ou judicial.',
    baseLegal: 'Art. 406 CC (mora); 1% a.m. na ausência de estipulação. Capitalização: exige previsão.',
    campos: [
      { name: 'valor', label: 'Valor atualizado', type: 'currency', required: true },
      { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
      { name: 'meses', label: 'Nº de meses em atraso', type: 'number', required: true },
      { name: 'jurosTipo', label: 'Tipo', type: 'select', options: [{ value: 'simples', label: 'Simples' }, { value: 'composto', label: 'Compostos' }], default: 'simples' },
    ],
    compute: (v) => {
      const base = num(v.valor), i = pct(v.jurosMes), m = num(v.meses)
      const composto = v.jurosTipo === 'composto'
      const juros = composto ? base * (Math.pow(1 + i, m) - 1) : base * i * m
      const total = base + juros
      return {
        headline: { label: 'Total com juros', value: brl(total) },
        linhas: [{ label: 'Valor base', value: brl(base) }, { label: 'Juros', value: brl(juros) }],
        memoria: [
          composto
            ? `Juros compostos = ${brl(base)} × [(1+${(i*100).toFixed(2)}%)^${m} − 1] = ${brl(juros)}`
            : `Juros simples = ${brl(base)} × ${(i*100).toFixed(2)}% × ${m} = ${brl(juros)}`,
          `Total = ${brl(total)}`,
        ],
        criterios: [`Taxa: ${(i*100).toFixed(2)}% a.m.`, `Período: ${m} meses`, `Regime: ${composto ? 'composto' : 'simples'}`],
      }
    },
  },
  {
    id: 'multa-contratual', ramo: 'civel', titulo: 'Multa contratual',
    descricao: 'Aplica o percentual de multa sobre o valor-base do contrato.',
    casos: 'Descumprimento contratual (cláusula penal).',
    baseLegal: 'Arts. 408-416 CC. Cláusula penal não pode exceder a obrigação principal (art. 412).',
    campos: [
      { name: 'valor', label: 'Valor-base do contrato', type: 'currency', required: true },
      { name: 'multa', label: 'Percentual da multa (%)', type: 'percent', default: '10', required: true },
    ],
    compute: (v) => {
      const base = num(v.valor), p = pct(v.multa), multa = base * p
      return {
        headline: { label: 'Valor da multa', value: brl(multa) },
        linhas: [{ label: 'Valor-base', value: brl(base) }, { label: `Multa (${(p*100).toFixed(2)}%)`, value: brl(multa) }],
        memoria: [`Multa = ${brl(base)} × ${(p*100).toFixed(2)}% = ${brl(multa)}`],
        criterios: [`Percentual: ${(p*100).toFixed(2)}%`],
      }
    },
  },
  {
    id: 'honorarios-sucumbenciais', ramo: 'civel', titulo: 'Honorários sucumbenciais',
    descricao: 'Aplica o percentual fixado sobre a base de cálculo (condenação/proveito).',
    casos: 'Sentenças e cumprimento de sentença.',
    baseLegal: 'Art. 85, §2º CPC — entre 10% e 20% sobre condenação, proveito ou valor da causa.',
    campos: [
      { name: 'base', label: 'Base de cálculo (condenação/proveito)', type: 'currency', required: true },
      { name: 'perc', label: 'Percentual fixado (%)', type: 'percent', default: '10', required: true },
    ],
    compute: (v) => {
      const base = num(v.base), p = pct(v.perc), h = base * p
      const aviso = (p < 0.10 || p > 0.20) ? ['⚠️ Fora da faixa usual de 10%–20% (art. 85, §2º CPC).'] : []
      return {
        headline: { label: 'Honorários', value: brl(h) },
        linhas: [{ label: 'Base de cálculo', value: brl(base) }, { label: `Honorários (${(p*100).toFixed(2)}%)`, value: brl(h) }],
        memoria: [`Honorários = ${brl(base)} × ${(p*100).toFixed(2)}% = ${brl(h)}`, ...aviso],
        criterios: [`Percentual: ${(p*100).toFixed(2)}%`],
      }
    },
  },
  {
    id: 'cumprimento-sentenca', ramo: 'civel', titulo: 'Cumprimento de sentença',
    descricao: 'Principal atualizado + juros + multa + honorários + custas − pagamentos.',
    casos: 'Apuração do valor devido após decisão judicial transitada.',
    baseLegal: 'Art. 523 CPC — multa de 10% e honorários de 10% no não pagamento em 15 dias.',
    campos: camposAtualizacao,
    compute: blocoAtualizacao,
  },

  // ─────────────────────── TRABALHISTA ───────────────────────
  {
    id: 'verbas-rescisorias', ramo: 'trabalhista', titulo: 'Verbas rescisórias',
    descricao: 'Cálculo completo do acerto: saldo, aviso, férias, 13º, FGTS e multa.',
    casos: 'Demissão sem justa causa, pedido de demissão, rescisão indireta, término de contrato.',
    baseLegal: 'CLT arts. 477, 487, 142, 146; Constituição art. 7º; Lei 8.036/90 (FGTS).',
    campos: [
      { name: 'salario', label: 'Último salário mensal', type: 'currency', required: true },
      { name: 'admissao', label: 'Data de admissão', type: 'date', required: true },
      { name: 'saida', label: 'Data de saída', type: 'date', required: true },
      { name: 'motivo', label: 'Motivo', type: 'select', default: 'sem_justa', options: [
        { value: 'sem_justa', label: 'Dispensa sem justa causa' },
        { value: 'pedido', label: 'Pedido de demissão' },
        { value: 'justa', label: 'Dispensa por justa causa' },
        { value: 'indireta', label: 'Rescisão indireta' },
      ]},
      { name: 'diasTrabMes', label: 'Dias trabalhados no mês da saída', type: 'number', default: '30' },
      { name: 'feriasVencidas', label: 'Tem férias vencidas?', type: 'select', default: 'nao', options: [{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }] },
      { name: 'fgtsDepositado', label: 'FGTS já depositado (saldo)', type: 'currency', help: 'Para cálculo da multa de 40%.' },
    ],
    compute: (v) => {
      const sal = num(v.salario)
      const admissao = new Date(v.admissao), saida = new Date(v.saida)
      const anosCompletos = Math.max(0, Math.floor(diasEntre(v.admissao, v.saida) / 365))
      const mesesTrabAno = Math.min(12, saida.getUTCMonth() + (saida.getUTCDate() >= 15 ? 1 : 0)) // meses no ano p/ 13º e férias prop.
      const motivo = v.motivo
      const temAviso = motivo === 'sem_justa' || motivo === 'indireta'
      const temMulta = motivo === 'sem_justa' || motivo === 'indireta'
      const dias = num(v.diasTrabMes) || 30

      const linhas = [], memoria = []
      // Saldo de salário
      const saldo = sal / 30 * dias
      linhas.push({ label: `Saldo de salário (${dias} dias)`, value: brl(saldo) })
      memoria.push(`Saldo de salário = ${brl(sal)} ÷ 30 × ${dias} = ${brl(saldo)}`)

      // Aviso prévio
      let aviso = 0
      if (temAviso) {
        const diasAviso = Math.min(90, 30 + anosCompletos * 3)
        aviso = sal / 30 * diasAviso
        linhas.push({ label: `Aviso-prévio indenizado (${diasAviso} dias)`, value: brl(aviso) })
        memoria.push(`Aviso-prévio = 30 + ${anosCompletos}×3 = ${diasAviso} dias → ${brl(sal)} ÷ 30 × ${diasAviso} = ${brl(aviso)}`)
      }

      // 13º proporcional
      const meses13 = mesesTrabAno
      const decimo = motivo === 'justa' ? 0 : sal / 12 * meses13
      if (decimo) { linhas.push({ label: `13º proporcional (${meses13}/12)`, value: brl(decimo) }); memoria.push(`13º proporcional = ${brl(sal)} ÷ 12 × ${meses13} = ${brl(decimo)}`) }

      // Férias proporcionais + 1/3
      const fp = motivo === 'justa' ? 0 : (sal / 12 * meses13)
      const fpTerco = fp / 3
      if (fp) { linhas.push({ label: `Férias proporcionais + 1/3 (${meses13}/12)`, value: brl(fp + fpTerco) }); memoria.push(`Férias prop. = ${brl(sal)} ÷ 12 × ${meses13} = ${brl(fp)}; +1/3 = ${brl(fpTerco)}`) }

      // Férias vencidas + 1/3
      let fv = 0
      if (v.feriasVencidas === 'sim') { fv = sal + sal / 3; linhas.push({ label: 'Férias vencidas + 1/3', value: brl(fv) }); memoria.push(`Férias vencidas = ${brl(sal)} + 1/3 = ${brl(fv)}`) }

      // Multa 40% FGTS
      let multa = 0
      if (temMulta) { multa = num(v.fgtsDepositado) * 0.40; linhas.push({ label: 'Multa 40% do FGTS', value: brl(multa) }); memoria.push(`Multa FGTS = ${brl(num(v.fgtsDepositado))} × 40% = ${brl(multa)}`) }

      const total = saldo + aviso + decimo + fp + fpTerco + fv + multa
      memoria.push(`TOTAL BRUTO = ${brl(total)}`)
      if (motivo === 'justa') memoria.push('Justa causa: sem aviso, 13º/férias proporcionais e multa.')
      if (motivo === 'pedido') memoria.push('Pedido de demissão: sem aviso indenizado (pode ser descontado) e sem multa de 40%.')

      return {
        headline: { label: 'Total rescisório (bruto)', value: brl(total) },
        linhas, memoria,
        criterios: [`Motivo: ${{sem_justa:'Sem justa causa',pedido:'Pedido de demissão',justa:'Justa causa',indireta:'Rescisão indireta'}[motivo]}`, `Tempo: ${anosCompletos} ano(s) completos`, 'Não inclui INSS/IRRF nem horas extras/adicionais.'],
      }
    },
  },
  {
    id: 'saldo-salario', ramo: 'trabalhista', titulo: 'Saldo de salário',
    descricao: 'Salário ÷ 30 × dias trabalhados no mês.', casos: 'Rescisão em qualquer modalidade.',
    baseLegal: 'CLT art. 457 e ss.',
    campos: [{ name: 'salario', label: 'Salário mensal', type: 'currency', required: true }, { name: 'dias', label: 'Dias trabalhados', type: 'number', default: '30', required: true }],
    compute: (v) => { const r = num(v.salario)/30*num(v.dias); return { headline: { label: 'Saldo de salário', value: brl(r) }, linhas: [{label:'Saldo', value: brl(r)}], memoria: [`${brl(num(v.salario))} ÷ 30 × ${num(v.dias)} = ${brl(r)}`], criterios: [] } },
  },
  {
    id: 'aviso-previo', ramo: 'trabalhista', titulo: 'Aviso-prévio proporcional',
    descricao: '30 dias + 3 dias por ano completo (máx. 90 dias).', casos: 'Dispensa sem justa causa / rescisão indireta.',
    baseLegal: 'Lei 12.506/2011.',
    campos: [{ name: 'salario', label: 'Salário mensal', type: 'currency', required: true }, { name: 'anos', label: 'Anos completos de serviço', type: 'number', default: '0', required: true }],
    compute: (v) => { const d = Math.min(90, 30 + num(v.anos)*3); const r = num(v.salario)/30*d; return { headline: { label: `Aviso-prévio (${d} dias)`, value: brl(r) }, linhas: [{label:`${d} dias`, value: brl(r)}], memoria: [`Dias = 30 + ${num(v.anos)}×3 = ${d} (máx. 90)`, `Valor = ${brl(num(v.salario))} ÷ 30 × ${d} = ${brl(r)}`], criterios: [`${d} dias de aviso`] } },
  },
  {
    id: 'decimo-terceiro', ramo: 'trabalhista', titulo: '13º salário proporcional',
    descricao: 'Salário ÷ 12 × meses trabalhados.', casos: 'Rescisão e pagamento anual.',
    baseLegal: 'Lei 4.090/62. Frações ≥ 15 dias contam mês inteiro.',
    campos: [{ name: 'salario', label: 'Salário mensal', type: 'currency', required: true }, { name: 'meses', label: 'Meses trabalhados no ano', type: 'number', default: '12', required: true }],
    compute: (v) => { const r = num(v.salario)/12*num(v.meses); return { headline: { label: '13º proporcional', value: brl(r) }, linhas: [{label:'13º', value: brl(r)}], memoria: [`${brl(num(v.salario))} ÷ 12 × ${num(v.meses)} = ${brl(r)}`], criterios: [`${num(v.meses)}/12 avos`] } },
  },
  {
    id: 'ferias-prop', ramo: 'trabalhista', titulo: 'Férias proporcionais + 1/3',
    descricao: '(Salário ÷ 12 × meses) + 1/3 constitucional.', casos: 'Rescisão.',
    baseLegal: 'CLT art. 146; CF art. 7º, XVII.',
    campos: [{ name: 'salario', label: 'Salário mensal', type: 'currency', required: true }, { name: 'meses', label: 'Meses do período aquisitivo', type: 'number', default: '12', required: true }],
    compute: (v) => { const f = num(v.salario)/12*num(v.meses); const t = f/3; return { headline: { label: 'Férias prop. + 1/3', value: brl(f+t) }, linhas: [{label:'Férias', value: brl(f)}, {label:'1/3', value: brl(t)}], memoria: [`Férias = ${brl(num(v.salario))} ÷ 12 × ${num(v.meses)} = ${brl(f)}`, `1/3 = ${brl(t)}`, `Total = ${brl(f+t)}`], criterios: [] } },
  },
  {
    id: 'ferias-vencidas', ramo: 'trabalhista', titulo: 'Férias vencidas + 1/3',
    descricao: 'Salário + 1/3 (período já adquirido não gozado).', casos: 'Férias vencidas na rescisão.',
    baseLegal: 'CLT art. 137 (dobra se ultrapassado o período concessivo).',
    campos: [{ name: 'salario', label: 'Salário mensal', type: 'currency', required: true }, { name: 'dobra', label: 'Em dobro (período concessivo vencido)?', type: 'select', default: 'nao', options: [{value:'nao',label:'Não'},{value:'sim',label:'Sim'}] }],
    compute: (v) => { const base = num(v.salario)+num(v.salario)/3; const r = v.dobra==='sim'? base*2 : base; return { headline: { label: 'Férias vencidas', value: brl(r) }, linhas: [{label:'Férias + 1/3', value: brl(base)}, ...(v.dobra==='sim'?[{label:'Em dobro', value: brl(r)}]:[])], memoria: [`Férias + 1/3 = ${brl(num(v.salario))} + 1/3 = ${brl(base)}`, ...(v.dobra==='sim'?[`Em dobro (art. 137 CLT) = ${brl(r)}`]:[])], criterios: [] } },
  },
  {
    id: 'fgts', ramo: 'trabalhista', titulo: 'FGTS mensal + Multa 40%',
    descricao: '8% da remuneração; multa de 40% sobre o total depositado.', casos: 'Depósito mensal e rescisão sem justa causa.',
    baseLegal: 'Lei 8.036/90; art. 18, §1º.',
    campos: [{ name: 'remuneracao', label: 'Remuneração mensal', type: 'currency', required: true }, { name: 'meses', label: 'Meses de vínculo', type: 'number', default: '12' }, { name: 'saldoFgts', label: 'Saldo total do FGTS (p/ multa)', type: 'currency' }],
    compute: (v) => { const dep = num(v.remuneracao)*0.08; const acum = dep*num(v.meses); const multa = num(v.saldoFgts)*0.40; return { headline: { label: 'FGTS + multa 40%', value: brl(acum+multa) }, linhas: [{label:`Depósito mensal (8%)`, value: brl(dep)}, {label:`Acumulado (${num(v.meses)}m)`, value: brl(acum)}, ...(multa?[{label:'Multa 40%', value: brl(multa)}]:[])], memoria: [`Depósito = ${brl(num(v.remuneracao))} × 8% = ${brl(dep)}`, `Acumulado = ${brl(dep)} × ${num(v.meses)} = ${brl(acum)}`, ...(multa?[`Multa = ${brl(num(v.saldoFgts))} × 40% = ${brl(multa)}`]:[])], criterios: [] } },
  },
  {
    id: 'horas-extras', ramo: 'trabalhista', titulo: 'Horas extras',
    descricao: '(Salário ÷ divisor) × (1 + adicional) × qtde de horas.', casos: 'Jornada extraordinária.',
    baseLegal: 'CF art. 7º, XVI (mín. 50%); CLT art. 59.',
    campos: [
      { name: 'salario', label: 'Salário mensal', type: 'currency', required: true },
      { name: 'divisor', label: 'Divisor mensal', type: 'number', default: '220', help: '220 (44h/sem), 200, 180…' },
      { name: 'adicional', label: 'Adicional (%)', type: 'percent', default: '50' },
      { name: 'qtde', label: 'Quantidade de horas', type: 'number', required: true },
    ],
    compute: (v) => { const hn = num(v.salario)/num(v.divisor); const he = hn*(1+pct(v.adicional)); const total = he*num(v.qtde); return { headline: { label: 'Total de horas extras', value: brl(total) }, linhas: [{label:'Hora normal', value: brl(hn)}, {label:`Hora extra (+${(pct(v.adicional)*100).toFixed(0)}%)`, value: brl(he)}, {label:`${num(v.qtde)} horas`, value: brl(total)}], memoria: [`Hora normal = ${brl(num(v.salario))} ÷ ${num(v.divisor)} = ${brl(hn)}`, `Hora extra = ${brl(hn)} × ${(1+pct(v.adicional)).toFixed(2)} = ${brl(he)}`, `Total = ${brl(he)} × ${num(v.qtde)} = ${brl(total)}`], criterios: [`Adicional: ${(pct(v.adicional)*100).toFixed(0)}%`, `Divisor: ${num(v.divisor)}`] } },
  },
  {
    id: 'adicional-noturno', ramo: 'trabalhista', titulo: 'Adicional noturno',
    descricao: 'Hora normal × adicional noturno × horas noturnas.', casos: 'Trabalho entre 22h e 5h (urbano).',
    baseLegal: 'CF art. 7º, IX; CLT art. 73 (adicional mín. 20%, hora reduzida de 52m30s).',
    campos: [
      { name: 'salario', label: 'Salário mensal', type: 'currency', required: true },
      { name: 'divisor', label: 'Divisor mensal', type: 'number', default: '220' },
      { name: 'adicional', label: 'Adicional noturno (%)', type: 'percent', default: '20' },
      { name: 'horas', label: 'Horas noturnas', type: 'number', required: true },
    ],
    compute: (v) => { const hn = num(v.salario)/num(v.divisor); const ad = hn*pct(v.adicional); const total = (hn+ad)*num(v.horas); return { headline: { label: 'Adicional noturno', value: brl(ad*num(v.horas)) }, linhas: [{label:'Hora normal', value: brl(hn)}, {label:`Adicional (${(pct(v.adicional)*100).toFixed(0)}%/h)`, value: brl(ad)}, {label:`Total c/ adicional (${num(v.horas)}h)`, value: brl(total)}], memoria: [`Hora normal = ${brl(num(v.salario))} ÷ ${num(v.divisor)} = ${brl(hn)}`, `Adicional/h = ${brl(hn)} × ${(pct(v.adicional)*100).toFixed(0)}% = ${brl(ad)}`, `Adicional total = ${brl(ad)} × ${num(v.horas)} = ${brl(ad*num(v.horas))}`], criterios: [`Adicional: ${(pct(v.adicional)*100).toFixed(0)}%`] } },
  },
  {
    id: 'insalubridade', ramo: 'trabalhista', titulo: 'Adicional de insalubridade',
    descricao: 'Base × 10%, 20% ou 40% conforme o grau.', casos: 'Exposição a agentes insalubres (NR-15).',
    baseLegal: 'CLT art. 192. Base: salário mínimo, salvo norma coletiva/decisão diversa (Súm. Vinc. 4 STF).',
    campos: [
      { name: 'base', label: 'Base de cálculo', type: 'currency', default: String(PARAMS.salarioMinimo), help: 'Padrão: salário mínimo vigente.' },
      { name: 'grau', label: 'Grau', type: 'select', default: '20', options: [{value:'10',label:'Mínimo (10%)'},{value:'20',label:'Médio (20%)'},{value:'40',label:'Máximo (40%)'}] },
    ],
    compute: (v) => { const r = num(v.base)*pct(v.grau); return { headline: { label: 'Adicional de insalubridade', value: brl(r) }, linhas: [{label:`Insalubridade (${v.grau}%)`, value: brl(r)}], memoria: [`${brl(num(v.base))} × ${v.grau}% = ${brl(r)}`], criterios: [`Grau: ${v.grau}%`, `Base: ${brl(num(v.base))}`] } },
  },
  {
    id: 'periculosidade', ramo: 'trabalhista', titulo: 'Adicional de periculosidade',
    descricao: 'Salário-base × 30%.', casos: 'Atividades perigosas (NR-16).',
    baseLegal: 'CLT art. 193, §1º.',
    campos: [{ name: 'salario', label: 'Salário-base', type: 'currency', required: true }],
    compute: (v) => { const r = num(v.salario)*0.30; return { headline: { label: 'Periculosidade (30%)', value: brl(r) }, linhas: [{label:'Adicional', value: brl(r)}], memoria: [`${brl(num(v.salario))} × 30% = ${brl(r)}`], criterios: [] } },
  },

  // ─────────────────────── PREVIDENCIÁRIO ───────────────────────
  {
    id: 'tempo-contribuicao', ramo: 'previdenciario', titulo: 'Tempo de contribuição',
    descricao: 'Soma períodos e retorna o total em anos, meses e dias.',
    casos: 'Aposentadoria, revisão e planejamento.', baseLegal: 'Contagem: ano=365, mês=30 dias.',
    campos: [{ name: 'periodos', label: 'Períodos (um por linha: início a fim)', type: 'periodos' }],
    compute: (v) => {
      const ps = Array.isArray(v.periodos) ? v.periodos : []
      let dias = 0; const mem = []
      ps.forEach((p, i) => { const d = diasEntre(p.inicio, p.fim); dias += d; if (p.inicio && p.fim) mem.push(`Período ${i+1}: ${fmtData(p.inicio)} a ${fmtData(p.fim)} = ${d} dias`) })
      return { headline: { label: 'Tempo total', value: tempoStr(dias) }, linhas: [{label:'Total em dias', value: `${dias} dias`}, {label:'Em anos (decimal)', value: tempoDecimal(dias).toFixed(2)}], memoria: [...mem, `Soma = ${dias} dias = ${tempoStr(dias)}`], criterios: ['Não desconta períodos concomitantes automaticamente.'] }
    },
  },
  {
    id: 'regra-pontos', ramo: 'previdenciario', titulo: 'Regra de pontos (transição)',
    descricao: 'Idade + tempo de contribuição vs. pontuação exigida no ano.',
    casos: 'Transição EC 103/2019 (art. 15).', baseLegal: 'Mulher: 86 pts (2019) +1/ano até 100. Homem: 96 pts +1/ano até 105.',
    campos: [
      { name: 'sexo', label: 'Sexo', type: 'select', default: 'M', options: [{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}] },
      { name: 'idade', label: 'Idade atual (anos)', type: 'number', required: true },
      { name: 'tempoAnos', label: 'Tempo de contribuição (anos)', type: 'number', required: true },
      { name: 'ano', label: 'Ano de análise', type: 'number', default: '2025' },
    ],
    compute: (v) => {
      const ano = num(v.ano), fem = v.sexo === 'F'
      const exigido = fem ? Math.min(100, 86 + (ano - 2019)) : Math.min(105, 96 + (ano - 2019))
      const tempoMin = fem ? 30 : 35
      const pontos = num(v.idade) + num(v.tempoAnos)
      const ok = pontos >= exigido && num(v.tempoAnos) >= tempoMin
      return {
        headline: { label: ok ? '✅ Requisito de pontos atingido' : '❌ Ainda não atinge', value: `${pontos} / ${exigido} pts` },
        linhas: [{label:'Pontos (idade+tempo)', value: String(pontos)}, {label:`Exigido em ${ano}`, value: `${exigido} pts`}, {label:'Tempo mínimo', value: `${tempoMin} anos`}],
        memoria: [`Pontos = ${num(v.idade)} + ${num(v.tempoAnos)} = ${pontos}`, `Exigência ${ano}: ${exigido} pts (mín. ${tempoMin} anos de contribuição)`, ok ? 'Requisitos cumpridos.' : `Faltam ${Math.max(0, exigido - pontos)} pontos e/ou tempo mínimo.`],
        criterios: [`Sexo: ${fem ? 'Feminino' : 'Masculino'}`, `Ano: ${ano}`],
      }
    },
  },
  {
    id: 'pedagio-50', ramo: 'previdenciario', titulo: 'Pedágio de 50%',
    descricao: 'Para quem faltava até 2 anos em 13/11/2019.', casos: 'Transição EC 103/2019 (art. 17).',
    baseLegal: 'Tempo faltante em 13/11/2019 × 50% de pedágio. Aplica fator previdenciário.',
    campos: [
      { name: 'sexo', label: 'Sexo', type: 'select', default: 'M', options: [{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}] },
      { name: 'tempoNaData', label: 'Tempo de contribuição em 13/11/2019 (anos)', type: 'number', required: true },
    ],
    compute: (v) => {
      const fem = v.sexo === 'F', tempoMin = fem ? 30 : 35
      const faltava = Math.max(0, tempoMin - num(v.tempoNaData))
      const elegivel = faltava <= 2 && faltava > 0
      const pedagio = faltava * 0.5
      const totalFaltante = faltava + pedagio
      return {
        headline: { label: elegivel ? '✅ Elegível ao pedágio 50%' : '❌ Não elegível', value: elegivel ? `Faltam ${totalFaltante.toFixed(2)} anos` : '—' },
        linhas: [{label:'Tempo mínimo', value: `${tempoMin} anos`}, {label:'Faltava em 13/11/2019', value: `${faltava.toFixed(2)} anos`}, {label:'Pedágio (50%)', value: `${pedagio.toFixed(2)} anos`}, {label:'Total a cumprir', value: `${totalFaltante.toFixed(2)} anos`}],
        memoria: [`Faltava = ${tempoMin} − ${num(v.tempoNaData)} = ${faltava.toFixed(2)} anos`, elegivel ? `Pedágio = ${faltava.toFixed(2)} × 50% = ${pedagio.toFixed(2)} anos` : 'Só é elegível quem faltava ≤ 2 anos em 13/11/2019.', `Total = ${faltava.toFixed(2)} + ${pedagio.toFixed(2)} = ${totalFaltante.toFixed(2)} anos`],
        criterios: [`Sexo: ${fem ? 'Feminino' : 'Masculino'}`, 'Sujeito ao fator previdenciário.'],
      }
    },
  },
  {
    id: 'pedagio-100', ramo: 'previdenciario', titulo: 'Pedágio de 100%',
    descricao: 'Idade mínima + pedágio de 100% do tempo faltante em 13/11/2019.', casos: 'Transição EC 103/2019 (art. 20).',
    baseLegal: 'Idade mín.: 57 (M-mulher)/60 (homem). Pedágio = 100% do que faltava.',
    campos: [
      { name: 'sexo', label: 'Sexo', type: 'select', default: 'M', options: [{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}] },
      { name: 'idade', label: 'Idade atual', type: 'number', required: true },
      { name: 'tempoNaData', label: 'Tempo de contribuição em 13/11/2019 (anos)', type: 'number', required: true },
    ],
    compute: (v) => {
      const fem = v.sexo === 'F', tempoMin = fem ? 30 : 35, idadeMin = fem ? 57 : 60
      const faltava = Math.max(0, tempoMin - num(v.tempoNaData))
      const pedagio = faltava
      const totalFaltante = faltava + pedagio
      const idadeOk = num(v.idade) >= idadeMin
      return {
        headline: { label: idadeOk ? '✔️ Idade mínima OK' : '❌ Idade insuficiente', value: `Faltam ${totalFaltante.toFixed(2)} anos de contrib.` },
        linhas: [{label:'Idade mínima', value: `${idadeMin} anos`}, {label:'Faltava em 13/11/2019', value: `${faltava.toFixed(2)} anos`}, {label:'Pedágio (100%)', value: `${pedagio.toFixed(2)} anos`}, {label:'Total a cumprir', value: `${totalFaltante.toFixed(2)} anos`}],
        memoria: [`Faltava = ${tempoMin} − ${num(v.tempoNaData)} = ${faltava.toFixed(2)} anos`, `Pedágio 100% = ${faltava.toFixed(2)} anos`, `Total = ${totalFaltante.toFixed(2)} anos`, `Idade mínima ${idadeMin}: ${idadeOk ? 'atingida' : 'não atingida'}`],
        criterios: [`Sexo: ${fem ? 'Feminino' : 'Masculino'}`, 'Benefício: 100% da média (sem redutor).'],
      }
    },
  },
  {
    id: 'conversao-especial', ramo: 'previdenciario', titulo: 'Conversão de tempo especial em comum',
    descricao: 'Tempo especial × fator (períodos até 13/11/2019).', casos: 'Atividade com exposição a agentes nocivos.',
    baseLegal: 'Fator: 1,40 (homem) / 1,20 (mulher) p/ 25 anos. Só até a Reforma.',
    campos: [
      { name: 'anosEspecial', label: 'Anos de atividade especial', type: 'number', required: true },
      { name: 'fator', label: 'Fator de conversão', type: 'select', default: '1.4', options: [{value:'1.4',label:'1,40 (homem)'},{value:'1.2',label:'1,20 (mulher)'},{value:'2.33',label:'2,33 (15→comum H)'},{value:'2.0',label:'2,00 (15→comum M)'}] },
    ],
    compute: (v) => { const conv = num(v.anosEspecial)*num(v.fator); const ganho = conv - num(v.anosEspecial); return { headline: { label: 'Tempo convertido', value: `${conv.toFixed(2)} anos` }, linhas: [{label:'Tempo especial', value: `${num(v.anosEspecial)} anos`}, {label:`Fator ${v.fator}`, value: `× ${v.fator}`}, {label:'Tempo comum equivalente', value: `${conv.toFixed(2)} anos`}, {label:'Ganho', value: `${ganho.toFixed(2)} anos`}], memoria: [`Convertido = ${num(v.anosEspecial)} × ${v.fator} = ${conv.toFixed(2)} anos`, `Ganho de ${ganho.toFixed(2)} anos.`], criterios: ['Conversão vedada para períodos após 13/11/2019.'] } },
  },
  {
    id: 'rmi', ramo: 'previdenciario', titulo: 'RMI — Renda Mensal Inicial (estimativa)',
    descricao: 'Média (100% dos salários desde 07/1994) × coeficiente da EC 103/2019.',
    casos: 'Estimativa do valor do benefício após a Reforma.',
    baseLegal: 'EC 103/2019, art. 26: média de 100% dos salários (desde 07/1994). §2º: 60% + 2% por ano que exceder 20 (homem) / 15 (mulher, §5). §3º: 100% da média na aposentadoria por acidente/doença do trabalho e no pedágio de 100%. Piso: salário mínimo (art. 33 da Lei 8.213/91).',
    campos: [
      { name: 'media', label: 'Média dos salários de contribuição (100% desde 07/1994)', type: 'currency', required: true },
      { name: 'sexo', label: 'Sexo', type: 'select', default: 'M', options: [{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}] },
      { name: 'anos', label: 'Anos de contribuição', type: 'number', required: true },
      { name: 'regra', label: 'Regra de cálculo', type: 'select', default: 'geral', options: [
        { value: 'geral',     label: 'Regra geral (60% + 2%/ano)' },
        { value: 'especial',  label: 'Aposentadoria especial (60% + 2% acima de 15)' },
        { value: 'cem',       label: '100% da média (pedágio 100% / acidente)' },
      ]},
    ],
    compute: (v) => {
      const fem = v.sexo === 'F'
      const anos = num(v.anos)
      let coef, memoriaCoef
      if (v.regra === 'cem') {
        coef = 1; memoriaCoef = 'Coeficiente = 100% da média (EC 103, art. 26, §3)'
      } else {
        const base = v.regra === 'especial' ? 15 : (fem ? 15 : 20)
        const excedente = Math.max(0, anos - base)
        coef = Math.min(1, 0.60 + 0.02 * excedente)
        memoriaCoef = `Coeficiente = 60% + 2% × ${excedente} anos acima de ${base} = ${(coef*100).toFixed(0)}%`
      }
      const rmi = num(v.media) * coef
      const teto = PARAMS.tetoINSS, piso = PARAMS.salarioMinimo
      const limitado = rmi > teto ? teto : (rmi < piso ? piso : rmi)
      return {
        headline: { label: 'RMI estimada', value: brl(limitado) },
        linhas: [{label:'Média', value: brl(num(v.media))}, {label:'Coeficiente', value: `${(coef*100).toFixed(0)}%`}, {label:'RMI calculada', value: brl(rmi)}, ...(limitado!==rmi?[{label:'RMI ajustada (piso/teto)', value: brl(limitado)}]:[])],
        memoria: [memoriaCoef, `RMI = ${brl(num(v.media))} × ${(coef*100).toFixed(0)}% = ${brl(rmi)}`, limitado!==rmi ? `Ajuste a ${rmi>teto?'teto':'piso'}: ${brl(limitado)}` : ''].filter(Boolean),
        criterios: [`Piso ${brl(piso)} / Teto ${brl(teto)}`, 'Média = 100% dos salários desde 07/1994 (EC 103, art. 26), corrigidos pelo INPC.', 'Estimativa — não aplica descarte de contribuições nem fator previdenciário.'],
      }
    },
  },
  {
    id: 'fator-previdenciario', ramo: 'previdenciario', titulo: 'Fator previdenciário',
    descricao: 'Fator = (Tc × 0,31 / Es) × [1 + (Id + Tc × 0,31) / 100].',
    casos: 'Aposentadoria por tempo de contribuição (regra antiga) e pedágio de 50%.',
    baseLegal: 'Lei 8.213/91, art. 29, §7-§9 e Anexo. Es = expectativa de sobrevida (tábua IBGE). Mulher +5 anos; professor(a) +5/+10.',
    campos: [
      { name: 'idade', label: 'Idade na aposentadoria (anos)', type: 'number', required: true },
      { name: 'tc', label: 'Tempo de contribuição (anos)', type: 'number', required: true },
      { name: 'sexo', label: 'Sexo', type: 'select', default: 'M', options: [{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}] },
      { name: 'professor', label: 'Professor(a) (magistério)?', type: 'select', default: 'nao', options: [{value:'nao',label:'Não'},{value:'sim',label:'Sim'}] },
      { name: 'media', label: 'Média dos salários (opcional)', type: 'currency' },
    ],
    compute: (v) => {
      const fem = v.sexo === 'F', professor = v.professor === 'sim'
      const bonus = professor ? (fem ? 10 : 5) : (fem ? 5 : 0)
      const tcAj = num(v.tc) + bonus
      const fp = fatorPrevidenciario(num(v.idade), num(v.tc), { fem, professor })
      if (fp == null) return { headline: { label: 'Fator previdenciário', value: '—' }, linhas: [], memoria: ['Verifique idade e tempo de contribuição.'], criterios: [] }
      const media = num(v.media)
      const beneficio = media ? media * fp : 0
      return {
        headline: { label: 'Fator previdenciário', value: fp.toFixed(4) },
        linhas: [
          { label: 'Tempo de contribuição ajustado', value: `${tcAj.toFixed(2)} anos${bonus?` (+${bonus})`:''}` },
          { label: 'Expectativa de sobrevida (Es)', value: `${esIBGE(num(v.idade)).toFixed(1)} anos` },
          { label: 'Fator', value: fp.toFixed(4) },
          ...(media ? [{ label: 'Benefício (média × fator)', value: brl(beneficio) }] : []),
        ],
        memoria: [
          `Tc ajustado = ${num(v.tc)} + ${bonus} = ${tcAj.toFixed(2)} anos`,
          `Es (idade ${num(v.idade)}) = ${esIBGE(num(v.idade)).toFixed(1)} anos (tábua IBGE)`,
          `FP = (${tcAj.toFixed(2)} × 0,31 / ${esIBGE(num(v.idade)).toFixed(1)}) × [1 + (${num(v.idade)} + ${tcAj.toFixed(2)} × 0,31) / 100] = ${fp.toFixed(4)}`,
          ...(media ? [`Benefício = ${brl(media)} × ${fp.toFixed(4)} = ${brl(beneficio)}`] : []),
        ],
        criterios: ['Tábua Completa de Mortalidade IBGE 2024 (oficial, ambos os sexos).', 'Fator < 1 reduz e > 1 aumenta o benefício.'],
      }
    },
  },

  // ─────────────────────── TRIBUTÁRIO ───────────────────────
  {
    id: 'debito-tributario', ramo: 'tributario', titulo: 'Atualização de débito tributário',
    descricao: 'Tributo + correção (SELIC) + multa de mora.', casos: 'Tributos federais/estaduais em atraso.',
    baseLegal: 'Débitos federais: SELIC acumulada (Lei 9.430/96). Multa de mora limitada (usualmente 20%).',
    campos: [
      { name: 'valor', label: 'Tributo original', type: 'currency', required: true },
      { name: 'selic', label: 'SELIC acumulada no período (%)', type: 'percent', required: true },
      { name: 'multa', label: 'Multa de mora (%)', type: 'percent', default: '20' },
    ],
    compute: (v) => { const p = num(v.valor); const corr = p*pct(v.selic); const base = p+corr; const multa = base*pct(v.multa); const total = base+multa; return { headline: { label: 'Débito atualizado', value: brl(total) }, linhas: [{label:'Tributo', value: brl(p)}, {label:`SELIC (${(pct(v.selic)*100).toFixed(2)}%)`, value: brl(corr)}, {label:`Multa (${(pct(v.multa)*100).toFixed(2)}%)`, value: brl(multa)}], memoria: [`Correção SELIC = ${brl(p)} × ${(pct(v.selic)*100).toFixed(2)}% = ${brl(corr)}`, `Multa = ${brl(base)} × ${(pct(v.multa)*100).toFixed(2)}% = ${brl(multa)}`, `Total = ${brl(total)}`], criterios: ['SELIC engloba juros e correção.'] } },
  },
  {
    id: 'multa-mora-trib', ramo: 'tributario', titulo: 'Multa de mora tributária',
    descricao: 'Tributo × percentual da multa (frequentemente 0,33%/dia até 20%).', casos: 'Atraso no recolhimento.',
    baseLegal: 'Ex.: art. 61 Lei 9.430/96 (0,33% ao dia, limite 20%).',
    campos: [{ name: 'valor', label: 'Valor do tributo', type: 'currency', required: true }, { name: 'multa', label: 'Multa (%)', type: 'percent', default: '20', required: true }],
    compute: (v) => { const r = num(v.valor)*pct(v.multa); return { headline: { label: 'Multa de mora', value: brl(r) }, linhas: [{label:'Multa', value: brl(r)}], memoria: [`${brl(num(v.valor))} × ${(pct(v.multa)*100).toFixed(2)}% = ${brl(r)}`], criterios: [] } },
  },
  {
    id: 'parcelamento-trib', ramo: 'tributario', titulo: 'Parcelamento tributário',
    descricao: 'Débito consolidado ÷ nº de parcelas.', casos: 'REFIS e parcelamentos ordinários.',
    baseLegal: 'Parcela mínima e atualização conforme o programa.',
    campos: [{ name: 'debito', label: 'Débito consolidado', type: 'currency', required: true }, { name: 'parcelas', label: 'Nº de parcelas', type: 'number', default: '60', required: true }],
    compute: (v) => { const r = num(v.debito)/Math.max(1,num(v.parcelas)); return { headline: { label: 'Valor por parcela', value: brl(r) }, linhas: [{label:'Débito', value: brl(num(v.debito))}, {label:`Parcelas`, value: String(num(v.parcelas))}, {label:'Parcela', value: brl(r)}], memoria: [`${brl(num(v.debito))} ÷ ${num(v.parcelas)} = ${brl(r)}`], criterios: ['Parcelas futuras corrigidas pela SELIC.'] } },
  },
  {
    id: 'restituicao-trib', ramo: 'tributario', titulo: 'Restituição / compensação',
    descricao: 'Valor pago indevidamente × (1 + índice acumulado).', casos: 'Pagamento indevido ou a maior.',
    baseLegal: 'Repetição corrigida pela SELIC desde o pagamento indevido (Súm. 162 STJ).',
    campos: [{ name: 'valor', label: 'Valor pago indevidamente', type: 'currency', required: true }, { name: 'selic', label: 'SELIC acumulada (%)', type: 'percent', required: true }],
    compute: (v) => { const corr = num(v.valor)*pct(v.selic); const total = num(v.valor)+corr; return { headline: { label: 'Valor a restituir', value: brl(total) }, linhas: [{label:'Pago indevido', value: brl(num(v.valor))}, {label:`SELIC (${(pct(v.selic)*100).toFixed(2)}%)`, value: brl(corr)}], memoria: [`Correção = ${brl(num(v.valor))} × ${(pct(v.selic)*100).toFixed(2)}% = ${brl(corr)}`, `Total = ${brl(total)}`], criterios: [] } },
  },

  // ─────────────────────── FAMÍLIA ───────────────────────
  {
    id: 'pensao-alimenticia', ramo: 'familia', titulo: 'Pensão alimentícia',
    descricao: 'Percentual sobre a renda líquida, valor fixo ou em salários mínimos.', casos: 'Ação de alimentos, revisão, acordo.',
    baseLegal: 'Binômio necessidade × possibilidade (art. 1.694 CC).',
    campos: [
      { name: 'modo', label: 'Base', type: 'select', default: 'perc', options: [{value:'perc',label:'% da renda líquida'},{value:'fixo',label:'Valor fixo'},{value:'sm',label:'Salários mínimos'}] },
      { name: 'renda', label: 'Renda líquida do alimentante', type: 'currency' },
      { name: 'perc', label: 'Percentual (%)', type: 'percent', default: '30' },
      { name: 'valorFixo', label: 'Valor fixo (R$)', type: 'currency' },
      { name: 'qtdeSM', label: 'Qtde de salários mínimos', type: 'number', default: '1' },
      { name: 'filhos', label: 'Nº de filhos (rateio)', type: 'number', default: '1' },
    ],
    compute: (v) => {
      let total = 0, mem = []
      if (v.modo === 'perc') { total = num(v.renda)*pct(v.perc); mem.push(`${brl(num(v.renda))} × ${(pct(v.perc)*100).toFixed(0)}% = ${brl(total)}`) }
      else if (v.modo === 'fixo') { total = num(v.valorFixo); mem.push(`Valor fixo = ${brl(total)}`) }
      else { total = num(v.qtdeSM)*PARAMS.salarioMinimo; mem.push(`${num(v.qtdeSM)} × ${brl(PARAMS.salarioMinimo)} (SM) = ${brl(total)}`) }
      const filhos = Math.max(1, num(v.filhos))
      const porFilho = total / filhos
      if (filhos > 1) mem.push(`Rateio entre ${filhos} filhos = ${brl(porFilho)} cada`)
      return { headline: { label: 'Pensão mensal', value: brl(total) }, linhas: [{label:'Total mensal', value: brl(total)}, ...(filhos>1?[{label:`Por filho (${filhos})`, value: brl(porFilho)}]:[])], memoria: mem, criterios: [`Base: ${{perc:'% da renda',fixo:'valor fixo',sm:'salários mínimos'}[v.modo]}`] }
    },
  },
  {
    id: 'alimentos-atrasados', ramo: 'familia', titulo: 'Alimentos atrasados',
    descricao: 'Parcelas vencidas + correção + juros (+ multa).', casos: 'Execução de alimentos.',
    baseLegal: 'Correção + juros de mora. Rito dos arts. 528/911 CPC.',
    campos: [
      { name: 'valorParcela', label: 'Valor da parcela', type: 'currency', required: true },
      { name: 'parcelas', label: 'Nº de parcelas vencidas', type: 'number', required: true },
      { name: 'taxaAcumulada', label: 'Correção acumulada (%)', type: 'percent' },
      { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
      { name: 'multa', label: 'Multa (%)', type: 'percent' },
    ],
    compute: (v) => {
      const base = num(v.valorParcela)*num(v.parcelas)
      const corr = base*pct(v.taxaAcumulada)
      const corrigido = base+corr
      // juros média simples sobre metade do período (aprox.) — usamos meses = parcelas
      const juros = corrigido*pct(v.jurosMes)*num(v.parcelas)/2
      const multa = (corrigido+juros)*pct(v.multa)
      const total = corrigido+juros+multa
      return { headline: { label: 'Total dos alimentos atrasados', value: brl(total) }, linhas: [{label:`${num(v.parcelas)} parcelas`, value: brl(base)}, {label:'Correção', value: brl(corr)}, {label:'Juros', value: brl(juros)}, ...(multa?[{label:'Multa', value: brl(multa)}]:[])], memoria: [`Base = ${brl(num(v.valorParcela))} × ${num(v.parcelas)} = ${brl(base)}`, `Correção = ${brl(corr)}`, `Juros (média) ≈ ${brl(juros)}`, `Total = ${brl(total)}`], criterios: ['Juros calculados de forma aproximada sobre o período médio.'] }
    },
  },
  {
    id: 'partilha-bens', ramo: 'familia', titulo: 'Partilha de bens',
    descricao: '(Bens − dívidas) dividido conforme o regime.', casos: 'Divórcio, união estável.',
    baseLegal: 'Regimes: arts. 1.658 e ss. CC.',
    campos: [
      { name: 'bens', label: 'Valor total dos bens', type: 'currency', required: true },
      { name: 'dividas', label: 'Dívidas do casal', type: 'currency' },
      { name: 'regime', label: 'Regime', type: 'select', default: 'parcial', options: [{value:'parcial',label:'Comunhão parcial'},{value:'universal',label:'Comunhão universal'},{value:'total',label:'Separação total'}] },
      { name: 'bensParticulares', label: 'Bens particulares (excluir, se parcial)', type: 'currency' },
    ],
    compute: (v) => {
      let partilhavel = num(v.bens) - num(v.dividas)
      if (v.regime === 'parcial') partilhavel -= num(v.bensParticulares)
      if (v.regime === 'total') partilhavel = 0
      const cada = partilhavel/2
      return { headline: { label: 'Meação de cada cônjuge', value: brl(cada) }, linhas: [{label:'Patrimônio líquido partilhável', value: brl(Math.max(0,partilhavel))}, {label:'Cada cônjuge (50%)', value: brl(Math.max(0,cada))}], memoria: [`Partilhável = ${brl(num(v.bens))} − ${brl(num(v.dividas))} ${v.regime==='parcial'?`− ${brl(num(v.bensParticulares))} (particulares)`:''} = ${brl(partilhavel)}`, v.regime==='total'?'Separação total: sem partilha de aquestos.':`Cada um = ${brl(cada)}`], criterios: [`Regime: ${{parcial:'Comunhão parcial',universal:'Comunhão universal',total:'Separação total'}[v.regime]}`] }
    },
  },

  // ─────────────────────── SUCESSÓRIO ───────────────────────
  {
    id: 'inventario-quinhao', ramo: 'sucessorio', titulo: 'Inventário e quinhão hereditário',
    descricao: 'Monte partilhável ÷ herdeiros, após meação e dívidas.', casos: 'Inventário / partilha.',
    baseLegal: 'Arts. 1.784 e ss. CC. Meação do cônjuge não integra a herança.',
    campos: [
      { name: 'bens', label: 'Valor total dos bens', type: 'currency', required: true },
      { name: 'dividas', label: 'Dívidas do espólio', type: 'currency' },
      { name: 'meacao', label: 'Meação do cônjuge (R$)', type: 'currency', help: 'Metade dos bens comuns, se houver.' },
      { name: 'herdeiros', label: 'Nº de herdeiros', type: 'number', default: '1', required: true },
    ],
    compute: (v) => {
      const monte = num(v.bens) - num(v.dividas) - num(v.meacao)
      const herdeiros = Math.max(1, num(v.herdeiros))
      const quinhao = monte/herdeiros
      return { headline: { label: 'Quinhão por herdeiro', value: brl(Math.max(0,quinhao)) }, linhas: [{label:'Bens', value: brl(num(v.bens))}, {label:'(−) Dívidas', value: brl(num(v.dividas))}, {label:'(−) Meação', value: brl(num(v.meacao))}, {label:'Monte partilhável', value: brl(Math.max(0,monte))}, {label:`Quinhão (÷${herdeiros})`, value: brl(Math.max(0,quinhao))}], memoria: [`Monte = ${brl(num(v.bens))} − ${brl(num(v.dividas))} − ${brl(num(v.meacao))} = ${brl(monte)}`, `Quinhão = ${brl(monte)} ÷ ${herdeiros} = ${brl(quinhao)}`], criterios: ['Respeitar ordem de vocação hereditária (art. 1.829 CC).'] }
    },
  },
  {
    id: 'itcmd', ramo: 'sucessorio', titulo: 'ITCMD',
    descricao: 'Base de cálculo × alíquota estadual.', casos: 'Transmissão causa mortis ou doação.',
    baseLegal: 'Competência estadual; alíquotas até 8% (Res. Senado 9/92).',
    campos: [{ name: 'base', label: 'Base de cálculo (bens transmitidos)', type: 'currency', required: true }, { name: 'aliquota', label: 'Alíquota (%)', type: 'percent', default: '4', required: true }],
    compute: (v) => { const r = num(v.base)*pct(v.aliquota); return { headline: { label: 'ITCMD devido', value: brl(r) }, linhas: [{label:'Base', value: brl(num(v.base))}, {label:`Alíquota (${(pct(v.aliquota)*100).toFixed(1)}%)`, value: brl(r)}], memoria: [`${brl(num(v.base))} × ${(pct(v.aliquota)*100).toFixed(1)}% = ${brl(r)}`], criterios: ['Confira a alíquota do Estado competente.'] } },
  },
  {
    id: 'meacao', ramo: 'sucessorio', titulo: 'Meação',
    descricao: 'Bens comunicáveis ÷ 2.', casos: 'Apuração da meação do cônjuge/companheiro.',
    baseLegal: 'Regime de bens (arts. 1.658 e ss. CC).',
    campos: [{ name: 'bensComuns', label: 'Bens comunicáveis', type: 'currency', required: true }],
    compute: (v) => { const r = num(v.bensComuns)/2; return { headline: { label: 'Meação', value: brl(r) }, linhas: [{label:'Bens comuns', value: brl(num(v.bensComuns))}, {label:'Meação (50%)', value: brl(r)}], memoria: [`${brl(num(v.bensComuns))} ÷ 2 = ${brl(r)}`], criterios: [] } },
  },

  // ─────────────────────── PENAL ───────────────────────
  {
    id: 'dosimetria', ramo: 'penal', titulo: 'Dosimetria da pena',
    descricao: 'Método trifásico: pena-base → agravantes/atenuantes → causas de aumento/diminuição.',
    casos: 'Fixação da pena privativa de liberdade.', baseLegal: 'Art. 68 CP (sistema trifásico).',
    campos: [
      { name: 'minMeses', label: 'Pena mínima (meses)', type: 'number', required: true },
      { name: 'maxMeses', label: 'Pena máxima (meses)', type: 'number', required: true },
      { name: 'circNeg', label: 'Circunstâncias judiciais negativas (0-8)', type: 'number', default: '0' },
      { name: 'agravantes', label: 'Fração de aumento 2ª fase (ex.: 1/6 = 0.1667)', type: 'number', default: '0' },
      { name: 'atenuantes', label: 'Fração de redução 2ª fase', type: 'number', default: '0' },
      { name: 'aumento', label: 'Causa de aumento 3ª fase (ex.: 1/3 = 0.3333)', type: 'number', default: '0' },
      { name: 'diminuicao', label: 'Causa de diminuição 3ª fase', type: 'number', default: '0' },
    ],
    compute: (v) => {
      const min = num(v.minMeses), max = num(v.maxMeses)
      const intervalo = Math.max(0, max - min)
      // 1ª fase: cada circunstância negativa acresce ~1/8 do intervalo sobre o mínimo
      const neg = Math.min(8, num(v.circNeg))
      const base = min + intervalo * (neg / 8)
      // 2ª fase
      let f2 = base + base * num(v.agravantes) - base * num(v.atenuantes)
      f2 = Math.max(min, f2) // não abaixo do mínimo legal (Súm. 231 STJ)
      // 3ª fase
      const f3 = f2 + f2 * num(v.aumento) - f2 * num(v.diminuicao)
      const anos = Math.floor(f3 / 12), meses = Math.round(f3 % 12)
      return {
        headline: { label: 'Pena definitiva', value: `${anos} ano(s) e ${meses} mês(es)` },
        linhas: [{label:'1ª fase (pena-base)', value: `${(base/12).toFixed(2)} anos`}, {label:'2ª fase', value: `${(f2/12).toFixed(2)} anos`}, {label:'3ª fase (definitiva)', value: `${(f3/12).toFixed(2)} anos`}],
        memoria: [
          `Intervalo = ${max} − ${min} = ${intervalo} meses`,
          `1ª fase: ${min} + ${intervalo} × (${neg}/8) = ${base.toFixed(1)} meses`,
          `2ª fase: ${base.toFixed(1)} + agrav. ${num(v.agravantes)} − aten. ${num(v.atenuantes)} = ${f2.toFixed(1)} meses (piso: mínimo legal)`,
          `3ª fase: ${f2.toFixed(1)} + aum. ${num(v.aumento)} − dim. ${num(v.diminuicao)} = ${f3.toFixed(1)} meses`,
          `Definitiva = ${anos} ano(s) e ${meses} mês(es)`,
        ],
        criterios: ['1ª fase usa peso 1/8 por circunstância (critério doutrinário); ajuste conforme entendimento.'],
      }
    },
  },
  {
    id: 'detracao', ramo: 'penal', titulo: 'Detração penal',
    descricao: 'Pena − tempo de prisão provisória/medida cautelar.', casos: 'Execução penal.',
    baseLegal: 'Art. 42 CP.',
    campos: [{ name: 'penaMeses', label: 'Pena total (meses)', type: 'number', required: true }, { name: 'provisoriaMeses', label: 'Prisão provisória (meses)', type: 'number', required: true }],
    compute: (v) => { const r = Math.max(0, num(v.penaMeses)-num(v.provisoriaMeses)); return { headline: { label: 'Pena remanescente', value: `${(r/12).toFixed(2)} anos` }, linhas: [{label:'Pena total', value: `${num(v.penaMeses)} meses`}, {label:'(−) Provisória', value: `${num(v.provisoriaMeses)} meses`}, {label:'Restante', value: `${r} meses`}], memoria: [`${num(v.penaMeses)} − ${num(v.provisoriaMeses)} = ${r} meses`], criterios: [] } },
  },
  {
    id: 'remicao', ramo: 'penal', titulo: 'Remição de pena',
    descricao: 'Trabalho: 3 dias = 1 remido. Estudo: 12h = 1 remido.', casos: 'Execução penal.',
    baseLegal: 'Art. 126 LEP.',
    campos: [{ name: 'diasTrab', label: 'Dias trabalhados', type: 'number', default: '0' }, { name: 'horasEstudo', label: 'Horas de estudo', type: 'number', default: '0' }],
    compute: (v) => { const rt = Math.floor(num(v.diasTrab)/3); const re = Math.floor(num(v.horasEstudo)/12); const total = rt+re; return { headline: { label: 'Dias remidos', value: `${total} dias` }, linhas: [{label:'Por trabalho (÷3)', value: `${rt} dias`}, {label:'Por estudo (÷12h)', value: `${re} dias`}], memoria: [`Trabalho: ${num(v.diasTrab)} ÷ 3 = ${rt}`, `Estudo: ${num(v.horasEstudo)} ÷ 12 = ${re}`, `Total = ${total} dias remidos`], criterios: [] } },
  },
  {
    id: 'progressao', ramo: 'penal', titulo: 'Progressão de regime',
    descricao: 'Pena × fração exigida − tempo já cumprido.', casos: 'Execução penal.',
    baseLegal: 'Art. 112 LEP (frações de 16% a 70% conforme o caso).',
    campos: [
      { name: 'penaMeses', label: 'Pena total (meses)', type: 'number', required: true },
      { name: 'fracao', label: 'Fração exigida', type: 'select', default: '0.16', options: [{value:'0.16',label:'16% (primário, s/ violência)'},{value:'0.20',label:'20% (reincidente, s/ violência)'},{value:'0.25',label:'25% (primário, c/ violência)'},{value:'0.30',label:'30% (reincidente, c/ violência)'},{value:'0.40',label:'40% (hediondo primário)'},{value:'0.60',label:'60% (hediondo reincidente)'},{value:'0.70',label:'70% (hediondo c/ morte)'}] },
      { name: 'cumpridoMeses', label: 'Tempo já cumprido (meses)', type: 'number', default: '0' },
    ],
    compute: (v) => { const exig = num(v.penaMeses)*num(v.fracao); const falta = Math.max(0, exig-num(v.cumpridoMeses)); const ok = falta<=0; return { headline: { label: ok?'✅ Já pode progredir':'Faltam '+falta.toFixed(1)+' meses', value: `${exig.toFixed(1)} meses exigidos` }, linhas: [{label:'Fração', value: `${(num(v.fracao)*100).toFixed(0)}%`}, {label:'Tempo exigido', value: `${exig.toFixed(1)} meses`}, {label:'Já cumprido', value: `${num(v.cumpridoMeses)} meses`}, {label:'Falta', value: `${falta.toFixed(1)} meses`}], memoria: [`Exigido = ${num(v.penaMeses)} × ${(num(v.fracao)*100).toFixed(0)}% = ${exig.toFixed(1)} meses`, ok?'Requisito objetivo cumprido.':`Faltam ${falta.toFixed(1)} meses.`], criterios: ['Requisito subjetivo avaliado à parte.'] } },
  },

  // ─────────────────────── CONSUMIDOR ───────────────────────
  {
    id: 'repeticao-indebito', ramo: 'consumidor', titulo: 'Repetição de indébito (dobro)',
    descricao: 'Valor pago indevidamente × 2 + correção + juros.', casos: 'Cobrança indevida ao consumidor.',
    baseLegal: 'Art. 42, §único CDC (devolução em dobro, salvo engano justificável).',
    campos: [
      { name: 'valor', label: 'Valor pago indevidamente', type: 'currency', required: true },
      { name: 'dobro', label: 'Devolução em dobro?', type: 'select', default: 'sim', options: [{value:'sim',label:'Sim (art. 42 CDC)'},{value:'nao',label:'Simples'}] },
      { name: 'taxaAcumulada', label: 'Correção acumulada (%)', type: 'percent' },
      { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
      { name: 'meses', label: 'Meses', type: 'number', default: '0' },
    ],
    compute: (v) => { const base = num(v.valor)*(v.dobro==='sim'?2:1); const corr = base*pct(v.taxaAcumulada); const cj = base+corr; const juros = cj*pct(v.jurosMes)*num(v.meses); const total = cj+juros; return { headline: { label: 'Total a restituir', value: brl(total) }, linhas: [{label:`Valor ${v.dobro==='sim'?'em dobro':'simples'}`, value: brl(base)}, {label:'Correção', value: brl(corr)}, {label:'Juros', value: brl(juros)}], memoria: [`Base ${v.dobro==='sim'?'× 2':''} = ${brl(base)}`, `Correção = ${brl(corr)}`, `Juros = ${brl(cj)} × ${(pct(v.jurosMes)*100).toFixed(2)}% × ${num(v.meses)} = ${brl(juros)}`, `Total = ${brl(total)}`], criterios: [] } },
  },
  {
    id: 'dano-material', ramo: 'consumidor', titulo: 'Dano material',
    descricao: 'Soma dos prejuízos comprovados (danos emergentes).', casos: 'Indenização por prejuízos.',
    baseLegal: 'Arts. 402-403 CC.',
    campos: [{ name: 'prejuizos', label: 'Prejuízos (um por linha)', type: 'valores' }],
    compute: (v) => { const arr = Array.isArray(v.prejuizos)?v.prejuizos:[]; const total = arr.reduce((s,x)=>s+num(x.valor),0); return { headline: { label: 'Dano material total', value: brl(total) }, linhas: arr.filter(x=>x.desc||x.valor).map(x=>({label:x.desc||'Item', value: brl(num(x.valor))})), memoria: [...arr.filter(x=>x.valor).map(x=>`${x.desc||'Item'}: ${brl(num(x.valor))}`), `Total = ${brl(total)}`], criterios: [] } },
  },

  // ─────────────────────── IMOBILIÁRIO ───────────────────────
  {
    id: 'aluguel-atraso', ramo: 'imobiliario', titulo: 'Aluguel em atraso',
    descricao: 'Aluguel + multa + juros + correção + encargos.', casos: 'Cobrança/execução de locação.',
    baseLegal: 'Lei 8.245/91. Multa e encargos conforme contrato.',
    campos: [
      { name: 'aluguel', label: 'Valor do aluguel', type: 'currency', required: true },
      { name: 'meses', label: 'Meses em atraso', type: 'number', default: '1', required: true },
      { name: 'multa', label: 'Multa (%)', type: 'percent', default: '10' },
      { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
      { name: 'taxaAcumulada', label: 'Correção acumulada (%)', type: 'percent' },
      { name: 'encargos', label: 'Encargos (IPTU, condomínio) R$', type: 'currency' },
    ],
    compute: (v) => { const base = num(v.aluguel)*num(v.meses)+num(v.encargos); const corr = base*pct(v.taxaAcumulada); const cj = base+corr; const juros = cj*pct(v.jurosMes)*num(v.meses); const multa = (cj+juros)*pct(v.multa); const total = cj+juros+multa; return { headline: { label: 'Débito locatício', value: brl(total) }, linhas: [{label:`Aluguéis (${num(v.meses)}) + encargos`, value: brl(base)}, {label:'Correção', value: brl(corr)}, {label:'Juros', value: brl(juros)}, {label:'Multa', value: brl(multa)}], memoria: [`Base = ${brl(num(v.aluguel))} × ${num(v.meses)} + encargos ${brl(num(v.encargos))} = ${brl(base)}`, `Correção = ${brl(corr)}`, `Juros = ${brl(juros)}`, `Multa = ${brl(multa)}`, `Total = ${brl(total)}`], criterios: [] } },
  },
  {
    id: 'reajuste-aluguel', ramo: 'imobiliario', titulo: 'Reajuste de aluguel',
    descricao: 'Aluguel × (1 + índice acumulado).', casos: 'Reajuste anual da locação.',
    baseLegal: 'Índice contratual (IGP-M, IPCA…). Lei 8.245/91.',
    campos: [{ name: 'aluguel', label: 'Aluguel atual', type: 'currency', required: true }, { name: 'indice', label: 'Índice acumulado (%)', type: 'percent', required: true }],
    compute: (v) => { const novo = num(v.aluguel)*(1+pct(v.indice)); return { headline: { label: 'Novo aluguel', value: brl(novo) }, linhas: [{label:'Aluguel atual', value: brl(num(v.aluguel))}, {label:`Reajuste (${(pct(v.indice)*100).toFixed(2)}%)`, value: brl(novo-num(v.aluguel))}, {label:'Novo valor', value: brl(novo)}], memoria: [`${brl(num(v.aluguel))} × (1 + ${(pct(v.indice)*100).toFixed(2)}%) = ${brl(novo)}`], criterios: [] } },
  },
  {
    id: 'condominio-atraso', ramo: 'imobiliario', titulo: 'Condomínio em atraso',
    descricao: 'Cota + multa (máx. 2%) + juros + correção.', casos: 'Cobrança de cotas condominiais.',
    baseLegal: 'Art. 1.336, §1º CC (multa até 2%).',
    campos: [
      { name: 'cota', label: 'Cota condominial', type: 'currency', required: true },
      { name: 'meses', label: 'Meses em atraso', type: 'number', default: '1', required: true },
      { name: 'multa', label: 'Multa (%)', type: 'percent', default: '2' },
      { name: 'jurosMes', label: 'Juros ao mês (%)', type: 'percent', default: '1' },
    ],
    compute: (v) => { const base = num(v.cota)*num(v.meses); const juros = base*pct(v.jurosMes)*num(v.meses); const multa = base*pct(v.multa); const total = base+juros+multa; return { headline: { label: 'Débito condominial', value: brl(total) }, linhas: [{label:`Cotas (${num(v.meses)})`, value: brl(base)}, {label:'Juros', value: brl(juros)}, {label:`Multa (${(pct(v.multa)*100).toFixed(0)}%)`, value: brl(multa)}], memoria: [`Base = ${brl(num(v.cota))} × ${num(v.meses)} = ${brl(base)}`, `Juros = ${brl(juros)}`, `Multa = ${brl(multa)}`, `Total = ${brl(total)}`], criterios: ['Multa condominial limitada a 2%.'] } },
  },

  // ─────────────────────── BANCÁRIO ───────────────────────
  {
    id: 'tabela-price', ramo: 'bancario', titulo: 'Tabela Price (parcela fixa)',
    descricao: 'PMT = PV × i ÷ (1 − (1+i)^−n).', casos: 'Financiamentos com prestação fixa.',
    baseLegal: 'Sistema Francês de Amortização.',
    campos: [
      { name: 'pv', label: 'Valor financiado (PV)', type: 'currency', required: true },
      { name: 'taxaMes', label: 'Taxa de juros ao mês (%)', type: 'percent', required: true },
      { name: 'n', label: 'Nº de parcelas', type: 'number', required: true },
    ],
    compute: (v) => {
      const pv = num(v.pv), i = pct(v.taxaMes), n = num(v.n)
      const pmt = i === 0 ? pv/n : pv * i / (1 - Math.pow(1+i, -n))
      const totalPago = pmt*n, juros = totalPago-pv
      return { headline: { label: 'Prestação mensal', value: brl(pmt) }, linhas: [{label:'Financiado', value: brl(pv)}, {label:`Parcela × ${n}`, value: brl(pmt)}, {label:'Total pago', value: brl(totalPago)}, {label:'Juros totais', value: brl(juros)}], memoria: [`PMT = ${brl(pv)} × ${(i*100).toFixed(4)}% ÷ (1 − (1+${(i*100).toFixed(4)}%)^−${n}) = ${brl(pmt)}`, `Total = ${brl(pmt)} × ${n} = ${brl(totalPago)}`, `Juros = ${brl(juros)}`], criterios: [`Taxa: ${(i*100).toFixed(2)}% a.m.`] }
    },
  },
  {
    id: 'sac', ramo: 'bancario', titulo: 'Sistema SAC',
    descricao: 'Amortização constante + juros sobre o saldo devedor.', casos: 'Financiamentos imobiliários.',
    baseLegal: 'Sistema de Amortização Constante.',
    campos: [
      { name: 'pv', label: 'Valor financiado', type: 'currency', required: true },
      { name: 'taxaMes', label: 'Taxa ao mês (%)', type: 'percent', required: true },
      { name: 'n', label: 'Nº de parcelas', type: 'number', required: true },
    ],
    compute: (v) => {
      const pv = num(v.pv), i = pct(v.taxaMes), n = num(v.n)
      const amort = pv/n
      const primeira = amort + pv*i
      const ultima = amort + amort*i
      const totalJuros = i*amort*(n*(n+1)/2)
      return { headline: { label: '1ª parcela (decrescente)', value: brl(primeira) }, linhas: [{label:'Amortização constante', value: brl(amort)}, {label:'1ª parcela', value: brl(primeira)}, {label:'Última parcela', value: brl(ultima)}, {label:'Juros totais', value: brl(totalJuros)}, {label:'Total pago', value: brl(pv+totalJuros)}], memoria: [`Amortização = ${brl(pv)} ÷ ${n} = ${brl(amort)}`, `1ª parcela = ${brl(amort)} + ${brl(pv)}×${(i*100).toFixed(2)}% = ${brl(primeira)}`, `Última = ${brl(ultima)}`, `Juros totais = ${brl(totalJuros)}`], criterios: ['Parcelas decrescentes.'] }
    },
  },

  // ─────────────────────── EMPRESARIAL ───────────────────────
  {
    id: 'apuracao-haveres', ramo: 'empresarial', titulo: 'Apuração de haveres',
    descricao: 'Valor patrimonial × % de participação do sócio.', casos: 'Saída, exclusão ou falecimento de sócio.',
    baseLegal: 'Arts. 1.031 CC e 604-609 CPC (balanço de determinação).',
    campos: [{ name: 'patrimonio', label: 'Valor patrimonial da empresa', type: 'currency', required: true }, { name: 'participacao', label: 'Participação do sócio (%)', type: 'percent', required: true }],
    compute: (v) => { const r = num(v.patrimonio)*pct(v.participacao); return { headline: { label: 'Haveres do sócio', value: brl(r) }, linhas: [{label:'Patrimônio', value: brl(num(v.patrimonio))}, {label:`Participação (${(pct(v.participacao)*100).toFixed(2)}%)`, value: brl(r)}], memoria: [`${brl(num(v.patrimonio))} × ${(pct(v.participacao)*100).toFixed(2)}% = ${brl(r)}`], criterios: ['Idealmente apurado por balanço de determinação.'] } },
  },
  {
    id: 'lucros-cessantes', ramo: 'empresarial', titulo: 'Lucros cessantes',
    descricao: 'Lucro/faturamento médio × período prejudicado.', casos: 'Reparação pelo que se deixou de ganhar.',
    baseLegal: 'Art. 402 CC.',
    campos: [{ name: 'lucroMes', label: 'Lucro líquido médio mensal', type: 'currency', required: true }, { name: 'meses', label: 'Meses/período prejudicado', type: 'number', required: true }],
    compute: (v) => { const r = num(v.lucroMes)*num(v.meses); return { headline: { label: 'Lucros cessantes', value: brl(r) }, linhas: [{label:'Lucro mensal', value: brl(num(v.lucroMes))}, {label:`Período (${num(v.meses)} meses)`, value: brl(r)}], memoria: [`${brl(num(v.lucroMes))} × ${num(v.meses)} = ${brl(r)}`], criterios: [] } },
  },

  // ─────────────────────── ADMINISTRATIVO ───────────────────────
  {
    id: 'diferencas-salariais', ramo: 'administrativo', titulo: 'Servidor — diferenças salariais',
    descricao: '(Devido − pago) × nº de meses + correção.', casos: 'Diferenças remuneratórias de servidor.',
    baseLegal: 'Prescrição quinquenal (Dec. 20.910/32).',
    campos: [
      { name: 'devido', label: 'Valor devido/mês', type: 'currency', required: true },
      { name: 'pago', label: 'Valor pago/mês', type: 'currency', required: true },
      { name: 'meses', label: 'Nº de meses', type: 'number', required: true },
      { name: 'taxaAcumulada', label: 'Correção acumulada (%)', type: 'percent' },
    ],
    compute: (v) => { const dif = (num(v.devido)-num(v.pago))*num(v.meses); const corr = dif*pct(v.taxaAcumulada); const total = dif+corr; return { headline: { label: 'Diferenças devidas', value: brl(total) }, linhas: [{label:'Diferença mensal', value: brl(num(v.devido)-num(v.pago))}, {label:`× ${num(v.meses)} meses`, value: brl(dif)}, {label:'Correção', value: brl(corr)}], memoria: [`Diferença = (${brl(num(v.devido))} − ${brl(num(v.pago))}) × ${num(v.meses)} = ${brl(dif)}`, `Correção = ${brl(corr)}`, `Total = ${brl(total)}`], criterios: ['Observar prescrição das parcelas anteriores a 5 anos.'] } },
  },
  {
    id: 'multa-administrativa', ramo: 'administrativo', titulo: 'Multa administrativa',
    descricao: 'Base da penalidade × percentual/valor da norma.', casos: 'Autos de infração.',
    baseLegal: 'Conforme norma sancionadora aplicável.',
    campos: [{ name: 'base', label: 'Base da penalidade', type: 'currency', required: true }, { name: 'perc', label: 'Percentual (%)', type: 'percent', default: '10', required: true }],
    compute: (v) => { const r = num(v.base)*pct(v.perc); return { headline: { label: 'Multa', value: brl(r) }, linhas: [{label:'Multa', value: brl(r)}], memoria: [`${brl(num(v.base))} × ${(pct(v.perc)*100).toFixed(2)}% = ${brl(r)}`], criterios: [] } },
  },

  // ─────────────────────── HONORÁRIOS ───────────────────────
  {
    id: 'honorarios-contratuais', ramo: 'honorarios', titulo: 'Honorários contratuais',
    descricao: 'Valor da causa/proveito × percentual contratado.', casos: 'Contrato de honorários.',
    baseLegal: 'Estatuto da OAB (Lei 8.906/94).',
    campos: [{ name: 'base', label: 'Valor da causa / proveito', type: 'currency', required: true }, { name: 'perc', label: 'Percentual contratado (%)', type: 'percent', default: '20', required: true }],
    compute: (v) => { const r = num(v.base)*pct(v.perc); return { headline: { label: 'Honorários contratuais', value: brl(r) }, linhas: [{label:'Base', value: brl(num(v.base))}, {label:`${(pct(v.perc)*100).toFixed(1)}%`, value: brl(r)}], memoria: [`${brl(num(v.base))} × ${(pct(v.perc)*100).toFixed(1)}% = ${brl(r)}`], criterios: [] } },
  },
  {
    id: 'honorarios-exito', ramo: 'honorarios', titulo: 'Honorários de êxito',
    descricao: 'Valor efetivamente recebido × percentual de êxito.', casos: 'Cláusula quota litis.',
    baseLegal: 'Estatuto da OAB.',
    campos: [{ name: 'recebido', label: 'Valor recebido pelo cliente', type: 'currency', required: true }, { name: 'perc', label: 'Percentual de êxito (%)', type: 'percent', default: '30', required: true }],
    compute: (v) => { const r = num(v.recebido)*pct(v.perc); return { headline: { label: 'Honorários de êxito', value: brl(r) }, linhas: [{label:'Recebido pelo cliente', value: brl(num(v.recebido))}, {label:`Êxito (${(pct(v.perc)*100).toFixed(1)}%)`, value: brl(r)}, {label:'Líquido ao cliente', value: brl(num(v.recebido)-r)}], memoria: [`${brl(num(v.recebido))} × ${(pct(v.perc)*100).toFixed(1)}% = ${brl(r)}`], criterios: [] } },
  },

  // ─────────────────────── PROCESSUAL ───────────────────────
  {
    id: 'custas-judiciais', ramo: 'processual', titulo: 'Custas judiciais (estimativa)',
    descricao: 'Valor da causa × alíquota do tribunal (com pisos/tetos).', casos: 'Recolhimento inicial.',
    baseLegal: 'Regimento de custas de cada tribunal — CONFIRA a tabela oficial.',
    campos: [
      { name: 'valorCausa', label: 'Valor da causa', type: 'currency', required: true },
      { name: 'aliquota', label: 'Alíquota (%)', type: 'percent', default: '1', help: 'Ex.: TJSP ~1%. Confira o regimento.' },
      { name: 'minimo', label: 'Piso (R$)', type: 'currency' },
      { name: 'maximo', label: 'Teto (R$)', type: 'currency' },
    ],
    compute: (v) => { let r = num(v.valorCausa)*pct(v.aliquota); if(num(v.minimo)&&r<num(v.minimo)) r=num(v.minimo); if(num(v.maximo)&&r>num(v.maximo)) r=num(v.maximo); return { headline: { label: 'Custas estimadas', value: brl(r) }, linhas: [{label:'Valor da causa', value: brl(num(v.valorCausa))}, {label:`Alíquota (${(pct(v.aliquota)*100).toFixed(2)}%)`, value: brl(r)}], memoria: [`${brl(num(v.valorCausa))} × ${(pct(v.aliquota)*100).toFixed(2)}% = ${brl(num(v.valorCausa)*pct(v.aliquota))}`, (num(v.minimo)||num(v.maximo))?`Ajustado a piso/teto: ${brl(r)}`:''].filter(Boolean), criterios: ['⚠️ Estimativa — use o cálculo oficial do tribunal.'] } },
  },
  {
    id: 'valor-causa', ramo: 'processual', titulo: 'Valor da causa',
    descricao: 'Soma dos pedidos econômicos (principal + acessórios).', casos: 'Definição do valor da causa.',
    baseLegal: 'Arts. 291-293 CPC. Alimentos: 12 prestações (art. 292, III).',
    campos: [
      { name: 'principal', label: 'Pedido principal', type: 'currency', required: true },
      { name: 'acessorios', label: 'Acessórios (juros/multa vencidos)', type: 'currency' },
      { name: 'alimentos', label: 'Prestação mensal (se alimentos)', type: 'currency' },
    ],
    compute: (v) => { const ali = num(v.alimentos)*12; const total = num(v.principal)+num(v.acessorios)+ali; return { headline: { label: 'Valor da causa', value: brl(total) }, linhas: [{label:'Principal', value: brl(num(v.principal))}, ...(num(v.acessorios)?[{label:'Acessórios', value: brl(num(v.acessorios))}]:[]), ...(ali?[{label:'Alimentos (×12)', value: brl(ali)}]:[])], memoria: [`Valor da causa = ${brl(num(v.principal))} + ${brl(num(v.acessorios))} ${ali?`+ ${brl(ali)} (12 prestações)`:''} = ${brl(total)}`], criterios: [] } },
  },
]

export const getCalc = (id) => CALCULADORAS.find(c => c.id === id)
export const calcsByRamo = (ramo) => CALCULADORAS.filter(c => c.ramo === ramo)

export { DISCLAIMER }
