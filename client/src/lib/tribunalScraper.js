// ─────────────────────────────────────────────────────────────────
// Tribunal Scraper — cliente frontend para as rotas /api/tribunal
// Faz login no portal do tribunal e busca processos autenticados.
// ─────────────────────────────────────────────────────────────────

import api from './api.js'
import { currentTenantId } from './tenant'

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v)  => localStorage.setItem(k, JSON.stringify(v))

// Persiste sessões ativas por tribunal no localStorage (cache local)
const SESSION_KEY = 'pj_tribunal_sessions'

function getSessions() {
  return lsGet(SESSION_KEY, {})
}

function saveSession(tribunal, sessionId) {
  const all = getSessions()
  all[tribunal] = { sessionId, createdAt: new Date().toISOString() }
  lsSet(SESSION_KEY, all)
}

function clearSession(tribunal) {
  const all = getSessions()
  delete all[tribunal]
  lsSet(SESSION_KEY, all)
}

export function getStoredSession(tribunal) {
  return getSessions()[tribunal] ?? null
}

// ─────────────────────────────────────────────────────────────────
// Estas quatro funções chamavam `fetch` na mão e liam o token de
// `localStorage.pj_token` — chave que NÃO existe: o token fica em
// `pj_access_token`. Ou seja, iam sempre sem credencial, e o servidor
// respondia 401 antes de qualquer coisa. Nenhuma versão desta tela chegou a
// entrar em tribunal nenhum.
//
// Agora passam pelo `api`, que é quem sabe o nome da chave, renova o token
// vencido e traz a mensagem de erro do servidor em vez de um 401 mudo.
// ─────────────────────────────────────────────────────────────────

// Login no portal do tribunal via backend (scraping autenticado)
export async function tribunalLogin(tribunal, cpf, password) {
  const json = await api.post('/api/tribunal/login', { tribunal, cpf, password })
  if (!json?.ok || !json.sessionId) {
    throw new Error(json?.message ?? 'O tribunal não confirmou a entrada.')
  }
  saveSession(tribunal, json.sessionId)
  return json.sessionId
}

// Busca processos por OAB no portal (com sessão autenticada se disponível)
export async function fetchTribunalProcesses(tribunal, oabNum, oabUF = 'RS') {
  const stored = getStoredSession(tribunal)
  const params = new URLSearchParams({ tribunal, oabNum, oabUF })
  if (stored?.sessionId) params.set('sessionId', stored.sessionId)

  let json
  try {
    json = await api.get(`/api/tribunal/processes?${params}`)
  } catch (e) {
    // Sessão vencida do lado do tribunal: limpa o cache local para a tela
    // voltar a pedir a senha, em vez de insistir com uma sessão morta.
    if (e?.status === 401 || /sess/i.test(e?.message ?? '')) clearSession(tribunal)
    throw new Error(e?.message ?? 'Erro ao buscar processos no tribunal.')
  }
  if (!json?.ok) throw new Error(json?.message ?? 'Erro ao buscar processos no tribunal.')

  return json.processes ?? []
}

// Logout de um tribunal
export async function tribunalLogout(tribunal) {
  const stored = getStoredSession(tribunal)
  if (!stored?.sessionId) return

  try {
    await api.delete(`/api/tribunal/sessions/${stored.sessionId}`)
  } catch {
    // Sessão já pode ter vencido no servidor. O que importa é soltar daqui.
  }

  clearSession(tribunal)
}

// Lista sessões ativas (consulta o backend)
export async function listTribunalSessions() {
  try {
    const json = await api.get('/api/tribunal/sessions')
    return json?.sessions ?? {}
  } catch {
    return {}
  }
}

// Importa para o BANCO os processos trazidos do portal do tribunal.
// Antes gravava em pj_local_processes (localStorage): o que o scraper trazia
// existia só naquele navegador e nunca chegava ao servidor.
export async function importTribunalProcesses(processes) {
  let existentes = []
  try {
    const r = await api.processes.list({ limit: 500 })
    existentes = Array.isArray(r) ? r : (r?.data ?? [])
  } catch {
    throw new Error('Sem conexão com o servidor — nenhum processo foi importado.')
  }
  const jaTem = new Set(existentes.map(p => p.judicialNumber).filter(Boolean))

  let added = 0, skipped = 0
  const falhas = []
  for (const p of processes) {
    if (!p.judicialNumber || jaTem.has(p.judicialNumber)) { skipped++; continue }
    try {
      // id/tenantId/datas são do servidor.
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, ...campos } = p
      await api.processes.create(campos)
      jaTem.add(p.judicialNumber)
      added++
    } catch (e) {
      falhas.push(`${p.judicialNumber}: ${e?.message ?? 'erro'}`)
    }
  }
  return { added, skipped, falhas }
}
