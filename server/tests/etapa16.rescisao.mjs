// ─────────────────────────────────────────────────────────────────────────
//  Auditoria das verbas rescisórias — os sete defeitos encontrados na
//  conferência que a dona do sistema mandou fazer.
//
//   1. o aviso-prévio indenizado não PROJETAVA a data de saída, e os avos de
//      13º e de férias saíam um a dois a menos (art. 487, §1º; Súmula 371);
//   2. "férias vencidas" era um sim/não que pagava sempre um período
//      simples — nunca vários, nunca em dobro (art. 137);
//   3. a multa do art. 477 era aplicada com o campo de pagamento em branco,
//      mesmo DENTRO dos 10 dias de prazo: um salário a mais, do nada;
//   4. a multa de 40% saía ZERO quando o saldo do FGTS não era informado,
//      e não somava os depósitos rescisórios;
//   5. o INSS incidia sobre o SALÁRIO, não sobre as verbas pagas, e o 13º
//      era somado ao saldo numa base só (art. 214, §6º, Dec. 3.048/99);
//   6. o IRRF juntava saldo e 13º, quando o 13º é exclusivo na fonte
//      (art. 26 da Lei 7.713/88) — isso jogava a pessoa numa faixa a mais;
//   7. a memória imprimia um "TOTAL BRUTO" antes da multa do art. 477 e a
//      tabela imprimia outro depois: dois totais diferentes no mesmo papel.
//
//  Roda sem servidor e sem banco.
// ─────────────────────────────────────────────────────────────────────────
const { CALCULADORAS, anosDeServico, diasDeAvisoPrevio, somarDiasISO, aniversarioNaProjecao } =
  await import('../../client/src/lib/legalCalc.js')

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const calc = (id) => CALCULADORAS.find(c => c.id === id)
const rodar = (id, v) => calc(id).compute(v)
const brlNum = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.'))
const linha = (r, t) => r.linhas.find(l => l.label.includes(t))
const temLinha = (r, t) => Boolean(linha(r, t))
const valor = (r, t) => brlNum(linha(r, t)?.value ?? '0')

const BASE = {
  salario: '3000', admissao: '2020-01-20', saida: '2026-10-30', motivo: 'sem_justa',
  diasTrabMes: '30', projetarAviso: 'sim', feriasVencidasPeriodos: '1', feriasEmDobro: 'nao',
  fgtsDepositado: '10000', dependentes: '0', pagamento: '', outrosDescontos: '',
}

console.log('\n── Auxiliares de data ──────────────────────────────────')
eq(anosDeServico('2020-01-20', '2026-10-30'), 6, 'anos completos de serviço')
eq(anosDeServico('2020-10-30', '2026-10-29'), 5, 'um dia antes do aniversário ainda não fecha o ano')
eq(diasDeAvisoPrevio('2020-01-20', '2026-10-30'), 48, 'dias de aviso (30 + 6×3)')
eq(diasDeAvisoPrevio('1980-01-01', '2026-01-01'), 90, 'aviso trava no teto de 90 dias')
eq(somarDiasISO('2026-10-30', 48), '2026-12-17', 'projeção do aviso')
eq(aniversarioNaProjecao('2020-12-01', '2026-10-30', '2026-12-17'), '2026-12-01',
  'aniversário de admissão caindo dentro da projeção')
eq(aniversarioNaProjecao('2020-01-20', '2026-10-30', '2026-12-17'), null,
  'sem aniversário dentro da projeção')

console.log('\n── 1. Projeção do aviso-prévio (Súmula 371 do TST) ─────')
const com = rodar('verbas-rescisorias', BASE)
const sem = rodar('verbas-rescisorias', { ...BASE, projetarAviso: 'nao' })
eq(temLinha(com, '13º proporcional (12/12)'), true, '13º projetado fecha 12 avos')
eq(temLinha(sem, '13º proporcional (10/12)'), true, '13º sem projeção para em 10 avos')
eq(temLinha(com, 'Férias proporcionais + 1/3 (11/12)'), true, 'férias projetadas: 11 avos')
eq(temLinha(sem, 'Férias proporcionais + 1/3 (9/12)'), true, 'férias sem projeção: 9 avos')
if (brlNum(com.headline.value) > brlNum(sem.headline.value)) ok('projetar aumenta o líquido, como manda a lei')
else bad('projetar deveria aumentar o líquido')

