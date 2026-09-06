// ─────────────────────────────────────────────────────────────────────────
//  Diário Oficial — proxy server-side para a API pública DJEN (CNJ).
//  Evita CORS no navegador em produção.
// ─────────────────────────────────────────────────────────────────────────

import { registrarUso, TIPOS } from '../lib/usage.js'

// DJEN_URL existe para os testes apontarem para um servidor controlado —
// só assim dá para exercitar várias páginas e falha no meio. Em produção
// a variável não é definida e vale o endereço do CNJ.
const DJEN = process.env.DJEN_URL || 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// O DJEN aceita até 100 itens por página. Menos páginas, menos consultas.
const POR_PAGINA = 100
// Um teto para não varrer o Diário inteiro por engano: 20 páginas são 2.000
// publicações. Chegando lá, a resposta AVISA em vez de fingir que acabou.
const MAX_PAGINAS = 20

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

  // GET /api/diario/publicacoes?oab=&uf=&numeroProcesso=&dataInicio=&dataFim=&dias=
  //
  // Antes esta rota pedia `pagina: '1'` com 50 itens e parava ali. Um escritório
  // com mais de 50 publicações no período perdia o resto EM SILÊNCIO — nada na
  // tela dizia que faltava alguma coisa. Num sistema de prazo, publicação que
  // some é prazo que se perde.
  //
  // Agora percorre as páginas até acabar, e a resposta diz quantas vieram, de
  // que período, e se parou por limite.
  app.get('/publicacoes', auth, async (req, reply) => {
    const { oab, uf, numeroProcesso, dataInicio, dataFim, nome, dias } = req.query

    const janela = Math.min(365, Math.max(1, parseInt(dias ?? '', 10) || (numeroProcesso ? 365 : 30)))
    const de  = dataInicio || isoDaysAgo(janela)
    const ate = dataFim || isoDaysAgo(0)

    const base = new URLSearchParams({
      dataDisponibilizacaoInicio: de,
      dataDisponibilizacaoFim: ate,
      itensPorPagina: String(POR_PAGINA),
    })
    if (numeroProcesso) {
      base.set('numeroProcesso', String(numeroProcesso).replace(/\D/g, ''))
    } else {
      if (!oab || !uf) return reply.code(400).send({ message: 'Informe OAB e UF, ou o número do processo.' })
      base.set('numeroOab', String(oab).replace(/\D/g, ''))
      base.set('ufOab', uf)
      if (nome) base.set('nomeAdvogado', nome)
    }

    const itens = []
    const vistos = new Set()
    let pagina = 1, truncado = false, motivo = null

    try {
      while (pagina <= MAX_PAGINAS) {
        base.set('pagina', String(pagina))

        // Cada página é uma consulta ao CNJ: contar só a primeira esconderia o
        // consumo real de quem tem muita publicação.
        await registrarUso(req.user.tenantId, TIPOS.DJEN, 1,
          { oab: oab ?? null, uf: uf ?? null, processo: numeroProcesso ?? null, pagina },
          req.user.userId)

        const res = await fetch(`${DJEN}?${base.toString()}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) {
          // Já trouxe alguma coisa? Devolve o que tem e avisa, em vez de perder
          // tudo por causa da página 3.
          if (itens.length) { truncado = true; motivo = `o DJEN retornou ${res.status}`; break }
          return reply.code(502).send({ message: `DJEN retornou ${res.status}.` })
        }

        const data = await res.json()
        const bruto = data?.items ?? data?.content ?? data ?? []
        const lote = Array.isArray(bruto) ? bruto : []
        if (!lote.length) break

        for (const it of lote) {
          const n = normalizar(it)
          // O DJEN às vezes repete o mesmo item entre páginas.
          if (n.id && vistos.has(n.id)) continue
          if (n.id) vistos.add(n.id)
          itens.push(n)
        }

        if (lote.length < POR_PAGINA) break   // última página
        if (pagina === MAX_PAGINAS) { truncado = true; motivo = 'limite'; break }
        pagina++
      }

      return responder()
    } catch (err) {
      // Sem nada em mãos, devolver lista vazia seria mentir que não há
      // publicação nenhuma no período — o pior erro possível aqui.
      if (!itens.length) return reply.code(502).send({ message: 'Falha ao consultar o DJEN: ' + err.message })
      truncado = true
      motivo = `a consulta falhou (${err.message})`
      return responder()
    }

    function responder() {
      return {
        data: itens,
        periodo: { de, ate, dias: janela },
        total: itens.length,
        paginas: pagina,
        truncado,
        aviso: !truncado ? null
          : motivo === 'limite'
            ? `Foram trazidas ${itens.length} publicações em ${MAX_PAGINAS} páginas e ainda há mais no período. Reduza o intervalo de datas para ver o restante.`
            : `A busca parou na página ${pagina}: ${motivo}. Estas ${itens.length} publicações vieram antes disso — pode haver mais. Reduza o intervalo de datas e tente de novo.`,
      }
    }
  })
}
