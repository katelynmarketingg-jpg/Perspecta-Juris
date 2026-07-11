import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks } from '../db/schema.js'

export default async function taskRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const { assignedTo, status, processId, clientId } = req.query
    const tid = req.user.tenantId
    const conditions = [eq(tasks.tenantId, tid)]
    if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo))
    if (status)     conditions.push(eq(tasks.status, status))
    if (processId)  conditions.push(eq(tasks.processId, processId))
    if (clientId)   conditions.push(eq(tasks.clientId, clientId))
    return db.select().from(tasks).where(and(...conditions)).orderBy(tasks.dueDate, desc(tasks.createdAt))
  })

  app.post('/', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(tasks).values({
      id, tenantId: tid, ...req.body,
      tags: req.body.tags ?? [],
      status: req.body.status ?? 'todo',
      priority: req.body.priority ?? 'normal',
      createdBy: req.user.userId,
      createdAt: now, updatedAt: now,
    })
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  app.put('/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Tarefa não encontrada.' })
    const { id: _id, tenantId: _tid, createdAt: _ca, ...updates } = req.body
    await db.update(tasks).set({ ...updates, updatedAt: new Date().toISOString() }).where(eq(tasks.id, req.params.id))
    const [updated] = await db.select().from(tasks).where(eq(tasks.id, req.params.id)).limit(1)
    return updated
  })

  app.post('/:id/status', auth, async (req, reply) => {
    const [row] = await db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Tarefa não encontrada.' })
    const now = new Date().toISOString()
    const updates = { status: req.body.status, updatedAt: now }
    if (req.body.status === 'done') updates.completedAt = now
    await db.update(tasks).set(updates).where(eq(tasks.id, req.params.id))
    return { success: true, status: req.body.status }
  })
}
