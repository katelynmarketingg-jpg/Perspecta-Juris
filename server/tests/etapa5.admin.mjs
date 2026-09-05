// ETAPA 5 — a porta /api/admin/*, usada pela Perspecta Central.
//
// O que precisa ficar provado aqui:
//  1. sem token configurado no servidor, a porta nasce FECHADA (503);
//  2. token errado não passa (401);
//  3. criar escritório pela Central segue as MESMAS regras do painel master;
//  4. o limite de acessos do plano vale igual;
//  5. as métricas trazem o que a Central precisa para cobrar;
//  6. tudo que a Central faz fica registrado como origem 'central'.
//
// O servidor deste teste precisa subir com ADMIN_API_TOKEN definido.
const BASE  = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
const TOKEN = process.env.ADMIN_API_TOKEN

let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const j   = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

if (!TOKEN) {
  console.log('\n❌ Rode com ADMIN_API_TOKEN definido (o mesmo do servidor de teste).\n')
  process.exit(1)
}

const { db } = await import('../db/index.js')
const { tenants, users, auditLogs, usageEvents } = await import('../db/schema.js')
const { eq, and, inArray } = await import('drizzle-orm')

const NOME  = 'Escritorio Central Teste'
const NOME2 = 'Escritorio Central Dois'  // o master de mentira da seção 8

// Limpa o que uma execução anterior deixou (fixtures por nome, porque o id
// é gerado pelo próprio serviço).
const antigos = await db.select({ id: tenants.id }).from(tenants)
  .where(inArray(tenants.name, [NOME, NOME2]))
if (antigos.length) {
  const ids = antigos.map(t => t.id)
  await db.delete(tenants).where(inArray(tenants.id, ids))
  await db.delete(usageEvents).where(inArray(usageEvents.tenantId, ids))
  await db.delete(auditLogs).where(inArray(auditLogs.tenantId, ids))
}

const admin = (path, opts = {}) => fetch(`${BASE}/api/admin${path}`, {
  ...opts,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers ?? {}) },
})

console.log('\n── 0. Sem ADMIN_API_TOKEN no servidor, a porta nasce fechada ──')
{
  // Verificado direto no preHandler: seria preciso um segundo servidor para
  // testar isso pela rede, e o comportamento é do guarda, não da rota.
  const { requireServiceToken } = await import('../lib/serviceToken.js')
  const guardado = process.env.ADMIN_API_TOKEN
  const chamar = (envToken) => new Promise((resolve) => {
    if (envToken === undefined) delete process.env.ADMIN_API_TOKEN
    else process.env.ADMIN_API_TOKEN = envToken
    const reply = { code(c) { this._c = c; return this }, send(b) { resolve({ status: this._c, body: b }) } }
    requireServiceToken({ headers: {}, log: { error() {} } }, reply, () => resolve({ status: 200 }))
  })

  const semVar = await chamar(undefined)
  if (semVar.status === 503) ok('sem a variável configurada: 503, não deixa passar')
  else bad(`sem a variável devolveu ${semVar.status}`)

  const curto = await chamar('curto-demais')
  if (curto.status === 503) ok('token curto demais é recusado (config fraca não vira porta aberta)')
  else bad(`token curto devolveu ${curto.status}`)

  process.env.ADMIN_API_TOKEN = guardado
}

