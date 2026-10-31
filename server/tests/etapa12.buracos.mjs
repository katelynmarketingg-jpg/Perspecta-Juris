// Os buracos que a varredura achou — cada um com o seu teste.
//
// Todos tinham a mesma assinatura: o sistema fazia a coisa errada EM SILÊNCIO.
// A tela dizia "salvo", "enviado", "pago", e nada tinha acontecido.
//
//  1. Lançamento sem vencimento: o banco tinha due_date NOT NULL, a tela
//     sempre permitiu deixar em branco (ela mesma escreve "Sem vencimento").
//     Resultado: 500 no servidor, erro engolido na tela, lançamento perdido.
//  2. Parcelas recorrentes iam com `recorrenciaId`/`frequencia` — nomes que o
//     servidor não conhece. O Drizzle descarta chave desconhecida sem reclamar,
//     então as parcelas nasciam sem grupo e "excluir o parcelamento" não pegava.
//  3. Documento do cliente: "Enviar arquivo" gravava nome e tamanho no
//     navegador e DESCARTAVA o arquivo. Sem servidor, sem baixar, sem abrir.
//  4. Teses: a tabela existia desde o começo e não havia rota nenhuma.
//  5. Excluir documento deixava o arquivo no disco para sempre.
//  6. Migrações nunca rodavam no deploy.
import bcrypt from 'bcryptjs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

const { db } = await import('../db/index.js')
const { tenants, users, financialEntries, documents, legalTheses } = await import('../db/schema.js')
const { eq: dbEq, and, inArray } = await import('drizzle-orm')

// ── fixtures: dois escritórios, para checar isolamento ───────────────────
const A = 'tnt_buraco_a', B = 'tnt_buraco_b'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [A, B]))
for (const [id, slug, nome] of [[A, 'buraco-a', 'Escritorio Buraco A'], [B, 'buraco-b', 'Escritorio Buraco B']]) {
  await db.insert(tenants).values({ id, slug, name: nome, plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
  await db.insert(users).values({ id: `usr_${id}`, tenantId: id, name: 'Kat', loginName: 'kat',
    passwordHash: await bcrypt.hash('senha-forte-777', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })
}
const entrar = async (empresa) => (await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa, nome: 'kat', senha: 'senha-forte-777' }),
}))).accessToken
const tkA = await entrar('Escritorio Buraco A')
const tkB = await entrar('Escritorio Buraco B')
const HA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tkA}` }
const HB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tkB}` }
const SO_TOKEN_A = { Authorization: `Bearer ${tkA}` }

console.log('\n── 1. Lançamento sem vencimento é aceito e fica guardado ──')
{
  // Era 500 no servidor (due_date NOT NULL) e a tela engolia: o lançamento
  // não existia e ninguém era avisado.
  const r = await fetch(`${BASE}/api/financial/entries`, { method: 'POST', headers: HA,
    body: JSON.stringify({ type: 'receivable', description: 'Honorário sem vencimento', amount: 1500, status: 'pending' }) })
  eq(r.status, 201, 'criar sem vencimento')
  const linha = await j(r)
  eq(linha.dueDate, null, 'fica gravado sem data')
  eq(linha.amount, 1500, 'com o valor certo')
  // A categoria é deduzida da descrição no servidor ("Honorário" → honorarios).
  // O que importa é que nunca volte nula e estoure o NOT NULL.
  if (linha.category) ok(`categoria preenchida sozinha (${linha.category})`)
  else bad('categoria nula — vai estourar NOT NULL')

  // E aparece na lista, que é o que importa para ela.
  const lista = await j(await fetch(`${BASE}/api/financial/entries`, { headers: SO_TOKEN_A }))
  const linhas = Array.isArray(lista) ? lista : (lista?.data ?? [])
  if (linhas.some(e => e.id === linha.id)) ok('e aparece na lista do Financeiro')
  else bad('criou mas não aparece na lista')

  // Com vencimento continua funcionando.
  const comData = await fetch(`${BASE}/api/financial/entries`, { method: 'POST', headers: HA,
    body: JSON.stringify({ type: 'payable', description: 'Aluguel', amount: 900, status: 'pending', dueDate: '2026-11-10' }) })
  eq(comData.status, 201, 'com vencimento também')
}

