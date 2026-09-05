// Auditoria do motor de cálculos jurídicos.
//
// Três erros foram encontrados e corrigidos aqui:
//   1. mesesEntre() tinha `m -= 0` — um no-op no lugar do desconto do mês
//      incompleto. Cobrava juros de um mês que ainda não fechou.
//   2. os avos do 13º ignoravam a data de admissão.
//   3. as férias proporcionais usavam os avos do ano civil, em vez do
//      período aquisitivo (aniversário da admissão).
//
// Este arquivo roda sem servidor e sem banco: é só matemática.
const {
  mesesEntre, avosDecimoTerceiro, avosFeriasProporcionais,
  fracao, mesesEmPena, jurosDePrestacoes, diasDoPeriodo, diasEntre,
  descontoINSS, descontoIRRF, definirTabelaIRRF, restaurarTabelaIRRF, centavos,
  FAIXAS_IRRF_PADRAO, DEDUCAO_DEPENDENTE_PADRAO, DESCONTO_SIMPLIFICADO,
  CALCULADORAS, PARAMS, num, valorBrl, camposCorrecao,
} = await import('../../client/src/lib/legalCalc.js')
const { calcularPrazo, pascoa, feriadosDoAno, ehDiaUtil, emUTC, noRecesso } =
  await import('../../client/src/lib/prazos.js')

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const calc = (id) => CALCULADORAS.find(c => c.id === id)
const rodar = (id, v) => calc(id).compute(v)
const brlNum = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.'))
const linha = (r, texto) => r.linhas.find(l => l.label.includes(texto))

console.log('\n── 1. Meses entre datas: o mês incompleto não conta ──')
{
  eq(mesesEntre('2026-01-01', '2026-02-01'), 1, 'mês cheio')
  eq(mesesEntre('2026-01-15', '2026-02-01'), 0, 'mês que não fechou')
  eq(mesesEntre('2026-01-15', '2026-02-14'), 0, 'um dia antes de fechar')
  eq(mesesEntre('2026-01-15', '2026-02-15'), 1, 'no dia exato, fecha')
  eq(mesesEntre('2020-03-25', '2026-01-10'), 69, 'o caso que cobrava 70')

  // Quem começa dia 31 fecha no último dia dos meses curtos — senão
  // fevereiro nunca fecharia.
  eq(mesesEntre('2026-01-31', '2026-02-28'), 1, 'de 31/01 a 28/02 (fevereiro fecha)')
  eq(mesesEntre('2026-01-31', '2026-02-27'), 0, 'de 31/01 a 27/02 (ainda não)')

  eq(mesesEntre('2026-05-10', '2026-05-09'), 0, 'data final antes da inicial não vira negativo')
  eq(mesesEntre(null, '2026-01-01'), 0, 'data faltando devolve 0')
}

console.log('\n── 2. O fuso do Brasil não muda mais o resultado ──')
{
  // `new Date('2026-03-25')` em Brasília virava 24/03 às 21h, e todo dia do
  // mês saía um a menos. Agora a leitura é sempre em UTC.
  const antes = process.env.TZ
  const medir = (tz) => { process.env.TZ = tz; return mesesEntre('2026-01-01', '2026-07-01') }
  const utc = medir('UTC'), br = medir('America/Sao_Paulo'), toquio = medir('Asia/Tokyo')
  process.env.TZ = antes
  if (utc === br && br === toquio && utc === 6) ok(`6 meses em qualquer fuso (UTC/BR/Tóquio)`)
  else bad(`UTC=${utc} BR=${br} Tóquio=${toquio} — o fuso ainda interfere`)
}

console.log('\n── 3. Avos de 13º: a admissão conta ──')
{
  eq(avosDecimoTerceiro('2020-01-01', '2026-09-05'),  8, 'ano inteiro, saída dia 5 de setembro (setembro não conta)')
  eq(avosDecimoTerceiro('2020-01-01', '2026-09-20'),  9, 'saída dia 20 de setembro (setembro conta)')
  eq(avosDecimoTerceiro('2026-06-10', '2026-09-20'),  4, 'admitida em junho — o caso que dava 9')
  eq(avosDecimoTerceiro('2026-06-20', '2026-09-20'),  3, 'admitida dia 20 de junho (junho tem 11 dias, não conta)')
  eq(avosDecimoTerceiro('2026-06-16', '2026-09-20'),  4, 'admitida dia 16 de junho (junho tem 15 dias, conta)')
  eq(avosDecimoTerceiro('2020-01-01', '2026-12-31'), 12, 'ano fechado dá 12, nunca mais')
  eq(avosDecimoTerceiro('2026-09-25', '2026-09-30'),  0, 'menos de 15 dias no único mês: nenhum avo')
}

console.log('\n── 4. Avos de férias: valem do aniversário da admissão ──')
{
  // 5 meses fechados (15/03 a 14/08) + sobra de 22 dias = 6 avos. O sistema
  // dava 8, porque contava setembro do ano civil.
  eq(avosFeriasProporcionais('2015-03-15', '2026-09-05'), 6, 'casa de anos: conta de 15/03, não de 1º de janeiro')
  eq(avosFeriasProporcionais('2015-03-15', '2026-09-20'), 6, 'a sobra de 5 dias vira avo quando passa de 15')
  eq(avosFeriasProporcionais('2026-06-10', '2026-09-20'), 3, 'admitida em junho: 3 meses fechados, sobra de 10 dias')
  eq(avosFeriasProporcionais('2026-06-10', '2026-09-25'), 4, 'sobra de 15 dias conta mês inteiro')
  // Na véspera do aniversário o período aquisitivo fecha: 11 meses cheios +
  // sobra de 30 dias = 12/12. Vira direito a férias integrais — mesmo valor.
  eq(avosFeriasProporcionais('2020-05-01', '2026-04-30'), 12, 'véspera do aniversário: o período fechou')
  eq(avosFeriasProporcionais('2020-05-01', '2026-05-01'), 0, 'no aniversário, o período aquisitivo recomeça')
  eq(avosFeriasProporcionais('2026-09-01', '2026-08-01'), 0, 'saída antes da admissão devolve 0')
}

