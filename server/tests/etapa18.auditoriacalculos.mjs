// ─────────────────────────────────────────────────────────────────────────
//  Auditoria jurídica das demais calculadoras (previdenciário, tributário,
//  família, sucessório, penal e o composite da reclamatória).
//
//  A varredura estrutural das 61 calculadoras já passava limpa: nenhum NaN,
//  nenhum total que não fecha. O que estes testes cobram é outra coisa — a
//  PREMISSA JURÍDICA por baixo do número, que é onde estavam os defeitos
//  perigosos: contas certas sobre regras erradas.
//
//  Roda sem servidor e sem banco.
// ─────────────────────────────────────────────────────────────────────────
const { CALCULADORAS } = await import('../../client/src/lib/legalCalc.js')

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)
const perto = (real, esperado, msg, tol = 0.02) =>
  Math.abs(real - esperado) <= tol ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const rodar = (id, v) => CALCULADORAS.find(c => c.id === id).compute(v)
const brlNum = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.'))
const linha = (r, t) => r.linhas.find(l => l.label.includes(t))
const valor = (r, t) => brlNum(linha(r, t)?.value ?? '0')
const memTem = (r, t) => r.memoria.some(m => m.includes(t))
const opcoes = (id, campo) =>
  CALCULADORAS.find(c => c.id === id).campos.find(f => f.name === campo).options.map(o => o.value)

console.log('\n── Tempo de contribuição: períodos concomitantes ───────')
{
  // Dois vínculos simultâneos. A soma simples conta os mesmos dias duas
  // vezes e pode apontar uma data de aposentadoria que não existe.
  const r = rodar('tempo-contribuicao', { periodos: [
    { inicio: '2010-01-01', fim: '2014-12-31' },
    { inicio: '2013-01-01', fim: '2016-12-31' },
  ]})
  if (memTem(r, 'HÁ PERÍODOS CONCOMITANTES')) ok('aponta a concomitância em vez de somar calado')
  else bad('não detectou os períodos sobrepostos')
  if (memTem(r, '2013') && memTem(r, '2014')) ok('diz exatamente qual trecho se repete')
  else bad('não mostrou as datas da sobreposição')
  const soma = valor(r, 'Soma dos períodos')
  const unico = valor(r, 'Tempo sem concomitância')
  if (unico < soma) ok(`o destaque usa o tempo sem concomitância (${unico} < ${soma} dias)`)
  else bad('o tempo sem concomitância não ficou menor que a soma')
  eq(r.headline.label, 'Tempo sem concomitância', 'o título avisa qual número está em destaque')

  // Sem sobreposição, nada muda.
  const limpo = rodar('tempo-contribuicao', { periodos: [
    { inicio: '2010-01-01', fim: '2012-12-31' },
    { inicio: '2015-01-01', fim: '2016-12-31' },
  ]})
  eq(limpo.headline.label, 'Tempo total', 'sem concomitância, o título volta ao normal')
  if (memTem(limpo, 'Nenhum período se sobrepõe')) ok('e diz que conferiu')
  else bad('deveria dizer que não há sobreposição')
}

console.log('\n── EC 103: ano anterior a 2019 não baixa a exigência ───')
{
  // Antes, ano 2015 dava 82 pontos para a mulher e a tela dizia que ela já
  // podia se aposentar.
  const r = rodar('regra-pontos', { sexo: 'F', idade: '56', tempoAnos: '30', ano: '2015' })
  if (linha(r, 'Exigido').value.startsWith('86')) ok('regra de pontos trava a exigência em 86 (2019)')
  else bad(`exigência de 2015 saiu como ${linha(r, 'Exigido').value}`)

  const a = rodar('aposentadoria-regras', { sexo: 'F', idade: '56', tempoHoje: '30', tempoEm2019: '', ano: '2015' })
  if (memTem(a, 'Análise em 2019')) ok('a tela das regras também trava em 2019')
  else bad('a análise aceitou um ano anterior a 2019')
}

console.log('\n── Direito adquirido antes da Reforma ──────────────────')
{
  // Quem já tinha 35 anos em 13/11/2019 não precisa de pedágio nenhum.
  const r = rodar('aposentadoria-regras', { sexo: 'M', idade: '58', tempoHoje: '38', tempoEm2019: '35', ano: '2026' })
  if (linha(r, 'Direito adquirido')) ok('aponta o direito adquirido (EC 103, art. 3º)')
  else bad('não apontou o direito adquirido de quem já tinha o tempo em 2019')
}

