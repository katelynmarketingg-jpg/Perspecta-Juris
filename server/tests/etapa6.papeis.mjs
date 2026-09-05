// Um vocabulário só para os perfis de acesso.
//
// A tela de Configurações gravava 'lawyer' e 'staff'; o resto do sistema
// falava 'advogado' e 'estagiario'. O servidor aceitava os dois sem reclamar.
// Aqui se prova que agora há uma lista só, que os nomes antigos são
// traduzidos em vez de recusados, e — o mais importante — que trocar o
// rótulo de alguém NÃO mexe no que essa pessoa enxerga.
import bcrypt from 'bcryptjs'

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8799'
let falhas = 0
const ok  = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); falhas++ }
const j   = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }

const { db } = await import('../db/index.js')
const { tenants, users } = await import('../db/schema.js')
const { eq, and, inArray } = await import('drizzle-orm')
const { normalizarPapel, rotuloDoPapel, PAPEIS } = await import('../lib/roles.js')

const TID = 'tnt_papeis', UID = 'usr_papeis'
const now = new Date().toISOString()
await db.delete(tenants).where(inArray(tenants.id, [TID]))
await db.insert(tenants).values({ id: TID, slug: 'papeis', name: 'Escritorio Papeis',
  plan: 'enterprise', isActive: true, settings: {}, createdAt: now, updatedAt: now })
await db.insert(users).values({ id: UID, tenantId: TID, name: 'Chefe', loginName: 'chefe',
  passwordHash: await bcrypt.hash('senha-forte-123', 12), role: 'admin', isActive: true,
  createdAt: now, updatedAt: now })

