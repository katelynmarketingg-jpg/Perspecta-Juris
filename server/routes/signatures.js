import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { signatureRequests } from '../db/schema.js'

const code6 = () => String(Math.floor(100000 + Math.random() * 900000))

// Campos expostos publicamente (sem dados sensíveis do escritório)
function publicView(r) {
  return {
    id: r.id,
    clientName: r.clientName,
    documentos: r.documentos,
    modo: r.modo,
    status: r.status,
    validationCode: r.validationCode,
    createdAt: r.createdAt,
  }
}

export default async function signatureRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // ── Escritório (autenticado) ──────────────────────────────────

  // GET /api/signatures?processId=...
  app.get('/', auth, async (req) => {
    const tid = req.user.tenantId
    const conditions = [eq(signatureRequests.tenantId, tid)]
    if (req.query.processId) conditions.push(eq(signatureRequests.processId, req.query.processId))
    const rows = await db.select().from(signatureRequests)
      .where(and(...conditions)).orderBy(desc(signatureRequests.createdAt))
    return rows
  })

  // POST /api/signatures
  app.post('/', auth, async (req, reply) => {
    const now = new Date().toISOString()
    const id = nanoid()
    const data = {
      id,
      tenantId: req.user.tenantId,
      processId: req.body.processId ?? null,
      clientId: req.body.clientId ?? null,
      clientName: req.body.clientName ?? '',
      clientPhone: req.body.clientPhone ?? '',
      documentos: req.body.documentos ?? [],
      modo: req.body.modo ?? 'link',
      status: 'pendente',
      validationCode: code6(),
      createdBy: req.user.id ?? null,
      createdAt: now, updatedAt: now,
    }
    await db.insert(signatureRequests).values(data)
    const [row] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id)).limit(1)
    return reply.code(201).send(row)
  })

  // DELETE /api/signatures/:id
  app.delete('/:id', auth, async (req, reply) => {
    await db.delete(signatureRequests)
      .where(and(eq(signatureRequests.id, req.params.id), eq(signatureRequests.tenantId, req.user.tenantId)))
    return reply.code(204).send()
  })

  // ── Público (sem autenticação — o cliente assina pelo link) ───

  // GET /api/signatures/public/:id
  app.get('/public/:id', async (req, reply) => {
    const [row] = await db.select().from(signatureRequests)
      .where(eq(signatureRequests.id, req.params.id)).limit(1)
    if (!row) return reply.code(404).send({ message: 'Pedido de assinatura não encontrado.' })
    return publicView(row)
  })

  // POST /api/signatures/public/:id  → cliente envia assinatura + foto
  app.post('/public/:id', async (req, reply) => {
    const [row] = await db.select().from(signatureRequests)
      .where(eq(signatureRequests.id, req.params.id)).limit(1)
    if (!row) return reply.code(404).send({ message: 'Pedido não encontrado.' })
    if (row.status === 'assinado') return reply.code(409).send({ message: 'Este documento já foi assinado.' })

    const { signer, signatureImg, photoImg } = req.body ?? {}
    if (!signer?.nome || !signer?.cpf || !signatureImg || !photoImg) {
      return reply.code(400).send({ message: 'Dados incompletos: nome, CPF, assinatura e foto são obrigatórios.' })
    }
    const now = new Date().toISOString()
    await db.update(signatureRequests).set({
      signerName: signer.nome,
      signerCpf: signer.cpf,
      signatureImg, photoImg,
      status: 'assinado',
      signedAt: now,
      signedIp: req.ip ?? null,
      updatedAt: now,
    }).where(eq(signatureRequests.id, req.params.id))
    return { ok: true, status: 'assinado', signedAt: now }
  })
}
