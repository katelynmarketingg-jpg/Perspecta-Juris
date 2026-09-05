// ─────────────────────────────────────────────────────────────────────────
//  Porta administrativa — usada pela Perspecta Central, não por gente.
//
//  Autenticação por ADMIN_API_TOKEN (máquina-a-máquina), não por login.
//  A lógica de negócio é a MESMA do painel master: estas rotas são cascas
//  finas sobre server/services/provisionamento.js. Se as regras divergirem
//  um dia, o bug aparece nos dois lugares ao mesmo tempo — que é o certo.
//
//  Toda chamada fica registrada em audit_logs marcada como origem 'central'.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, ne, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants, users, auditLogs } from '../db/schema.js'
import { requireServiceToken } from '../lib/serviceToken.js'
import { getPlans } from '../lib/plans.js'
import { consumoAgregado, inicioDoMes } from '../lib/usage.js'
import {
  criarEscritorio, criarAcesso, revogarAcesso, contagens, ErroDeRegra,
} from '../services/provisionamento.js'

// Registra o que a Central fez. Nunca derruba a operação.
async function auditar(req, acao, recurso, recursoId, detalhes = {}) {
  try {
    await db.insert(auditLogs).values({
      id: nanoid(),
      tenantId:   detalhes.tenantId ?? 'sistema',
      userId:     null,
      action:     acao,
      resource:   recurso,
      resourceId: recursoId ?? null,
      changes:    { ...detalhes, origem: 'central' },
      ipAddress:  req.ip ?? null,
      userAgent:  req.headers['user-agent'] ?? null,
      createdAt:  new Date().toISOString(),
    })
  } catch (err) {
    req.log?.warn?.(`[admin] não foi possível auditar: ${err?.message ?? err}`)
  }
}

// Traduz erro de regra para o HTTP certo; o resto sobe como 500.
const responder = async (reply, fn) => {
  try { return await fn() }
  catch (err) {
    if (err instanceof ErroDeRegra) {
      return reply.code(err.status).send({ message: err.message, ...(err.limite ? { limite: err.limite, atual: err.atual } : {}) })
    }
    throw err
  }
}