console.log('\n── 5. A rescisão inteira, com os números corrigidos ──')
{
  // Admitida 10/06/2026, dispensada 20/09/2026, R$ 3.000, sem justa causa.
  const r = rodar('verbas-rescisorias', {
    salario: '3000', admissao: '2026-06-10', saida: '2026-09-20',
    motivo: 'sem_justa', diasTrabMes: '20', feriasVencidas: 'nao', fgtsDepositado: '0',
  })
  const d13 = brlNum(linha(r, '13º')?.value)
  const fer = brlNum(linha(r, 'Férias proporcionais')?.value)

  if (Math.abs(d13 - 1000) < 0.01) ok(`13º = R$ 1.000,00 (antes dava R$ 2.250,00)`)
  else bad(`13º deu ${d13}, esperado 1000`)
  if (Math.abs(fer - 1000) < 0.01) ok(`Férias + 1/3 = R$ 1.000,00 (antes dava R$ 3.000,00)`)
  else bad(`Férias deu ${fer}, esperado 1000`)

  if (linha(r, 'Aviso-prévio')?.value.includes('3.000')) ok('aviso-prévio de 30 dias = 1 salário')
  else bad(`aviso: ${linha(r, 'Aviso-prévio')?.value}`)

  // Justa causa derruba aviso, 13º, férias proporcionais e multa.
  const jc = rodar('verbas-rescisorias', {
    salario: '3000', admissao: '2020-01-01', saida: '2026-09-20',
    motivo: 'justa', diasTrabMes: '20', feriasVencidas: 'nao', fgtsDepositado: '10000',
  })
  if (!linha(jc, '13º') && !linha(jc, 'Férias proporcionais') && !linha(jc, 'Aviso') && !linha(jc, 'Multa'))
    ok('justa causa: só saldo de salário')
  else bad(`justa causa pagou a mais: ${jc.linhas.map(l => l.label).join(' | ')}`)

  // Pedido de demissão: sem aviso e sem multa, mas com 13º e férias.
  const pd = rodar('verbas-rescisorias', {
    salario: '3000', admissao: '2020-01-01', saida: '2026-09-20',
    motivo: 'pedido', diasTrabMes: '20', feriasVencidas: 'nao', fgtsDepositado: '10000',
  })
  // A multa do art. 477 é devida TAMBÉM no pedido de demissão: a obrigação de
  // pagar em 10 dias é do empregador, não importa quem pediu a saída. O que
  // não cabe aqui é a multa de 40% do FGTS.
  if (!linha(pd, 'Aviso') && !linha(pd, 'Multa 40%') && linha(pd, '13º'))
    ok('pedido de demissão: sem aviso e sem multa de 40%, mas com 13º')
  else bad(`pedido: ${pd.linhas.map(l => l.label).join(' | ')}`)

  // Aviso-prévio proporcional: 30 + 3 por ano, teto de 90 (Lei 12.506/2011).
  const velho = rodar('verbas-rescisorias', {
    salario: '3000', admissao: '1990-01-01', saida: '2026-09-20',
    motivo: 'sem_justa', diasTrabMes: '20', feriasVencidas: 'nao', fgtsDepositado: '0',
  })
  if (linha(velho, 'Aviso-prévio')?.label.includes('90 dias')) ok('aviso-prévio trava em 90 dias')
  else bad(`aviso do veterano: ${linha(velho, 'Aviso-prévio')?.label}`)
}

console.log('\n── 6. Juros sobre a dívida, com o mês certo ──')
{
  // R$ 100.000, 1% ao mês simples, sem correção: de 25/03/2020 a 10/01/2026.
  const r = rodar('atualizacao-divida', {
    valor: '100000', dataInicial: '2020-03-25', dataFinal: '2026-01-10',
    indice: 'manual', taxaAcumulada: '0', jurosMes: '1', jurosTipo: 'simples',
  })
  const juros = brlNum(linha(r, 'Juros')?.value)
  if (Math.abs(juros - 69000) < 0.01) ok('juros = R$ 69.000,00 (antes cobrava R$ 70.000,00)')
  else bad(`juros deu ${juros}, esperado 69000`)

  // SELIC já engloba juros: não pode somar juros por cima.
  const selic = rodar('atualizacao-divida', {
    valor: '100000', dataInicial: '2020-03-25', dataFinal: '2026-01-10',
    indice: 'selic', taxaAcumulada: '50', jurosMes: '1', jurosTipo: 'simples',
  })
  if (brlNum(linha(selic, 'Juros')?.value) === 0) ok('com SELIC, não soma juros em cima')
  else bad(`SELIC somou juros: ${linha(selic, 'Juros')?.value}`)
}

console.log('\n── 7. Parâmetros de 2026 ──')
{
  eq(PARAMS.salarioMinimo, 1621.00, 'salário mínimo (Portaria MPS/MF nº 13/2026)')
  eq(PARAMS.tetoINSS, 8475.55, 'teto do INSS (Portaria MPS/MF nº 13/2026)')
}