console.log('\n── 1. A porta só abre com a credencial certa ──')
{
  const semNada = await fetch(`${BASE}/api/admin/ping`)
  if (semNada.status === 401) ok('sem token: 401')
  else bad(`sem token devolveu ${semNada.status} (esperava 401)`)

  const errado = await fetch(`${BASE}/api/admin/ping`, { headers: { Authorization: 'Bearer token-completamente-inventado-mas-longo-o-bastante' } })
  if (errado.status === 401) ok('token errado: 401')
  else bad(`token errado devolveu ${errado.status}`)

  // Um JWT de usuário comum NÃO serve aqui: são credenciais de mundos diferentes.
  const comoUsuario = await fetch(`${BASE}/api/admin/companies`, { headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoibWFzdGVyIn0.x' } })
  if (comoUsuario.status === 401) ok('JWT de usuário não abre a porta de serviço')
  else bad(`JWT de usuário devolveu ${comoUsuario.status}`)

  const r = await admin('/ping')
  const b = await j(r)
  if (r.status === 200 && b.ok && b.servico === 'perspecta-juris') ok('token certo: ping responde')
  else bad(`ping devolveu ${r.status} ${JSON.stringify(b)}`)
}

console.log('\n── 2. A Central cria escritório com as regras do painel ──')
let empresa
{
  const semSenha = await j(await admin('/companies', {
    method: 'POST', body: JSON.stringify({ name: NOME, adminLogin: 'chefe', adminPassword: '123' }),
  }))
  if (String(semSenha.message ?? '').match(/8/)) ok('senha fraca recusada (mesma regra do painel)')
  else bad(`senha fraca passou: ${JSON.stringify(semSenha)}`)

  const r = await admin('/companies', {
    method: 'POST',
    body: JSON.stringify({
      name: NOME, cnpj: '11222333000181', plan: 'starter',
      adminName: 'Chefe', adminLogin: 'Chefe ', adminEmail: 'chefe@x.com', adminPassword: 'senha-forte-321',
    }),
  })
  empresa = await j(r)
  if (r.status === 201 && empresa.id?.startsWith('tnt_')) ok(`escritório criado (${empresa.id})`)
  else bad(`criação devolveu ${r.status} ${JSON.stringify(empresa)}`)
  if (empresa.admin?.loginName === 'chefe') ok('login normalizado (minúsculas, sem espaço)')
  else bad(`loginName = ${JSON.stringify(empresa.admin)}`)
  if (!JSON.stringify(empresa).match(/senha-forte-321/)) ok('a senha não volta na resposta')
  else bad('a senha voltou na resposta')

  // O login usa o nome da empresa: dois com o mesmo nome quebrariam a entrada.
  const dupe = await admin('/companies', {
    method: 'POST', body: JSON.stringify({ name: NOME, adminLogin: 'outro', adminPassword: 'senha-forte-321' }),
  })
  if (dupe.status === 409) ok('nome repetido recusado com 409')
  else bad(`nome repetido devolveu ${dupe.status}`)
}

console.log('\n── 3. O escritório criado pela Central funciona de verdade ──')
{
  const login = await j(await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa: NOME, nome: 'chefe', senha: 'senha-forte-321' }),
  }))
  if (login.accessToken) ok('o admin criado consegue entrar no sistema')
  else bad(`login falhou: ${JSON.stringify(login)}`)

  const uso = await db.select().from(usageEvents)
    .where(and(eq(usageEvents.tenantId, empresa.id), eq(usageEvents.kind, 'user_created')))
  if (uso.length === 1 && uso[0].meta?.origem === 'central') ok('o acesso foi contado como consumo, marcado como vindo da Central')
  else bad(`consumo: ${JSON.stringify(uso)}`)
}

console.log('\n── 4. Acessos: cria, lista, respeita o plano, revoga ──')
{
  // Login repetido primeiro, enquanto ainda há vaga no plano: com o plano
  // cheio a resposta seria 403 (limite), e não é isso que se está medindo.
  const dupe = await admin(`/companies/${empresa.id}/users`, {
    method: 'POST', body: JSON.stringify({ name: 'Outra', login: 'chefe', password: 'senha-forte-321' }),
  })
  if (dupe.status === 409) ok('login repetido no mesmo escritório: 409 (antes o índice único estourava 500)')
  else bad(`login repetido devolveu ${dupe.status} ${JSON.stringify(await j(dupe))}`)

  const criado = await j(await admin(`/companies/${empresa.id}/users`, {
    method: 'POST', body: JSON.stringify({ name: 'Advogada', login: 'adv', password: 'senha-forte-321', role: 'advogado' }),
  }))
  if (criado.id) ok('acesso criado pela Central')
  else bad(`criação de acesso: ${JSON.stringify(criado)}`)

  const lista = await j(await admin(`/companies/${empresa.id}/users`))
  if (Array.isArray(lista) && lista.length === 2) ok('lista traz os 2 acessos')
  else bad(`lista: ${JSON.stringify(lista)}`)
  if (!JSON.stringify(lista).includes('passwordHash')) ok('a lista não expõe hash de senha')
  else bad('hash de senha vazou na listagem')

  // Plano starter: o limite é do plano, não da porta.
  const planos = await j(await admin('/metrics'))
  const limite = planos.escritorios.find(e => e.id === empresa.id)?.maxUsers
  if (limite != null) {
    let estourou = null
    for (let n = 0; n < limite + 2 && !estourou; n++) {
      const r = await admin(`/companies/${empresa.id}/users`, {
        method: 'POST', body: JSON.stringify({ name: 'Extra ' + n, login: 'extra' + n, password: 'senha-forte-321' }),
      })
      if (r.status === 403) estourou = await j(r)
    }
    if (estourou?.limite === limite) ok(`limite do plano aplicado também pela Central (${limite} acessos)`)
    else bad(`o limite ${limite} não foi aplicado: ${JSON.stringify(estourou)}`)
  } else {
    ok('plano sem limite de acessos — nada a testar aqui')
  }

  const rev = await admin(`/companies/${empresa.id}/users/${criado.id}`, { method: 'DELETE' })
  if (rev.status === 204) ok('acesso revogado')
  else bad(`revogação devolveu ${rev.status}`)

  // O único administrador não pode ser removido: deixaria o escritório sem dono.
  const [adminId] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.tenantId, empresa.id), eq(users.role, 'admin')))
  const ultimo = await admin(`/companies/${empresa.id}/users/${adminId.id}`, { method: 'DELETE' })
  if (ultimo.status === 400) ok('o último administrador não pode ser revogado')
  else bad(`revogar o último admin devolveu ${ultimo.status}`)
}