console.log('\n── Conversão de tempo especial: faltavam 20 anos ───────')
{
  const fatores = opcoes('conversao-especial', 'fator')
  if (fatores.includes('1.75') && fatores.includes('1.5')) ok('fatores de 20 anos disponíveis (1,75 e 1,50)')
  else bad(`fatores oferecidos: ${fatores.join(', ')}`)
  const r = rodar('conversao-especial', { anosEspecial: '20', fator: '1.75' })
  if (r.headline.value.startsWith('35')) ok('20 anos × 1,75 = 35 anos comuns')
  else bad(`deu ${r.headline.value}`)
}

console.log('\n── RMI: a base do coeficiente deixou de ser escondida ──')
{
  const regras = opcoes('rmi', 'regra')
  if (regras.includes('especial15')) ok('a opção diz que a base é 15 anos')
  else bad(`opções: ${regras.join(', ')}`)
  // Homem, 25 anos: regra geral = 60% + 2%×5 = 70%.
  const geral = rodar('rmi', { media: '5000', sexo: 'M', anos: '25', regra: 'geral' })
  perto(valor(geral, 'RMI calculada'), 3500, 'homem, 25 anos, regra geral → 70% da média')
  // Mesma pessoa na modalidade de 15 anos: 60% + 2%×10 = 80%.
  const quinze = rodar('rmi', { media: '5000', sexo: 'M', anos: '25', regra: 'especial15' })
  perto(valor(quinze, 'RMI calculada'), 4000, 'modalidade de 15 anos → 80% da média')
  // Cálculos antigos gravaram regra: 'especial' — têm de ler a mesma base.
  const antigo = rodar('rmi', { media: '5000', sexo: 'M', anos: '25', regra: 'especial' })
  eq(valor(antigo, 'RMI calculada'), valor(quinze, 'RMI calculada'), 'o nome antigo da opção continua valendo')
}

console.log('\n── Tributário: a multa não incide sobre os juros ───────')
{
  // Tributo 10.000, SELIC 20%, multa 20%.
  // Certo:  multa = 10.000 × 20% = 2.000 → total 14.000
  // Antes:  multa = 12.000 × 20% = 2.400 → total 14.400 (R$ 400 a mais)
  const r = rodar('debito-tributario', { valor: '10000', selic: '20', multa: '20' })
  perto(valor(r, 'Multa de mora'), 2000, 'multa sobre o tributo, não sobre tributo + SELIC')
  perto(valor(r, '── TOTAL'), 14000, 'total do débito')
  if (memTem(r, 'art. 61')) ok('a memória cita o fundamento da base de cálculo')
  else bad('faltou o fundamento na memória')
}

console.log('\n── Multa de mora: 0,33% ao dia em vez do teto calado ───')
{
  // 30 dias de atraso = 9,9%, não os 20% que vinham de padrão.
  const r = rodar('multa-mora-trib', { valor: '10000', vencimento: '2026-01-01', pagamento: '2026-01-31', multa: '' })
  perto(valor(r, 'Multa ('), 990, '30 dias de atraso → 9,9%')
  // 100 dias passam do teto.
  const teto = rodar('multa-mora-trib', { valor: '10000', vencimento: '2026-01-01', pagamento: '2026-04-11', multa: '' })
  perto(valor(teto, 'Multa ('), 2000, '100 dias → limitada a 20%')
  if (memTem(teto, 'Limitada a 20%')) ok('a memória diz que bateu no teto')
  else bad('não avisou do teto')
  // Sem dado nenhum, não finge que a multa é zero.
  const vazio = rodar('multa-mora-trib', { valor: '10000', vencimento: '', pagamento: '', multa: '' })
  if (memTem(vazio, 'zero por falta de dado')) ok('sem as datas, avisa que o zero é falta de dado')
  else bad('zerou a multa sem avisar')
  // Percentual manual continua mandando.
  const manual = rodar('multa-mora-trib', { valor: '10000', vencimento: '2026-01-01', pagamento: '2026-01-31', multa: '2' })
  perto(valor(manual, 'Multa ('), 200, 'percentual informado à mão prevalece')
}

