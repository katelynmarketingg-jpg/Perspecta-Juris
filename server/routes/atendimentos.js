// ─────────────────────────────────────────────────────────────────────────
//  Fila de atendimento e histórico de atendimentos.
//
//  Vivia em `localStorage`, e num escritório com recepção isso não serve:
//  quem cadastra é o único que enxerga a fila. O campo "atender com" já
//  existia na tela e não adiantava nada, porque a pessoa escolhida nunca
//  via o chamado — ele estava no navegador da recepção.
//
//  Agora a fila é do escritório: todo mundo vê a mesma, de qualquer
//  computador, e o histórico de cada cliente fica junto com ele.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { serviceVisits, clients, users } from '../db/schema.js'

const TIPOS = new Set(['presencial', 'online', 'whatsapp', 'telefone'])
const STATUS = new Set(['fila', 'atendido'])

const COLUNAS = {
  id: serviceVisits.id,
  clientId: serviceVisits.clientId,
  clientName: serviceVisits.clientName,
  assignedToId: serviceVisits.assignedToId,
  assignedToName: serviceVisits.assignedToName,
  tipo: serviceVisits.tipo,
  obs: serviceVisits.obs,
  status: serviceVisits.status,
  createdAt: serviceVisits.createdAt,
  createdById: serviceVisits.createdById,
  createdByName: serviceVisits.createdByName,
  attendedAt: serviceVisits.attendedAt,
  attendedById: serviceVisits.attendedById,
  attendedByName: serviceVisits.attendedByName,
}

// Nome atual do acesso quando ele ainda existe; o congelado quando não.
async function nomeDoUsuario(id, tenantId) {
  if (!id) return null
  const [u] = await db.select({ name: users.name }).from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId))).limit(1)
  return u?.name ?? null
}

