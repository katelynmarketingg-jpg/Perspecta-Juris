// Sync do DataJud NO SERVIDOR (Opção A) — o acompanhamento dos processos não
// pode mais depender de alguém estar com o navegador aberto.
import bcrypt from 'bcryptjs'

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }

const { db } = await import('../db/index.js')
const { tenants, users, clients, processes, processMovements, usageEvents, jobLocks } = await import('../db/schema.js')
const { eq, and, inArray } = await import('drizzle-orm')
const { nanoid } = await import('nanoid')
const now = new Date().toISOString()

const A = 'tnt_syncA', B = 'tnt_syncB', DESLIG = 'tnt_syncOff', INATIVO = 'tnt_syncMorto'
await db.delete(tenants).where(inArray(tenants.id, [A, B, DESLIG, INATIVO]))
await db.delete(usageEvents).where(inArray(usageEvents.tenantId, [A, B, DESLIG, INATIVO]))
await db.delete(jobLocks).where(eq(jobLocks.id, 'datajud_sync'))

// 4 escritórios, cada um num estado diferente.
const criarTenant = async (id, nome, extra = {}) => {
  await db.insert(tenants).values({ id, slug: id, name: nome, plan: 'enterprise',
    isActive: extra.isActive ?? true, settings: extra.settings ?? {}, createdAt: now, updatedAt: now })
  await db.insert(users).values({ id: 'usr_' + id, tenantId: id, name: 'U', loginName: 'u_' + id,
    passwordHash: await bcrypt.hash('senha-forte-999', 12), role: 'admin', isActive: true, createdAt: now, updatedAt: now })
  const cli = { id: 'cli_' + id, tenantId: id, name: 'Cliente', type: 'person', tags: [], createdAt: now, updatedAt: now }
  await db.insert(clients).values(cli)
  return cli
}
const criarProcesso = async (tid, cliId, num, court) => {
  const id = 'prc_' + nanoid(8)
  await db.insert(processes).values({ id, tenantId: tid, clientId: cliId, title: 'Proc ' + num,
    area: 'civel', judicialNumber: num, court, status: 'active', team: [], customFields: {},
    createdAt: now, updatedAt: now })
  return id
}

const cliA = await criarTenant(A, 'Escritorio Sync A')
const cliB = await criarTenant(B, 'Escritorio Sync B')
const cliOff = await criarTenant(DESLIG, 'Escritorio Desligado', { settings: { config: { pj_cfg_autosync: 'false' } } })
const cliMorto = await criarTenant(INATIVO, 'Escritorio Inativo', { isActive: false })

const procA = await criarProcesso(A, cliA.id, '0001234-12.2025.8.26.0100', 'TJSP')
await criarProcesso(B, cliB.id, '0007777-77.2025.5.04.0001', null)          // TRT-4 pelo número
await criarProcesso(B, cliB.id, 'sem-numero-cnj', null)                      // deve ser ignorado
await criarProcesso(DESLIG, cliOff.id, '0002222-22.2025.8.26.0100', 'TJSP')
await criarProcesso(INATIVO, cliMorto.id, '0003333-33.2025.8.26.0100', 'TJSP')

