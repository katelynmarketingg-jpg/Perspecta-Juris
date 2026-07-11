import { nanoid } from 'nanoid'
import { eq, and, ilike, or, desc, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, processes, financialEntries, documents } from '../db/schema.js'

export default async function clientRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/clients
  app.get('/', auth, async (req) => {
    const { search, source, isActive, page = '1', limit = '50' } = req.query
    const tid = req.user.tenantId
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const conditions = [eq(clients.tenantId, tid)]
    if (isActive !== undefined) conditions.push(eq(clients.isActive, isActive === 'true'))
    if (source) conditions.push(eq(clients.source, source))
    if (search) {
      conditions.push(
        or(
          ilike(clients.name, `%${search}%`),
          ilike(clients.email, `%${search}%`),
          ilike(clients.cpfCnpj, `%${search}%`),
          ilike(clients.phone, `%${search}%`),
        )
      )
    }

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(clients).where(and(...conditions))
        .orderBy(desc(clients.createdAt)).limit(parseInt(limit)).offset(offset),
      db.select({ total: count() }).from(clients).where(and(...conditions)),
    ])

    return { data: rows, total, page: parseInt(page), limit: parseInt(limit) }
  })

  // GET /api/clients/:id
  app.get('/:id', auth, async (req, reply) => {
    const [row] = await db.select().from(clients)
      .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, req.user.tenantId)))
      .limit(1)
    if (!row) return reply.code(404).send({ message: 'Cliente não encontrado.' })
    return row
  })

  // POST /api/clients
  app.post('/', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id  = nanoid()
    const data = {
      id, tenantId: tid, ...req.body,
      tags: req.body.tags ?? [],
      createdAt: now, updatedAt: now,
    }
    await db.insert(clients).values(data)
    const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  // PUT /api/clients/:id
  app.put('/:id', auth, async (req, reply) => {
    const { id } = req.params
    const tid = req.user.tenantId
    const [existing] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tid))).limit(1)
    if (!existing) return reply.code(404).send({ message: 'Cliente não encontrado.' })

    const { id: _id, tenantId: _tid, createdAt: _ca, ...updates } = req.body
    await db.update(clients)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(clients.id, id))

    const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1)
    return row
  })

  // DELETE /api/clients/:id
  app.delete('/:id', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const [existing] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, tid))).limit(1)
    if (!existing) return reply.code(404).send({ message: 'Cliente não encontrado.' })

    await db.update(clients)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(clients.id, req.params.id))
    return reply.code(204).send()
  })

  // GET /api/clients/:id/processes
  app.get('/:id/processes', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const [client] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, req.params.id), eq(clients.tenantId, tid))).limit(1)
    if (!client) return reply.code(404).send({ message: 'Cliente não encontrado.' })

    const rows = await db.select().from(processes)
      .where(and(eq(processes.clientId, req.params.id), eq(processes.tenantId, tid)))
      .orderBy(desc(processes.createdAt))
    return rows
  })

  // GET /api/clients/:id/timeline
  app.get('/:id/timeline', auth, async (req) => {
    const tid = req.user.tenantId
    const clientId = req.params.id

    const [clientProcesses, entries] = await Promise.all([
      db.select({ id: processes.id }).from(processes)
        .where(and(eq(processes.clientId, clientId), eq(processes.tenantId, tid))),
      db.select().from(financialEntries)
        .where(and(eq(financialEntries.clientId, clientId), eq(financialEntries.tenantId, tid)))
        .orderBy(desc(financialEntries.createdAt)).limit(20),
    ])

    // Return aggregated timeline events
    const events = [
      ...entries.map(e => ({
        type: 'financial',
        date: e.createdAt,
        title: e.description,
        meta: { amount: e.amount, status: e.status, type: e.type },
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    return { events, processCount: clientProcesses.length }
  })

  // GET /api/clients/:id/financial
  app.get('/:id/financial', auth, async (req) => {
    const tid = req.user.tenantId
    const rows = await db.select().from(financialEntries)
      .where(and(eq(financialEntries.clientId, req.params.id), eq(financialEntries.tenantId, tid)))
      .orderBy(desc(financialEntries.dueDate))
    return rows
  })
}