console.log('\n── 2. Parcelamento nasce agrupado, e o grupo some junto ──')
{
  const lote = Array.from({ length: 6 }, (_, i) => ({
    type: 'receivable', description: `Honorários (${i + 1}/6)`, amount: 500, status: 'pending',
    dueDate: `2026-${String(i + 1).padStart(2, '0')}-10`,
    groupId: 'grp_teste_1', installmentOf: i + 1, installmentTotal: 6,
  }))
  const r = await fetch(`${BASE}/api/financial/entries/lote`, { method: 'POST', headers: HA, body: JSON.stringify({ entries: lote }) })
  eq(r.status, 201, 'seis parcelas numa transação só')
  const criadas = await j(r)
  eq(criadas.length, 6, 'todas criadas')
  if (criadas.every(e => e.groupId === 'grp_teste_1')) ok('todas com o mesmo grupo')
  else bad(`grupos: ${criadas.map(e => e.groupId).join(',')}`)
  if (criadas.every(e => typeof e.installmentOf === 'number')) ok('e sabem que parcela são')
  else bad('sem o número da parcela')

  // ?grupo=1 leva o parcelamento inteiro. Sem groupId isto nunca funcionava.
  const del = await fetch(`${BASE}/api/financial/entries/${criadas[0].id}?grupo=1`, { method: 'DELETE', headers: SO_TOKEN_A })
  eq(del.status, 204, 'excluir o parcelamento inteiro')
  const sobraram = await db.select().from(financialEntries)
    .where(and(dbEq(financialEntries.tenantId, A), dbEq(financialEntries.groupId, 'grp_teste_1')))
  eq(sobraram.length, 0, 'não sobrou parcela nenhuma')
}

