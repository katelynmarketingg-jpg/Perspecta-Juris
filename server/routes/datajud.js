// Proxy do DataJud (CNJ) — API pública NACIONAL de processos.
// O cliente chamava '/datajud/...', que só existe no proxy do modo de
// desenvolvimento; em produção a busca falhava em silêncio. Aqui o servidor
// repassa a consulta e injeta a chave (que assim não vai para o navegador).
const DATAJUD = 'https://api-publica.datajud.cnj.jus.br'
const CHAVE_PADRAO = 'cDZHYzlZa0JadVREZDJCendBdUFWZz09cDZHYzlZa0JadVREZDJCendBdUFWZz09'

// Só letras e números: evita que alguém monte uma URL para outro destino.
const TRIBUNAL_OK = /^[a-z0-9]{3,12}$/

export default async function datajudRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // POST /api/datajud/:tribunal/_search   (ex.: tjsp, trt4, tjrs)
  app.post('/:tribunal/_search', auth, async (req, reply) => {
    const tribunal = String(req.params.tribunal ?? '').toLowerCase()
    if (!TRIBUNAL_OK.test(tribunal)) {
      return reply.code(400).send({ message: 'Tribunal inválido.' })
    }

    const chave = process.env.DATAJUD_KEY || CHAVE_PADRAO
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
        return reply.code(res.status).send({ message: `DataJud respondeu ${res.status}.`, detalhe: texto.slice(0, 300) })
      }
      reply.header('Content-Type', 'application/json')
      return reply.send(texto)
    } catch (e) {
      return reply.code(502).send({ message: 'Não foi possível consultar o DataJud agora.', detalhe: String(e?.message ?? e) })
    }
  })
}
