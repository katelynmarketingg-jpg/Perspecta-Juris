// A busca no Diário parava na primeira página.
//
// A rota pedia `pagina: '1'` com 50 itens e devolvia. Um escritório com mais
// de 50 publicações no período perdia o resto EM SILÊNCIO — nada na resposta
// e nada na tela diziam que faltava alguma coisa. Num sistema de prazo,
// publicação que some é prazo que se perde.
//
// O DJEN aqui é de mentira: um servidor local que responde o que este teste
// mandar. Assim dá para exercitar 3 páginas, repetição entre páginas e falha
// no meio — coisas que a API real não faz sob encomenda.
//
// Esta suíte sobe o PRÓPRIO servidor, numa porta separada, apontando o
// DJEN_URL para o servidor de mentira. Por isso não usa o servidor de teste
// que as outras suítes compartilham.
import bcrypt from 'bcryptjs'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const eq  = (real, esperado, msg) =>
  real === esperado ? ok(`${msg} = ${real}`) : bad(`${msg}: deu ${real}, esperado ${esperado}`)
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const esperar = (ms) => new Promise(r => setTimeout(r, ms))

const { db } = await import('../db/index.js')
const { tenants, users, usageEvents } = await import('../db/schema.js')
const { eq: dbEq, and, inArray } = await import('drizzle-orm')

// ── DJEN de mentira ───────────────────────────────────────────────────────
let cenario = { paginas: 1, porPagina: 100, ultimaPagina: 100, falharNaPagina: 0, repetirId: null }
let pedidos = []

const publicacao = (n) => ({
  id: `pub-${n}`, numeroProcesso: `000${n}-11.2026.8.26.0100`, siglaTribunal: 'TJSP',
  nomeOrgao: '1ª Vara', tipoComunicacao: 'Intimação', dataDisponibilizacao: '2026-09-01',
  texto: `<p>Publicação número ${n}</p>`, destinatarios: [{ nome: 'Dra. Karen' }],
})

const djen = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const pagina = parseInt(url.searchParams.get('pagina') ?? '1', 10)
  pedidos.push({ pagina, query: Object.fromEntries(url.searchParams) })

  if (cenario.falharNaPagina && pagina === cenario.falharNaPagina) {
    res.writeHead(500); res.end('erro do CNJ'); return
  }
  const quantos = pagina > cenario.paginas ? 0
    : pagina === cenario.paginas ? cenario.ultimaPagina : cenario.porPagina
  const itens = Array.from({ length: quantos },
    (_, i) => publicacao((pagina - 1) * cenario.porPagina + i + 1))

  // Repetição entre páginas: o DJEN real às vezes devolve o mesmo item duas vezes.
  if (cenario.repetirId && pagina === 2 && itens.length) itens[0] = publicacao(cenario.repetirId)

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ items: itens }))
})
await new Promise(r => djen.listen(0, '127.0.0.1', r))
const PORTA = djen.address().port

// ── servidor da aplicação, apontado para o DJEN de mentira ────────────────
const PORTA_APP = Number(process.env.TEST_PORT ?? 8798)
const BASE = `http://127.0.0.1:${PORTA_APP}`
const servidor = spawn(process.execPath, ['server/index.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORTA_APP),
    DJEN_URL: `http://127.0.0.1:${PORTA}/api/v1/comunicacao`,
    DATAJUD_SYNC_ENABLED: 'false',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logDoServidor = ''
servidor.stdout.on('data', d => { logDoServidor += d })
servidor.stderr.on('data', d => { logDoServidor += d })

const encerrar = (codigo) => {
  try { servidor.kill('SIGTERM') } catch {}
  djen.close()
  process.exit(codigo)
}

let noAr = false
for (let i = 0; i < 80 && !noAr; i++) {
  try { noAr = (await fetch(`${BASE}/api/health`)).ok } catch { await esperar(250) }
}
if (!noAr) {
  console.log('  ❌ o servidor de teste não subiu\n' + logDoServidor)
  encerrar(1)
}

// ── fixtures ──────────────────────────────────────────────────────────────
const TID = 'tnt_diario', UID = 'usr_diario'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [TID]))
await db.delete(usageEvents).where(inArray(usageEvents.tenantId, [TID]))
await db.insert(tenants).values({ id: TID, slug: 'diario', name: 'Escritorio Diario',
  plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: UID, tenantId: TID, name: 'Karen', loginName: 'karen',
  passwordHash: await bcrypt.hash('senha-forte-123', 12), role: 'admin', isActive: true,
  createdAt: now, updatedAt: now })