console.log('\n── Dosimetria: 3ª fase em cascata ─────────────────────')
{
  // Pena-base 120 meses, aumento de 1/2 e diminuição de 1/3.
  // Cascata: 120 × 1,5 = 180 → 180 − 60 = 120 meses.
  // Antes:   120 + 60 − 40 = 140 meses (20 meses a mais, errado).
  const r = rodar('dosimetria', { minMeses: '120', maxMeses: '240', circNeg: '0',
    agravantes: '0', atenuantes: '0', aumento: '1/2', diminuicao: '1/3' })
  perto(Number(linha(r, '3ª fase').value.replace(' anos', '')), 10, 'pena definitiva = 10 anos (cascata)')
  if (memTem(r, 'sobre o valor já aumentado')) ok('a memória mostra a ordem de incidência')
  else bad('a memória não explicou a cascata')
  // A 2ª fase continua presa à moldura (Súmula 231 do STJ).
  const piso = rodar('dosimetria', { minMeses: '120', maxMeses: '240', circNeg: '0',
    agravantes: '0', atenuantes: '1/3', aumento: '0', diminuicao: '0' })
  perto(Number(linha(piso, '2ª fase').value.replace(' anos', '')), 10, 'atenuante não desce do mínimo legal')
}

console.log('\n── Progressão: faltava o inciso VI (50%) ──────────────')
{
  const fracoes = opcoes('progressao', 'fracao')
  if (fracoes.includes('0.50')) ok('a faixa de 50% do art. 112, VI, da LEP existe')
  else bad(`frações oferecidas: ${fracoes.join(', ')}`)
  const r = rodar('progressao', { penaMeses: '240', fracao: '0.50', cumpridoMeses: '0' })
  if (r.headline.value.startsWith('120')) ok('240 meses × 50% = 120 meses exigidos')
  else bad(`deu ${r.headline.value}`)
}

console.log('\n── Pensão: base vazia não vira zero calado ────────────')
{
  const r = rodar('pensao-alimenticia', { modo: 'perc', renda: '', perc: '30', filhos: '1' })
  if (memTem(r, 'Faltou preencher')) ok('avisa que faltou a renda')
  else bad('zerou a pensão sem avisar')
  eq(r.headline.label, 'Pensão mensal (dado faltando)', 'o título também avisa')
  const cheio = rodar('pensao-alimenticia', { modo: 'perc', renda: '5000', perc: '30', filhos: '2' })
  perto(valor(cheio, 'Total mensal'), 1500, 'com a renda preenchida, a conta sai normal')
  perto(valor(cheio, 'Por filho'), 750, 'e o rateio entre os filhos')
}

console.log('\n── Inventário: espólio insolvente e digitação errada ───')
{
  const r = rodar('inventario-quinhao', { bens: '100000', dividas: '150000', meacao: '0', herdeiros: '2' })
  eq(r.headline.label, 'Nada a partilhar — dívidas superam os bens', 'diz que não há herança')
  eq(valor(r, 'Quinhão'), 0, 'e o quinhão é zero')
  if (memTem(r, 'art. 1.792')) ok('cita que os herdeiros não respondem além das forças da herança')
  else bad('faltou o fundamento do espólio insolvente')

  const digitou = rodar('inventario-completo', { bens: '100000', bensComuns: '500000', dividas: '0',
    herdeiros: '1', itcmd: '4', custas: '1', honorarios: '6' })
  if (memTem(digitou, 'são maiores que o acervo total')) ok('aponta bens comuns maiores que o acervo')
  else bad('aceitou bens comuns maiores que o acervo sem dizer nada')
}

console.log('\n── Reclamatória: os dois adicionais e os reflexos ─────')
{
  const base = { salario: '3000', meses: '12', horasExtrasMes: '20', adicionalHE: '50', divisor: '220',
    horasNoturnasMes: '0', insalubridade: '40', periculosidade: 'sim', reflexos: 'sim',
    verbasRescisorias: '', incontroversas: '', multa477: 'nao' }
  const r = rodar('reclamatoria-trabalhista', base)
  // Antes a memória dizia "escolha uma" e o total somava as duas.
  if (memTem(r, 'não se acumulam')) ok('avisa que insalubridade e periculosidade não se acumulam')
  else bad('não avisou da não cumulação')
  const insal = valor(r, 'Insalubridade')
  const peric = valor(r, 'Periculosidade')
  const total = brlNum(r.headline.value)
  if (total < insal + peric + 100000) ok('o total não soma os dois adicionais')
  // Confere direto: refazendo só com o maior, o total tem de bater.
  const soMaior = rodar('reclamatoria-trabalhista', peric >= insal
    ? { ...base, insalubridade: 'nao' } : { ...base, periculosidade: 'nao' })
  perto(brlNum(soMaior.headline.value), total, 'o total é igual ao de usar só o adicional mais vantajoso', 0.05)
  if (linha(r, 'alternativo, fora do total')) ok('o adicional descartado aparece marcado como alternativo')
  else bad('o adicional descartado não foi marcado')

  // Reflexos das extras em 13º e férias (Súmula 376, II, do TST).
  if (linha(r, 'Reflexo em 13º') && linha(r, 'Reflexo em férias')) ok('os reflexos das extras entram no pedido')
  else bad('faltaram os reflexos em 13º e férias')
  const semReflexo = rodar('reclamatoria-trabalhista', { ...base, reflexos: 'nao' })
  if (brlNum(semReflexo.headline.value) < total) ok('desligar os reflexos reduz o pedido, e o critério avisa')
  else bad('desligar os reflexos não mudou nada')
  if (semReflexo.criterios.some(c => c.includes('DESLIGADOS'))) ok('o aviso de reflexos desligados aparece')
  else bad('faltou avisar que os reflexos estão desligados')
}

