// ─────────────────────────────────────────────────────────────────────────
//  Observações do cliente — o mural da equipe.
//
//  A tela dizia "escreva aqui — todos da equipe podem ver". Não era
//  verdade: estava em `localStorage`, então cada pessoa via o próprio
//  mural e ninguém via o das outras. Agora é do escritório.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clientNotes, clients, users } from '../db/schema.js'

const COLUNAS = {
  id: clientNotes.id, clientId: clientNotes.clientId,
  assunto: clientNotes.assunto, texto: clientNotes.texto,
  createdById: clientNotes.createdById, createdByName: clientNotes.createdByName,
  createdAt: clientNotes.createdAt, updatedAt: clientNotes.updatedAt,
}

export default async function clientNoteRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req, reply) => {
    if (!req.query.clientId) return reply.code(400).send({ message: 'Informe o cliente.' })
    return db.select(COLUNAS).from(clientNotes)
      .where(and(eq(clientNotes.tenantId, req.user.tenantId), eq(clientNotes.clientId, req.query.clientId)))
      .orderBy(desc(clientNotes.createdAt))
  })

  app.post('/', auth, async (req, reply) => {
    const b = req.body ?? {}
    const texto = String(b.texto ?? '').trim()
    if (!texto) return reply.code(400).send({ message: 'Escreva a observação.' })
    if (!b.clientId) return reply.code(400).send({ message: 'Informe o cliente.' })

    const [c] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, b.clientId), eq(clients.tenantId, req.user.tenantId))).limit(1)
    if (!c) return reply.code(400).send({ message: 'Cliente não encontrado.' })

    const [eu] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.user.userId)).limit(1)
    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(clientNotes).values({
      id, tenantId: req.user.tenantId, clientId: b.clientId,
      assunto: b.assunto ? String(b.assunto).trim() : null,
      texto,
      createdById: req.user.userId, createdByName: eu?.name ?? null,
      createdAt: now, updatedAt: now,
    })
    const [linha] = await db.select(COLUNAS).from(clientNotes).where(eq(clientNotes.id, id)).limit(1)
    return reply.code(201).send(linha)
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: clientNotes.id }).from(clientNotes)
      .where(and(eq(clientNotes.id, req.params.id), eq(clientNotes.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Observação não encontrada.' })
    await db.delete(clientNotes).where(eq(clientNotes.id, req.params.id))
    return reply.code(204).send()
  })
}