export default async function atendimentoRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/atendimentos?status=fila&clientId=&de=&ate=&atendidoPor=
  app.get('/', auth, async (req) => {
    const cond = [eq(serviceVisits.tenantId, req.user.tenantId)]
    if (req.query.status && STATUS.has(req.query.status)) cond.push(eq(serviceVisits.status, req.query.status))
    if (req.query.clientId)    cond.push(eq(serviceVisits.clientId, req.query.clientId))
    if (req.query.atendidoPor) cond.push(eq(serviceVisits.attendedById, req.query.atendidoPor))
    if (req.query.para)        cond.push(eq(serviceVisits.assignedToId, req.query.para))

    // A fila sai por ordem de chegada; o histórico, do mais recente.
    const naFila = req.query.status === 'fila'
    const linhas = await db.select(COLUNAS).from(serviceVisits).where(and(...cond))
      .orderBy(naFila ? asc(serviceVisits.createdAt) : desc(serviceVisits.createdAt))

    const de  = req.query.de  ? String(req.query.de)  : null
    const ate = req.query.ate ? String(req.query.ate) + 'T23:59:59' : null
    if (!de && !ate) return linhas
    // O período filtra pela data do ATENDIMENTO quando houver; senão, pela
    // da chegada — senão um atendimento de ontem concluído hoje sumiria.
    return linhas.filter(l => {
      const quando = l.attendedAt || l.createdAt
      return (!de || quando >= de) && (!ate || quando <= ate)
    })
  })

  app.post('/', auth, async (req, reply) => {
    const b = req.body ?? {}
    const nome = String(b.clientName ?? '').trim()
    if (!nome) return reply.code(400).send({ message: 'Informe o cliente ou o nome de quem chegou.' })

    // Vincular a cliente de outra empresa ligaria o atendimento à ficha de
    // quem não é cliente dela.
    if (b.clientId) {
      const [c] = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.id, b.clientId), eq(clients.tenantId, req.user.tenantId))).limit(1)
      if (!c) return reply.code(400).send({ message: 'Cliente não encontrado.' })
    }
    let assignedToName = null
    if (b.assignedToId) {
      assignedToName = await nomeDoUsuario(b.assignedToId, req.user.tenantId)
      if (!assignedToName) return reply.code(400).send({ message: 'Acesso escolhido não encontrado.' })
    }

    const status = STATUS.has(b.status) ? b.status : 'fila'
    const now = new Date().toISOString()
    const eu = await nomeDoUsuario(req.user.userId, req.user.tenantId)
    const id = nanoid()
    await db.insert(serviceVisits).values({
      id, tenantId: req.user.tenantId,
      clientId: b.clientId || null,
      clientName: nome,
      assignedToId: b.assignedToId || null,
      assignedToName,
      tipo: TIPOS.has(b.tipo) ? b.tipo : 'presencial',
      obs: b.obs ? String(b.obs) : null,
      status,
      createdAt: now, createdById: req.user.userId, createdByName: eu,
      // Atendimento já concluído (online, WhatsApp respondido) entra pronto.
      attendedAt:     status === 'atendido' ? now : null,
      attendedById:   status === 'atendido' ? req.user.userId : null,
      attendedByName: status === 'atendido' ? eu : null,
      updatedAt: now,
    })
    const [linha] = await db.select(COLUNAS).from(serviceVisits).where(eq(serviceVisits.id, id)).limit(1)
    return reply.code(201).send(linha)
  })

  // Chamar alguém da fila. Quem clica é quem atendeu — não o que estava
  // escrito em "atender com", que é só uma preferência da recepção.
  app.put('/:id/atender', auth, async (req, reply) => {
    const [atual] = await db.select({ id: serviceVisits.id, status: serviceVisits.status })
      .from(serviceVisits)
      .where(and(eq(serviceVisits.id, req.params.id), eq(serviceVisits.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Atendimento não encontrado.' })
    if (atual.status === 'atendido') return reply.code(409).send({ message: 'Este atendimento já foi concluído por outra pessoa.' })

    const now = new Date().toISOString()
    const eu = await nomeDoUsuario(req.user.userId, req.user.tenantId)
    await db.update(serviceVisits)
      .set({ status: 'atendido', attendedAt: now, attendedById: req.user.userId, attendedByName: eu, updatedAt: now })
      .where(eq(serviceVisits.id, req.params.id))
    const [linha] = await db.select(COLUNAS).from(serviceVisits).where(eq(serviceVisits.id, req.params.id)).limit(1)
    return linha
  })

  app.put('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: serviceVisits.id }).from(serviceVisits)
      .where(and(eq(serviceVisits.id, req.params.id), eq(serviceVisits.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Atendimento não encontrado.' })

    const b = req.body ?? {}
    const campos = { updatedAt: new Date().toISOString() }
    if (b.obs !== undefined)  campos.obs = b.obs ? String(b.obs) : null
    if (b.tipo !== undefined && TIPOS.has(b.tipo)) campos.tipo = b.tipo
    if (b.assignedToId !== undefined) {
      campos.assignedToId = b.assignedToId || null
      campos.assignedToName = b.assignedToId ? await nomeDoUsuario(b.assignedToId, req.user.tenantId) : null
      if (b.assignedToId && !campos.assignedToName) return reply.code(400).send({ message: 'Acesso escolhido não encontrado.' })
    }
    if (Object.keys(campos).length === 1) return reply.code(400).send({ message: 'Nada para alterar.' })

    await db.update(serviceVisits).set(campos).where(eq(serviceVisits.id, req.params.id))
    const [linha] = await db.select(COLUNAS).from(serviceVisits).where(eq(serviceVisits.id, req.params.id)).limit(1)
    return linha
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: serviceVisits.id }).from(serviceVisits)
      .where(and(eq(serviceVisits.id, req.params.id), eq(serviceVisits.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Atendimento não encontrado.' })
    await db.delete(serviceVisits).where(eq(serviceVisits.id, req.params.id))
    return reply.code(204).send()
  })
}