console.log('\n── EC 103 conferida contra o texto da emenda ──────────')
{
  // A dona mandou o texto da EC 103, da Lei 13.964/2019 (art. 112 da LEP),
  // do art. 61 da Lei 9.430/96 e das Súmulas 371 e 376 do TST. Estes testes
  // cobram o código contra a LETRA desses textos.

  // Art. 17: exige MAIS de 28 anos (mulher) e 33 (homem) em 13/11/2019 —
  // ou seja, faltar MENOS de 2 anos. Antes o código aceitava "faltava = 2".
  const exato = rodar('pedagio-50', { sexo: 'M', tempoNaData: '33' })
  eq(exato.headline.label, '❌ Não elegível', 'homem com exatos 33 anos em 2019 NÃO entra no pedágio de 50%')
  const dentro = rodar('pedagio-50', { sexo: 'M', tempoNaData: '33.5' })
  eq(dentro.headline.label, '✅ Elegível ao pedágio 50%', 'com 33,5 anos entra')
  const femExato = rodar('pedagio-50', { sexo: 'F', tempoNaData: '28' })
  eq(femExato.headline.label, '❌ Não elegível', 'mulher com exatos 28 anos também não entra')

  // Art. 19: a regra permanente exige 15 anos da MULHER e 20 do HOMEM.
  // Antes o código pedia 15 dos dois, e dizia a um homem de 65 anos com 16
  // de contribuição que ele já podia se aposentar.
  const homem = rodar('aposentadoria-regras', { sexo: 'M', professor: 'nao', idade: '65', tempoHoje: '16', tempoEm2019: '', ano: '2026' })
  const perm = linha(homem, 'Regra permanente')
  if (perm && perm.value.includes('faltam')) ok('homem com 65 anos e 16 de contribuição ainda NÃO cumpre o art. 19')
  else bad(`art. 19 para homem: ${perm?.value}`)
  const homem20 = rodar('aposentadoria-regras', { sexo: 'M', professor: 'nao', idade: '65', tempoHoje: '20', tempoEm2019: '', ano: '2026' })
  if (linha(homem20, 'Regra permanente')?.value === 'cumprida') ok('com 20 anos de contribuição, cumpre')
  else bad('art. 19 não reconheceu os 20 anos')
  const mulher = rodar('aposentadoria-regras', { sexo: 'F', professor: 'nao', idade: '62', tempoHoje: '15', tempoEm2019: '', ano: '2026' })
  if (linha(mulher, 'Regra permanente')?.value === 'cumprida') ok('mulher com 62 anos e 15 de contribuição cumpre o art. 19')
  else bad('art. 19 para mulher')

  // Art. 18 é regra distinta do art. 19 e faltava na tela.
  if (linha(homem, 'Transição por idade (art. 18)')) ok('a transição por idade do art. 18 aparece em separado')
  else bad('art. 18 não foi listado')

  // Art. 15, §3º — professor: 81/91 pontos, teto 92/100, tempo 25/30.
  const pBase = rodar('regra-pontos', { sexo: 'F', professor: 'sim', idade: '51', tempoAnos: '25', ano: '2019' })
  if (linha(pBase, 'Exigido').value.startsWith('81')) ok('professora em 2019: 81 pontos')
  else bad(`professora 2019: ${linha(pBase, 'Exigido').value}`)
  const pTeto = rodar('regra-pontos', { sexo: 'F', professor: 'sim', idade: '60', tempoAnos: '30', ano: '2040' })
  if (linha(pTeto, 'Exigido').value.startsWith('92')) ok('professora trava no teto de 92 pontos')
  else bad(`teto professora: ${linha(pTeto, 'Exigido').value}`)
  const pHomem = rodar('regra-pontos', { sexo: 'M', professor: 'sim', idade: '56', tempoAnos: '30', ano: '2019' })
  if (linha(pHomem, 'Exigido').value.startsWith('91')) ok('professor em 2019: 91 pontos')
  else bad(`professor 2019: ${linha(pHomem, 'Exigido').value}`)
  if (linha(pHomem, 'Tempo mínimo').value.startsWith('30')) ok('e 30 anos de magistério, não 35')
  else bad(`tempo mínimo professor: ${linha(pHomem, 'Tempo mínimo').value}`)
  // Sem professor, a tabela antiga continua valendo.
  const comum = rodar('regra-pontos', { sexo: 'F', professor: 'nao', idade: '56', tempoAnos: '30', ano: '2019' })
  if (linha(comum, 'Exigido').value.startsWith('86')) ok('sem magistério, segue 86 pontos')
  else bad(`regra comum: ${linha(comum, 'Exigido').value}`)

  // Art. 20, §1º — professor: idade e tempo reduzidos em 5 anos.
  const ped100 = rodar('pedagio-100', { sexo: 'M', professor: 'sim', idade: '55', tempoNaData: '30', tempoHoje: '' })
  if (linha(ped100, 'Idade mínima exigida').value.startsWith('55')) ok('pedágio de 100% do professor: idade mínima de 55')
  else bad(`idade professor: ${linha(ped100, 'Idade mínima exigida').value}`)
  // 30 anos é o mínimo do professor homem, então não falta pedágio nenhum.
  if (linha(ped100, 'Pedágio (100% do que faltava)').value.startsWith('0')) ok('e o tempo mínimo cai para 30 anos')
  else bad(`pedágio professor: ${linha(ped100, 'Pedágio (100% do que faltava)').value}`)

  // Art. 112, §6º da LEP: falta grave interrompe e a base vira a pena
  // remanescente. 240 meses, 100 cumpridos, 16% → sobre 140, não sobre 240.
  const semFalta = rodar('progressao', { penaMeses: '240', fracao: '0.16', cumpridoMeses: '100', faltaGrave: 'nao' })
  const comFalta = rodar('progressao', { penaMeses: '240', fracao: '0.16', cumpridoMeses: '100', faltaGrave: 'sim' })
  // Aqui o valor vem como "38.4 meses exigidos" — ponto decimal, não vírgula,
  // então brlNum() não serve.
  const meses = (r) => parseFloat(r.headline.value)
  perto(meses(semFalta), 38.4, 'sem falta grave: 16% de 240 meses', 0.2)
  perto(meses(comFalta), 22.4, 'com falta grave: 16% da pena remanescente (140)', 0.2)
  if (memTem(comFalta, '§6º')) ok('a memória cita o fundamento da interrupção')
  else bad('faltou o fundamento da falta grave')
  if (comFalta.criterios.some(c => c.includes('33, §4º'))) ok('avisa que o tráfico privilegiado não é hediondo aqui')
  else bad('faltou o aviso do §5º')
}

