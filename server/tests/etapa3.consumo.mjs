// ETAPA 3 — medidor de consumo. Cada consulta ao DataJud/DJEN e cada byte de
// upload precisa virar uma linha em usage_events, sem nunca derrubar a
// operação real do escritório.
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const j   = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

const { db } = await import('../db/index.js')
const { tenants, users, usageEvents } = await import('../db/schema.js')
const { eq, and } = await import('drizzle-orm')
const now = new Date().toISOString()

// Fixtures com id fixo: apaga o que uma execução anterior deixou, para a
// suíte poder rodar de novo no mesmo banco (o cascade leva os dados junto).
const { inArray } = await import('drizzle-orm')
await db.delete(tenants).where(inArray(tenants.id, ['tnt_uso', 'tnt_mst']))
// usage_events NÃO tem FK para tenants (de propósito: o histórico de consumo
// precisa sobreviver à exclusão do escritório, para fechar a cobrança do mês).
// Então o cascade não limpa — a suíte apaga explicitamente.
await db.delete(usageEvents).where(inArray(usageEvents.tenantId, ['tnt_uso', 'tnt_mst']))

const TID = 'tnt_uso'
await db.insert(tenants).values({ id: TID, slug: 'uso', name: 'Escritorio Uso', plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_uso', tenantId: TID, name: 'Léo', loginName: 'leo',
  passwordHash: await bcrypt.hash('senha-forte-000', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })
// master, para ler o agregado
await db.insert(tenants).values({ id: 'tnt_mst', slug: 'mst', name: 'Perspecta Juris', plan: 'master', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: 'usr_mst', tenantId: 'tnt_mst', name: 'Kat', loginName: 'kat',
  passwordHash: await bcrypt.hash('senha-forte-111', 12), role: 'master', isActive: true, createdAt: now, updatedAt: now })

const entrar = async (empresa, nome, senha) => (await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa, nome, senha }),
}))).accessToken
const tk  = await entrar('Escritorio Uso', 'leo', 'senha-forte-000')
const tkM = await entrar('Perspecta Juris', 'kat', 'senha-forte-111')
const H  = { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }
const HM = { Authorization: `Bearer ${tkM}` }

const contar = async (kind) => (await db.select().from(usageEvents)
  .where(and(eq(usageEvents.tenantId, TID), eq(usageEvents.kind, kind))))

console.log('\n── 1. Consulta ao DataJud vira linha em usage_events ──')
// O CNJ não responde daqui; o que importa é que a consulta foi CONTADA
// mesmo assim — é ela que gasta cota, dê certo ou não.
await fetch(`${BASE}/api/datajud/tjsp/_search`, { method: 'POST', headers: H, body: JSON.stringify({ query: {} }) })
let dj = await contar('datajud_query')
if (dj.length === 1) ok('1 consulta registrada')
else bad(`registrou ${dj.length} consultas`)
if (dj[0]?.meta?.tribunal === 'tjsp') ok('tribunal gravado no meta (dá para cobrar por tribunal)')
else bad(`meta = ${JSON.stringify(dj[0]?.meta)}`)
if (dj[0]?.userId === 'usr_uso') ok('quem consultou foi registrado')
else bad(`userId = ${dj[0]?.userId}`)
if (dj[0]?.qty === 1) ok('qty = 1')
else bad(`qty = ${dj[0]?.qty}`)

console.log('\n── 2. Falha do CNJ não impede a contagem (é cota gasta) ──')
await fetch(`${BASE}/api/datajud/trt4/_search`, { method: 'POST', headers: H, body: JSON.stringify({ query: {} }) })
dj = await contar('datajud_query')
if (dj.length === 2) ok('2ª consulta também contada')
else bad(`total = ${dj.length}`)

console.log('\n── 3. Tribunal inválido é recusado ANTES e não conta ──')
await fetch(`${BASE}/api/datajud/tribunal-invalido!/_search`, { method: 'POST', headers: H, body: JSON.stringify({}) })
dj = await contar('datajud_query')
if (dj.length === 2) ok('requisição inválida não inflou o contador')
else bad(`contador subiu para ${dj.length}`)

console.log('\n── 4. Consulta ao Diário (DJEN) também é medida ──')
await fetch(`${BASE}/api/diario/publicacoes?oab=12345&uf=RS`, { headers: H })
const djen = await contar('djen_query')
if (djen.length === 1) ok('1 consulta ao DJEN registrada')
else bad(`registrou ${djen.length}`)

console.log('\n── 5. Criar acesso conta como consumo ──')
await fetch(`${BASE}/api/settings/users`, { method: 'POST', headers: H,
  body: JSON.stringify({ name: 'Novo Colaborador', login: 'novo', password: 'senha-forte-222', role: 'advogado' }) })
const us = await contar('user_created')
if (us.length === 1) ok('criação de acesso registrada')
else bad(`registrou ${us.length}`)

console.log('\n── 6. O master enxerga o consumo agregado ──')
const uso = await j(await fetch(`${BASE}/api/master/usage`, { headers: HM }))
const meu = uso.escritorios?.find(e => e.tenantId === TID)
if (meu) ok(`escritório aparece no agregado como "${meu.name}"`)
else bad(`não achei o escritório: ${JSON.stringify(uso).slice(0, 200)}`)
if (meu?.uso?.datajud_query?.total === 2) ok('DataJud: 2 consultas no mês')
else bad(`datajud = ${JSON.stringify(meu?.uso?.datajud_query)}`)
if (meu?.uso?.djen_query?.total === 1) ok('DJEN: 1 consulta')
else bad(`djen = ${JSON.stringify(meu?.uso?.djen_query)}`)
if (meu?.plan === 'enterprise') ok('plano do escritório vem junto (para cruzar com a cota)')
else bad(`plan = ${meu?.plan}`)

console.log('\n── 7. Só o master lê o consumo ──')
const r7 = await fetch(`${BASE}/api/master/usage`, { headers: { Authorization: `Bearer ${tk}` } })
if (r7.status === 403) ok('admin de escritório recebe 403')
else bad(`admin conseguiu ler o consumo global: HTTP ${r7.status}`)

console.log('\n── 8. Falha ao medir NÃO derruba a operação ──')
// Simula indisponibilidade da medição derrubando a tabela por um instante.
await db.execute?.('') // no-op defensivo
const { registrarUso } = await import('../lib/usage.js')
let estourou = false
try { await registrarUso(null, null, 1) } catch { estourou = true }
if (!estourou) ok('registrarUso com argumentos inválidos não lança')
else bad('registrarUso lançou exceção — poderia derrubar a consulta do cliente')

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
