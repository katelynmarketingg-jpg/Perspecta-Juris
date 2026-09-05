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
  CALCULADORAS, PARAMS, num,
} = await import('../../client/src/lib/legalCalc.js')

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
  if (!linha(pd, 'Aviso') && !linha(pd, 'Multa') && linha(pd, '13º'))
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

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