console.log('\n── 8. Leitura de números em português ──')
{
  eq(num('1.234,56'), 1234.56, 'ponto de milhar e vírgula decimal')
  eq(num('R$ 3.000,00'), 3000, 'com símbolo de moeda')
  eq(num('1.500'), 1500, 'mil e quinhentos, não um vírgula cinco')
  eq(num('0.16'), 0.16, 'ponto decimal também funciona')
  eq(num(''), 0, 'vazio é zero')
  eq(num('abc'), 0, 'texto é zero, não NaN')
}

console.log('\n── 9. Dosimetria: 2 anos não é "1 ano e 12 meses" ──')
{
  // Frações jurídicas por extenso: 1/3 não cabe em decimal, e o 0,3333 que o
  // campo pedia fazia 24 meses virarem 23,9994 — "1 ano e 11 meses e 29 dias".
  if (Math.abs(fracao('1/3') - 1/3) < 1e-12) ok("'1/3' é lido como um terço exato")
  else bad(`fracao('1/3') = ${fracao('1/3')}`)
  eq(fracao('2/3') === 2/3, true, "'2/3' exato")
  eq(fracao('0.5'), 0.5, 'decimal continua funcionando')
  eq(fracao('1/0'), 0, 'divisão por zero não vira Infinity')
  eq(fracao('qualquer coisa'), 0, 'texto vira 0')

  const dos = (v) => calc('dosimetria').compute(v).headline.value
  const padrao = { agravantes: '0', atenuantes: '0', diminuicao: '0' }
  eq(dos({ ...padrao, minMeses: '6',  maxMeses: '54',  circNeg: '2', aumento: '1/3' }), '2 anos', 'o caso que dava "1 ano e 12 meses"')
  eq(dos({ ...padrao, minMeses: '6',  maxMeses: '18',  circNeg: '2', aumento: '1/3' }), '1 ano', 'o caso que dava "0 anos e 12 meses"')
  eq(dos({ ...padrao, minMeses: '48', maxMeses: '120', circNeg: '0', aumento: '0'   }), '4 anos', 'pena no mínimo, sem aumento')

  eq(JSON.stringify(mesesEmPena(24)),   '{"anos":2,"meses":0,"dias":0}', '24 meses = 2 anos exatos')
  eq(JSON.stringify(mesesEmPena(23.9994)), '{"anos":1,"meses":11,"dias":29}', 'quase-24 continua sendo quase-24 (não arredonda para cima sozinho)')
  eq(JSON.stringify(mesesEmPena(19.2)), '{"anos":1,"meses":7,"dias":6}', 'os dias aparecem, em vez de sumirem no arredondamento')

  // Súmula 231 STJ e o teto da moldura legal, na 2ª fase.
  const piso = calc('dosimetria').compute({ minMeses: '12', maxMeses: '48', circNeg: '0', agravantes: '0', atenuantes: '1/2', aumento: '0', diminuicao: '0' })
  if (piso.headline.value === '1 ano') ok('atenuante não leva a pena abaixo do mínimo (Súm. 231 STJ)')
  else bad(`2ª fase furou o piso: ${piso.headline.value}`)
  const teto = calc('dosimetria').compute({ minMeses: '12', maxMeses: '48', circNeg: '8', agravantes: '1/2', aumento: '0', atenuantes: '0', diminuicao: '0' })
  if (teto.headline.value === '4 anos') ok('agravante não leva a 2ª fase acima do máximo')
  else bad(`2ª fase furou o teto: ${teto.headline.value}`)
}

console.log('\n── 10. Aluguel e condomínio: cada prestação atrasa o seu tempo ──')
{
  // Cobrar `total × juros × N` trata tudo como vencido desde o começo.
  eq(jurosDePrestacoes(2000, 12, 0.01), 1560, '12 aluguéis de R$ 2.000 a 1% (era R$ 2.880)')
  eq(jurosDePrestacoes(2000, 1, 0.01), 20, 'um mês só: juros de um mês')
  eq(jurosDePrestacoes(2000, 0, 0.01), 0, 'nenhum mês, nenhum juro')

  const al = rodar('aluguel-atraso', { aluguel: '2000', meses: '12', multa: '0', jurosMes: '1', taxaAcumulada: '0', encargos: '0' })
  const jurosAl = brlNum(linha(al, 'Juros')?.value)
  if (Math.abs(jurosAl - 1560) < 0.01) ok('aluguel: R$ 1.560,00 de juros (antes R$ 2.880,00 — 85% a mais)')
  else bad(`juros do aluguel: ${jurosAl}`)

  const cd = rodar('condominio-atraso', { cota: '500', meses: '6', multa: '2', jurosMes: '1' })
  const jurosCd = brlNum(linha(cd, 'Juros')?.value)
  if (Math.abs(jurosCd - 105) < 0.01) ok('condomínio: R$ 105,00 de juros (antes R$ 180,00)')
  else bad(`juros do condomínio: ${jurosCd}`)

  const abusiva = rodar('condominio-atraso', { cota: '500', meses: '6', multa: '10', jurosMes: '1' })
  if (abusiva.memoria.some(m => m.includes('1.336'))) ok('multa de condomínio acima de 2% é avisada (art. 1.336, §1º CC)')
  else bad('multa de 10% passou sem aviso')
}