console.log('\n── 5. Ativar/desativar e trocar plano ──')
{
  const r = await admin(`/companies/${empresa.id}`, {
    method: 'PUT', body: JSON.stringify({ isActive: false, plan: 'enterprise', planExpiresAt: '2027-01-31' }),
  })
  const b = await j(r)
  if (b.isActive === false && b.plan === 'enterprise' && b.planExpiresAt === '2027-01-31')
    ok('escritório desativado, plano e vencimento gravados')
  else bad(`PUT devolveu ${r.status} ${JSON.stringify(b)}`)

  // Desativar pela Central tem de barrar o login — é assim que se corta quem não pagou.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa: NOME, nome: 'chefe', senha: 'senha-forte-321' }),
  })
  if (login.status >= 400) ok('escritório desativado não entra mais')
  else bad(`login continuou funcionando (${login.status}) com o escritório desativado`)

  await admin(`/companies/${empresa.id}`, { method: 'PUT', body: JSON.stringify({ isActive: true }) })

  const vazio = await admin(`/companies/${empresa.id}`, { method: 'PUT', body: JSON.stringify({ nada: 1 }) })
  if (vazio.status === 400) ok('PUT sem campo válido é recusado (não finge que salvou)')
  else bad(`PUT vazio devolveu ${vazio.status}`)

  const semTal = await admin('/companies/tnt_nao_existe', { method: 'PUT', body: JSON.stringify({ isActive: false }) })
  if (semTal.status === 404) ok('escritório inexistente: 404')
  else bad(`inexistente devolveu ${semTal.status}`)
}

console.log('\n── 6. Métricas: o que a Central precisa para cobrar ──')
{
  const m = await j(await admin('/metrics'))
  const e = m.escritorios?.find(x => x.id === empresa.id)
  if (e) ok('o escritório aparece nas métricas')
  else bad(`não achei o escritório em ${JSON.stringify(m.escritorios)}`)
  if (e?.contagens && typeof e.contagens.usuarios === 'number') ok(`contagens presentes (${e.contagens.usuarios} usuários)`)
  else bad(`contagens: ${JSON.stringify(e?.contagens)}`)
  if (e?.uso?.user_created?.total >= 1) ok('o consumo do mês vem junto (base da cobrança por cota)')
  else bad(`uso: ${JSON.stringify(e?.uso)}`)
  if (Array.isArray(m.planos) && m.planos.length) ok('a tabela de planos vem junto')
  else bad(`planos: ${JSON.stringify(m.planos)}`)
  if (!m.escritorios.some(x => x.plan === 'master')) ok('o escritório master fica fora da cobrança')
  else bad('o master apareceu na lista de cobrança')

  const lista = await j(await admin('/companies'))
  if (lista.some(x => x.id === empresa.id && x.usersCount >= 1)) ok('/companies traz as contagens')
  else bad(`/companies: ${JSON.stringify(lista.find(x => x.id === empresa.id))}`)
}

console.log('\n── 7. Rastro: tudo que a Central fez fica registrado ──')
{
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, empresa.id))
  if (logs.length >= 3) ok(`${logs.length} registros de auditoria para este escritório`)
  else bad(`só ${logs.length} registros`)
  if (logs.every(l => l.changes?.origem === 'central')) ok("todos marcados como origem 'central'")
  else bad(`origem: ${JSON.stringify(logs.map(l => l.changes?.origem))}`)
  if (logs.some(l => l.action.includes('criado')) && logs.some(l => l.action.includes('alterado')))
    ok('criação e alteração aparecem no rastro')
  else bad(`ações: ${JSON.stringify(logs.map(l => l.action))}`)

  const via = await j(await admin('/audit?limit=5'))
  if (Array.isArray(via) && via.length <= 5) ok('/audit responde e respeita o limite')
  else bad(`/audit: ${JSON.stringify(via).slice(0, 200)}`)
}

console.log('\n── 8. O master continua intocável ──')
{
  let [mst] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.plan, 'master')).limit(1)
  if (!mst) {
    // Em produção o master vem do seed; aqui é preciso criá-lo para que a
    // proteção seja de fato exercitada, e não pulada.
    const now = new Date().toISOString()
    mst = { id: 'tnt_master_teste' }
    await db.delete(tenants).where(eq(tenants.id, mst.id))
    await db.insert(tenants).values({ id: mst.id, slug: 'master-teste', name: NOME2,
      plan: 'master', isActive: true, settings: {}, createdAt: now, updatedAt: now })
  }
  const r = await admin(`/companies/${mst.id}`, { method: 'PUT', body: JSON.stringify({ isActive: false }) })
  if (r.status === 403) ok('a Central não desativa o escritório master')
  else bad(`o master aceitou PUT com ${r.status}`)

  const lista = await j(await admin('/companies'))
  if (!lista.some(x => x.id === mst.id)) ok('o master também não aparece em /companies')
  else bad('o master apareceu em /companies')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
