import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, tenants, units } from '../db/schema.js'
import { planLimitFor, userCount, getPlans } from '../lib/plans.js'
import { menuAccessFor, setMenuAccess } from '../lib/permissions.js'

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

  // ── Dados do escritório (logo, timbrado, endereço, PIX…) por tenant ──
  app.get('/office', auth, async (req) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return t?.settings?.office ?? {}
  })
  app.put('/office', auth, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.code(403).send({ message: 'Apenas administradores podem alterar o escritório.' })
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    const settings = { ...(t?.settings ?? {}), office: (req.body && typeof req.body === 'object') ? req.body : {} }
    await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, req.user.tenantId))
    return settings.office
  })

  // ── Aceite dos Termos de Uso (valor de prova) ────────────────────────
  // Guarda data/hora e IP observados pelo SERVIDOR — não pelo navegador.
  app.get('/terms', auth, async (req) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return t?.settings?.terms?.[req.user.userId] ?? null
  })
  app.post('/terms', auth, async (req) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    const [u] = await db.select({ name: users.name, loginName: users.loginName })
      .from(users).where(eq(users.id, req.user.userId)).limit(1)
    const registro = {
      versao:    String(req.body?.versao ?? ''),
      aceitoEm:  new Date().toISOString(),          // hora do servidor
      ip:        req.ip ?? null,                    // IP observado pelo servidor
      userAgent: req.headers['user-agent'] ?? null,
      usuario:   u?.name ?? null,
      login:     u?.loginName ?? null,
    }
    const anteriores = (t?.settings ?? {}).terms ?? {}
    const settings = { ...(t?.settings ?? {}), terms: { ...anteriores, [req.user.userId]: registro } }
    await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, req.user.tenantId))
    return registro
  })

  // ── Modelos de documento (petições/contratos) por tenant ─────────────
  app.get('/templates', auth, async (req) => {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return t?.settings?.templates ?? []
  })
  app.put('/templates', auth, async (req, reply) => {
    const list = Array.isArray(req.body?.templates) ? req.body.templates : []
    const [t] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    const settings = { ...(t?.settings ?? {}), templates: list }
    await db.update(tenants).set({ settings, updatedAt: new Date().toISOString() }).where(eq(tenants.id, req.user.tenantId))
    return list
  })

  // GET /api/settings/users
  app.get('/users', auth, async (req) => {
    const rows = await db.select({
      id: users.id, name: users.name, loginName: users.loginName, email: users.email,
      role: users.role, oabNumber: users.oabNumber, oabState: users.oabState,
      phone: users.phone, isActive: users.isActive, lastLoginAt: users.lastLoginAt,
      unitId: users.unitId, avatarUrl: users.avatarUrl, createdAt: users.createdAt,
    }).from(users).where(eq(users.tenantId, req.user.tenantId))
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    return rows.map(u => ({ ...u, menuAccess: menuAccessFor(tenant, u.id, u.role) }))
  })

  // GET /api/settings/plan-usage — uso de acessos vs. limite do plano
  app.get('/plan-usage', auth, async (req) => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.user.tenantId)).limit(1)
    const limit = await planLimitFor(tenant)          // null = ilimitado
    const used = await userCount(req.user.tenantId)
    const plans = await getPlans()
    const planName = plans.find(p => p.key === tenant?.plan)?.name ?? tenant?.plan ?? '—'
    return {
      plan: tenant?.plan ?? null,
      planName,
      limit,
      used,
      remaining: limit == null ? null : Math.max(0, limit - used),
    }
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
    if (req.body.menuAccess !== undefined) await setMenuAccess(req.user.tenantId, id, req.body.menuAccess)
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

    const { password, passwordHash: _ph, id: _id, tenantId: _tid, menuAccess, login: _login, ...updates } = req.body
    if (password) updates.passwordHash = await bcrypt.hash(password, 12)
    await db.update(users).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(users.id, req.params.id))
    if (menuAccess !== undefined) await setMenuAccess(req.user.tenantId, req.params.id, menuAccess)
    return { success: true }
  })

  // GET /api/settings/units
  // DELETE /api/settings/users/:id — remove um acesso do escritório
  app.delete('/users/:id', auth, async (req, reply) => {
    if (req.user.role !== 'admin') return reply.code(403).send({ message: 'Apenas administradores podem excluir acessos.' })
    if (req.params.id === req.user.userId) return reply.code(400).send({ message: 'Você não pode excluir o seu próprio acesso.' })

    const [alvo] = await db.select().from(users)
      .where(and(eq(users.id, req.params.id), eq(users.tenantId, req.user.tenantId))).limit(1)
    if (!alvo) return reply.code(404).send({ message: 'Acesso não encontrado.' })
    if (alvo.role === 'master') return reply.code(403).send({ message: 'O acesso master não pode ser excluído.' })

    // não deixa o escritório ficar sem nenhum administrador
    if (alvo.role === 'admin') {
      const admins = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.tenantId, req.user.tenantId), eq(users.role, 'admin')))
      if (admins.length <= 1) {
        return reply.code(400).send({ message: 'Este é o único administrador do escritório — crie outro antes de excluí-lo.' })
      }
    }

    await db.delete(users).where(eq(users.id, req.params.id))
    await setMenuAccess(req.user.tenantId, req.params.id, null) // limpa permissões guardadas
    return reply.code(204).send()
  })

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