const login = await j(await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ empresa: 'Escritorio Papeis', nome: 'chefe', senha: 'senha-forte-123' }),
}))
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.accessToken}` }
const criar = (body) => fetch(`${BASE}/api/settings/users`, { method: 'POST', headers: H, body: JSON.stringify(body) })

console.log('\n── 1. A tradução dos nomes antigos ──')
{
  if (normalizarPapel('lawyer') === 'advogado') ok("'lawyer' vira 'advogado'")
  else bad(`lawyer virou ${normalizarPapel('lawyer')}`)
  if (normalizarPapel('staff') === 'estagiario') ok("'staff' vira 'estagiario'")
  else bad(`staff virou ${normalizarPapel('staff')}`)
  if (normalizarPapel('  ADVOGADO ') === 'advogado') ok('espaço e maiúscula não atrapalham')
  else bad(`normalizou para ${normalizarPapel('  ADVOGADO ')}`)
  if (normalizarPapel('') === 'advogado') ok("vazio cai no padrão 'advogado'")
  else bad(`vazio virou ${normalizarPapel('')}`)
  if (normalizarPapel('chefão') === null) ok('perfil inventado devolve null')
  else bad(`inventado virou ${normalizarPapel('chefão')}`)
  if (rotuloDoPapel('lawyer') === 'Advogado(a)') ok('o rótulo do nome antigo ainda aparece certo na tela')
  else bad(`rótulo de lawyer: ${rotuloDoPapel('lawyer')}`)
  if (rotuloDoPapel('perfil_de_um_banco_antigo') === 'perfil_de_um_banco_antigo')
    ok('perfil desconhecido aparece como está, em vez de sumir da tela')
  else bad(`desconhecido virou ${rotuloDoPapel('perfil_de_um_banco_antigo')}`)
}

console.log('\n── 2. Criar acesso: a lista vale ──')
{
  for (const p of PAPEIS) {
    const r = await criar({ name: 'Fulano ' + p.valor, login: 'u_' + p.valor, password: 'senha-forte-123', role: p.valor })
    const b = await j(r)
    if (r.status === 201 && b.role === p.valor) ok(`'${p.valor}' aceito`)
    else bad(`'${p.valor}' devolveu ${r.status} ${JSON.stringify(b)}`)
  }

  const antigo = await j(await criar({ name: 'Veterano', login: 'veterano', password: 'senha-forte-123', role: 'lawyer' }))
  if (antigo.role === 'advogado') ok("quem manda 'lawyer' recebe 'advogado' gravado — nada de dois vocabulários")
  else bad(`gravou ${antigo.role}`)

  const semPapel = await j(await criar({ name: 'Sem Perfil', login: 'semperfil', password: 'senha-forte-123' }))
  if (semPapel.role === 'advogado') ok("sem informar perfil, entra como 'advogado'")
  else bad(`sem perfil virou ${semPapel.role}`)

  const invalido = await criar({ name: 'Invasor', login: 'invasor', password: 'senha-forte-123', role: 'chefe_supremo' })
  if (invalido.status === 400) ok('perfil inventado é recusado com 400 (antes era gravado como veio)')
  else bad(`perfil inventado devolveu ${invalido.status}`)

  // 'master' é o acesso da dona do sistema: nasce no seed, não por rota.
  const master = await criar({ name: 'Falso Master', login: 'falsomaster', password: 'senha-forte-123', role: 'master' })
  if (master.status === 400) ok("ninguém cria um acesso 'master' por esta porta")
  else bad(`role master devolveu ${master.status}`)
}

console.log('\n── 3. Editar perfil passa pela mesma lista ──')
{
  const [alvo] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.tenantId, TID), eq(users.loginName, 'u_financeiro'))).limit(1)

  const r = await fetch(`${BASE}/api/settings/users/${alvo.id}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ role: 'inventado' }),
  })
  if (r.status === 400) ok('não dá para contornar a validação pela edição')
  else bad(`PUT com perfil inválido devolveu ${r.status}`)

  await fetch(`${BASE}/api/settings/users/${alvo.id}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ role: 'staff' }),
  })
  const [depois] = await db.select({ role: users.role }).from(users).where(eq(users.id, alvo.id)).limit(1)
  if (depois.role === 'estagiario') ok("editar para 'staff' grava 'estagiario'")
  else bad(`editou para ${depois.role}`)
}

console.log('\n── 4. O que essa mudança NÃO faz: mexer em permissão ──')
{
  // Esta é a garantia que importa. As abas que alguém enxerga vêm de
  // settings.permissions[userId], gravado POR USUÁRIO — não do rótulo.
  const abas = ['/app/clientes', '/app/processos']
  const criado = await j(await criar({
    name: 'Restrita', login: 'restrita', password: 'senha-forte-123',
    role: 'advogado', menuAccess: abas,
  }))

  const permsDe = async () => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, TID)).limit(1)
    return t.settings?.permissions?.[criado.id] ?? null
  }
  const antes = await permsDe()
  if (JSON.stringify(antes) === JSON.stringify(abas)) ok('as abas escolhidas foram gravadas')
  else bad(`gravou ${JSON.stringify(antes)}`)

  await fetch(`${BASE}/api/settings/users/${criado.id}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ role: 'estagiario' }),
  })
  const depois = await permsDe()
  if (JSON.stringify(depois) === JSON.stringify(abas))
    ok('trocar o perfil de advogado para estagiário NÃO mudou as abas dessa pessoa')
  else bad(`as abas viraram ${JSON.stringify(depois)} — a mudança mexeu em permissão!`)

  // E o admin continua sendo o único que ganha tudo pelo rótulo.
  const { menuAccessFor } = await import('../lib/permissions.js')
  const [t] = await db.select().from(tenants).where(eq(tenants.id, TID)).limit(1)
  if (menuAccessFor(t, criado.id, 'admin') === null) ok('admin continua com acesso total')
  else bad('admin perdeu o acesso total')
  if (JSON.stringify(menuAccessFor(t, criado.id, 'estagiario')) === JSON.stringify(abas))
    ok('não-admin continua limitado ao que foi marcado para ele')
  else bad('a restrição do não-admin se perdeu')
}

console.log(falhas === 0 ? '\n🟢 TODOS OS TESTES PASSARAM\n' : `\n🔴 ${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
