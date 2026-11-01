import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks, users, clients } from '../db/schema.js'
import { alias as pgAlias } from 'drizzle-orm/pg-core'

// Quem criou e para quem é — a tela precisa dos NOMES, e a tabela guarda
// só os ids. Dois aliases para juntar o mesmo `users` duas vezes.
const responsavel = pgAlias(users, 'responsavel')
const autor = pgAlias(users, 'autor')
const concluiu = pgAlias(users, 'concluiu')

// Campos que o cliente pode mandar. Tudo que não estiver aqui é ignorado.
const CAMPOS = ['processId', 'clientId', 'title', 'description', 'priority',
                'status', 'assignedTo', 'dueDate', 'tags',
                // Estes três a tela já mandava e o banco não tinha onde
                // guardar: "Feita por" saía vazio e "Dar ciência" não
                // guardava nada.
                'completedBy', 'completedAt', 'acknowledged', 'acknowledgedAt']
function limpar(body) {
  const out = {}
  for (const c of CAMPOS) if (body?.[c] !== undefined) out[c] = body[c]
  if (out.tags !== undefined && !Array.isArray(out.tags)) out.tags = []
  for (const k of ['processId', 'clientId', 'assignedTo', 'dueDate']) {
    if (out[k] === '') out[k] = null
  }
  return out
}

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
    const linhas = await db
      .select({
        id: tasks.id, processId: tasks.processId, clientId: tasks.clientId,
        title: tasks.title, description: tasks.description,
        priority: tasks.priority, status: tasks.status,
        assignedTo: tasks.assignedTo, createdBy: tasks.createdBy,
        dueDate: tasks.dueDate, completedAt: tasks.completedAt, tags: tasks.tags,
        createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
        completedBy: tasks.completedBy,
        acknowledged: tasks.acknowledged,
        acknowledgedAt: tasks.acknowledgedAt,
        assignedToName: responsavel.name,
        createdByName: autor.name,
        completedByName: concluiu.name,
        // De qual cliente é a tarefa. A aba Tarefas não mostrava, então
        // "Protocolar petição inicial" não dizia de quem.
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(responsavel, eq(responsavel.id, tasks.assignedTo))
      .leftJoin(autor, eq(autor.id, tasks.createdBy))
      .leftJoin(concluiu, eq(concluiu.id, tasks.completedBy))
      .leftJoin(clients, eq(clients.id, tasks.clientId))
      .where(and(...conditions))
      .orderBy(tasks.dueDate, desc(tasks.createdAt))
    return linhas
  })

  app.post('/', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const now = new Date().toISOString()
    const id = nanoid()
    // `...req.body` vinha DEPOIS de `tenantId`, então um corpo com
    // `tenantId` sobrescrevia o da sessão e criava a tarefa no escritório
    // de outra pessoa. Isolamento entre empresas não pode depender de
    // ninguém se lembrar da ordem das chaves num objeto.
    const campos = limpar(req.body)
    if (!String(campos.title ?? '').trim()) {
      return reply.code(400).send({ message: 'Informe o título da tarefa.' })
    }
    await db.insert(tasks).values({
      ...campos,
      id, tenantId: tid,
      title: campos.title.trim(),
      tags: campos.tags ?? [],
      status: campos.status ?? 'todo',
      priority: campos.priority ?? 'normal',
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
    const updates = limpar(req.body)
    if (!Object.keys(updates).length) return reply.code(400).send({ message: 'Nada para alterar.' })
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
    if (req.body.status === 'done') {
      updates.completedAt = now
      updates.completedBy = req.user.userId
    } else {
      // Reabrir limpa a conclusão e a ciência: senão a tarefa volta a
      // aberta carregando "feita por Fulano" de uma conclusão antiga.
      updates.completedAt = null
      updates.completedBy = null
      updates.acknowledged = false
      updates.acknowledgedAt = null
    }
    await db.update(tasks).set(updates).where(eq(tasks.id, req.params.id))
    return { success: true, status: req.body.status }
  })

  // Faltava: a ficha do cliente precisa poder apagar uma tarefa.
  app.delete('/:id', auth, async (req, reply) => {
    const [row] = await db.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.tenantId, req.user.tenantId))).limit(1)
    if (!row) return reply.code(404).send({ message: 'Tarefa não encontrada.' })
    await db.delete(tasks).where(eq(tasks.id, req.params.id))
    return reply.code(204).send()
  })
}
