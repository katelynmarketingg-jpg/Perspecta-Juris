import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { eq, ne, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users, clients, processes, refreshTokens } from '../db/schema.js'
import { getPlans, savePlans } from '../lib/plans.js'
import { menuAccessFor } from '../lib/permissions.js'
import { getBranding, setBranding } from '../lib/branding.js'

const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? '7')

function refreshExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS)
  return d.toISOString()
}

function slugify(s) {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Contagens por tenant (usuários/clientes/processos) em 3 agregações.
async function counts() {
  const [u, c, p] = await Promise.all([
    db.select({ t: users.tenantId,     n: sql`count(*)::int` }).from(users).groupBy(users.tenantId),
    db.select({ t: clients.tenantId,   n: sql`count(*)::int` }).from(clients).groupBy(clients.tenantId),
    db.select({ t: processes.tenantId, n: sql`count(*)::int` }).from(processes).groupBy(processes.tenantId),
  ])
  const map = arr => Object.fromEntries(arr.map(r => [r.t, r.n]))
  return { u: map(u), c: map(c), p: map(p) }
}

export default async function masterRoutes(app) {
  // Todas as rotas exigem papel 'master'.
  const master = { preHandler: [app.requireRoles(['master'])] }

  // ── Planos ────────────────────────────────────────────────────
  // GET /api/master/plans — definição dos planos (nome + limite de acessos)
  app.get('/plans', master, async () => {
    return await getPlans()
  })
  // PUT /api/master/plans — salva a definição dos planos
  app.put('/plans', master, async (req, reply) => {
    if (!Array.isArray(req.body?.plans)) {
      return reply.code(400).send({ message: 'Envie { plans: [...] }.' })
    }
    return await savePlans(req.body.plans)
  })

  // ── Marca do sistema (logo, favicon, cor) ────────────────────
  app.get('/branding', master, async () => await getBranding())
  app.put('/branding', master, async (req) => await setBranding(req.body ?? {}))

  // GET /api/master/companies — lista escritórios (exceto o próprio master)
  app.get('/companies', master, async () => {
    const rows = await db.select().from(tenants).where(ne(tenants.plan, 'master'))
    const { u, c, p } = await counts()
    const plans = await getPlans()
    const limitOf = key => {
      const pl = plans.find(x => x.key === key)
      return pl ? (pl.maxUsers ?? null) : null
    }
    return rows.map(t => ({
      ...t,
      cnpj:           t.settings?.cnpj ?? '',
      maxUsers:       limitOf(t.plan),   // null = ilimitado
      usersCount:     u[t.id] ?? 0,
      clientsCount:   c[t.id] ?? 0,
      processesCount: p[t.id] ?? 0,
    }))
  })

  // POST /api/master/companies — cria escritório + usuário admin dele
  app.post('/companies', master, async (req, reply) => {
    const b = req.body ?? {}
    if (!b.name?.trim() || !b.adminLogin?.trim() || !b.adminPassword?.trim()) {
      return reply.code(400).send({ message: 'Nome da empresa, login e senha do administrador são obrigatórios.' })
    }

    const now = new Date().toISOString()
    const id = 'tnt_' + nanoid(12)

    let slug = slugify(b.slug ?? b.name)
    if (!slug) slug = 'escritorio-' + nanoid(6)
    const [dupe] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    if (dupe) slug = `${slug}-${nanoid(4)}`

    // login único dentro do tenant (aqui é o primeiro usuário, então só normaliza)
    const loginName = b.adminLogin.trim().toLowerCase()

    await db.insert(tenants).values({
      id,
      slug,
      name:      b.name.trim(),
      plan:      b.plan ?? 'starter',
      isActive:  true,
      settings:  { cnpj: b.cnpj ?? '' },
      createdAt: now,
      updatedAt: now,
    })

    const passwordHash = await bcrypt.hash(b.adminPassword, 12)
    await db.insert(users).values({
      id:           'usr_' + nanoid(12),
      tenantId:     id,
      name:         b.adminName?.trim() || 'Administrador',
      loginName,
      email:        b.adminEmail ?? null,
      passwordHash,
      role:         'admin',
      isActive:     true,
      createdAt:    now,
      updatedAt:    now,
    })

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return reply.code(201).send({
      ...tenant,
      cnpj: tenant.settings?.cnpj ?? '',
      usersCount: 1, clientsCount: 0, processesCount: 0,
    })
  })

  // PUT /api/master/companies/:id — atualiza (ativar/desativar, nome, plano)
  app.put('/companies/:id', master, async (req, reply) => {
    const b = req.body ?? {}
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    if (t.plan === 'master') return reply.code(403).send({ message: 'A empresa master não pode ser alterada.' })

    const patch = { updatedAt: new Date().toISOString() }
    if (typeof b.isActive === 'boolean') patch.isActive = b.isActive
    if (b.name?.trim()) patch.name = b.name.trim()
    if (b.plan) patch.plan = b.plan
    if (b.cnpj !== undefined) patch.settings = { ...(t.settings ?? {}), cnpj: b.cnpj }

    await db.update(tenants).set(patch).where(eq(tenants.id, req.params.id))
    const [row] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    return { ...row, cnpj: row.settings?.cnpj ?? '' }
  })

  // DELETE /api/master/companies/:id — remove escritório (cascata apaga usuários/clientes/processos)
  app.delete('/companies/:id', master, async (req, reply) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!t) return reply.code(404).send({ message: 'Empresa não encontrada.' })
    if (t.plan === 'master') return reply.code(403).send({ message: 'A empresa master não pode ser excluída.' })
    await db.delete(tenants).where(eq(tenants.id, req.params.id))
    return reply.code(204).send()
  })

  // POST /api/master/companies/:id/enter — o master "entra" no escritório
  // (gera um token como o admin daquele escritório, sem precisar deslogar).
  app.post('/companies/:id/enter', master, async (req, reply) => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
    if (!tenant?.isActive) return reply.code(404).send({ message: 'Empresa não encontrada ou inativa.' })

    const tUsers = await db.select().from(users).where(eq(users.tenantId, tenant.id))
    const target = tUsers.find(u => u.role === 'admin' && u.isActive)
      ?? tUsers.find(u => u.isActive)
    if (!target) return reply.code(404).send({ message: 'Este escritório não tem usuário de acesso.' })

    const payload = { userId: target.id, tenantId: tenant.id, role: target.role }
    const accessToken  = app.jwt.sign(payload)
    const refreshToken = nanoid(64)
    const tokenHash    = await bcrypt.hash(refreshToken, 8)

    await db.insert(refreshTokens).values({
      id: nanoid(),
      userId: target.id,
      tokenHash,
      expiresAt: refreshExpiry(),
      createdAt: new Date().toISOString(),
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: target.id, name: target.name, email: target.email,
        role: target.role, tenantId: tenant.id,
        avatarUrl: target.avatarUrl, oabNumber: target.oabNumber,
        menuAccess: menuAccessFor(tenant, target.id, target.role),
      },
      tenant: {
        id: tenant.id, name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl,
      },
    })
  })
}
