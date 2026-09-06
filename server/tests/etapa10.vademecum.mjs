// O índice remissivo da Legislação.
//
// Dois problemas, um de cada lado:
//
//  1. A BUSCA casava PEDAÇO de palavra. `"casamento".includes("m")` é
//     verdadeiro, então digitar uma única letra trazia Divórcio, Casamento,
//     União estável, Pensão alimentícia... meia lista. E não normalizava
//     acento: "divorcio" e "divórcio" achavam coisas diferentes.
//
//  2. O ÍNDICE tinha 51 temas. Buscar "maus-tratos" não achava nada — por
//     melhor que fosse o algoritmo, o assunto não estava lá.
//
// Roda sem servidor e sem banco.
const {
  VADE, INDICE, buscarTemas, buscarCodigos, normalizar, linkDoArtigo, COD,
} = await import('../../client/src/lib/vademecum.js')

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)

const temas = (q) => buscarTemas(q).map(t => t.tema)
const achou = (q, tema) => temas(q).includes(tema)

console.log('\n── 1. Uma letra não traz meia lista ──')
{
  // O caso exato da reclamação: digitar "m" trazia Divórcio, Casamento,
  // União estável, Pensão alimentícia, Guarda dos filhos...
  eq(buscarTemas('m').length, 0, 'buscar "m" não devolve nada')
  eq(buscarTemas('a').length, 0, 'nem "a"')
  eq(buscarTemas('').length, 0, 'busca vazia devolve vazio')
  eq(buscarTemas('  ').length, 0, 'só espaços também')

  // Duas letras já discriminam, mas por INÍCIO de palavra.
  if (!achou('me', 'Casamento')) ok('"me" não acha "casaMEnto" — a busca é por palavra, não por pedaço')
  else bad('ainda casa no meio da palavra')
}

console.log('\n── 2. Acento não muda o resultado ──')
{
  eq(normalizar('Divórcio'), 'divorcio', 'normaliza acento')
  eq(normalizar('MAUS-TRATOS'), 'maus-tratos', 'e maiúscula, preservando o hífen')
  eq(normalizar('  Ação   Penal  '), 'acao penal', 'e espaço sobrando')

  const comAcento = temas('divórcio')
  const semAcento = temas('divorcio')
  if (JSON.stringify(comAcento) === JSON.stringify(semAcento) && comAcento.length)
    ok('"divórcio" e "divorcio" acham exatamente a mesma coisa')
  else bad(`com acento: ${comAcento.length}, sem: ${semAcento.length}`)
}

console.log('\n── 3. Os assuntos que faltavam ──')
{
  // O exemplo que ela deu.
  if (achou('maus-tratos', 'Maus-tratos')) ok('"maus-tratos" acha')
  else bad('"maus-tratos" continua não achando')
  if (achou('maus tratos', 'Maus-tratos')) ok('e "maus tratos" sem hífen também')
  else bad('sem hífen não acha')

  const esperados = [
    ['homicidio', 'Homicídio'], ['furto', 'Furto'], ['roubo', 'Roubo e extorsão'],
    ['estelionato', 'Estelionato'], ['stalking', 'Perseguição (stalking)'],
    ['tortura', 'Tortura'], ['habeas corpus', 'Habeas corpus'],
    ['prisao preventiva', 'Prisão preventiva'], ['juri', 'Tribunal do júri'],
    ['dosimetria', 'Aplicação da pena (dosimetria)'],
    ['prescricao penal', 'Prescrição penal'],
    ['usucapiao', 'Usucapião'], ['dano moral', 'Dano moral'],
    ['horas extras', 'Jornada e horas extras'], ['aposentadoria', 'Aposentadoria'],
    ['pensao por morte', 'Pensão por morte'], ['negativacao', 'Negativação indevida'],
    ['despejo', 'Locação e despejo'], ['inventario', 'Inventário e herança'],
    ['lgpd', 'LGPD e proteção de dados'],
  ]
  let faltando = []
  for (const [busca, tema] of esperados) if (!achou(busca, tema)) faltando.push(`${busca} → ${tema}`)
  if (!faltando.length) ok(`os ${esperados.length} assuntos testados são encontrados`)
  else bad(`não achou: ${faltando.join(' | ')}`)

  if (INDICE.length >= 150) ok(`o índice tem ${INDICE.length} temas (eram 51)`)
  else bad(`só ${INDICE.length} temas`)
}

