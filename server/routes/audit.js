import { nanoid } from 'nanoid'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogs, users } from '../db/schema.js'

// Registros de atividade do escritório. Autor, IP e data/hora são definidos
// pelo SERVIDOR — é isso que dá valor probatório ao log.
export default async function auditRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/audit — lista os registros do escritório atual
  app.get('/', auth, async (req) => {
    const limite = Math.min(parseInt(req.query.limit ?? '500', 10) || 500, 2000)
    const rows = await db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, req.user.tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limite)

    const equipe = await db.select({ id: users.id, name: users.name })
      .from(users).where(eq(users.tenantId, req.user.tenantId))
    const nomes = Object.fromEntries(equipe.map(u => [u.id, u.name]))

    return rows.map(r => ({
      id:         r.id,
      tipo:       r.resource,
      descricao:  r.action,
      meta:       r.changes ?? {},
      autor:      nomes[r.userId] ?? 'Usuário',
      autorId:    r.userId,
      ip:         r.ipAddress,
      createdAt:  r.createdAt,
    }))
  })

  // POST /api/audit — registra uma atividade
  app.post('/', auth, async (req, reply) => {
    const b = req.body ?? {}
    await db.insert(auditLogs).values({
      id:         nanoid(),
      tenantId:   req.user.tenantId,
      userId:     req.user.userId ?? null,
      action:     String(b.descricao ?? '').slice(0, 500) || '—',
      resource:   String(b.tipo ?? 'geral').slice(0, 60),
      resourceId: b.resourceId ? String(b.resourceId).slice(0, 120) : null,
      changes:    (b.meta && typeof b.meta === 'object') ? b.meta : {},
      ipAddress:  req.ip ?? null,
      userAgent:  req.headers['user-agent'] ?? null,
      createdAt:  new Date().toISOString(),
    })
    return reply.code(201).send({ ok: true })
  })
}