console.log('\n── 3. O arquivo enviado existe de verdade ──')
{
  // O teste que denuncia o bug antigo: enviar, baixar e comparar o conteúdo.
  const conteudo = 'RG da cliente — conteudo de teste\nlinha 2'
  const fd = new FormData()
  fd.append('file', new Blob([conteudo], { type: 'text/plain' }), 'rg-cliente.txt')
  fd.append('clientId', '')          // sem cliente também tem de funcionar
  fd.append('folder', 'identificacao')

  const up = await fetch(`${BASE}/api/documents/upload`, { method: 'POST', headers: SO_TOKEN_A, body: fd })
  eq(up.status, 201, 'enviar arquivo')
  const [doc] = await j(up)
  eq(doc.name, 'rg-cliente.txt', 'nome gravado')
  eq(doc.folder, 'identificacao', 'pasta gravada no banco, não só no navegador')
  eq(doc.fileSize, Buffer.byteLength(conteudo), 'tamanho real do arquivo')

  const baixado = await fetch(`${BASE}/api/documents/${doc.id}/download`, { headers: SO_TOKEN_A })
  eq(baixado.status, 200, 'baixar')
  eq(await baixado.text(), conteudo, 'o conteúdo volta igualzinho')

  // Documento do PROCESSO: a aba Documentos do processo era um estado vazio
  // fixo — dizia "Sem documentos" sempre, e o botão "Enviar Documento" não
  // tinha onClick nenhum. Agora envia e lista pelo processId.
  {
    const dono = await j(await fetch(`${BASE}/api/clients`, { method: 'POST', headers: HA,
      body: JSON.stringify({ name: 'Cliente do Processo', type: 'individual', cpfCnpj: '52998224725' }) }))
    const proc = await j(await fetch(`${BASE}/api/processes`, { method: 'POST', headers: HA,
      body: JSON.stringify({ title: 'Ação com documento', clientId: dono.id, area: 'civel', status: 'active' }) }))
    const fd2 = new FormData()
    fd2.append('file', new Blob(['peticao inicial'], { type: 'text/plain' }), 'peticao.txt')
    fd2.append('processId', proc.id)
    const up2 = await fetch(`${BASE}/api/documents/upload`, { method: 'POST', headers: SO_TOKEN_A, body: fd2 })
    eq(up2.status, 201, 'enviar documento do processo')
    eq((await j(up2))[0].processId, proc.id, 'fica ligado ao processo')

    const doProcesso = await j(await fetch(`${BASE}/api/documents?processId=${proc.id}`, { headers: SO_TOKEN_A }))
    eq(doProcesso.length, 1, 'e a aba do processo encontra ele')
    const deOutro = await j(await fetch(`${BASE}/api/documents?processId=nao-existe`, { headers: SO_TOKEN_A }))
    eq(deOutro.length, 0, 'sem misturar com os de outro processo')
  }

  // Mover de pasta: antes a pasta era enfeite do navegador.
  const mv = await fetch(`${BASE}/api/documents/${doc.id}`, { method: 'PATCH', headers: HA, body: JSON.stringify({ folder: 'assinados' }) })
  eq(mv.status, 200, 'mover de pasta')
  eq((await j(mv)).folder, 'assinados', 'a pasta nova ficou gravada')

  // Outro escritório não vê nem move nem apaga.
  const espiar = await fetch(`${BASE}/api/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${tkB}` } })
  eq(espiar.status, 404, 'outro escritório não baixa o arquivo')
  const mexer = await fetch(`${BASE}/api/documents/${doc.id}`, { method: 'PATCH', headers: HB, body: JSON.stringify({ folder: 'root' }) })
  eq(mexer.status, 404, 'nem move de pasta')

  // Excluir apaga a linha E o arquivo do disco.
  const caminho = join(process.env.FILES_DIR ?? './data/files', doc.filePath)
  if (existsSync(caminho)) ok('o arquivo está no disco')
  else bad(`não achei o arquivo em ${caminho}`)
  const del = await fetch(`${BASE}/api/documents/${doc.id}`, { method: 'DELETE', headers: SO_TOKEN_A })
  eq(del.status, 204, 'excluir')
  if (!existsSync(caminho)) ok('e o arquivo saiu do disco, em vez de ficar ocupando espaço para sempre')
  else bad('a linha foi apagada mas o arquivo ficou no disco')
  const sobrou = await db.select().from(documents).where(dbEq(documents.id, doc.id))
  eq(sobrou.length, 0, 'linha apagada')
}

