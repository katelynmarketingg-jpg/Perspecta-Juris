import { nanoid } from 'nanoid'
import { eq, and, ilike, or, desc, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { processes, processMovements, deadlines, financialEntries, documents, tenants } from '../db/schema.js'

async function nextInternalNumber(tenantId) {
  const year = new Date().getFullYear()
  const [row] = await db.select({ total: count() }).from(processes)
    .where(and(eq(processes.tenantId, tenantId)))
  return `${(row?.total ?? 0) + 1}/${year}`
}

export default async function processRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/processes
  app.get('/', auth, async (req) => {
    const { clientId, area, status, search, assignedTo, page = '1', limit = '50' } = req.query
    const tid = req.user.tenantId
    const offset = (parseInt(page) - 1) * parseInt(limit)

    const conditions = [eq(processes.tenantId, tid)]
    if (clientId)   conditions.push(eq(processes.clientId, clientId))
    if (area)       conditions.push(eq(processes.area, area))
    if (status)     conditions.push(eq(processes.status, status))
    if (assignedTo) conditions.push(eq(processes.assignedTo, assignedTo))
    if (search)     conditions.push(or(
      ilike(processes.title, `%${search}%`),
      ilike(processes.judicialNumber, `%${search}%`),
      ilike(processes.internalNumber, `%${search}%`),
    ))

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(processes).where(and(...conditions))
        .orderBy(desc(processes.createdAt)).limit(parseInt(limit)).offset(offset),
      db.select({ total: count() }).from(processes).where(and(...conditions)),
    ])

    return { data: rows, total, page: parseInt(page), limit: parseInt(limit) }
  })

  // GET /api/processes/:id
  app.get('/:id', auth, async (req, reply) => {
    const [row] = await db.select().from(processes)
      .where(and(eq(processes.id, req.params.id), eq(processes.tenantId, req.user.tenantId)))
      .limit(1)
    if (!row) return reply.code(404).send({ message: 'Processo não encontrado.' })
    return row
  })

  // POST /api/processes
  app.post('/', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id  = nanoid()
    const internalNumber = await nextInternalNumber(tid)

    const data = {
      id, tenantId: tid,
      internalNumber,
      team: req.body.team ?? [],
      customFields: req.body.customFields ?? {},
      status: 'active',
      priority: req.body.priority ?? 'normal',
      startedAt: now,
      ...req.body,
      createdAt: now, updatedAt: now,
    }
    await db.insert(processes).values(data)

    // Auto-create initial movement
    await db.insert(processMovements).values({
      id: nanoid(),
      tenantId: tid,
      processId: id,
      date: now.slice(0, 10),
      description: `Processo criado — ${req.body.title}`,
      type: 'outro',
      createdBy: req.user.userId,
      isPublic: false,
      createdAt: now,
    })

    const [row] = await db.select().from(processes).where(eq(processes.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  // PUT /api/processes/:id
  app.put('/:id', auth, async (req, reply) => {
    const { id } = req.params
    const tid = req.user.tenantId
    const [existing] = await db.select({ id: processes.id }).from(processes)
      .where(and(eq(processes.id, id), eq(processes.tenantId, tid))).limit(1)
    if (!existing) return reply.code(404).send({ message: 'Processo não encontrado.' })

    const { id: _id, tenantId: _tid, createdAt: _ca, internalNumber: _in, ...updates } = req.body
    await db.update(processes)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(processes.id, id))

    const [row] = await db.select().from(processes).where(eq(processes.id, id)).limit(1)
    return row
  })

  // GET /api/processes/:id/movements
  app.get('/:id/movements', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const [proc] = await db.select({ id: processes.id }).from(processes)
      .where(and(eq(processes.id, req.params.id), eq(processes.tenantId, tid))).limit(1)
    if (!proc) return reply.code(404).send({ message: 'Processo não encontrado.' })

    const rows = await db.select().from(processMovements)
      .where(and(eq(processMovements.processId, req.params.id), eq(processMovements.tenantId, tid)))
      .orderBy(desc(processMovements.date))
    return rows
  })

  // POST /api/processes/:id/movements
  app.post('/:id/movements', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const [proc] = await db.select({ id: processes.id }).from(processes)
      .where(and(eq(processes.id, req.params.id), eq(processes.tenantId, tid))).limit(1)
    if (!proc) return reply.code(404).send({ message: 'Processo não encontrado.' })

    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(processMovements).values({
      id, tenantId: tid, processId: req.params.id,
      date: req.body.date ?? now.slice(0, 10),
      description: req.body.description,
      type: req.body.type ?? 'outro',
      author: req.body.author,
      isPublic: req.body.isPublic ?? false,
      createdBy: req.user.userId,
      createdAt: now,
    })

    // Update process updatedAt
    await db.update(processes).set({ updatedAt: now }).where(eq(processes.id, req.params.id))

    const [row] = await db.select().from(processMovements).where(eq(processMovements.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  // POST /api/processes/:id/phase-change
  app.post('/:id/phase-change', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const { phase, description } = req.body
    const [proc] = await db.select().from(processes)
      .where(and(eq(processes.id, req.params.id), eq(processes.tenantId, tid))).limit(1)
    if (!proc) return reply.code(404).send({ message: 'Processo não encontrado.' })

    const now = new Date().toISOString()
    await db.update(processes).set({ phase, updatedAt: now }).where(eq(processes.id, req.params.id))
    await db.insert(processMovements).values({
      id: nanoid(), tenantId: tid, processId: req.params.id,
      date: now.slice(0, 10),
      description: description ?? `Fase alterada para: ${phase}`,
      type: 'despacho',
      createdBy: req.user.userId,
      isPublic: true,
      createdAt: now,
    })

    return { success: true, phase }
  })

  // GET /api/processes/:id/deadlines
  app.get('/:id/deadlines', auth, async (req) => {
    const tid = req.user.tenantId
    return db.select().from(deadlines)
      .where(and(eq(deadlines.processId, req.params.id), eq(deadlines.tenantId, tid)))
      .orderBy(deadlines.dueDate)
  })

  // GET /api/processes/:id/financial
  app.get('/:id/financial', auth, async (req) => {
    const tid = req.user.tenantId
    return db.select().from(financialEntries)
      .where(and(eq(financialEntries.processId, req.params.id), eq(financialEntries.tenantId, tid)))
      .orderBy(desc(financialEntries.dueDate))
  })

  // GET /api/processes/:id/documents
  app.get('/:id/documents', auth, async (req) => {
    const tid = req.user.tenantId
    return db.select().from(documents)
      .where(and(eq(documents.processId, req.params.id), eq(documents.tenantId, tid)))
      .orderBy(desc(documents.createdAt))
  })
}
