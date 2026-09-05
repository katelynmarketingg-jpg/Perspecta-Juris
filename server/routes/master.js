import { eq, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users } from '../db/schema.js'
import { getPlans, savePlans } from '../lib/plans.js'
import { menuAccessFor } from '../lib/permissions.js'
import { getBranding, setBranding } from '../lib/branding.js'
import { issueRefreshToken } from '../lib/refreshTokens.js'
import { consumoAgregado, inicioDoMes } from '../lib/usage.js'
import { emitirEventoPerspecta } from '../lib/perspecta-webhook.js'
// As regras de criar escritório vivem no serviço: a porta /api/admin/* usada
// pela Perspecta Central chama exatamente as mesmas funções. Duas cópias
// seriam, na prática, duas regras — e uma ficaria para trás.
import { criarEscritorio, contagens as counts, ErroDeRegra } from '../services/provisionamento.js'

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

  // ── Consumo por escritório ────────────────────────────────────
  // GET /api/master/usage?from=&to=  → o que cada escritório gastou.
  // É a base para cobrar por cota; antes não existia contador nenhum.
  app.get('/usage', master, async (req) => {
    const { from, to } = req.query
    const desde = from ?? inicioDoMes()
    const linhas = await consumoAgregado({ from: desde, to })

    // Agrupa por escritório, com o nome junto para a tela não precisar cruzar.
    const nomes = Object.fromEntries(
      (await db.select({ id: tenants.id, name: tenants.name, plan: tenants.plan }).from(tenants))
        .map(t => [t.id, t]),
    )
    const porTenant = {}
    for (const l of linhas) {
      const t = (porTenant[l.tenantId] ??= {
        tenantId: l.tenantId,
        name: nomes[l.tenantId]?.name ?? '(escritório removido)',
        plan: nomes[l.tenantId]?.plan ?? null,
        uso: {},
      })
      t.uso[l.kind] = { total: l.total, eventos: l.eventos }
    }
    return { desde, ate: to ?? null, escritorios: Object.values(porTenant) }
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
    let tenant
    try {
      ({ tenant } = await criarEscritorio(req.body ?? {}, { origem: 'nova-empresa' }))
    } catch (err) {
      if (err instanceof ErroDeRegra) return reply.code(err.status).send({ message: err.message })
      throw err
    }

    emitirEventoPerspecta('cadastro.novo', {
      empresa_ref: tenant.id, nome: tenant.name, plano: tenant.plan,
      cnpj: tenant.settings?.cnpj ?? '', admin_email: req.body?.adminEmail ?? null,
    })
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
    const refreshToken = await issueRefreshToken(target.id)

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