console.log('\n── 4. Teses: existem, são do escritório, e dá para vincular ──')
{
  const r = await fetch(`${BASE}/api/theses`, { method: 'POST', headers: HA,
    body: JSON.stringify({ title: 'Dano moral por negativação indevida', area: 'consumidor',
      content: 'CDC art. 42 · Súmula 385 STJ · dano in re ipsa', source: 'Vade Mecum' }) })
  eq(r.status, 201, 'criar tese')
  const t = await j(r)
  eq(t.title, 'Dano moral por negativação indevida', 'título')
  eq(t.area, 'consumidor', 'área')

  const lista = await j(await fetch(`${BASE}/api/theses`, { headers: SO_TOKEN_A }))
  eq(lista.length, 1, 'aparece na lista do escritório')

  // É isto que o botão "+ Vincular tese" do cliente precisava e nunca tinha.
  if (lista[0].id && lista[0].title && lista[0].content) ok('com id, título e conteúdo — o que a Área de Trabalho do cliente lê')
  else bad('lista sem os campos que a tela usa')

  // Busca por palavra.
  const achou = await j(await fetch(`${BASE}/api/theses?q=negativa`, { headers: SO_TOKEN_A }))
  eq(achou.length, 1, 'busca por palavra acha')
  const naoAchou = await j(await fetch(`${BASE}/api/theses?q=usucapiao`, { headers: SO_TOKEN_A }))
  eq(naoAchou.length, 0, 'e não inventa resultado')

  // Isolamento: o escritório B não vê nem mexe.
  const listaB = await j(await fetch(`${BASE}/api/theses`, { headers: { Authorization: `Bearer ${tkB}` } }))
  eq(listaB.length, 0, 'outro escritório não vê a tese')
  const mexerB = await fetch(`${BASE}/api/theses/${t.id}`, { method: 'PUT', headers: HB, body: JSON.stringify({ title: 'roubada' }) })
  eq(mexerB.status, 404, 'nem consegue alterar')
  const apagarB = await fetch(`${BASE}/api/theses/${t.id}`, { method: 'DELETE', headers: HB })
  eq(apagarB.status, 404, 'nem apagar')

  // Sem título ou sem conteúdo não entra lixo no lugar da tese.
  const vazia = await fetch(`${BASE}/api/theses`, { method: 'POST', headers: HA, body: JSON.stringify({ title: '   ' }) })
  eq(vazia.status, 400, 'tese sem título: 400')
  const semTexto = await fetch(`${BASE}/api/theses`, { method: 'POST', headers: HA, body: JSON.stringify({ title: 'X' }) })
  eq(semTexto.status, 400, 'tese sem conteúdo: 400')

  const del = await fetch(`${BASE}/api/theses/${t.id}`, { method: 'DELETE', headers: SO_TOKEN_A })
  eq(del.status, 204, 'excluir a própria tese')
  const fim = await db.select().from(legalTheses).where(dbEq(legalTheses.tenantId, A))
  eq(fim.length, 0, 'e some mesmo')
}

