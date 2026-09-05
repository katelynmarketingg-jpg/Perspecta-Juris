import { nanoid } from 'nanoid'
import { eq, and, gte, lte, desc, sum, count, isNull, ne, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { financialEntries } from '../db/schema.js'

// Campos que o cliente pode gravar. Lista explícita porque o Drizzle descarta
// chaves desconhecidas EM SILÊNCIO: sem isto, um campo novo na tela some sem
// erro nenhum e ninguém percebe até faltar dinheiro no relatório.
const CAMPOS = [
  'type', 'category', 'description', 'amount', 'status', 'dueDate', 'paidDate',
  'paidAmount', 'processId', 'clientId', 'invoiceNumber', 'paymentMethod',
  'recurrence', 'recurrenceEnd', 'parentEntryId', 'notes',
  'installmentOf', 'installmentTotal',
  'groupId', 'needsReview', 'feeKind', 'formaPagamento', 'paymentLink',
  'receivedVia', 'receivedAmount', 'percentage', 'estimativa', 'createdViaProcess',
]

function limpar(body) {
  const out = {}
  for (const c of CAMPOS) if (body?.[c] !== undefined) out[c] = body[c]
  return out
}

// Lançamentos de ÊXITO são estimativa, não caixa: nunca entram nos totais.
const semExito = or(isNull(financialEntries.feeKind), ne(financialEntries.feeKind, 'exito'))

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

  // Categoria implícita: as telas de Pagamentos e de cobrança do processo não
  // pedem categoria ao usuário, e a coluna é NOT NULL.
  const categoriaDe = (e) => e?.category
    || (e?.feeKind === 'exito' ? 'honorarios-exito'
      : e?.type === 'payable' ? 'despesa' : 'honorarios')

  app.post('/entries', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id = nanoid()
    const campos = limpar(req.body)
    await db.insert(financialEntries).values({
      id, tenantId: tid, ...campos,
      category: categoriaDe(campos),
      createdBy: req.user.userId, createdAt: now, updatedAt: now,
    })
    const [row] = await db.select().from(financialEntries).where(eq(financialEntries.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  app.put('/entries/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: financialEntries.id }).from(financialEntries)
      .where(and(eq(financialEntries.id, req.params.id), eq(financialEntries.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Lançamento não encontrado.' })
    const updates = limpar(req.body)
    await db.update(financialEntries).set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(financialEntries.id, req.params.id))
    const [updated] = await db.select().from(financialEntries).where(eq(financialEntries.id, req.params.id)).limit(1)
    return updated
  })

  // DELETE /api/financial/entries/:id — a aba Pagamentos exclui lançamentos,
  // mas esta rota não existia: a exclusão só acontecia no navegador.
  app.delete('/entries/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: financialEntries.id, groupId: financialEntries.groupId })
      .from(financialEntries)
      .where(and(eq(financialEntries.id, req.params.id), eq(financialEntries.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Lançamento não encontrado.' })

    // ?grupo=1 apaga o parcelamento inteiro (todas as parcelas do mesmo groupId).
    if (req.query.grupo === '1' && row.groupId) {
      await db.delete(financialEntries).where(and(
        eq(financialEntries.tenantId, req.user.tenantId),
        eq(financialEntries.groupId, row.groupId),
      ))
    } else {
      await db.delete(financialEntries).where(eq(financialEntries.id, req.params.id))
    }
    return reply.code(204).send()
  })

  // POST /api/financial/entries/lote — cria várias parcelas de uma vez.
  // Uma chamada por parcela deixava o parcelamento pela metade se a conexão
  // caísse no meio; aqui ou entram todas ou não entra nenhuma.
  app.post('/entries/lote', auth, async (req, reply) => {
    const itens = Array.isArray(req.body?.entries) ? req.body.entries : []
    if (!itens.length) return reply.code(400).send({ message: 'Envie { entries: [...] }.' })
    if (itens.length > 60) return reply.code(400).send({ message: 'No máximo 60 parcelas por vez.' })

    const now = new Date().toISOString()
    const linhas = itens.map(e => {
      const campos = limpar(e)
      return {
        ...campos,
        category: categoriaDe(campos),
        id: nanoid(), tenantId: req.user.tenantId,
        createdBy: req.user.userId, createdAt: now, updatedAt: now,
      }
    })
    const criados = await db.insert(financialEntries).values(linhas).returning()
    return reply.code(201).send(criados)
  })

  app.post('/entries/:id/pay', auth, async (req, reply) => {
    const [row] = await db.select().from(financialEntries)
      .where(and(eq(financialEntries.id, req.params.id), eq(financialEntries.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Lançamento não encontrado.' })
    const now = new Date().toISOString()
    const b = req.body ?? {}
    // A baixa registra COMO e QUANTO entrou — antes esses dois campos só
    // existiam no navegador e se perdiam.
    const valor = b.receivedAmount ?? b.paidAmount ?? row.amount
    const via   = b.receivedVia ?? b.paymentMethod ?? null
    await db.update(financialEntries).set({
      status:        'paid',
      paidDate:      b.paidDate ?? now.slice(0, 10),
      paidAmount:    valor,
      receivedAmount: valor,
      paymentMethod: via,
      receivedVia:   via,
      needsReview:   false,
      updatedAt:     now,
    }).where(eq(financialEntries.id, req.params.id))
    const [atualizado] = await db.select().from(financialEntries).where(eq(financialEntries.id, req.params.id)).limit(1)
    return atualizado
  })

  app.get('/summary', auth, async (req) => {
    const tid = req.user.tenantId
    const today = new Date().toISOString().slice(0, 10)

    const [receivable, payable, overdue, received, paid] = await Promise.all([
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'receivable'), eq(financialEntries.status, 'pending'), semExito)),
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.type, 'payable'), eq(financialEntries.status, 'pending'))),
      db.select({ total: sum(financialEntries.amount) }).from(financialEntries)
        .where(and(eq(financialEntries.tenantId, tid), eq(financialEntries.status, 'pending'), lte(financialEntries.dueDate, today), semExito)),
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
