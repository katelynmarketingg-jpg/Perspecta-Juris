import { nanoid } from 'nanoid'
import { eq, and, gte, lte, desc, sum, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import { financialEntries } from '../db/schema.js'

export default async function financialRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/entries', auth, async (req) => {
    const { type, status, from, to, clientId, processId, page = '1', limit = '50' } = req.query
    const tid = req.user.tenantId
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const conditions = [eq(financialEntries.tenantId, tid)]
    if (type)      conditions.push(eq(financialEntries.type, type))
    if (status)    conditions.push(eq(financialEntries.status, status))
    if (clientId)  conditions.push(eq(financialEntries.clientId, clientId))
    if (processId) conditions.push(eq(financialEntries.processId, processId))
    if (from)      conditions.push(gte(financialEntries.dueDate, from))
    if (to)        conditions.push(lte(financialEntries.dueDate, to))

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(financialEntries).where(and(...conditions))
        .orderBy(desc(financialEntries.dueDate)).limit(parseInt(limit)).offset(offset),
      db.select({ total: count() }).from(financialEntries).where(and(...conditions)),
    ])
    return { data: rows, total }
  })

  app.post('/entries', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(financialEntries).values({
      id, tenantId: tid, ...req.body,
      createdBy: req.user.userId, createdAt: now, updatedAt: now,
    })
    const [row] = await db.select().from(financialEntries).where(eq(financialEntries.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  app.put('/entries/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: financialEntries.id }).from(financialEntries)
      .where(and(eq(financialEntries.id, req.params.id), eq(financialEntries.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Lançamento não encontrado.' })
    const { id: _id, tenantId: _tid, createdAt: _ca, ...updates } = req.body
    await db.update(financialEntries).set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(financialEntries.id, req.params.id))
    const [updated] = await db.select().from(financialEntries).where(eq(financialEntries.id, req.params.id)).limit(1)
    return updated
  })

  app.post('/entries/:id/pay', auth, async (req, reply) => {
    const [row] = await db.select().from(financialEntries)
      .where(and(eq(financialEntries.id, req.params.id), eq(financialEntries.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Lançamento não encontrado.' })
    const now = new Date().toISOString()
    await db.update(financialEntries).set({
      status: 'paid',
      paidDate: req.body.paidDate ?? now.slice(0, 10),
      paidAmount: req.body.paidAmount ?? row.amount,
      paymentMethod: req.body.paymentMethod,
      updatedAt: now,
    }).where(eq(financialEntries.id, req.params.id))
    return { success: true }
  })

  app.get('/summary', auth, async (req) => {
    const tid = req.user.tenantId
    const today = new Date().toISOString().slice(0, 10)

    const [receivable, payable, overdue, received, paid] = await Promise.all([
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'receivable'), eq(financialEntries.status, 'pending'))),
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'payable'), eq(financialEntries.status, 'pending'))),
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.status, 'pending'), lte(financialEntries.dueDate, today))),
      db.select({ total: sum(financialEntries.paidAmount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.status, 'paid'), eq(financialEntries.type, 'receivable'))),
      db.select({ total: sum(financialEntries.paidAmount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.status, 'paid'), eq(financialEntries.type, 'payable'))),
    ])

    return {
      totalReceivable: parseFloat(receivable[0]?.total ?? 0),
      totalPayable:    parseFloat(payable[0]?.total ?? 0),
      totalOverdue:    parseFloat(overdue[0]?.total ?? 0),
      totalReceived:   parseFloat(received[0]?.total ?? 0),
      totalPaid:       parseFloat(paid[0]?.total ?? 0),
    }
  })

  app.get('/cashflow', auth, async (req) => {
    const tid = req.user.tenantId
    const months = []
    const today = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        from: d.toISOString().slice(0, 7) + '-01',
        to:   new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10),
      })
    }

    const series = await Promise.all(months.map(async m => {
      const [rec, pay] = await Promise.all([
        db.select({ total: sum(financialEntries.paidAmount) }).from(financialEntries)
          .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'receivable'),
            gte(financialEntries.paidDate, m.from), lte(financialEntries.paidDate, m.to))),
        db.select({ total: sum(financialEntries.paidAmount) }).from(financialEntries)
          .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'payable'),
            gte(financialEntries.paidDate, m.from), lte(financialEntries.paidDate, m.to))),
      ])
      return {
        ...m,
        receitas:  parseFloat(rec[0]?.total ?? 0),
        despesas:  parseFloat(pay[0]?.total ?? 0),
      }
    }))

    return series
  })
}
