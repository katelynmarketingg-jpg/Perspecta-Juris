// ─────────────────────────────────────────────────────────────────────────
//  Criar escritório, criar acesso, revogar acesso.
//
//  Esta lógica nasceu dentro das rotas do painel master e de Configurações.
//  Foi extraída para cá porque agora tem um segundo chamador: a porta
//  /api/admin/*, usada pela Perspecta Central. Copiar e colar as regras
//  significaria, na prática, duas regras — e uma delas ficaria para trás.
// ─────────────────────────────────────────────────────────────────────────
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users, clients, processes } from '../db/schema.js'
import { validarSenha } from '../lib/senha.js'
import { planLimitFor, userCount } from '../lib/plans.js'
import { setMenuAccess } from '../lib/permissions.js'
import { registrarUso, TIPOS } from '../lib/usage.js'
import { normalizarPapel, PAPEIS } from '../lib/roles.js'

// Erro de regra de negócio: quem chama traduz para o HTTP certo.
export class ErroDeRegra extends Error {
  constructor(mensagem, status = 400, extra = {}) {
    super(mensagem)
    this.name = 'ErroDeRegra'
    this.status = status
    Object.assign(this, extra)
  }
}

export function slugify(s) {
  return (s ?? '')
    .toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const normalizarLogin = (s) => String(s ?? '').toLowerCase().trim().replace(/\s+/g, '')

/**
 * Cria um escritório e o primeiro acesso de administrador dele.
 * Devolve { tenant, usuario }.
 */
export async function criarEscritorio(dados = {}, { origem = 'painel' } = {}) {
  const nome = String(dados.name ?? '').trim()
  const adminLogin = String(dados.adminLogin ?? '').trim()

  if (!nome) throw new ErroDeRegra('Nome da empresa é obrigatório.')
  if (!adminLogin) throw new ErroDeRegra('Login do administrador é obrigatório.')
  const erroSenha = validarSenha(dados.adminPassword)
  if (erroSenha) throw new ErroDeRegra(erroSenha)

  const now = new Date().toISOString()
  const id = 'tnt_' + nanoid(12)

  let slug = slugify(dados.slug ?? nome)
  if (!slug) slug = 'escritorio-' + nanoid(6)
  const [dupe] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1)
  if (dupe) slug = `${slug}-${nanoid(4)}`

  // Dois escritórios com o mesmo NOME quebrariam o login, que busca a empresa
  // pelo nome. O painel nunca checou isso.
  const [mesmoNome] = await db.select({ id: tenants.id }).from(tenants)
    .where(sql`lower(${tenants.name}) = lower(${nome})`).limit(1)
  if (mesmoNome) {
    throw new ErroDeRegra(
      `Já existe um escritório chamado "${nome}". O login usa o nome da empresa, então ele precisa ser único.`,
      409,
    )
  }

  await db.insert(tenants).values({
    id, slug, name: nome,
    plan:      dados.plan ?? 'starter',
    isActive:  true,
    settings:  { cnpj: dados.cnpj ?? '' },
    createdAt: now, updatedAt: now,
  })

  const usuarioId = 'usr_' + nanoid(12)
  await db.insert(users).values({
    id: usuarioId, tenantId: id,
    name:         String(dados.adminName ?? '').trim() || 'Administrador',
    loginName:    normalizarLogin(adminLogin),
    email:        dados.adminEmail ?? null,
    passwordHash: await bcrypt.hash(dados.adminPassword, 12),
    role:         'admin',
    isActive:     true,
    createdAt:    now, updatedAt: now,
  })

  await registrarUso(id, TIPOS.USUARIO, 1, { origem, role: 'admin' })

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
  const [usuario] = await db.select({
    id: users.id, name: users.name, loginName: users.loginName, email: users.email, role: users.role,
  }).from(users).where(eq(users.id, usuarioId)).limit(1)

  return { tenant, usuario }
}

/**
 * Cria um acesso dentro de um escritório, respeitando o limite do plano.
 */
