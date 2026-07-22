import { getCfg, setCfg } from './tenantData'
// ─────────────────────────────────────────────────────────────────────────
//  Diário Oficial — DJEN (Diário de Justiça Eletrônico Nacional / CNJ)
//  Consulta pública de intimações e publicações por OAB.
//  Em dev usa o proxy /comunica (vite.config.js). Em produção, aponte para
//  um backend que faça o mesmo proxy (evita CORS).
// ─────────────────────────────────────────────────────────────────────────


// yyyy-mm-dd de N dias atrás
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

/**
 * Busca publicações/intimações no DJEN por OAB.
 * @param {{oab:string, uf:string, dataInicio?:string, dataFim?:string, nome?:string}} params
 * @returns {Promise<Array>} lista normalizada de publicações
 */
export async function fetchPublicacoes({ oab, uf, dataInicio, dataFim, nome, numeroProcesso } = {}) {
  if (!numeroProcesso && (!oab || !uf)) {
    throw new Error('Informe o número da OAB e a UF (ou o número do processo).')
  }

  // 1) Preferir o backend (evita CORS em produção e centraliza o proxy)
  try {
    const token = localStorage.getItem('pj_access_token')
    const qp = new URLSearchParams()
    if (numeroProcesso) qp.set('numeroProcesso', numeroProcesso)
    else { qp.set('oab', oab); qp.set('uf', uf); if (nome) qp.set('nome', nome) }
    if (dataInicio) qp.set('dataInicio', dataInicio)
    if (dataFim) qp.set('dataFim', dataFim)
    const res = await fetch(`/api/diario/publicacoes?${qp.toString()}`, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (res.ok) {
      const j = await res.json()
      // Backend já devolve normalizado em { data: [...] }
      if (Array.isArray(j?.data)) return j.data
    }
    // 5xx / proxy vazio (backend offline) → cai para o proxy direto abaixo
  } catch { /* backend indisponível — usa proxy direto */ }

  // 2) Fallback: proxy direto do Vite (funciona em dev)
  const params = new URLSearchParams({
    dataDisponibilizacaoInicio: dataInicio || isoDaysAgo(numeroProcesso ? 365 : 30),
    dataDisponibilizacaoFim: dataFim || isoDaysAgo(0),
    pagina: '1',
    itensPorPagina: '50',
  })
  if (numeroProcesso) {
    params.set('numeroProcesso', String(numeroProcesso).replace(/\D/g, ''))
  } else {
    params.set('numeroOab', String(oab).replace(/\D/g, ''))
    params.set('ufOab', uf)
    if (nome) params.set('nomeAdvogado', nome)
  }
  // Passa pelo servidor (/api/diario/publicacoes). O caminho '/comunica' só
  // existe no modo de desenvolvimento e quebrava em produção.
  const res = await fetch(`/api/diario/publicacoes?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      ...(localStorage.getItem('pj_access_token') ? { Authorization: `Bearer ${localStorage.getItem('pj_access_token')}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Diário retornou ${res.status}. Tente novamente mais tarde.`)
  const data = await res.json()
  const itens = data?.items ?? data?.content ?? data ?? []
  return (Array.isArray(itens) ? itens : []).map(normalizar)
}

function normalizar(it) {
  return {
    id: it.id ?? it.hash ?? `${it.numeroComunicacao ?? ''}-${it.dataDisponibilizacao ?? ''}`,
    processo: it.numeroProcesso ?? it.numero_processo ?? it.numeroprocessocommascara ?? '',
    tribunal: it.siglaTribunal ?? it.sigla_tribunal ?? '',
    orgao: it.nomeOrgao ?? it.nomeorgao ?? '',
    tipo: it.tipoComunicacao ?? it.tipoDocumento ?? 'Publicação',
    data: it.dataDisponibilizacao ?? it.data_disponibilizacao ?? '',
    texto: (it.texto ?? it.teor ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    destinatarios: (it.destinatarios ?? it.destinatarioadvogados ?? [])
      .map(d => d?.nome ?? d?.advogado?.nome ?? '').filter(Boolean),
    raw: it,
  }
}

// Config de OAB (compartilha as chaves já usadas na aba Integrações)
export function getOabConfig() {
  return {
    oab: getCfg('pj_cfg_oab', ''),
    uf: getCfg('pj_cfg_oab_uf', 'RS'),
    nome: getCfg('pj_cfg_adv_nome', ''),
  }
}
export function saveOabConfig({ oab, uf, nome }) {
  if (oab != null) setCfg('pj_cfg_oab', oab)
  if (uf != null) setCfg('pj_cfg_oab_uf', uf)
  if (nome != null) setCfg('pj_cfg_adv_nome', nome)
}

// Marca publicações já vistas / vinculadas (para não repetir)
const SEEN_KEY = 'pj_djen_seen'
export function getSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') } catch { return [] } }
export function markSeen(id) {
  const s = new Set(getSeen()); s.add(id)
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s]))
}