console.log('\n── 4. O mais relevante vem primeiro ──')
{
  const r = temas('furto')
  if (r[0] === 'Furto') ok('buscar "furto" põe Furto em primeiro')
  else bad(`primeiro veio ${r[0]}`)

  const p = temas('prazo')
  if (p[0] === 'Prazos processuais') ok('"prazo" põe Prazos processuais em primeiro')
  else bad(`primeiro veio ${p[0]}`)

  // Duas palavras: as duas precisam aparecer.
  const duas = temas('violencia domestica')
  if (duas.includes('Violência doméstica')) ok('"violencia domestica" acha o tema certo')
  else bad(`achou ${duas.slice(0, 3).join(', ')}`)
  if (buscarTemas('furto aposentadoria').length === 0)
    ok('palavras que não convivem em nenhum tema não devolvem nada')
  else bad('devolveu resultado casando só uma das palavras')
}

console.log('\n── 5. Os códigos também são pesquisáveis, e se explicam ──')
{
  const codigos = (q) => buscarCodigos(q).map(v => v.sigla)
  if (codigos('penal').includes('CP')) ok('"penal" acha o Código Penal')
  else bad('não achou o CP')
  if (codigos('CLT').includes('CLT')) ok('a sigla acha a lei')
  else bad('sigla não acha')
  if (codigos('consumidor').includes('CDC')) ok('"consumidor" acha o CDC')
  else bad('não achou o CDC')
  eq(buscarCodigos('').length, VADE.length, 'sem busca, lista todos os códigos')

  // O "resumo do que tem em cada código" que ela pediu.
  const semResumo = VADE.filter(v => !v.resumo)
  if (!semResumo.length) ok(`os ${VADE.length} códigos têm resumo do que contêm`)
  else bad(`sem resumo: ${semResumo.map(v => v.sigla).join(', ')}`)
}

console.log('\n── 6. Abrir leva ao artigo, não ao topo do código ──')
{
  const l = linkDoArtigo('CP', 136)
  if (l && l.endsWith('#art136')) ok('maus-tratos abre no art. 136, com âncora')
  else bad(`link do CP art. 136: ${l}`)
  if (linkDoArtigo('CC', 1571)?.endsWith('#art1571')) ok('divórcio abre no art. 1.571')
  else bad('âncora do CC errada')
  eq(linkDoArtigo('NaoExiste', 1), null, 'sigla desconhecida devolve null, não um link quebrado')
  if (linkDoArtigo('CP', null) === COD['CP']) ok('sem artigo, abre o código inteiro')
  else bad('sem artigo não caiu no código')
}

console.log('\n── 7. Integridade do índice ──')
{
  // Uma referência apontando para uma sigla que não existe abriria um link
  // quebrado. Verificar isso é barato e evita o erro mais provável ao ampliar.
  const siglas = new Set(VADE.map(v => v.sigla))
  const orfas = []
  for (const t of INDICE) {
    for (const r of t.refs) {
      if (r[0] !== 'Súmula' && !siglas.has(r[0])) orfas.push(`${t.tema} → ${r[0]}`)
    }
  }
  if (!orfas.length) ok('toda referência aponta para um código que existe')
  else bad(`referências órfãs: ${orfas.join(' | ')}`)

  const semKw = INDICE.filter(t => !t.kw?.length)
  if (!semKw.length) ok('todo tema tem palavras-chave para ser encontrado')
  else bad(`sem palavras-chave: ${semKw.map(t => t.tema).join(', ')}`)

  const repetidos = INDICE.map(t => t.tema).filter((v, i, a) => a.indexOf(v) !== i)
  if (!repetidos.length) ok('nenhum tema duplicado')
  else bad(`temas repetidos: ${repetidos.join(', ')}`)

  // Todo tema tem de ser encontrável pelo próprio nome — senão está lá e
  // ninguém acha.
  const invisiveis = INDICE.filter(t => !achou(t.tema, t.tema))
  if (!invisiveis.length) ok('todo tema é encontrado buscando pelo próprio nome')
  else bad(`invisíveis na busca: ${invisiveis.map(t => t.tema).join(', ')}`)
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
