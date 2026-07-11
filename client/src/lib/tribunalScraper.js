// ─────────────────────────────────────────────────────────────────
// Tribunal Scraper — cliente frontend para as rotas /api/tribunal
// Faz login no portal do tribunal e busca processos autenticados.
// ─────────────────────────────────────────────────────────────────

import api from './api.js'

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

// Login no portal do tribunal via backend (scraping autenticado)
export async function tribunalLogin(tribunal, cpf, password) {
  const res = await fetch('/api/tribunal/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('pj_token') ?? ''}`,
    },
    body: JSON.stringify({ tribunal, cpf, password }),
  })

  const json = await res.json()
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? 'Login falhou')
  }

  saveSession(tribunal, json.sessionId)
  return json.sessionId
}

// Busca processos por OAB no portal (com sessão autenticada se disponível)
export async function fetchTribunalProcesses(tribunal, oabNum, oabUF = 'RS') {
  const stored = getStoredSession(tribunal)
  const params = new URLSearchParams({ tribunal, oabNum, oabUF })
  if (stored?.sessionId) params.set('sessionId', stored.sessionId)

  const res = await fetch(`/api/tribunal/processes?${params}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('pj_token') ?? ''}`,
    },
  })

  const json = await res.json()
  if (!res.ok || !json.ok) {
    // Se sessão expirou, limpa localmente
    if (res.status === 401 || json.message?.includes('sessão')) {
      clearSession(tribunal)
    }
    throw new Error(json.message ?? 'Erro ao buscar processos')
  }

  return json.processes ?? []
}

// Logout de um tribunal
export async function tribunalLogout(tribunal) {
  const stored = getStoredSession(tribunal)
  if (!stored?.sessionId) return

  try {
    await fetch(`/api/tribunal/sessions/${stored.sessionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('pj_token') ?? ''}`,
      },
    })
  } catch {
    // ignora erros de rede no logout
  }

  clearSession(tribunal)
}

// Lista sessões ativas (consulta o backend)
export async function listTribunalSessions() {
  try {
    const res = await fetch('/api/tribunal/sessions', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('pj_token') ?? ''}`,
      },
    })
    if (!res.ok) return {}
    const json = await res.json()
    return json.sessions ?? {}
  } catch {
    return {}
  }
}

// Importa processos do tribunal para o localStorage local
export function importTribunalProcesses(processes) {
  const LS_KEY = 'pj_local_processes'
  const lsProc = lsGet(LS_KEY, [])
  const existingNums = new Set(lsProc.map(p => p.judicialNumber).filter(Boolean))

  const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)

  const toAdd = processes.filter(p => p.judicialNumber && !existingNums.has(p.judicialNumber))
    .map(p => ({
      id: 'proc_' + uid(),
      tenantId: 'tenant_demo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...p,
    }))

  if (toAdd.length > 0) {
    lsSet(LS_KEY, [...lsProc, ...toAdd])
  }

  return { added: toAdd.length, skipped: processes.length - toAdd.length }
}
