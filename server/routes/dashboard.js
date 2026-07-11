import { eq, and, lte, count, sum } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, processes, deadlines, tasks, financialEntries } from '../db/schema.js'

export default async function dashboardRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/kpis', auth, async (req) => {
    const tid = req.user.tenantId
    const today = new Date().toISOString().slice(0, 10)
    const in7  = new Date(); in7.setDate(in7.getDate() + 7)
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)

    const [
      [{ activeClients }],
      [{ inactiveClients }],
      [{ activeProcesses }],
      [{ closedProcesses }],
      upcomingDeadlines,
      pendingTasks,
      financialSummary,
    ] = await Promise.all([
      db.select({ activeClients: count() }).from(clients)
        .where(and(eq(clients.tenantId, tid), eq(clients.isActive, true))),
      db.select({ inactiveClients: count() }).from(clients)
        .where(and(eq(clients.tenantId, tid), eq(clients.isActive, false))),
      db.select({ activeProcesses: count() }).from(processes)
        .where(and(eq(processes.tenantId, tid), eq(processes.status, 'active'))),
      db.select({ closedProcesses: count() }).from(processes)
        .where(and(eq(processes.tenantId, tid))),
      db.select().from(deadlines)
        .where(and(
          eq(deadlines.tenantId, tid),
          eq(deadlines.status, 'pending'),
          lte(deadlines.dueDate, in7.toISOString().slice(0, 10)),
        ))
        .orderBy(deadlines.dueDate).limit(10),
      db.select({ total: count() }).from(tasks)
        .where(and(eq(tasks.tenantId, tid), eq(tasks.status, 'todo'))),
      db.select({
        totalReceivable: sum(financialEntries.amount),
        type: financialEntries.type,
        status: financialEntries.status,
      }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.status, 'pending')))
        .groupBy(financialEntries.type, financialEntries.status),
    ])

    const receivable = financialSummary.find(r => r.type === 'receivable')
    const payable    = financialSummary.find(r => r.type === 'payable')

    return {
      clients: { active: activeClients, inactive: inactiveClients },
      processes: { active: activeProcesses, total: closedProcesses },
      deadlines: { upcoming: upcomingDeadlines },
      tasks: { pending: pendingTasks[0]?.total ?? 0 },
      financial: {
        totalReceivable: parseFloat(receivable?.totalReceivable ?? 0),
        totalPayable:    parseFloat(payable?.totalReceivable ?? 0),
      },
    }
  })
}
