import { nanoid } from 'nanoid'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { pipeline } from 'stream/promises'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { documents } from '../db/schema.js'

const FILES_BASE = process.env.FILES_DIR ?? './data/files'

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export default async function documentRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const { processId, clientId, type } = req.query
    const tid = req.user.tenantId
    const conditions = [eq(documents.tenantId, tid)]
    if (processId) conditions.push(eq(documents.processId, processId))
    if (clientId)  conditions.push(eq(documents.clientId, clientId))
    if (type)      conditions.push(eq(documents.type, type))
    return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt))
  })

  app.post('/upload', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const parts = req.parts()
    const fields = {}
    const uploadedDocs = []

    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = extname(part.filename)
        const fileId = nanoid()
        const destDir = join(FILES_BASE, tid)
        ensureDir(destDir)
        const filePath = join(destDir, `${fileId}${ext}`)
        await pipeline(part.file, createWriteStream(filePath))

        const now = new Date().toISOString()
        const docId = nanoid()
        await db.insert(documents).values({
          id: docId, tenantId: tid,
          name: part.filename,
          mimeType: part.mimetype,
          filePath: `${tid}/${fileId}${ext}`,
          fileSize: part.file.bytesRead ?? 0,
          type: fields.type ?? null,
          processId: fields.processId ?? null,
          clientId:  fields.clientId ?? null,
          tags: [],
          uploadedBy: req.user.userId,
          createdAt: now, updatedAt: now,
        })
        const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1)
        uploadedDocs.push(doc)
      } else {
        fields[part.fieldname] = part.value
      }
    }

    return reply.code(201).send(uploadedDocs)
  })

  app.get('/:id/download', auth, async (req, reply) => {
    const [doc] = await db.select().from(documents)
      .where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.user.tenantId)))
      .limit(1)
    if (!doc) return reply.code(404).send({ message: 'Documento não encontrado.' })

    const fullPath = join(FILES_BASE, doc.filePath)
    if (!existsSync(fullPath)) return reply.code(404).send({ message: 'Arquivo não encontrado no disco.' })

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}"`)
    reply.header('Content-Type', doc.mimeType)
    return reply.sendFile(doc.filePath, FILES_BASE)
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [doc] = await db.select().from(documents)
      .where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.user.tenantId)))
      .limit(1)
    if (!doc) return reply.code(404).send({ message: 'Documento não encontrado.' })
    await db.delete(documents).where(eq(documents.id, req.params.id))
    return reply.code(204).send()
  })
}
