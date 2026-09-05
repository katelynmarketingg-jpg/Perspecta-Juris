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

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