// ── CNJ substituído por resposta conhecida ───────────────────────────────
const fetchReal = globalThis.fetch
let consultas = []
const responder = (movs) => async (url, opts) => {
  if (String(url).includes('api-publica.datajud.cnj.jus.br')) {
    consultas.push(String(url))
    return new Response(JSON.stringify({ hits: { hits: [{ _source: { movimentos: movs } }] } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return fetchReal(url, opts)
}
globalThis.fetch = responder([
  { nome: 'Distribuído por sorteio', dataHora: '2026-08-01T10:00:00' },
  { nome: 'Juntada de petição',      dataHora: '2026-08-05T14:30:00' },
])

process.env.DATAJUD_SYNC_PAUSA_MS = '0'
const { rodarSync } = await import('../jobs/datajudSync.js')

const movsDe = async (tid) => (await db.select().from(processMovements)
  .where(eq(processMovements.tenantId, tid))).filter(m => m.author === 'DataJud / CNJ')

console.log('\n── 1. O servidor sincroniza sozinho, sem navegador nenhum ──')
const r1 = await rodarSync()
if (r1.novas === 4) ok(`4 movimentações novas (2 escritórios × 2)`)
else bad(`novas = ${r1.novas} — ${JSON.stringify(r1)}`)
if ((await movsDe(A)).length === 2) ok('escritório A recebeu as 2')
else bad(`A tem ${(await movsDe(A)).length}`)
if ((await movsDe(B)).length === 2) ok('escritório B recebeu as 2')
else bad(`B tem ${(await movsDe(B)).length}`)

console.log('\n── 2. Respeita quem desligou e quem está inativo ──')
if ((await movsDe(DESLIG)).length === 0) ok('escritório com autosync desligado foi pulado')
else bad(`escritório desligado recebeu ${(await movsDe(DESLIG)).length}`)
if ((await movsDe(INATIVO)).length === 0) ok('escritório inativo foi pulado')
else bad(`escritório inativo recebeu ${(await movsDe(INATIVO)).length}`)

console.log('\n── 3. Processo sem número CNJ não vira consulta ──')
if (r1.consultados === 2) ok('2 consultas ao CNJ (o processo sem CNJ não contou)')
else bad(`consultados = ${r1.consultados} (esperava 2)`)
if (consultas.some(u => u.includes('api_publica_tjsp')) && consultas.some(u => u.includes('api_publica_trt4')))
  ok('tribunal inferido certo: tjsp pela sigla, trt4 pelo número CNJ')
else bad(`tribunais consultados: ${consultas.join(', ')}`)

console.log('\n── 4. Cada consulta é contada como consumo do escritório ──')
const usoA = await db.select().from(usageEvents).where(and(eq(usageEvents.tenantId, A), eq(usageEvents.kind, 'datajud_query')))
if (usoA.length === 1) ok('1 consulta registrada para o escritório A')
else bad(`registrou ${usoA.length} para A`)
if (usoA[0]?.meta?.origem === 'job') ok('meta marca que veio do job (dá para separar do uso manual)')
else bad(`meta = ${JSON.stringify(usoA[0]?.meta)}`)

console.log('\n── 5. Rodada seguinte não duplica ──')
const r2 = await rodarSync()
if (r2.novas === 0) ok('nada novo importado')
else bad(`importou ${r2.novas} de novo`)
if ((await movsDe(A)).length === 2) ok('A continua com 2')
else bad(`A agora tem ${(await movsDe(A)).length}`)

console.log('\n── 6. Movimentação inédita é detectada ──')
globalThis.fetch = responder([
  { nome: 'Distribuído por sorteio', dataHora: '2026-08-01T10:00:00' },
  { nome: 'Juntada de petição',      dataHora: '2026-08-05T14:30:00' },
  { nome: 'Sentença publicada',      dataHora: '2026-09-04T09:00:00' },
])
const r3 = await rodarSync()
if (r3.novas === 2) ok('só a nova entrou, nos 2 escritórios')
else bad(`importou ${r3.novas} (esperava 2)`)

console.log('\n── 7. TRAVA: duas instâncias ao mesmo tempo não duplicam ──')
await db.delete(jobLocks).where(eq(jobLocks.id, 'datajud_sync'))
globalThis.fetch = responder([{ nome: 'Ato ordinatório', dataHora: '2026-09-05T08:00:00' }])
const [ra, rb] = await Promise.all([rodarSync(), rodarSync()])
const pulou = [ra, rb].filter(r => r.pulado).length
if (pulou === 1) ok('uma rodou, a outra pulou (trava funcionou)')
else bad(`${pulou} pularam — as duas rodaram juntas: ${JSON.stringify([ra, rb])}`)
const totalA = (await movsDe(A)).length
if (totalA === 4) ok(`escritório A com 4 movimentações (sem duplicata)`)
else bad(`A tem ${totalA} (esperava 4 — duplicou?)`)

console.log('\n── 8. CNJ fora do ar: conta a consulta, não grava nada ──')
globalThis.fetch = async (url, opts) => {
  if (String(url).includes('api-publica.datajud.cnj.jus.br')) throw new Error('CNJ fora do ar')
  return fetchReal(url, opts)
}
await db.delete(jobLocks).where(eq(jobLocks.id, 'datajud_sync'))
const antes = (await movsDe(A)).length
const r4 = await rodarSync()
if (r4.novas === 0) ok('nenhuma movimentação inventada')
else bad(`gravou ${r4.novas} com o CNJ fora`)
if ((await movsDe(A)).length === antes) ok('banco intacto')
else bad('banco mudou com o CNJ fora do ar')
const usoDepois = await db.select().from(usageEvents).where(and(eq(usageEvents.tenantId, A), eq(usageEvents.kind, 'datajud_query')))
if (usoDepois.length > usoA.length) ok('a consulta falha ainda contou como cota gasta (é o que o CNJ vê)')
else bad('consulta falha não foi contada')

globalThis.fetch = fetchReal
console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
