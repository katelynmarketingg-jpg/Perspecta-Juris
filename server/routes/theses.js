// ─────────────────────────────────────────────────────────────────────────
//  Teses do escritório.
//
//  A tabela `legal_theses` existia desde o início, mas sem rota nenhuma: a
//  Área de Trabalho do cliente lia `pj_local_theses` do navegador, uma chave
//  que NADA no sistema escrevia. O resultado era um beco sem saída — o botão
//  "+ Vincular" abria uma lista que nunca ia ter nada, dizendo "crie na aba
//  Teses", e a aba Teses é o Vade Mecum, que não salva tese.
//
//  Agora a tese é do escritório, fica no banco e aparece em qualquer
//  computador.
// ─────────────────────────────────────────────────────────────────────────
import { nanoid } from 'nanoid'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { legalTheses } from '../db/schema.js'

const CAMPOS = ['title', 'area', 'subArea', 'content', 'tags', 'source', 'isPublic']

function limpar(body) {
  const out = {}
  for (const c of CAMPOS) if (body?.[c] !== undefined) out[c] = body[c]
  if (out.tags !== undefined && !Array.isArray(out.tags)) out.tags = []
  return out
}

export default async function thesesRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const cond = [eq(legalTheses.tenantId, req.user.tenantId)]
    if (req.query.area) cond.push(eq(legalTheses.area, req.query.area))
    const linhas = await db.select().from(legalTheses).where(and(...cond)).orderBy(desc(legalTheses.createdAt))

    const busca = String(req.query.q ?? '').trim().toLowerCase()
    if (!busca) return linhas
    return linhas.filter(t =>
      `${t.title} ${t.content} ${(t.tags ?? []).join(' ')}`.toLowerCase().includes(busca))
  })

  app.post('/', auth, async (req, reply) => {
    const campos = limpar(req.body)
    if (!campos.title?.trim())   return reply.code(400).send({ message: 'Informe o título da tese.' })
    if (!campos.content?.trim()) return reply.code(400).send({ message: 'Informe o conteúdo da tese.' })

    const now = new Date().toISOString()
    const id = nanoid()
    await db.insert(legalTheses).values({
      id, tenantId: req.user.tenantId,
      area: campos.area || 'geral',
      tags: Array.isArray(campos.tags) ? campos.tags : [],
      ...campos,
      title: campos.title.trim(),
      createdBy: req.user.userId, createdAt: now, updatedAt: now,
    })
    const [linha] = await db.select().from(legalTheses).where(eq(legalTheses.id, id)).limit(1)
    return reply.code(201).send(linha)
  })

  app.put('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: legalTheses.id }).from(legalTheses)
      .where(and(eq(legalTheses.id, req.params.id), eq(legalTheses.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Tese não encontrada.' })

    const campos = limpar(req.body)
    if (!Object.keys(campos).length) return reply.code(400).send({ message: 'Nada para alterar.' })
    await db.update(legalTheses).set({ ...campos, updatedAt: new Date().toISOString() })
      .where(eq(legalTheses.id, req.params.id))
    const [linha] = await db.select().from(legalTheses).where(eq(legalTheses.id, req.params.id)).limit(1)
    return linha
  })

  app.delete('/:id', auth, async (req, reply) => {
    const [atual] = await db.select({ id: legalTheses.id }).from(legalTheses)
      .where(and(eq(legalTheses.id, req.params.id), eq(legalTheses.tenantId, req.user.tenantId))).limit(1)
    if (!atual) return reply.code(404).send({ message: 'Tese não encontrada.' })
    await db.delete(legalTheses).where(eq(legalTheses.id, req.params.id))
    return reply.code(204).send()
  })
}
