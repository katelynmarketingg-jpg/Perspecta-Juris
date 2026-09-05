// ETAPA 2 — o que o DataJud traz precisa acabar no BANCO, não no navegador.
// Roda a lógica real de client/src/lib/datajudSync.js contra o servidor, com
// o proxy do CNJ substituído por uma resposta conhecida (o teste não depende
// da API do CNJ estar no ar).
const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const j   = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const lista = (r) => Array.isArray(r) ? r : (r?.data ?? [])

// ── navegador falso ──────────────────────────────────────────────────────
const store = new Map()
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.window = { location: { origin: BASE, href: '' } }

const bcrypt = (await import('bcryptjs')).default
const { db } = await import('../db/index.js')
const { tenants, users, clients, processes, processMovements } = await import('../db/schema.js')
const { eq } = await import('drizzle-orm')
const now = new Date().toISOString()

// Fixtures com id fixo: apaga o que uma execução anterior deixou, para a
// suíte poder rodar de novo no mesmo banco (o cascade leva os dados junto).
const { inArray } = await import('drizzle-orm')
await db.delete(tenants).where(inArray(tenants.id, ['tnt_dj']))

const TID = 'tnt_dj'
await db.insert(tenants).values({ id: TID, slug: 'dj', name: 'Escritorio DataJud', plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_dj', tenantId: TID, name: 'Rita', loginName: 'rita',
  passwordHash: await bcrypt.hash('senha-forte-789', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })

const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio DataJud', nome: 'rita', senha: 'senha-forte-789' }),
}))
localStorage.setItem('pj_access_token', login.accessToken)
localStorage.setItem('pj_refresh_token', login.refreshToken)
localStorage.setItem('pj_auth', JSON.stringify({ state: { user: login.user, tenant: login.tenant } }))
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.accessToken}` }

const cliente = await j(await fetch(`${BASE}/api/clients`, {
  method: 'POST', headers: H, body: JSON.stringify({ name: 'Cliente DJ', phone: '5199', type: 'person' }),
}))
const proc = await j(await fetch(`${BASE}/api/processes`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ clientId: cliente.id, title: 'Processo com CNJ', area: 'civel',
    judicialNumber: '0001234-12.2025.8.26.0100', court: 'TJSP', status: 'active' }),
}))

// ── intercepta só a chamada ao proxy do DataJud ──────────────────────────
const fetchReal = globalThis.fetch
let consultasAoCNJ = 0
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('/api/datajud/')) {
    consultasAoCNJ++
    return new Response(JSON.stringify({ hits: { hits: [{ _source: { movimentos: [
      { nome: 'Distribuído por sorteio', dataHora: '2026-08-01T10:00:00' },
      { nome: 'Juntada de petição',      dataHora: '2026-08-05T14:30:00' },
    ] } }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return fetchReal(url, opts)
}

const { syncAllProcesses, getLastSyncInfo } = await import('../../client/src/lib/datajudSync.js')

console.log('\n── 1. O sync enxerga os processos do BANCO ──')
const info = await getLastSyncInfo()
if (info.processCount === 1) ok('1 processo com CNJ encontrado via API')
else bad(`processCount = ${info.processCount} (esperava 1)`)

console.log('\n── 2. As movimentações do DataJud vão para o banco ──')
const r1 = await syncAllProcesses()
if (r1.newMovements === 2) ok('2 movimentações importadas')
else bad(`newMovements = ${r1.newMovements} — ${JSON.stringify(r1)}`)

// Criar o processo já grava uma movimentação própria (processes.js:72),
// então contamos só as que vieram do DataJud.
const doDataJud = async () => (await db.select().from(processMovements)
  .where(eq(processMovements.tenantId, TID))).filter(m => m.author === 'DataJud / CNJ')
const noBanco = await doDataJud()
if (noBanco.length === 2) ok('SELECT confirma 2 movimentações do DataJud em process_movements')
else bad(`banco tem ${noBanco.length} do DataJud`)
if (noBanco.some(m => m.description === 'Distribuído por sorteio' && m.date === '2026-08-01')) ok('descrição e data preservadas')
else bad('conteúdo da movimentação não confere')
if (noBanco.every(m => m.tenantId === TID && m.processId === proc.id)) ok('vinculada ao processo e ao escritório certos')
else bad('vínculo errado')

console.log('\n── 3. Rodar de novo NÃO duplica ──')
const r2 = await syncAllProcesses()
if (r2.newMovements === 0) ok('segunda passada não importou nada')
else bad(`segunda passada importou ${r2.newMovements} (DUPLICOU)`)
const depois = await doDataJud()
if (depois.length === 2) ok('continuam 2 movimentações do DataJud no banco')
else bad(`agora há ${depois.length}`)

console.log('\n── 4. Movimentação nova é detectada ──')
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('/api/datajud/')) {
    return new Response(JSON.stringify({ hits: { hits: [{ _source: { movimentos: [
      { nome: 'Distribuído por sorteio', dataHora: '2026-08-01T10:00:00' },
      { nome: 'Juntada de petição',      dataHora: '2026-08-05T14:30:00' },
      { nome: 'Sentença publicada',      dataHora: '2026-08-19T09:00:00' },
    ] } }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return fetchReal(url, opts)
}
const r3 = await syncAllProcesses()
if (r3.newMovements === 1) ok('só a movimentação inédita entrou')
else bad(`importou ${r3.newMovements} (esperava 1)`)
const final = await doDataJud()
if (final.length === 3) ok('3 movimentações do DataJud no total')
else bad(`total = ${final.length}`)

console.log('\n── 5. Sem conexão, o sync não inventa nem grava ──')
globalThis.fetch = async () => { throw new Error('rede caiu') }
const r4 = await syncAllProcesses()
if (r4.newMovements === 0) ok('não importou nada com a rede fora')
else bad(`importou ${r4.newMovements} sem rede: ${JSON.stringify(r4)}`)
globalThis.fetch = fetchReal
const aposOffline = await doDataJud()
if (aposOffline.length === 3) ok('banco intacto após a queda')
else bad(`banco mudou: ${aposOffline.length}`)

console.log('\n── 6. Nada foi parar no localStorage ──')
const chavesLocais = [...store.keys()].filter(k => k.startsWith('pj_local_'))
if (chavesLocais.length === 0) ok('nenhuma chave pj_local_* criada pelo sync')
else bad(`o sync ainda grava no navegador: ${chavesLocais.join(', ')}`)

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