export async function criarAcesso(tenantId, dados = {}, { origem = 'painel', criadoPor = null } = {}) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new ErroDeRegra('Escritório não encontrado.', 404)

  const nome = String(dados.name ?? '').trim()
  if (!nome) throw new ErroDeRegra('Informe o nome do colaborador.')
  const erroSenha = validarSenha(dados.password)
  if (erroSenha) throw new ErroDeRegra(erroSenha)

  // Antes qualquer string virava perfil, e a tela de Configurações gravava um
  // vocabulário diferente do resto do sistema. Agora há um só, e o que não
  // estiver nele é recusado — inclusive 'master', que nasce no seed.
  const papel = normalizarPapel(dados.role)
  if (!papel || papel === 'master') {
    throw new ErroDeRegra(
      `Perfil inválido: "${dados.role}". Use um destes: ${PAPEIS.map(p => p.valor).join(', ')}.`,
    )
  }

  // Limite de acessos do plano.
  const limite = await planLimitFor(tenant)
  if (limite != null) {
    const atual = await userCount(tenantId)
    if (atual >= limite) {
      throw new ErroDeRegra(
        `Limite do plano atingido (${atual}/${limite} acessos). Faça upgrade do plano para adicionar mais usuários.`,
        403, { limite, atual },
      )
    }
  }

  const id = nanoid()
  const loginName = normalizarLogin(dados.login ?? String(dados.email ?? '').split('@')[0])
    || ('user' + id.slice(0, 6))

  // O índice único é (tenant_id, login_name): sem checar antes, o insert
  // estoura 500 em vez de explicar o problema.
  const [jaExiste] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.loginName, loginName))).limit(1)
  if (jaExiste) throw new ErroDeRegra(`Já existe um acesso com o login "${loginName}" neste escritório.`, 409)

  const now = new Date().toISOString()
  await db.insert(users).values({
    id, tenantId,
    name: nome, loginName,
    email: dados.email ? String(dados.email).toLowerCase().trim() : null,
    passwordHash: await bcrypt.hash(dados.password, 12),
    role: papel,
    oabNumber: dados.oabNumber ?? null,
    oabState:  dados.oabState ?? null,
    phone:     dados.phone ?? null,
    isActive: true, createdAt: now, updatedAt: now,
  })

  if (dados.menuAccess !== undefined) await setMenuAccess(tenantId, id, dados.menuAccess)
  await registrarUso(tenantId, TIPOS.USUARIO, 1, { origem, role: papel }, criadoPor)

  const [row] = await db.select({
    id: users.id, name: users.name, loginName: users.loginName, email: users.email, role: users.role,
  }).from(users).where(eq(users.id, id)).limit(1)
  return row
}

/**
 * Revoga um acesso. Guarda as duas regras que o painel já aplicava: não
 * apagar o master, e não deixar o escritório sem nenhum administrador.
 */
export async function revogarAcesso(tenantId, userId, { proprioUsuario = null } = {}) {
  if (proprioUsuario && proprioUsuario === userId) {
    throw new ErroDeRegra('Você não pode excluir o seu próprio acesso.')
  }

  const [alvo] = await db.select().from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId))).limit(1)
  if (!alvo) throw new ErroDeRegra('Acesso não encontrado.', 404)
  if (alvo.role === 'master') throw new ErroDeRegra('O acesso master não pode ser excluído.', 403)

  if (alvo.role === 'admin') {
    const admins = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'admin')))
    if (admins.length <= 1) {
      throw new ErroDeRegra('Este é o único administrador do escritório — crie outro antes de excluí-lo.')
    }
  }

  await db.delete(users).where(eq(users.id, userId))
  await setMenuAccess(tenantId, userId, null)
  return { id: userId, loginName: alvo.loginName }
}

// Contagens por escritório (usuários/clientes/processos), em 3 agregações.
export async function contagens() {
  const [u, c, p] = await Promise.all([
    db.select({ t: users.tenantId,     n: sql`count(*)::int` }).from(users).groupBy(users.tenantId),
    db.select({ t: clients.tenantId,   n: sql`count(*)::int` }).from(clients).groupBy(clients.tenantId),
    db.select({ t: processes.tenantId, n: sql`count(*)::int` }).from(processes).groupBy(processes.tenantId),
  ])
  const map = arr => Object.fromEntries(arr.map(r => [r.t, r.n]))
  return { u: map(u), c: map(c), p: map(p) }
}