// Projeção que vira o ano: o 13º do ano da saída fecha em 31/12 e o resto
// gera avos do ano seguinte. Antes isso zerava o 13º do ano da saída.
const vira = rodar('verbas-rescisorias', { ...BASE, saida: '2026-12-20' })
if (valor(vira, '13º proporcional') >= 3000) ok('projeção que vira o ano não perde o 13º do ano da saída')
else bad(`projeção virando o ano: 13º saiu ${valor(vira, '13º proporcional')}`)

// Período aquisitivo fechado dentro do aviso vira férias integrais.
const fechou = rodar('verbas-rescisorias', { ...BASE, admissao: '2020-12-01' })
eq(temLinha(fechou, 'Férias integrais + 1/3 (período completado na projeção)'), true,
  'aquisitivo completado na projeção vira férias integrais')

console.log('\n── 2. Férias vencidas: períodos e dobro (art. 137) ─────')
const umP = rodar('verbas-rescisorias', { ...BASE, feriasVencidasPeriodos: '1' })
const doisP = rodar('verbas-rescisorias', { ...BASE, feriasVencidasPeriodos: '2' })
const dobro = rodar('verbas-rescisorias', { ...BASE, feriasVencidasPeriodos: '1', feriasEmDobro: 'sim' })
eq(valor(umP, 'Férias vencidas'), 4000, 'um período simples')
eq(valor(doisP, 'Férias vencidas'), 8000, 'dois períodos')
eq(valor(dobro, 'Férias vencidas'), 8000, 'um período em dobro')
// Compatibilidade com os cálculos antigos, que gravaram feriasVencidas: 'sim'.
eq(valor(rodar('verbas-rescisorias', { ...BASE, feriasVencidasPeriodos: '', feriasVencidas: 'sim' }),
  'Férias vencidas'), 4000, 'campo antigo "feriasVencidas: sim" continua valendo 1 período')

console.log('\n── 3. Multa do art. 477 só com atraso configurado ──────')
const hoje = new Date().toISOString().slice(0, 10)
const futuro = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
const passado = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
const dentroDoPrazo = rodar('verbas-rescisorias', { ...BASE, saida: hoje, pagamento: '' })
eq(temLinha(dentroDoPrazo, '477'), false, 'saída hoje, sem pagamento: NÃO há multa (prazo em curso)')
if (dentroDoPrazo.memoria.some(m => m.includes('ainda não passou'))) ok('a memória explica por que não há multa')
else bad('a memória deveria dizer que o prazo ainda não passou')
const prazoVencido = rodar('verbas-rescisorias', { ...BASE, saida: passado, pagamento: '' })
eq(temLinha(prazoVencido, '477'), true, 'prazo vencido e nada pago: multa devida')
eq(valor(prazoVencido, '477'), 3000, 'multa = 1 salário')
const pagoEmDia = rodar('verbas-rescisorias', { ...BASE, saida: passado, pagamento: passado })
eq(temLinha(pagoEmDia, '477'), false, 'pago no mesmo dia da saída: sem multa')
// A calculadora avulsa das multas tinha o mesmo defeito.
const m477 = rodar('multa-477', { salario: '3000', saida: futuro, pagamento: '', incontroversas: '' })
eq(temLinha(m477, '477'), false, 'multa-477 avulsa: saída futura não gera multa')

