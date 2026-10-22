import { nanoid } from 'nanoid'
import { createWriteStream, existsSync, mkdirSync, statSync, rmSync } from 'fs'
import { join, extname } from 'path'
import { pipeline } from 'stream/promises'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { documents } from '../db/schema.js'
import { registrarUso, TIPOS } from '../lib/usage.js'

const FILES_BASE = process.env.FILES_DIR ?? './data/files'

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export default async function documentRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const { processId, clientId, type, folder } = req.query
    const tid = req.user.tenantId
    const conditions = [eq(documents.tenantId, tid)]
    if (processId) conditions.push(eq(documents.processId, processId))
    if (clientId)  conditions.push(eq(documents.clientId, clientId))
    if (type)      conditions.push(eq(documents.type, type))
    if (folder)    conditions.push(eq(documents.folder, folder))
    return db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt))
  })

  app.post('/upload', auth, async (req, reply) => {
    const tid = req.user.tenantId
    const fields = {}
    const gravados = []

    // Duas passadas de propósito. Antes a linha era gravada DENTRO do laço,
    // lendo `fields` — que só está completo no fim. Como o navegador manda o
    // arquivo primeiro e os campos depois (é a ordem natural do FormData),
    // clientId, pasta e tipo chegavam vazios e o documento nascia solto, sem
    // cliente e sem pasta. Agora o arquivo vai para o disco na hora, mas a
    // linha só é criada quando já se sabe a que ela pertence.
    for await (const part of req.parts()) {
      if (part.type !== 'file') { fields[part.fieldname] = part.value; continue }

      const ext = extname(part.filename)
      const fileId = nanoid()
      const destDir = join(FILES_BASE, tid)
      ensureDir(destDir)
      const filePath = join(destDir, `${fileId}${ext}`)
      await pipeline(part.file, createWriteStream(filePath))

      // Tamanho real, lido do disco depois de gravar. Antes usava
      // part.file.bytesRead, que nem sempre existe no stream do multipart e
      // gravava 0 — o que tornava impossível medir GB por escritório.
      let fileSize = 0
      try { fileSize = statSync(filePath).size } catch { /* fica 0 */ }

      gravados.push({ nome: part.filename, mime: part.mimetype, rel: `${tid}/${fileId}${ext}`, fileSize })
    }

    const uploadedDocs = []
    for (const g of gravados) {
      const now = new Date().toISOString()
      const docId = nanoid()
      await db.insert(documents).values({
        id: docId, tenantId: tid,
        name: g.nome,
        mimeType: g.mime,
        filePath: g.rel,
        fileSize: g.fileSize,
        type: fields.type || null,
        folder: fields.folder || null,
        processId: fields.processId || null,
        clientId:  fields.clientId || null,
        tags: [],
        uploadedBy: req.user.userId,
        createdAt: now, updatedAt: now,
      })
      const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1)
      uploadedDocs.push(doc)

      // Medidor de armazenamento.
      await registrarUso(tid, TIPOS.DOCUMENTO, g.fileSize, { nome: g.nome }, req.user.userId)
    }

    if (!uploadedDocs.length) return reply.code(400).send({ message: 'Nenhum arquivo foi enviado.' })
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

  // Mover de pasta e renomear. A aba Documentos do cliente arrasta arquivos
  // entre pastas; sem isto a pasta era só enfeite do navegador.
  app.patch('/:id', auth, async (req, reply) => {
    const [doc] = await db.select().from(documents)
      .where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.user.tenantId)))
      .limit(1)
    if (!doc) return reply.code(404).send({ message: 'Documento não encontrado.' })

    const mudanca = {}
    if (req.body?.folder !== undefined) mudanca.folder = req.body.folder || null
    if (typeof req.body?.name === 'string' && req.body.name.trim()) mudanca.name = req.body.name.trim()
    if (!Object.keys(mudanca).length) return reply.code(400).send({ message: 'Nada para alterar.' })

    mudanca.updatedAt = new Date().toISOString()
    await db.update(documents).set(mudanca).where(eq(documents.id, req.params.id))
    const [novo] = await db.select().from(documents).where(eq(documents.id, req.params.id)).limit(1)
    return novo
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [doc] = await db.select().from(documents)
      .where(and(eq(documents.id, req.params.id), eq(documents.tenantId, req.user.tenantId)))
      .limit(1)
    if (!doc) return reply.code(404).send({ message: 'Documento não encontrado.' })
    await db.delete(documents).where(eq(documents.id, req.params.id))
    // Apagar a linha e deixar o arquivo no disco enchia os 2 GB com documentos
    // que ninguém mais vê. O caminho vem do nosso próprio banco.
    try { rmSync(join(FILES_BASE, doc.filePath), { force: true }) } catch { /* já não existe */ }
    return reply.code(204).send()
  })
}
