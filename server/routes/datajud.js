// Proxy do DataJud (CNJ) — API pública NACIONAL de processos.
// O cliente chamava '/datajud/...', que só existe no proxy do modo de
// desenvolvimento; em produção a busca falhava em silêncio. Aqui o servidor
// repassa a consulta e injeta a chave (que assim não vai para o navegador).
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenants } from '../db/schema.js'

const DATAJUD = 'https://api-publica.datajud.cnj.jus.br'
const CHAVE_PADRAO = 'cDZHYzlZa0JadVREZDJCendBdUFWZz09cDZHYzlZa0JadVREZDJCendBdUFWZz09'

// Só letras e números: evita que alguém monte uma URL para outro destino.
const TRIBUNAL_OK = /^[a-z0-9]{3,12}$/

// A chave do escritório (Configurações → Integrações) tem prioridade sobre a
// variável de ambiente e sobre a chave padrão (que o CNJ pode invalidar).
async function chaveDoEscritorio(tenantId) {
  try {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    const k = t?.settings?.config?.pj_cfg_datajud_key
    return (typeof k === 'string' && k.trim()) ? k.trim() : null
  } catch { return null }
}

export default async function datajudRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // POST /api/datajud/:tribunal/_search   (ex.: tjsp, trt4, tjrs)
  app.post('/:tribunal/_search', auth, async (req, reply) => {
    const tribunal = String(req.params.tribunal ?? '').toLowerCase()
    if (!TRIBUNAL_OK.test(tribunal)) {
      return reply.code(400).send({ message: 'Tribunal inválido.' })
    }

    const chave = (await chaveDoEscritorio(req.user.tenantId)) || process.env.DATAJUD_KEY || CHAVE_PADRAO
    try {
      const res = await fetch(`${DATAJUD}/api_publica_${tribunal}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `APIKey ${chave}`,
        },
        body: JSON.stringify(req.body ?? {}),
      })
      const texto = await res.text()
      if (!res.ok) {
        // 401/403 = chave recusada pelo CNJ. Mensagem clara em vez de "não achou nada".
        if (res.status === 401 || res.status === 403) {
          return reply.code(424).send({
            message: 'O CNJ recusou a chave do DataJud. Cadastre a chave pública atual em Configurações → Integrações.',
            comoResolver: 'A chave é gratuita e publicada pelo CNJ em datajud-wiki.cnj.jus.br (API Pública → Acesso).',
            origem: 'datajud',
          })
        }
        return reply.code(res.status).send({ message: `DataJud respondeu ${res.status}.`, detalhe: texto.slice(0, 300) })
      }
      reply.header('Content-Type', 'application/json')
      return reply.send(texto)
    } catch (e) {
      return reply.code(502).send({ message: 'Não foi possível consultar o DataJud agora.', detalhe: String(e?.message ?? e) })
    }
  })
}