const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Diario', nome: 'karen', senha: 'senha-forte-123' }),
}))
const H = { Authorization: `Bearer ${login.accessToken}` }

const buscar = async (qs = 'oab=123456&uf=RS') =>
  j(await fetch(`${BASE}/api/diario/publicacoes?${qs}`, { headers: H }))

const consultas = async () => (await db.select().from(usageEvents)
  .where(and(dbEq(usageEvents.tenantId, TID), dbEq(usageEvents.kind, 'djen_query')))).length

console.log('\n── 1. Três páginas viram uma lista só ──')
{
  cenario = { paginas: 3, porPagina: 100, ultimaPagina: 40, falharNaPagina: 0, repetirId: null }
  pedidos = []
  const r = await buscar()

  eq(r.total, 240, '100 + 100 + 40 publicações')
  eq(r.data?.length, 240, 'e a lista tem todas')
  eq(pedidos.map(p => p.pagina).join(','), '1,2,3', 'pediu as três páginas, em ordem')
  eq(r.truncado, false, 'não ficou faltando nada')
  eq(r.aviso, null, 'e por isso não avisa nada')
  if (r.data[0].texto === 'Publicação número 1') ok('o HTML da publicação foi limpo')
  else bad(`texto: ${r.data[0].texto}`)
  if (r.periodo?.de && r.periodo?.ate) ok(`o período consultado volta na resposta (${r.periodo.dias} dias)`)
  else bad('sem período na resposta')
}

console.log('\n── 2. Cada página conta como consulta ──')
{
  // Contar só a primeira esconderia o consumo real de quem tem muita
  // publicação — e é justamente esse número que a Central usa para cobrar.
  await db.delete(usageEvents).where(dbEq(usageEvents.tenantId, TID))
  cenario = { paginas: 3, porPagina: 100, ultimaPagina: 10, falharNaPagina: 0, repetirId: null }
  await buscar()
  eq(await consultas(), 3, 'três páginas, três consultas registradas')

  const linhas = await db.select().from(usageEvents)
    .where(and(dbEq(usageEvents.tenantId, TID), dbEq(usageEvents.kind, 'djen_query')))
  if (linhas.every(l => typeof l.meta?.pagina === 'number')) ok('cada registro diz de que página veio')
  else bad('a página não foi registrada no consumo')
  if (linhas.every(l => l.userId === UID)) ok('e quem consultou')
  else bad('sem o usuário no registro')
}

console.log('\n── 3. Uma página só: para sem pedir a segunda ──')
{
  cenario = { paginas: 1, porPagina: 100, ultimaPagina: 7, falharNaPagina: 0, repetirId: null }
  pedidos = []
  const r = await buscar()
  eq(r.total, 7, 'sete publicações')
  eq(pedidos.length, 1, 'e uma única consulta — página incompleta é a última')
}

console.log('\n── 4. Publicação repetida entre páginas não duplica ──')
{
  // O DJEN às vezes devolve o mesmo item em duas páginas. Duplicar viraria
  // duas tarefas e dois prazos para a mesma intimação.
  cenario = { paginas: 2, porPagina: 100, ultimaPagina: 100, falharNaPagina: 0, repetirId: 1 }
  const r = await buscar()
  eq(r.total, 199, '200 itens com uma repetição viram 199')
  const ids = r.data.map(p => p.id)
  eq(new Set(ids).size, ids.length, 'nenhum id repetido na lista')
}

