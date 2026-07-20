import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, tenants, units } from '../db/schema.js'
import { planLimitFor, userCount } from '../lib/plans.js'

export default async function settingsRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/settings/tenant
  app.get('/tenant', auth, async (req) => {
    const [row] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return row
  })

  // PUT /api/settings/tenant
  app.put('/tenant', auth, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.code(403).send({ message: 'Apenas administradores podem alterar o escritório.' })
    const { id: _id, createdAt: _ca, ...updates } = req.body
    await db.update(tenants).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(tenants.id, req.user.tenantId))
    const [row] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return row
  })

  // GET /api/settings/users
  app.get('/users', auth, async (req) => {
    const rows = await db.select({
      id: users.id, name: users.name, email: users.email,
      role: users.role, oabNumber: users.oabNumber, oabState: users.oabState,
      phone: users.phone, isActive: users.isActive, lastLoginAt: users.lastLoginAt,
      unitId: users.unitId, avatarUrl: users.avatarUrl, createdAt: users.createdAt,
    }).from(users).where(eq(users.tenantId, req.user.tenantId))
    return rows
  })

  // POST /api/settings/users
  app.post('/users', auth, async (req, reply) => {
    if (!['admin'].includes(req.user.role)) return reply.code(403).send({ message: 'Permissão insuficiente.' })

    // Limite de acessos do plano do escritório.
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    const limit = await planLimitFor(tenant)
    if (limit != null) {
      const atual = await userCount(req.user.tenantId)
      if (atual >= limit) {
        return reply.code(403).send({
          message: `Limite do plano atingido (${atual}/${limit} acessos). Faça upgrade do plano para adicionar mais usuários.`,
        })
      }
    }

    const { name, email, password, role, oabNumber, oabState, phone, login } = req.body
    const passwordHash = await bcrypt.hash(password, 12)
    const now = new Date().toISOString()
    const id = nanoid()
    // login_name é obrigatório (usado no login). Deriva de "login" ou do e-mail.
    const loginName = String(login ?? (email ?? '').split('@')[0] ?? '')
      .toLowerCase().trim().replace(/\s+/g, '') || ('user' + id.slice(0, 6))
    await db.insert(users).values({
      id, tenantId: req.user.tenantId,
      name, loginName, email: email ? email.toLowerCase().trim() : null, passwordHash,
      role: role ?? 'advogado',
      oabNumber, oabState, phone,
      isActive: true, createdAt: now, updatedAt: now,
    })
    const [row] = await db.select({
      id: users.id, name: users.name, email: users.email, role: users.role,
    }).from(users).where(eq(users.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  // PUT /api/settings/users/:id
  app.put('/users/:id', auth, async (req, reply) => {
    if (!['admin'].includes(req.user.role) && req.params.id !== req.user.userId) {
      return reply.code(403).send({ message: 'Permissão insuficiente.' })
    }
    const [existing] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, req.params.id), eq(users.tenantId, req.user.tenantId))).limit(1)
    if (!existing) return reply.code(404).send({ message: 'Usuário não encontrado.' })

    const { password, passwordHash: _ph, id: _id, tenantId: _tid, ...updates } = req.body
    if (password) updates.passwordHash = await bcrypt.hash(password, 12)
    await db.update(users).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(users.id, req.params.id))
    return { success: true }
  })

  // GET /api/settings/units
  app.get('/units', auth, async (req) => {
    return db.select().from(units).where(eq(units.tenantId, req.user.tenantId))
  })

  // POST /api/settings/units
  app.post('/units', auth, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.code(403).send({ message: 'Apenas administradores.' })
    const id = nanoid()
    await db.insert(units).values({ id, tenantId: req.user.tenantId, ...req.body, isActive: true, createdAt: new Date().toISOString() })
    const [row] = await db.select().from(units).where(eq(units.id, id)).limit(1)
    return reply.code(201).send(row)
  })
}
