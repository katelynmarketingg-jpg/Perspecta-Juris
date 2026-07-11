import { nanoid } from 'nanoid'
import { eq, and, lte, gte, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { deadlines } from '../db/schema.js'

export default async function deadlineRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const { assignedTo, status, processId, from, to } = req.query
    const tid = req.user.tenantId
    const conditions = [eq(deadlines.tenantId, tid)]
    if (assignedTo) conditions.push(eq(deadlines.assignedTo, assignedTo))
    if (status)     conditions.push(eq(deadlines.status, status))
    if (processId)  conditions.push(eq(deadlines.processId, processId))
    if (from)       conditions.push(gte(deadlines.dueDate, from))
    if (to)         conditions.push(lte(deadlines.dueDate, to))
    return db.select().from(deadlines).where(and(...conditions)).orderBy(deadlines.dueDate)
  })

  app.get('/upcoming', auth, async (req) => {
    const tid = req.user.tenantId
    const today = new Date()
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30)
    return db.select().from(deadlines)
      .where(and(
        eq(deadlines.tenantId, tid),
        eq(deadlines.status, 'pending'),
        lte(deadlines.dueDate, in30.toISOString().slice(0, 10)),
      ))
      .orderBy(deadlines.dueDate)
      .limit(20)
  })

  app.post('/', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(deadlines).values({
      id, tenantId: tid, ...req.body,
      status: 'pending', createdAt: now, updatedAt: now,
    })
    const [row] = await db.select().from(deadlines).where(eq(deadlines.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  app.put('/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: deadlines.id }).from(deadlines)
      .where(and(eq(deadlines.id, req.params.id), eq(deadlines.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Prazo não encontrado.' })
    const { id: _id, tenantId: _tid, createdAt: _ca, ...updates } = req.body
    await db.update(deadlines).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(deadlines.id, req.params.id))
    const [updated] = await db.select().from(deadlines).where(eq(deadlines.id, req.params.id)).limit(1)
    return updated
  })

  app.post('/:id/complete', auth, async (req, reply) => {
    const [row] = await db.select({ id: deadlines.id }).from(deadlines)
      .where(and(eq(deadlines.id, req.params.id), eq(deadlines.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Prazo não encontrado.' })
    const now = new Date().toISOString()
    await db.update(deadlines).set({
      status: 'done', completedAt: now, completedBy: req.user.userId, updatedAt: now,
    }).where(eq(deadlines.id, req.params.id))
    return { success: true }
  })
}