console.log('\n── 5. Falha no meio: entrega o que já veio, e avisa ──')
{
  // Perder 200 publicações porque a página 3 falhou seria pior do que
  // entregar 200 dizendo que pode faltar.
  cenario = { paginas: 5, porPagina: 100, ultimaPagina: 100, falharNaPagina: 3, repetirId: null }
  const r = await buscar()
  eq(r.total, 200, 'as duas primeiras páginas foram entregues')
  eq(r.truncado, true, 'marcado como incompleto')
  if (r.aviso?.includes('página 3')) ok('e diz onde parou: ' + r.aviso)
  else bad(`aviso: ${r.aviso}`)
}

console.log('\n── 6. Falha logo na primeira: aí sim é erro ──')
{
  // Sem nada em mãos, entregar lista vazia seria mentir que não há publicação.
  cenario = { paginas: 5, porPagina: 100, ultimaPagina: 100, falharNaPagina: 1, repetirId: null }
  const res = await fetch(`${BASE}/api/diario/publicacoes?oab=123456&uf=RS`, { headers: H })
  eq(res.status, 502, 'devolve erro, não uma lista vazia')
  const b = await j(res)
  if (String(b.message).includes('DJEN')) ok('e diz que o problema foi no DJEN')
  else bad(`mensagem: ${b.message}`)
}

console.log('\n── 7. O teto existe, e é anunciado ──')
{
  // Sem teto, uma OAB muito ativa varreria o Diário inteiro. Com teto e sem
  // aviso, a pessoa acharia que aquilo era tudo.
  cenario = { paginas: 999, porPagina: 100, ultimaPagina: 100, falharNaPagina: 0, repetirId: null }
  pedidos = []
  const r = await buscar()
  if (pedidos.length <= 20) ok(`parou em ${pedidos.length} páginas em vez de varrer o Diário inteiro`)
  else bad(`pediu ${pedidos.length} páginas`)
  eq(r.truncado, true, 'e marcou como incompleto')
  if (r.aviso?.includes('Reduza')) ok('dizendo o que fazer: reduzir o intervalo de datas')
  else bad(`aviso: ${r.aviso}`)
}

console.log('\n── 8. Parâmetros de busca ──')
{
  cenario = { paginas: 1, porPagina: 100, ultimaPagina: 3, falharNaPagina: 0, repetirId: null }
  pedidos = []
  await buscar('oab=123.456&uf=RS&nome=Karen')
  const q = pedidos[0].query
  eq(q.numeroOab, '123456', 'a OAB vai sem pontuação')
  eq(q.ufOab, 'RS', 'a UF é a da inscrição da OAB')
  eq(q.nomeAdvogado, 'Karen', 'o nome, quando informado')
  eq(q.itensPorPagina, '100', 'pede 100 por página, não 50')

  pedidos = []
  await buscar('numeroProcesso=0001234-12.2026.8.26.0100')
  eq(pedidos[0].query.numeroProcesso, '00012341220268260100', 'processo vai só com dígitos')

  // Sem OAB e sem processo não dá para buscar nada.
  const semNada = await fetch(`${BASE}/api/diario/publicacoes`, { headers: H })
  eq(semNada.status, 400, 'sem OAB nem processo: 400')

  // A janela de dias é limitada — 5 anos de Diário não cabem numa tela.
  pedidos = []
  await buscar('oab=123456&uf=RS&dias=9999')
  const dias = (new Date(pedidos[0].query.dataDisponibilizacaoFim) - new Date(pedidos[0].query.dataDisponibilizacaoInicio)) / 86400000
  if (dias <= 366) ok(`a janela trava em ${Math.round(dias)} dias`)
  else bad(`aceitou ${Math.round(dias)} dias`)

  // Sem token não passa: o Diário é dado de cliente.
  const semLogin = await fetch(`${BASE}/api/diario/publicacoes?oab=123456&uf=RS`)
  eq(semLogin.status, 401, 'sem autenticação: 401')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
encerrar(falhas === 0 ? 0 : 1)