export default async function adminRoutes(app) {
  const servico = { preHandler: [requireServiceToken] }

  // Limite próprio, mais folgado que o global de 200/min: a administração não
  // deve competir com os escritórios usando o sistema.
  await app.register(async (escopo) => {
    await escopo.register(import('@fastify/rate-limit'), {
      max: parseInt(process.env.ADMIN_RATE_LIMIT ?? '600', 10),
      timeWindow: '1 minute',
      keyGenerator: (req) => `admin:${req.ip}`,
    })

    // ── Saúde da porta ────────────────────────────────────────────
    // Serve para a Central confirmar que o token está certo antes de tentar
    // qualquer coisa que mude estado.
    escopo.get('/ping', servico, async () => ({
      ok: true, servico: 'perspecta-juris', ts: new Date().toISOString(),
    }))

    // ── Escritórios ───────────────────────────────────────────────
    escopo.get('/companies', servico, async () => {
      const rows = await db.select().from(tenants).where(ne(tenants.plan, 'master'))
      const { u, c, p } = await contagens()
      const planos = await getPlans()
      const limiteDe = key => planos.find(x => x.key === key)?.maxUsers ?? null
      return rows.map(t => ({
        id: t.id, name: t.name, slug: t.slug, plan: t.plan,
        isActive: t.isActive, planExpiresAt: t.planExpiresAt,
        cnpj: t.settings?.cnpj ?? '',
        maxUsers: limiteDe(t.plan),
        usersCount: u[t.id] ?? 0, clientsCount: c[t.id] ?? 0, processesCount: p[t.id] ?? 0,
        createdAt: t.createdAt,
      }))
    })

    escopo.post('/companies', servico, async (req, reply) => responder(reply, async () => {
      const { tenant, usuario } = await criarEscritorio(req.body ?? {}, { origem: 'central' })
      await auditar(req, `Escritório "${tenant.name}" criado pela Central`, 'escritorio', tenant.id, { tenantId: tenant.id, plano: tenant.plan })
      return reply.code(201).send({
        id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan,
        isActive: tenant.isActive, cnpj: tenant.settings?.cnpj ?? '',
        createdAt: tenant.createdAt,
        admin: usuario,   // a senha NÃO volta: quem a definiu já a conhece
      })
    }))

    // Ativa/desativa, renomeia, troca plano e define vencimento.
    escopo.put('/companies/:id', servico, async (req, reply) => responder(reply, async () => {
      const b = req.body ?? {}
      const [t] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
      if (!t) return reply.code(404).send({ message: 'Escritório não encontrado.' })
      if (t.plan === 'master') return reply.code(403).send({ message: 'O escritório master não pode ser alterado.' })

      const patch = { updatedAt: new Date().toISOString() }
      if (typeof b.isActive === 'boolean') patch.isActive = b.isActive
      if (b.name?.trim())                  patch.name = b.name.trim()
      if (b.plan)                          patch.plan = b.plan
      if (b.planExpiresAt !== undefined)   patch.planExpiresAt = b.planExpiresAt
      if (b.cnpj !== undefined)            patch.settings = { ...(t.settings ?? {}), cnpj: b.cnpj }

      if (Object.keys(patch).length === 1) {
        return reply.code(400).send({
          message: 'Nada para alterar.',
          camposPermitidos: ['isActive', 'name', 'plan', 'planExpiresAt', 'cnpj'],
        })
      }

      await db.update(tenants).set(patch).where(eq(tenants.id, req.params.id))
      const [row] = await db.select().from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
      const { updatedAt: _u, ...mudou } = patch
      await auditar(req, `Escritório "${row.name}" alterado pela Central`, 'escritorio', row.id, { tenantId: row.id, mudou })
      return { id: row.id, name: row.name, plan: row.plan, isActive: row.isActive, planExpiresAt: row.planExpiresAt, cnpj: row.settings?.cnpj ?? '' }
    }))

    // ── Acessos ───────────────────────────────────────────────────
    escopo.get('/companies/:id/users', servico, async (req, reply) => {
      const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, req.params.id)).limit(1)
      if (!t) return reply.code(404).send({ message: 'Escritório não encontrado.' })
      return db.select({
        id: users.id, name: users.name, loginName: users.loginName, email: users.email,
        role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      }).from(users).where(eq(users.tenantId, req.params.id))
    })

    escopo.post('/companies/:id/users', servico, async (req, reply) => responder(reply, async () => {
      const criado = await criarAcesso(req.params.id, req.body ?? {}, { origem: 'central' })
      await auditar(req, `Acesso "${criado.loginName}" criado pela Central`, 'acesso', criado.id, { tenantId: req.params.id, role: criado.role })
      return reply.code(201).send(criado)
    }))

    escopo.delete('/companies/:id/users/:userId', servico, async (req, reply) => responder(reply, async () => {
      const removido = await revogarAcesso(req.params.id, req.params.userId)
      await auditar(req, `Acesso "${removido.loginName}" revogado pela Central`, 'acesso', removido.id, { tenantId: req.params.id })
      return reply.code(204).send()
    }))

    // ── Métricas ──────────────────────────────────────────────────
    // Tudo que a Central precisa para medir e cobrar, numa chamada só.
    escopo.get('/metrics', servico, async (req) => {
      const { from, to } = req.query
      const desde = from ?? inicioDoMes()

      const [escritorios, linhasUso, planos, { u, c, p }] = await Promise.all([
        db.select().from(tenants).where(ne(tenants.plan, 'master')),
        consumoAgregado({ from: desde, to }),
        getPlans(),
        contagens(),
      ])

      const usoPorTenant = {}
      for (const l of linhasUso) {
        (usoPorTenant[l.tenantId] ??= {})[l.kind] = { total: l.total, eventos: l.eventos }
      }
      const limiteDe = key => planos.find(x => x.key === key)?.maxUsers ?? null

      return {
        periodo: { desde, ate: to ?? null },
        planos,
        escritorios: escritorios.map(t => ({
          id: t.id, name: t.name, plan: t.plan, isActive: t.isActive,
          planExpiresAt: t.planExpiresAt,
          maxUsers: limiteDe(t.plan),
          contagens: {
            usuarios:  u[t.id] ?? 0,
            clientes:  c[t.id] ?? 0,
            processos: p[t.id] ?? 0,
          },
          uso: usoPorTenant[t.id] ?? {},
        })),
      }
    })

    // ── Auditoria da própria porta ────────────────────────────────
    escopo.get('/audit', servico, async (req) => {
      const limite = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, 500)
      return db.select().from(auditLogs)
        .orderBy(desc(auditLogs.createdAt)).limit(limite)
    })
  }, { prefix: '' })
}