console.log('\n── 5. Assinatura à distância: o circuito inteiro ──')
{
  // Esta parte eu disse que funciona — então tem de ficar provado.
  const cli = await j(await fetch(`${BASE}/api/clients`, { method: 'POST', headers: HA,
    body: JSON.stringify({ name: 'Cliente Assina', type: 'individual', cpfCnpj: '52998224725' }) }))
  const pedido = await j(await fetch(`${BASE}/api/signatures`, { method: 'POST', headers: HA,
    body: JSON.stringify({ clientId: cli.id, clientName: 'Cliente Assina', clientPhone: '51999990000',
      documentos: [{ titulo: 'Procuração', corpo: 'Outorgo poderes…' }], modo: 'remoto' }) }))
  if (pedido?.id) ok('pedido de assinatura criado')
  else bad(`pedido: ${JSON.stringify(pedido).slice(0, 160)}`)

  // A pessoa abre o link SEM estar logada — é o ponto do negócio.
  const aberto = await fetch(`${BASE}/api/signatures/public/${pedido.id}`)
  eq(aberto.status, 200, 'o link abre sem login')
  const visao = await j(aberto)
  eq(visao.status, 'pendente', 'e vem como pendente')
  if (visao.signatureImg === undefined && visao.photoImg === undefined)
    ok('a visão pública não devolve assinatura nem foto de ninguém')
  else bad('a visão pública expõe imagens de assinatura')

  // Faltando foto ou CPF, não assina.
  const incompleto = await fetch(`${BASE}/api/signatures/public/${pedido.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signer: { nome: 'Cliente Assina' }, signatureImg: 'data:,x' }) })
  eq(incompleto.status, 400, 'sem CPF e sem foto: recusa')

  const assinado = await fetch(`${BASE}/api/signatures/public/${pedido.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signer: { nome: 'Cliente Assina', cpf: '529.982.247-25' },
      signatureImg: 'data:image/png;base64,iVBORw0KGgo=',
      photoImg: 'data:image/png;base64,iVBORw0KGgo=',
      consent: true, consentText: 'Li e concordo.', documentHash: 'abc123',
    }) })
  eq(assinado.status, 200, 'assina')
  eq((await j(assinado)).status, 'assinado', 'e fica marcado como assinado')

  // Foto grande: o limite do Fastify era 1 MiB e a foto vai DENTRO do JSON,
  // em base64. Uma foto de celular estourava e a pessoa via "Request body is
  // too large" — sem assinar, sem entender. O cliente encolhe antes de
  // enviar; esta folga no servidor é a rede de segurança.
  const pedidoGrande = await j(await fetch(`${BASE}/api/signatures`, { method: 'POST', headers: HA,
    body: JSON.stringify({ clientId: cli.id, clientName: 'Cliente Foto', clientPhone: '51999990000',
      documentos: [{ titulo: 'Procuração', corpo: 'Outorgo poderes…' }], modo: 'remoto' }) }))
  const fotoDe3MB = 'data:image/jpeg;base64,' + 'A'.repeat(3 * 1024 * 1024)
  const comFotoGrande = await fetch(`${BASE}/api/signatures/public/${pedidoGrande.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signer: { nome: 'Cliente Foto', cpf: '529.982.247-25' },
      signatureImg: 'data:image/png;base64,iVBORw0KGgo=',
      photoImg: fotoDe3MB, consent: true,
    }) })
  eq(comFotoGrande.status, 200, 'foto de 3 MB passa (antes: 413 "body too large")')

  // Duas assinaturas no mesmo pedido, não.
  const denovo = await fetch(`${BASE}/api/signatures/public/${pedido.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signer: { nome: 'Outro', cpf: '11111111111' },
      signatureImg: 'data:,x', photoImg: 'data:,y' }) })
  eq(denovo.status, 409, 'assinar duas vezes: recusa')

  // O escritório vê o pedido assinado; o outro escritório não vê nada.
  const meus = await j(await fetch(`${BASE}/api/signatures`, { headers: SO_TOKEN_A }))
  const linhas = Array.isArray(meus) ? meus : (meus?.data ?? [])
  if (linhas.some(r => r.id === pedido.id && r.status === 'assinado')) ok('o escritório vê o documento assinado')
  else bad('o pedido assinado não aparece para o escritório')
  const doOutro = await j(await fetch(`${BASE}/api/signatures`, { headers: { Authorization: `Bearer ${tkB}` } }))
  const linhasB = Array.isArray(doOutro) ? doOutro : (doOutro?.data ?? [])
  if (!linhasB.some(r => r.id === pedido.id)) ok('e o outro escritório não vê')
  else bad('vazamento entre escritórios nas assinaturas')
}

console.log('\n── 6. Migrações rodam no arranque, e repetir não quebra ──')
{
  // O deploy só rodava `npm install && npm run build`: coluna nova no código,
  // banco velho em produção, e o erro aparecia como 500 engolido pela tela.
  const { migrarNoArranque } = await import('../db/autoMigrate.js')
  const silencio = { info() {}, warn() {}, error() {} }
  const r1 = await migrarNoArranque(silencio)
  eq(r1.rodou, true, 'rodou')
  const r2 = await migrarNoArranque(silencio)
  eq(r2.rodou, true, 'rodar de novo é inofensivo')

  const desligado = { ...process.env.AUTO_MIGRATE }
  process.env.AUTO_MIGRATE = 'false'
  const r3 = await migrarNoArranque(silencio)
  eq(r3.rodou, false, 'dá para desligar com AUTO_MIGRATE=false')
  delete process.env.AUTO_MIGRATE
  void desligado
}

