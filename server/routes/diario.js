// ─────────────────────────────────────────────────────────────────────────
//  Diário Oficial — proxy server-side para a API pública DJEN (CNJ).
//  Evita CORS no navegador em produção.
// ─────────────────────────────────────────────────────────────────────────

const DJEN = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

function normalizar(it) {
  return {
    id: it.id ?? it.hash ?? `${it.numeroComunicacao ?? ''}-${it.dataDisponibilizacao ?? ''}`,
    processo: it.numeroProcesso ?? it.numeroprocessocommascara ?? '',
    tribunal: it.siglaTribunal ?? '',
    orgao: it.nomeOrgao ?? '',
    tipo: it.tipoComunicacao ?? it.tipoDocumento ?? 'Publicação',
    data: it.dataDisponibilizacao ?? '',
    texto: (it.texto ?? it.teor ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    destinatarios: (it.destinatarios ?? it.destinatarioadvogados ?? [])
      .map(d => d?.nome ?? d?.advogado?.nome ?? '').filter(Boolean),
  }
}

export default async function diarioRoutes(app) {
  const auth = { preHandler: [app.authenticate] }

  // GET /api/diario/publicacoes?oab=&uf=&numeroProcesso=&dataInicio=&dataFim=
  app.get('/publicacoes', auth, async (req, reply) => {
    const { oab, uf, numeroProcesso, dataInicio, dataFim, nome } = req.query
    const params = new URLSearchParams({
      dataDisponibilizacaoInicio: dataInicio || isoDaysAgo(numeroProcesso ? 365 : 30),
      dataDisponibilizacaoFim: dataFim || isoDaysAgo(0),
      pagina: '1', itensPorPagina: '50',
    })
    if (numeroProcesso) {
      params.set('numeroProcesso', String(numeroProcesso).replace(/\D/g, ''))
    } else {
      if (!oab || !uf) return reply.code(400).send({ message: 'Informe OAB e UF, ou o número do processo.' })
      params.set('numeroOab', String(oab).replace(/\D/g, ''))
      params.set('ufOab', uf)
      if (nome) params.set('nomeAdvogado', nome)
    }

    try {
      const res = await fetch(`${DJEN}?${params.toString()}`, { headers: { Accept: 'application/json' } })
      if (!res.ok) return reply.code(502).send({ message: `DJEN retornou ${res.status}.` })
      const data = await res.json()
      const itens = data?.items ?? data?.content ?? data ?? []
      return { data: (Array.isArray(itens) ? itens : []).map(normalizar) }
    } catch (err) {
      return reply.code(502).send({ message: 'Falha ao consultar o DJEN: ' + err.message })
    }
  })
}