console.log('\n── 11. Tempo de contribuição: o último dia conta ──')
{
  // Distância entre datas e duração de um período são coisas diferentes.
  eq(diasEntre('2020-01-01', '2020-12-31'), 365, 'distância entre as duas datas')
  eq(diasDoPeriodo('2020-01-01', '2020-12-31'), 366, 'período trabalhado (o INSS conta os dois extremos)')
  eq(diasDoPeriodo('2026-05-10', '2026-05-10'), 1, 'um dia de vínculo conta 1, não 0')
  eq(diasDoPeriodo('2026-05-10', '2026-05-01'), 0, 'fim antes do início não vira negativo')
  eq(diasDoPeriodo(null, '2026-01-01'), 0, 'data faltando devolve 0')

  const tc = rodar('tempo-contribuicao', { periodos: [
    { inicio: '2020-01-01', fim: '2020-12-31' },
    { inicio: '2021-01-01', fim: '2021-12-31' },
  ]})
  if (tc.linhas[0].value === '731 dias') ok('dois anos somam 731 dias (366 + 365), não 729')
  else bad(`somou ${tc.linhas[0].value}`)
}

console.log('\n── 12. Alimentos atrasados: parcela a parcela ──')
{
  const r = rodar('alimentos-atrasados', { valorParcela: '1000', parcelas: '12', taxaAcumulada: '0', jurosMes: '1', multa: '0' })
  const juros = brlNum(linha(r, 'Juros')?.value)
  if (Math.abs(juros - 780) < 0.01) ok('R$ 780,00 de juros (a aproximação dava R$ 720,00)')
  else bad(`juros dos alimentos: ${juros}`)
  if (!r.criterios.some(c => c.toLowerCase().includes('aproximad'))) ok('a tela não chama mais o número de aproximado')
  else bad('ainda diz que é aproximado')
}