console.log('\n── 4. FGTS: depósitos + rescisório + multa ─────────────')
const semSaldo = rodar('verbas-rescisorias', { ...BASE, fgtsDepositado: '' })
if (valor(semSaldo, 'Multa 40%') > 0) ok(`sem o extrato, a multa é estimada (${valor(semSaldo, 'Multa 40%')}) em vez de sair zero`)
else bad('a multa de 40% saiu ZERO com o saldo do FGTS em branco')
if (semSaldo.memoria.some(m => m.includes('ESTIMADO'))) ok('a memória avisa que o FGTS foi estimado')
else bad('a memória deveria avisar que o FGTS é estimativa')
// 10.000 de depósitos + 8% sobre (3.000 saldo + 4.800 aviso + 3.000 13º) = 864
eq(valor(com, 'Multa 40%'), 4345.60, 'multa de 40% inclui o FGTS rescisório')
eq(temLinha(com, 'FGTS a sacar na Caixa'), true, 'o FGTS aparece separado do líquido pago pelo empregador')
const fgtsAvulso = rodar('fgts', { remuneracao: '3000', meses: '12', saldoFgts: '' })
if (brlNum(fgtsAvulso.headline.value) > 0) ok('calculadora de FGTS avulsa estima o saldo em vez de zerar a multa')
else bad('FGTS avulso continua zerando a multa sem saldo informado')

console.log('\n── 5 e 6. INSS e IRRF em bases separadas ───────────────')
// Saldo 3.000: INSS 248,60. 13º 3.000, base isolada: outros 248,60.
eq(valor(com, '(−) INSS'), 497.20, 'INSS do saldo + INSS do 13º, cada um em sua base')
if (com.memoria.some(m => m.includes('base separada'))) ok('a memória mostra o INSS do 13º em separado')
else bad('a memória deveria separar o INSS do 13º')
// Juntas, as bases dariam 22,5% de IRRF (R$ 369,46). Separadas, cada uma
// fica abaixo da faixa de isenção — e o imposto correto é zero.
eq(valor(com, '(−) IRRF'), 0, 'IRRF zerado: separadas, as duas bases ficam na faixa isenta')
const liq = rodar('rescisao-liquida', { salario: '3000', verbasTributaveis: '3000', decimoTerceiro: '3000', verbasIsentas: '0', dependentes: '0', outrosDescontos: '' })
eq(valor(liq, '(−) INSS'), 497.20, 'líquido avulso: INSS também separado')
eq(valor(liq, '(−) IRRF'), 0, 'líquido avulso: IRRF também separado')

console.log('\n── 7. Um único TOTAL BRUTO ─────────────────────────────')
const comMulta = rodar('verbas-rescisorias', { ...BASE, saida: passado, pagamento: '' })
const brutoTabela = valor(comMulta, 'TOTAL BRUTO')
const brutoMemoria = comMulta.memoria
  .filter(m => m.startsWith('TOTAL BRUTO'))
  .map(m => brlNum(m.split('=')[1]))
eq(brutoMemoria.length, 1, 'a memória imprime UM total bruto')
eq(brutoMemoria[0], brutoTabela, 'o total da memória bate com o da tabela')
// E a soma das parcelas tem que fechar com o total.
const parcelas = comMulta.linhas
  .filter(l => !l.label.startsWith('──') && !l.label.startsWith('(−)') && !l.label.startsWith('FGTS a sacar'))
  .reduce((s, l) => s + brlNum(l.value), 0)
eq(Math.round(parcelas * 100) / 100, brutoTabela, 'a soma das parcelas fecha com o TOTAL BRUTO')

console.log('\n── Justa causa ─────────────────────────────────────────')
const justa = rodar('verbas-rescisorias', { ...BASE, motivo: 'justa' })
eq(temLinha(justa, 'Aviso-prévio'), false, 'justa causa: sem aviso')
eq(temLinha(justa, '13º proporcional'), false, 'justa causa: sem 13º proporcional')
eq(temLinha(justa, 'Multa 40%'), false, 'justa causa: sem multa de 40%')
eq(temLinha(justa, 'Férias vencidas'), true, 'justa causa: férias vencidas continuam devidas')
eq(temLinha(justa, 'Saldo de salário'), true, 'justa causa: saldo de salário continua devido')

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : '\n✅ Tudo certo nas verbas rescisórias\n')
process.exit(falhas ? 1 : 0)