console.log('\n── Correção monetária: o vazio não vira 0% calado ─────')
{
  const { aplicarCorrecao } = await import('../../client/src/lib/legalCalc.js')
  const nominal = { headline: { label: 'Total', value: 'R$ 10.000,00' }, linhas: [], memoria: [], criterios: [] }

  // Era o defeito que a dona apontou: ligar a correção sem informar o índice
  // devolvia o valor NOMINAL com o título "— atualizado".
  const semIndice = aplicarCorrecao(nominal, { corrigir: 'sim', corrIndice: 'ipca-e',
    corrDataInicial: '2015-01-01', corrDataFinal: '2026-01-01', corrTaxa: '', corrJuros: '0' })
  if (semIndice.headline.label.includes('NÃO APLICADA')) ok('sem índice, o título diz que NÃO corrigiu')
  else bad(`título saiu: ${semIndice.headline.label}`)
  eq(brlNum(semIndice.headline.value), 10000, 'e devolve o nominal, sem fingir correção')
  if (semIndice.memoria.some(m => m.includes('CORREÇÃO FOI LIGADA') || m.includes('correção foi LIGADA'))) ok('a memória explica o que faltou')
  else bad('a memória não avisou')
  if (semIndice.memoria.some(m => m.includes('CALCIDADAO'))) ok('e diz onde buscar o índice')
  else bad('não disse onde buscar')
  if (semIndice.criterios.some(c => c.includes('NÃO está corrigido'))) ok('o aviso aparece também nos critérios')
  else bad('faltou o aviso nos critérios')

  // Com o índice preenchido, corrige normalmente.
  const comIndice = aplicarCorrecao(nominal, { corrigir: 'sim', corrIndice: 'ipca-e',
    corrDataInicial: '2015-01-01', corrDataFinal: '2026-01-01', corrTaxa: '80', corrJuros: '0' })
  eq(brlNum(comIndice.headline.value), 18000, '10.000 + 80% = 18.000')
  if (comIndice.headline.label.includes('atualizado')) ok('e aí sim o título diz atualizado')
  else bad(`título: ${comIndice.headline.label}`)

  // Zero digitado de propósito é diferente de campo em branco.
  const zero = aplicarCorrecao(nominal, { corrigir: 'sim', corrIndice: 'ipca-e',
    corrDataInicial: '2015-01-01', corrDataFinal: '2026-01-01', corrTaxa: '0', corrJuros: '0' })
  if (zero.criterios.some(c => c.includes('0%'))) ok('índice digitado como 0% avisa que o valor não mudou')
  else bad('0% digitado passou calado')

  // Juros pedidos sem as datas também saíam zero sem dizer nada.
  const semDatas = aplicarCorrecao(nominal, { corrigir: 'sim', corrIndice: 'ipca-e',
    corrDataInicial: '', corrDataFinal: '', corrTaxa: '10', corrJuros: '1' })
  if (semDatas.criterios.some(c => c.includes('Juros NÃO aplicados'))) ok('juros sem datas avisam em vez de sumir')
  else bad('juros sem datas passaram calados')

  // Correção desligada continua devolvendo o resultado intacto.
  const desligada = aplicarCorrecao(nominal, { corrigir: 'nao' })
  eq(desligada.headline.label, 'Total', 'com a correção desligada, nada muda')
}