console.log('\n── 13. Nada de valor negativo na partilha ──')
{
  const r = rodar('partilha-bens', { bens: '100000', dividas: '250000', regime: 'parcial', bensParticulares: '0' })
  if (r.headline.value === brl0()) ok('dívidas maiores que os bens: meação zerada, não negativa')
  else bad(`título mostrou ${r.headline.value}`)
}
function brl0() { return (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

console.log('\n── 14. Transição da EC 103/2019 ──')
{
  const pts = (v) => rodar('regra-pontos', v).linhas.find(l => l.label.startsWith('Exigido')).value
  eq(pts({ sexo: 'F', idade: '60', tempoAnos: '30', ano: '2026' }), '93 pts', 'mulher em 2026 (86 + 7)')
  eq(pts({ sexo: 'M', idade: '62', tempoAnos: '35', ano: '2026' }), '103 pts', 'homem em 2026 (96 + 7)')
  eq(pts({ sexo: 'F', idade: '65', tempoAnos: '30', ano: '2040' }), '100 pts', 'mulher trava em 100')
  eq(pts({ sexo: 'M', idade: '65', tempoAnos: '35', ano: '2040' }), '105 pts', 'homem trava em 105')
  if (calc('regra-pontos').campos.find(c => c.name === 'ano').default === String(new Date().getFullYear()))
    ok('o ano de análise acompanha o calendário (estava preso em 2025)')
  else bad('o ano de análise continua fixo')

  const p50 = rodar('pedagio-50', { sexo: 'M', tempoNaData: '34' })
  if (p50.headline.label.includes('✅')) ok('faltando 1 ano em 13/11/2019: elegível ao pedágio de 50%')
  else bad(`pedágio 50: ${p50.headline.label}`)
  const p50n = rodar('pedagio-50', { sexo: 'M', tempoNaData: '30' })
  if (p50n.headline.label.includes('❌')) ok('faltando 5 anos: fora do pedágio de 50%')
  else bad(`pedágio 50 aceitou quem faltava 5 anos`)
}

console.log('\n── 15. Prazo processual: os feriados móveis ──')
{
  // Páscoa manda em Carnaval, Sexta-feira Santa e Corpus Christi. Uma lista
  // fixa ficaria errada no ano seguinte.
  const pas = (a) => pascoa(a).toISOString().slice(0, 10)
  eq(pas(2026), '2026-04-05', 'Páscoa 2026')
  eq(pas(2027), '2027-03-28', 'Páscoa 2027')
  eq(pas(2030), '2030-04-21', 'Páscoa 2030')

  const f26 = feriadosDoAno(2026).map(f => f.data)
  if (f26.includes('2026-02-16') && f26.includes('2026-02-17')) ok('Carnaval 2026 nos dias 16 e 17 de fevereiro')
  else bad(`carnaval: ${f26.join(', ')}`)
  if (f26.includes('2026-04-03')) ok('Sexta-feira Santa 2026 em 3 de abril')
  else bad('sexta-feira santa errada')
  if (f26.includes('2026-06-04')) ok('Corpus Christi 2026 em 4 de junho')
  else bad('corpus christi errado')
  if (f26.includes('2026-11-20')) ok('Consciência Negra (Lei 14.759/2023) está na lista')
  else bad('20 de novembro não entrou')

  // Errar para o lado do feriado joga o vencimento para depois do real, e a
  // petição entra intempestiva. A Quarta-feira de Cinzas tem expediente na
  // maioria dos tribunais, então NÃO entra.
  if (!f26.includes('2026-02-18')) ok('Quarta-feira de Cinzas fica de fora (erra para o lado seguro)')
  else bad('cinzas entrou como feriado')
}

console.log('\n── 16. Prazo processual: a contagem ──')
{
  const venc = (pub, dias, opts) => calcularPrazo(pub, dias, opts).vencimento

  // Publicada terça 08/09; começa quarta 09/09; 15 dias úteis → terça 29/09.
  eq(venc('2026-09-08', 15), '2026-09-29', '15 dias úteis de uma terça-feira')
  // Publicada sexta 11/09: art. 224 §3º manda começar na segunda.
  eq(calcularPrazo('2026-09-11', 15).inicio, '2026-09-14', 'publicação na sexta começa a contar na segunda')
  eq(venc('2026-09-11', 15), '2026-10-02', 'e vence na sexta seguinte')
  // Prazo em dobro (art. 183 CPC).
  eq(venc('2026-09-08', 15, { dobro: true }), '2026-10-21', 'prazo em dobro da Fazenda')

  // Recesso de 20/12 a 20/01 (art. 220 CPC): o prazo atravessa o ano.
  const rec = calcularPrazo('2026-12-15', 15)
  if (rec.vencimento > '2027-01-20') ok(`recesso empurra o vencimento para ${rec.vencimento}`)
  else bad(`recesso ignorado: venceu em ${rec.vencimento}`)
  if (rec.pulados.some(p => p.motivo.includes('220'))) ok('a memória mostra o recesso como motivo')
  else bad('recesso não apareceu nos dias pulados')

  // Feriado local informado pela pessoa.
  const semFeriado = venc('2026-09-11', 15)
  const comFeriado = venc('2026-09-11', 15, { feriadosExtras: ['2026-09-21', '2026-09-22'] })
  if (comFeriado > semFeriado) ok('dois feriados locais empurram o vencimento em dois dias')
  else bad(`feriado local ignorado: ${semFeriado} → ${comFeriado}`)

  // Dias corridos: art. 132 CC prorroga só o vencimento.
  const corr = calcularPrazo('2026-09-08', 30, { uteis: false })
  eq(corr.vencimento, '2026-10-08', '30 dias corridos')
  const cai = calcularPrazo('2026-10-02', 30, { uteis: false })
  if (ehDiaUtil(emUTC(cai.vencimento))) ok('vencimento em dia não útil é prorrogado')
  else bad(`venceu em dia sem expediente: ${cai.vencimento}`)

  eq(calcularPrazo(null, 15), null, 'sem data, não inventa prazo')
  eq(calcularPrazo('2026-09-08', 0), null, 'sem dias, não inventa prazo')
  if (noRecesso(emUTC('2026-12-25')) && noRecesso(emUTC('2027-01-05')) && !noRecesso(emUTC('2027-01-21')))
    ok('o recesso vai de 20/12 a 20/01, e acaba ali')
  else bad('as bordas do recesso estão erradas')
}

console.log('\n── 17. INSS: progressivo, faixa a faixa ──')
{
  // Portaria Interministerial MPS/MF nº 13/2026.
  const inss = (s) => descontoINSS(s).valor
  eq(inss(1621.00), 121.58, 'no piso: 7,5% sobre tudo (121,575 arredonda PARA CIMA, como no holerite)')
  eq(centavos(121.575), 121.58, 'o arredondamento de centavos não desce no meio')
  eq(centavos(-121.575), -121.58, 'e faz o mesmo com valor negativo')
  eq(centavos('abc'), 0, 'texto vira zero, não NaN')
  eq(inss(2000), 155.69, 'R$ 2.000 pega duas faixas')
  eq(inss(5000), 501.51, 'R$ 5.000 pega quatro faixas')
  eq(inss(8475.55), 988.09, 'no teto: contribuição máxima')
  eq(inss(50000), 988.09, 'acima do teto, não sobe mais')
  eq(inss(0), 0, 'sem salário, sem contribuição')

  // A prova de que é progressivo: 14% de 5.000 seriam R$ 700, não R$ 501,51.
  if (inss(5000) < 5000 * 0.14) ok('a alíquota não incide sobre o salário inteiro')
  else bad('está aplicando a alíquota cheia sobre tudo')
  if (descontoINSS(9000).tetoAtingido) ok('avisa quando bate no teto')
  else bad('não sinalizou o teto')
}

console.log('\n── 18. IRRF: a tabela oficial de 2026 ──')
{
  restaurarTabelaIRRF()

  // A "dedução" de cada faixa não é arbitrária: existe para o imposto não dar
  // um salto na virada. Se a tabela fecha nessa conta, não houve erro de
  // digitação — é a melhor verificação possível sem acesso à fonte.
  let continua = true
  for (let i = 1; i < FAIXAS_IRRF_PADRAO.length; i++) {
    const ant = FAIXAS_IRRF_PADRAO[i - 1], at = FAIXAS_IRRF_PADRAO[i]
    const esperado = ant.deduzir + ant.ate * (at.aliquota - ant.aliquota)
    if (Math.abs(esperado - at.deduzir) > 0.01) continua = false
  }
  if (continua) ok('as cinco faixas fecham na conta da continuidade (Lei 15.191/2025)')
  else bad('a tabela não é internamente consistente — erro de digitação?')

  eq(DEDUCAO_DEPENDENTE_PADRAO, 189.59, 'dedução mensal por dependente')
  eq(DESCONTO_SIMPLIFICADO, 607.20, 'desconto simplificado = 25% da 1ª faixa (2.428,80)')
  eq(centavos(2428.80 * 0.25), 607.20, 'e 25% de 2.428,80 dá exatamente isso')

  // Isento: base abaixo da primeira faixa.
  eq(descontoIRRF(2000, 0).valor, 0, 'base de R$ 2.000: isento')
  // O desconto simplificado (607,20) ganha de 2 dependentes (379,18), e a lei
  // manda aplicar o mais favorável.
  const doisDep = descontoIRRF(5000, 2)
  if (doisDep.usouSimplificado) ok('com 2 dependentes, o simplificado ainda é melhor — e é o que se usa')
  else bad('aplicou as deduções legais sendo o simplificado maior')
  // A base de 4.392,80 fica ABAIXO de 4.664,68, então cai na faixa de 22,5%
  // — e não na última. É exatamente o tipo de faixa que se erra na mão.
  eq(doisDep.faixa.aliquota, 0.225, 'base de 4.392,80 cai na faixa de 22,5%, não na última')
  eq(doisDep.valor, 312.89, '4.392,80 × 22,5% − 675,49')

  // Com dependentes suficientes, as deduções legais passam o simplificado.
  const muitos = descontoIRRF(5000, 4)
  if (!muitos.usouSimplificado) ok('com 4 dependentes (R$ 758,36), as deduções legais passam a valer mais')
  else bad('continuou no simplificado com 4 dependentes')
  if (muitos.valor < doisDep.valor) ok('e o imposto cai')
  else bad('mais dependentes não reduziram o imposto')

  // Nunca negativo.
  eq(descontoIRRF(0, 5).valor, 0, 'sem rendimento, sem imposto (e não negativo)')

  const cheio = rodar('rescisao-liquida', { salario: '5000', verbasTributaveis: '6500', verbasIsentas: '4000', dependentes: '0', outrosDescontos: '0' })
  if (cheio.headline.label === 'Líquido a receber') ok('o líquido da rescisão agora vem completo')
  else bad(`título: ${cheio.headline.label}`)

  // E o comportamento de segurança continua lá, para quando a tabela virar o ano.
  definirTabelaIRRF([], 0)
  if (descontoIRRF(5000, 0).aplicavel === false) ok('tabela esvaziada: volta a dizer "não aplicável", não zero')
  else bad('tabela vazia devolveu zero como se não houvesse imposto')
  const semIR = rodar('rescisao-liquida', { salario: '5000', verbasTributaveis: '6500', verbasIsentas: '4000', dependentes: '0', outrosDescontos: '0' })
  if (semIR.memoria.some(m => m.includes('MAIOR que o real'))) ok('e avisa que o líquido está superestimado')
  else bad('não avisou')
  restaurarTabelaIRRF()
}

console.log('\n── 19. Multas do art. 477 e do art. 467 da CLT ──')
{
  const m = (v) => rodar('multa-477', { salario: '3000', incontroversas: '0', ...v })
  // Saída num sábado: o prazo de 10 dias é material, começa no dia seguinte
  // mesmo sendo domingo — só o vencimento é que prorroga (art. 132 CC).
  if (brlNum(m({ saida: '2026-08-01', pagamento: '2026-08-11' }).headline.value) === 0)
    ok('pago no último dia do prazo: sem multa')
  else bad('cobrou multa de quem pagou no prazo')
  if (brlNum(m({ saida: '2026-08-01', pagamento: '2026-08-12' }).headline.value) === 3000)
    ok('um dia depois: multa de 1 salário (art. 477, §8º)')
  else bad('não aplicou a multa do atraso')
  if (brlNum(m({ saida: '2026-08-01', pagamento: '' }).headline.value) === 3000)
    ok('sem pagamento nenhum: multa devida')
  else bad('não aplicou multa para quem nunca pagou')

  const art467 = m({ saida: '2026-08-01', pagamento: '2026-08-11', incontroversas: '5000' })
  if (brlNum(art467.headline.value) === 2500) ok('art. 467: 50% do incontroverso')
  else bad(`art. 467 deu ${art467.headline.value}`)
}

console.log('\n── 20. DSR, salário-maternidade e auxílio-acidente ──')
{
  const dsr = rodar('dsr-horas-extras', { valorExtras: '1000', diasUteis: '25', diasRepouso: '5' })
  if (brlNum(dsr.headline.value) === 200) ok('DSR = extras ÷ dias úteis × repousos (Súm. 172 TST)')
  else bad(`DSR deu ${dsr.headline.value}`)
  const dsr0 = rodar('dsr-horas-extras', { valorExtras: '1000', diasUteis: '0', diasRepouso: '5' })
  if (isFinite(brlNum(dsr0.headline.value))) ok('zero dias úteis não vira divisão por zero')
  else bad('dividiu por zero')

  const sm = (cat, base) => rodar('salario-maternidade', { categoria: cat, base, dias: '120' })
  if (brlNum(sm('especial', '').linhas[0].value) === PARAMS.salarioMinimo) ok('segurada especial: 1 salário mínimo')
  else bad('segurada especial errada')
  if (brlNum(sm('individual', '20000').linhas[0].value) === PARAMS.tetoINSS) ok('contribuinte individual trava no teto do INSS')
  else bad('individual passou do teto')
  if (brlNum(sm('empregada', '20000').linhas[0].value) === 20000) ok('empregada NÃO trava no teto (Súm. 688 STF)')
  else bad('aplicou o teto à empregada')
  if (brlNum(sm('empregada', '500').linhas[0].value) === PARAMS.salarioMinimo) ok('nunca abaixo do salário mínimo')
  else bad('ficou abaixo do piso')

  const aa = rodar('auxilio-acidente', { salarioBeneficio: '2400' })
  if (brlNum(aa.headline.value) === 1200) ok('auxílio-acidente: 50% do salário de benefício (art. 86, §1º)')
  else bad(`auxílio-acidente deu ${aa.headline.value}`)
}

console.log('\n── 21. Rescisão completa: do bruto ao líquido numa conta só ──')
{
  const base = {
    salario: '4000', admissao: '2021-03-15', saida: '2026-09-20', motivo: 'sem_justa',
    diasTrabMes: '20', feriasVencidas: 'nao', fgtsDepositado: '18000',
    dependentes: '1', pagamento: '', outrosDescontos: '0',
  }
  const r = rodar('verbas-rescisorias', base)
  if (r.headline.label === 'Líquido a receber') ok('o resultado termina no líquido, não no bruto')
  else bad(`título: ${r.headline.label}`)
  if (linha(r, 'INSS') && linha(r, 'IRRF')) ok('INSS e IRRF aparecem na mesma tela')
  else bad('faltou algum desconto')

  // Só saldo e 13º sofrem incidência; férias indenizadas e multa de 40%, não.
  const inss = brlNum(linha(r, 'INSS').value)
  if (Math.abs(inss - 368.60) < 0.01) ok('INSS calculado sobre o salário, não sobre o total bruto')
  else bad(`INSS deu ${inss}`)

  // Sem data de pagamento = ainda não pagou = multa do art. 477.
  if (linha(r, 'art. 477')) ok('sem pagamento informado, a multa do art. 477 entra sozinha')
  else bad('não aplicou a multa do atraso')
  const noPrazo = rodar('verbas-rescisorias', { ...base, pagamento: '2026-09-30' })
  if (!linha(noPrazo, 'art. 477')) ok('pago dentro dos 10 dias: sem multa')
  else bad('cobrou multa de quem pagou no prazo')

  // Justa causa não gera multa do art. 477 nem 40%.
  const jc = rodar('verbas-rescisorias', { ...base, motivo: 'justa' })
  if (!linha(jc, 'art. 477') && !linha(jc, 'Multa 40%')) ok('justa causa: nenhuma das duas multas')
  else bad('justa causa gerou multa')
}

console.log('\n── 22. Reclamatória trabalhista completa ──')
{
  const r = rodar('reclamatoria-trabalhista', {
    salario: '3000', meses: '24', horasExtrasMes: '20', adicionalHE: '50', divisor: '220',
    horasNoturnasMes: '0', insalubridade: '20', periculosidade: 'nao',
    verbasRescisorias: '15000', incontroversas: '5000', multa477: 'sim',
  })
  // Hora normal 3000/220 = 13,6364; extra ×1,5 = 20,4545; ×20h = 409,09/mês.
  const extras = brlNum(linha(r, 'Horas extras').value)
  if (Math.abs(extras - 9818.18) < 0.05) ok('horas extras de 24 meses conferem')
  else bad(`extras deu ${extras}`)
  const dsr = brlNum(linha(r, 'DSR').value)
  if (Math.abs(dsr - extras / 5) < 0.05) ok('DSR = 1/5 das extras (5 repousos ÷ 25 dias úteis)')
  else bad(`DSR deu ${dsr}`)

  // Insalubridade tem base no salário mínimo, não no salário do trabalhador.
  const ins = brlNum(linha(r, 'Insalubridade').value)
  if (Math.abs(ins - PARAMS.salarioMinimo * 0.20 * 24) < 0.05)
    ok('insalubridade sobre o salário mínimo (Súm. Vinc. 4 STF)')
  else bad(`insalubridade deu ${ins}`)

  if (linha(r, 'FGTS') && linha(r, 'Multa 40%')) ok('FGTS de 8% e a multa de 40% sobre os reflexos')
  else bad('faltou o FGTS dos reflexos')
  if (brlNum(linha(r, 'art. 467').value) === 2500) ok('multa do art. 467 sobre o incontroverso')
  else bad('art. 467 errado')

  // Os dois adicionais não se acumulam: precisa avisar.
  const ambos = rodar('reclamatoria-trabalhista', {
    salario: '3000', meses: '12', horasExtrasMes: '0', adicionalHE: '50', divisor: '220',
    horasNoturnasMes: '0', insalubridade: '20', periculosidade: 'sim',
    verbasRescisorias: '0', incontroversas: '0', multa477: 'nao',
  })
  if (ambos.memoria.some(m => m.includes('não se acumulam')))
    ok('avisa que insalubridade e periculosidade não se acumulam (art. 193, §2º)')
  else bad('somou os dois adicionais em silêncio')
}

console.log('\n── 23. Inventário completo ──')
{
  const r = rodar('inventario-completo', {
    bens: '800000', bensComuns: '600000', dividas: '50000',
    herdeiros: '3', itcmd: '4', custas: '1', honorarios: '6',
  })
  // A meação sai ANTES: é do cônjuge, nunca foi do falecido.
  if (brlNum(linha(r, 'Meação').value) === 300000) ok('meação = metade dos bens comuns')
  else bad('meação errada')
  if (brlNum(linha(r, 'Herança bruta').value) === 500000) ok('herança bruta = acervo − meação')
  else bad('herança bruta errada')
  // ITCMD sobre a herança, não sobre o acervo com a meação dentro.
  if (brlNum(linha(r, 'ITCMD').value) === 20000) ok('ITCMD incide sobre a herança, não sobre a meação')
  else bad('ITCMD calculado sobre a base errada')
  if (Math.abs(brlNum(r.headline.value) - 131666.67) < 0.01) ok('quinhão de cada um dos 3 herdeiros')
  else bad(`quinhão deu ${r.headline.value}`)

  // Dívidas maiores que o acervo não viram quinhão negativo.
  const afundado = rodar('inventario-completo', {
    bens: '100000', bensComuns: '0', dividas: '500000', herdeiros: '2', itcmd: '4', custas: '0', honorarios: '0' })
  if (brlNum(afundado.headline.value) === 0) ok('espólio insolvente: quinhão zero, não negativo')
  else bad(`quinhão negativo: ${afundado.headline.value}`)
}

console.log('\n── 24. Em que regra de aposentadoria a pessoa se encaixa ──')
{
  const r = (v) => rodar('aposentadoria-regras', v)

  // Mulher de 59 anos com 31 de contribuição, em 2026: nenhuma fechada ainda.
  const perto = r({ sexo: 'F', idade: '59', tempoHoje: '31', tempoEm2019: '24', ano: '2026' })
  if (perto.linhas.every(l => l.label.startsWith('❌'))) ok('nenhuma regra cumprida ainda — e diz qual é a mais próxima')
  else bad('marcou alguma regra como cumprida indevidamente')
  if (perto.headline.value.includes('Idade progressiva')) ok('aponta a regra que falta menos')
  else bad(`apontou: ${perto.headline.value}`)

  // Mulher de 63 com 32: regra permanente e pontos fechadas.
  const pronta = r({ sexo: 'F', idade: '63', tempoHoje: '32', tempoEm2019: '', ano: '2026' })
  const ok3 = pronta.linhas.filter(l => l.label.startsWith('✅')).length
  if (ok3 >= 2) ok(`já pode se aposentar por ${ok3} regras`)
  else bad(`só ${ok3} regra(s) cumprida(s)`)
  if (pronta.headline.label === 'Já pode se aposentar por') ok('o título muda quando alguma regra fecha')
  else bad('o título não reflete que já pode')

  // Sem o tempo em 2019, os pedágios não são avaliados — e isso é dito.
  if (pronta.memoria.some(m => m.includes('13/11/2019')))
    ok('avisa que os pedágios ficaram de fora sem o tempo em 13/11/2019')
  else bad('omitiu que não avaliou os pedágios')
  if (!pronta.linhas.some(l => l.label.includes('Pedágio'))) ok('e realmente não os lista')
  else bad('listou pedágio sem ter o dado')
}

console.log('\n── 25. Correção monetária acoplada ──')
{
  eq(valorBrl('R$ 1.234,56'), 1234.56, 'lê o valor de volta do texto formatado')
  eq(valorBrl('R$ 0,00'), 0, 'zero')
  eq(valorBrl('5 anos e 4 meses'), null, 'o que não é dinheiro devolve null')
  eq(valorBrl('2 anos'), null, 'uma pena não é dinheiro')

  const corrigiveis = CALCULADORAS.filter(c => c.corrigivel)
  if (corrigiveis.length > 30) ok(`${corrigiveis.length} calculadoras ganharam o bloco de correção`)
  else bad(`só ${corrigiveis.length} ficaram corrigíveis`)

  // Desligada por padrão: ninguém corrige sem pedir.
  const nominal = rodar('multa-contratual', { valor: '10000', multa: '10' })
  if (brlNum(nominal.headline.value) === 1000) ok('desligada por padrão — o valor sai nominal')
  else bad(`veio corrigido sem pedir: ${nominal.headline.value}`)

  const corrigido = rodar('multa-contratual', {
    valor: '10000', multa: '10', corrigir: 'sim',
    corrDataInicial: '2024-09-20', corrDataFinal: '2026-09-20',
    corrIndice: 'ipca-e', corrTaxa: '30', corrJuros: '1', corrJurosTipo: 'simples',
  })
  // 1000 + 30% = 1300; juros 1% × 24 meses sobre 1300 = 312 → 1612.
  if (Math.abs(brlNum(corrigido.headline.value) - 1612) < 0.01) ok('1.000 + 30% + 1% a.m. por 24 meses = R$ 1.612,00')
  else bad(`corrigido deu ${corrigido.headline.value}`)
  if (corrigido.headline.label.includes('atualizado')) ok('o título diz que está atualizado')
  else bad('o título não avisa')

  // SELIC já engloba juros: não pode somar por cima.
  const selic = rodar('multa-contratual', {
    valor: '10000', multa: '10', corrigir: 'sim',
    corrDataInicial: '2024-09-20', corrDataFinal: '2026-09-20',
    corrIndice: 'selic', corrTaxa: '30', corrJuros: '1', corrJurosTipo: 'simples',
  })
  if (Math.abs(brlNum(selic.headline.value) - 1300) < 0.01) ok('com SELIC, nenhum juro é somado por cima')
  else bad(`SELIC somou juros: ${selic.headline.value}`)

  // O que não é dinheiro não é corrigido, mesmo pedindo.
  const pena = rodar('dosimetria', {
    minMeses: '48', maxMeses: '120', circNeg: '0', agravantes: '0',
    atenuantes: '0', aumento: '0', diminuicao: '0', corrigir: 'sim', corrTaxa: '30',
  })
  if (pena.headline.value === '4 anos') ok('uma pena não é corrigida monetariamente, nem se mandarem')
  else bad(`corrigiu a pena: ${pena.headline.value}`)

  // E quem já corrige por dentro não ganha o bloco, para não corrigir 2 vezes.
  if (!calc('atualizacao-divida').corrigivel) ok('quem já corrige por dentro não recebe o bloco de novo')
  else bad('atualizacao-divida ficaria corrigindo duas vezes')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
