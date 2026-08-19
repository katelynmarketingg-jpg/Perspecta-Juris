// Teste de integração da ETAPA 0.1 — sobe o servidor real contra um Postgres
// local e tenta explorar a falha do refresh token.
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }

// ── Preparação: dois tenants, dois usuários ──────────────────────────
const { db } = await import('../db/index.js')
const { tenants, users, refreshTokens } = await import('../db/schema.js')
const now = new Date().toISOString()

await db.insert(tenants).values([
  { id: 'tnt_a', slug: 'alfa', name: 'Escritorio Alfa', plan: 'master', isActive: true, settings: {}, createdAt: now, updatedAt: now },
  { id: 'tnt_b', slug: 'beta', name: 'Escritorio Beta', plan: 'starter', isActive: true, settings: {}, createdAt: now, updatedAt: now },
])
await db.insert(users).values([
  { id: 'usr_master', tenantId: 'tnt_a', name: 'Chefona', loginName: 'chefona',
    passwordHash: await bcrypt.hash('senha-do-master', 12), role: 'master', isActive: true, createdAt: now, updatedAt: now },
  { id: 'usr_ze', tenantId: 'tnt_b', name: 'Ze', loginName: 'ze',
    passwordHash: await bcrypt.hash('senha-do-ze', 12), role: 'advogado', isActive: true, createdAt: now, updatedAt: now },
])

console.log('\n── 1. Login do master (cria a PRIMEIRA linha de refresh_tokens) ──')
const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Alfa', nome: 'chefona', senha: 'senha-do-master' }),
}))
if (login.accessToken) ok('master logou'); else bad('master nao logou: ' + JSON.stringify(login))

const linhas = await db.select().from(refreshTokens)
if (linhas.length === 1) ok('1 linha em refresh_tokens (a do master)')
else bad(`esperava 1 linha, achei ${linhas.length}`)
if (/^[0-9a-f]{64}$/.test(linhas[0]?.tokenHash ?? '')) ok('token_hash e SHA-256 hex (nao bcrypt)')
else bad('token_hash nao parece SHA-256: ' + linhas[0]?.tokenHash?.slice(0, 12))

console.log('\n── 2. O ATAQUE: refresh com uma string inventada ──')
console.log('    (antes da correcao isto devolvia o accessToken do master)')
for (const lixo of ['qualquer-coisa', '', 'x'.repeat(64), nanoid(64)]) {
  const r = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: lixo }),
  })
  const body = await j(r)
  if (r.status === 401 && !body.accessToken) ok(`token invalido "${lixo.slice(0, 14)}…" recusado com 401`)
  else bad(`FALHA EXPLORADA com "${lixo.slice(0, 14)}…" → ${r.status} ${JSON.stringify(body).slice(0, 120)}`)
}

console.log('\n── 3. O caminho legitimo continua funcionando ──')
const ref1 = await j(await fetch(`${BASE}/api/auth/refresh`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: login.refreshToken }),
}))
if (ref1.accessToken && ref1.refreshToken) ok('refresh valido devolveu novo par de tokens')
else bad('refresh valido falhou: ' + JSON.stringify(ref1))

console.log('\n── 4. Rotacao: o token antigo morre ──')
const reuso = await fetch(`${BASE}/api/auth/refresh`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: login.refreshToken }),
})
if (reuso.status === 401) ok('token ja usado foi recusado (rotacao funciona)')
else bad(`token reutilizado aceito com ${reuso.status}`)

console.log('\n── 5. O token do Ze nunca vira sessao do master ──')
const loginZe = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Beta', nome: 'ze', senha: 'senha-do-ze' }),
}))
const refZe = await j(await fetch(`${BASE}/api/auth/refresh`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: loginZe.refreshToken }),
}))
const me = await j(await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${refZe.accessToken}` } }))
if (me?.user?.id === 'usr_ze' && me?.user?.role === 'advogado') ok('refresh do Ze devolveu a sessao do Ze (nao a do master)')
else bad('ESCALADA DE PRIVILEGIO: ' + JSON.stringify(me?.user))

console.log('\n── 6. ETAPA 0.4 — admin nao consegue subir o proprio plano ──')
const loginAdminB = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Beta', nome: 'ze', senha: 'senha-do-ze' }),
}))
await db.update(users).set({ role: 'admin' }).where((await import('drizzle-orm')).eq(users.id, 'usr_ze'))
const loginAdmin = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Beta', nome: 'ze', senha: 'senha-do-ze' }),
}))
await fetch(`${BASE}/api/settings/tenant`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAdmin.accessToken}` },
  body: JSON.stringify({ plan: 'enterprise', isActive: false, slug: 'hackeado', name: 'Nome Novo Legitimo' }),
})
const { eq } = await import('drizzle-orm')
const [tB] = await db.select().from(tenants).where(eq(tenants.id, 'tnt_b'))
if (tB.plan === 'starter') ok('plano continua "starter" (upgrade bloqueado)')
else bad(`PLANO ESCALADO para "${tB.plan}"`)
if (tB.isActive === true) ok('isActive nao foi alterado')
else bad('isActive foi alterado pelo cliente')
if (tB.slug === 'beta') ok('slug nao foi alterado')
else bad(`slug alterado para "${tB.slug}"`)
if (tB.name === 'Nome Novo Legitimo') ok('name (campo permitido) foi atualizado normalmente')
else bad(`name nao atualizou: "${tB.name}"`)

console.log('\n── 7. ETAPA 0.5 — senha fraca/ausente devolve 400, nao 500 ──')
for (const [rotulo, senha] of [['ausente', undefined], ['curta', '123']]) {
  const r = await fetch(`${BASE}/api/settings/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAdmin.accessToken}` },
    body: JSON.stringify({ name: 'Fulano', login: 'fulano', password: senha }),
  })
  if (r.status === 400) ok(`senha ${rotulo} → 400`)
  else bad(`senha ${rotulo} → ${r.status} (esperava 400)`)
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
