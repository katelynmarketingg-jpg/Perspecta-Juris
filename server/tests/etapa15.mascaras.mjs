// As máscaras dos campos (telefone, CPF, CNPJ, CEP, nº do processo).
//
// O relato: "não dá para apagar mais do que 4 números" no telefone. O campo
// ficava preso em "(51) 9977-" e o backspace não saía dali.
//
// Causa: a máscara devolvia o hífen mesmo sem nada depois dele — `(\d{0,4})`
// casa com vazio. Num campo controlado isso trava: a pessoa apaga o hífen, os
// dígitos não mudam, a máscara repõe o hífen, e o valor volta igual. Não é
// lentidão nem azar de teclado: é laço infinito, e não tem como sair digitando.
//
// A regra que todas as máscaras têm de obedecer: SEPARADOR SÓ ENTRA QUANDO HÁ
// ALGO DEPOIS DELE. Senão o campo nunca esvazia.
//
// Roda sem servidor e sem banco.
const { formatPhone, formatCpf, formatCnpj, formatCep, formatProcessNumber, formatCpfCnpj } =
  await import('../../client/src/lib/format.js')

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = "${real}"`) : bad(`${msg}: deu "${real}", esperado "${esperado}"`)

// É isto que o navegador faz: apaga um caractere e devolve o resto para a
// máscara, que reformata. Se em algum ponto o valor não encolhe, travou.
function apagarTudo(mascara, valorInicial) {
  let v = mascara(valorInicial)
  const passos = [v]
  for (let i = 0; i < 40; i++) {
    if (v === '') return { esvaziou: true, passos }
    const depois = mascara(v.slice(0, -1))
    if (depois === v) return { esvaziou: false, travouEm: v, passos }
    v = depois
    passos.push(v)
  }
  return { esvaziou: false, travouEm: v, passos }
}

console.log('\n── 1. O caso relatado: apagar o telefone até o fim ──')
{
  const r = apagarTudo(formatPhone, '51997712345')
  if (r.esvaziou) ok(`o campo esvazia por completo (${r.passos.length} backspaces)`)
  else bad(`travou em "${r.travouEm}" — foi exatamente aqui que ela parou`)

  // O estado exato do print: 6 dígitos não podem produzir hífen solto.
  eq(formatPhone('519977'), '(51) 9977', 'seis dígitos, sem hífen sobrando')
  if (!formatPhone('519977').endsWith('-')) ok('nenhum separador no fim')
  else bad('ainda termina em separador')
}

console.log('\n── 2. Toda máscara tem de esvaziar ──')
{
  // O mesmo defeito em qualquer uma delas prenderia o campo do mesmo jeito.
  const casos = [
    ['telefone celular', formatPhone, '51997712345'],
    ['telefone fixo',    formatPhone, '5133321234'],
    ['CPF',              formatCpf, '70131562053'],
    ['CNPJ',             formatCnpj, '11222333000181'],
    ['CPF/CNPJ',         formatCpfCnpj, '70131562053'],
    ['CEP',              formatCep, '95500000'],
    ['nº do processo',   formatProcessNumber, '00012341220268260100'],
  ]
  for (const [nome, fn, valor] of casos) {
    const r = apagarTudo(fn, valor)
    if (r.esvaziou) ok(`${nome}: esvazia`)
    else bad(`${nome}: trava em "${r.travouEm}"`)
  }
}

console.log('\n── 3. Nenhuma máscara termina em separador, em nenhum tamanho ──')
{
  // A causa raiz, varrida: para cada máscara, todo tamanho de entrada.
  const digitos = '51997712345678901234'
  const casos = [['telefone', formatPhone], ['CPF', formatCpf], ['CNPJ', formatCnpj],
                 ['CEP', formatCep], ['processo', formatProcessNumber]]
  for (const [nome, fn] of casos) {
    const ruins = []
    for (let n = 0; n <= digitos.length; n++) {
      const saida = fn(digitos.slice(0, n))
      if (/[-./( ]$/.test(saida)) ruins.push(`${n} dígitos → "${saida}"`)
    }
    if (!ruins.length) ok(`${nome}: nenhum tamanho deixa separador solto`)
    else bad(`${nome}: ${ruins.join(' | ')}`)
  }
}

console.log('\n── 4. E continua formatando certo ──')
{
  eq(formatPhone('51997712345'), '(51) 99771-2345', 'celular com 11 dígitos')
  eq(formatPhone('5133321234'),  '(51) 3332-1234',  'fixo com 10 dígitos')
  eq(formatPhone('519977123456789'), '(51) 99771-2345', 'corta no 11º dígito')
  eq(formatPhone('(51) 99771-2345'), '(51) 99771-2345', 'reformatar o já formatado não muda')
  eq(formatPhone(''), '', 'vazio continua vazio')
  eq(formatPhone(null), '', 'nulo não quebra')
  eq(formatPhone('abc'), '', 'só letras viram vazio')
  eq(formatPhone('5'), '(5', 'primeiro dígito do DDD')
  eq(formatPhone('51'), '(51', 'DDD completo')
  eq(formatPhone('519'), '(51) 9', 'primeiro dígito do número')
  eq(formatCpf('70131562053'), '701.315.620-53', 'CPF')
  eq(formatCnpj('11222333000181'), '11.222.333/0001-81', 'CNPJ')
  eq(formatCep('95500000'), '95500-000', 'CEP')
  eq(formatProcessNumber('00012341220268260100'), '0001234-12.2026.8.26.0100', 'número do processo')
}

console.log('\n── 5. Digitar dígito a dígito não pula nem repete ──')
{
  // Cada tecla tem de acrescentar exatamente um dígito ao resultado.
  const alvo = '51997712345'
  let v = ''
  let erro = ''
  for (let i = 0; i < alvo.length; i++) {
    v = formatPhone(v + alvo[i])
    const digitos = v.replace(/\D/g, '')
    if (digitos !== alvo.slice(0, i + 1)) { erro = `na tecla ${i + 1}: "${v}"`; break }
  }
  if (!erro) ok('os 11 dígitos entram na ordem, sem perder nenhum')
  else bad(erro)
  eq(v, '(51) 99771-2345', 'e o resultado final')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