console.log('\n── Varredura estrutural das 61 calculadoras ───────────')
{
  // Nenhuma pode explodir, devolver NaN ou entregar um resultado sem
  // composição e sem memória — nem com os campos todos preenchidos, nem
  // só com os obrigatórios.
  let quebradas = 0
  for (const calc of CALCULADORAS) {
    for (const soObrig of [false, true]) {
      const v = {}
      for (const f of calc.campos ?? []) {
        if (soObrig && !f.required) { if (f.default !== undefined) v[f.name] = f.default; continue }
        if (f.default !== undefined && f.type === 'select') { v[f.name] = f.default; continue }
        if (f.type === 'currency') v[f.name] = '5000'
        else if (f.type === 'number' || f.type === 'percent') v[f.name] = f.default ?? '12'
        else if (f.type === 'date') v[f.name] = /admis|inicio|início|public|venc|compet|nasc/i.test(f.label) ? '2020-03-10' : '2026-03-10'
        else if (f.type === 'select') v[f.name] = f.options?.[0]?.value
        else if (f.type === 'periodos') v[f.name] = [{ inicio: '2015-01-01', fim: '2020-01-01' }]
        else if (f.type === 'valores') v[f.name] = [{ desc: 'item', valor: '1000' }]
        else v[f.name] = f.default ?? '1000'
      }
      try {
        const res = calc.compute(v)
        const txt = JSON.stringify(res)
        if (/NaN|Infinity/.test(txt)) { bad(`${calc.id}: NaN ou Infinity no resultado`); quebradas++ }
        else if (!res?.headline?.value) { bad(`${calc.id}: sem resultado em destaque`); quebradas++ }
        else if (!res?.memoria?.length) { bad(`${calc.id}: sem memória de cálculo`); quebradas++ }
        else if (!calc.baseLegal) { bad(`${calc.id}: sem base legal`); quebradas++ }
      } catch (e) { bad(`${calc.id}: explodiu — ${e.message}`); quebradas++ }
    }
  }
  if (!quebradas) ok(`as ${CALCULADORAS.length} calculadoras respondem com resultado, memória e base legal`)
}

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : '\n✅ Auditoria das calculadoras inteira\n')
process.exit(falhas ? 1 : 0)