console.log('\n── 7. Nenhuma tela volta a engolir falha de gravação ──')
{
  // Teste de regressão por leitura: estas quatro gravações tinham `catch {}`.
  const { readFileSync } = await import('node:fs')
  const semComentarios = (t) => t.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const ler = (f) => semComentarios(readFileSync(`client/src/${f}`, 'utf8'))

  const casos = [
    ['modules/deadlines/DeadlinesPage.jsx', /api\.deadlines\.create\([^)]*\)\s*\}\s*catch\s*\{\s*\}/, 'criar prazo'],
    ['modules/deadlines/DeadlinesPage.jsx', /api\.deadlines\.complete\(id\)\s*\}\s*catch\s*\{\s*\}/, 'concluir prazo'],
    ['modules/tasks/TasksPage.jsx',         /api\.tasks\.update\(id, data\)\s*\}\s*catch\s*\{\s*\}/, 'alterar tarefa'],
    ['modules/financial/FinancialPage.jsx', /api\.financial\.pay\(id\)\s*\}\s*catch\s*\{\s*\}/,      'marcar pago'],
  ]
  for (const [arquivo, padrao, nome] of casos) {
    if (padrao.test(ler(arquivo))) bad(`${nome}: a falha voltou a ser engolida`)
    else ok(`${nome}: a falha não é mais engolida`)
  }

  // E cada uma dessas telas tem de DIZER que não salvou.
  const prazos = ler('modules/deadlines/DeadlinesPage.jsx')
  if (/O prazo NÃO foi salvo/.test(prazos)) ok('o modal de prazo avisa que não salvou, em vez de fechar')
  else bad('o modal de prazo fecha sem avisar')
  if (/setDeadlines\(antes\)/.test(prazos)) ok('e desfaz o "concluído" que o servidor recusou')
  else bad('mantém na tela um prazo concluído que o servidor não aceitou')

  const fin = ler('modules/financial/FinancialPage.jsx')
  if (/O lançamento NÃO foi salvo/.test(fin)) ok('o modal de lançamento avisa que não salvou')
  else bad('o modal de lançamento fecha sem avisar')
  if (/createLote\(lote\)/.test(fin)) ok('e as parcelas vão em lote: ou todas, ou nenhuma')
  else bad('as parcelas continuam indo uma por uma')
  if (/groupId: grupo/.test(fin)) ok('com o nome de campo que o servidor realmente grava')
  else bad('continua mandando recorrenciaId, que o servidor descarta')

  // O upload do cliente tem de usar o servidor.
  const cli = ler('modules/clients/ClientPage.jsx')
  if (/api\.documents\.upload\(fd\)/.test(cli)) ok('o envio de arquivo do cliente sobe para o servidor')
  else bad('o envio de arquivo continua só no navegador')
  if (/api\.documents\.download/.test(cli) && /api\.documents\.view/.test(cli)) ok('e dá para baixar e abrir o que foi enviado')
  else bad('não dá para baixar o arquivo enviado')
  if (/arquivo não foi guardado/.test(cli)) ok('as linhas antigas (sem arquivo) aparecem marcadas, em vez de fingir que têm arquivo')
  else bad('linhas antigas continuam parecendo arquivo de verdade')
  if (/api\.theses\.list\(\)/.test(cli)) ok('e a lista de teses do cliente vem do servidor')
  else bad('a lista de teses continua lendo uma chave que ninguém escreve')

  // O botão "Enviar Documento" do processo não tinha ação nenhuma.
  const proc = ler('modules/processes/ProcessDetail.jsx')
  if (/api\.documents\.upload\(fd\)/.test(proc)) ok('o botão Enviar Documento do processo envia de verdade')
  else bad('o botão Enviar Documento continua sem ação')
  if (/api\.documents\.list\(\{ processId \}\)/.test(proc)) ok('e a aba lista os documentos do processo')
  else bad('a aba continua com o "Sem documentos" fixo')

  const cfg = ler('lib/tenantData.js')
  if (/avisarFalha/.test(cfg) && !/saveConfig\(payload\)\.catch\(\(\) => \{\}\)/.test(cfg))
    ok('as configurações avisam quando não conseguem salvar no servidor')
  else bad('configuração continua falhando em silêncio')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
