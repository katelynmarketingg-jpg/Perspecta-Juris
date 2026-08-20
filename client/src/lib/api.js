import { localHandle } from './localDb'

const BASE = import.meta.env.VITE_API_URL ?? ''

// ─────────────────────────────────────────────────────────────────────────
//  Modo offline — regra de ouro
//
//  LEITURA (GET) pode cair no cache local quando o servidor não responde:
//  é melhor ver o que já se tinha do que uma tela em branco.
//
//  ESCRITA (POST/PUT/PATCH/DELETE) NUNCA cai no local. Antes caía, em
//  silêncio: com o servidor fora do ar a pessoa cadastrava clientes,
//  lançamentos e prazos o dia inteiro achando que estava tudo salvo, e
//  nada chegava ao banco. Num sistema com prazo processual isso é o pior
//  defeito possível. Agora a escrita falha alto e a tela avisa.
// ─────────────────────────────────────────────────────────────────────────
const METODOS_DE_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Estado de conexão observado, para a interface poder avisar.
let servidorInacessivel = false
const ouvintes = new Set()

export function estaOffline() { return servidorInacessivel }
export function ouvirConexao(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn) }

function marcarConexao(inacessivel) {
  if (servidorInacessivel === inacessivel) return
  servidorInacessivel = inacessivel
  ouvintes.forEach(fn => { try { fn(inacessivel) } catch { /* ignora */ } })
}

// Erro de escrita sem servidor — a UI trata como "NÃO foi salvo".
export class SemConexaoError extends Error {
  constructor(metodo, path) {
    super('Sem conexão com o servidor — este dado NÃO foi salvo. Verifique a internet e tente de novo.')
    this.name = 'SemConexaoError'
    this.semConexao = true
    this.naoSalvo = true
    this.metodo = metodo
    this.path = path
  }
}

function getToken() {
  return localStorage.getItem('pj_access_token')
}

function setTokens({ access, refresh }) {
  localStorage.setItem('pj_access_token', access)
  localStorage.setItem('pj_refresh_token', refresh)
}

function clearTokens() {
  localStorage.removeItem('pj_access_token')
  localStorage.removeItem('pj_refresh_token')
}

let refreshPromise = null

async function refreshAccessToken() {
  const refresh = localStorage.getItem('pj_refresh_token')
  if (!refresh) throw new Error('no_refresh_token')

  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
  if (!res.ok) throw new Error('refresh_failed')
  const data = await res.json()
  setTokens({ access: data.accessToken, refresh: data.refreshToken })
  return data.accessToken
}

async function request(path, opts = {}) {
  const token = getToken()
  const metodo = (opts.method ?? 'GET').toUpperCase()
  const ehEscrita = METODOS_DE_ESCRITA.has(metodo)
  // Login e refresh JAMAIS caem no local: uma sessão falsa é pior que
  // nenhuma sessão — a pessoa acha que entrou e trabalha fora do banco.
  const ehAuth = path.includes('/api/auth/login') || path.includes('/api/auth/refresh')
  const podeCairNoLocal = !ehEscrita && !ehAuth && path.startsWith('/api')

  const headers = {
    ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers,
      body: opts.body instanceof FormData ? opts.body
        : opts.body ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    // Servidor inalcançável (rede caiu, DNS, servidor fora do ar).
    marcarConexao(true)
    if (podeCairNoLocal) return localHandle(path, metodo, opts.body ?? null)
    throw new SemConexaoError(metodo, path)
  }

  // 5xx numa rota /api: pode ser erro real do backend (JSON com message) ou
  // o servidor fora do ar devolvendo uma página de erro HTML.
  if (res.status >= 500 && res.status < 600 && path.startsWith('/api')) {
    const text = await res.text().catch(() => '')
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* não é JSON */ }

    if (parsed?.message) {
      // Erro real do backend — mostra a mensagem dele, não engole.
      marcarConexao(false)
      throw Object.assign(new Error(parsed.message), { status: res.status, data: parsed })
    }

    // Sem JSON = servidor indisponível (proxy/erro HTML/cold start).
    marcarConexao(true)
    if (podeCairNoLocal) return localHandle(path, metodo, opts.body ?? null)
    throw new SemConexaoError(metodo, path)
  }

  marcarConexao(false)

  // Auto-refresh no 401 — exceto nos próprios endpoints de auth.
  // Um 401 do /login significa "credenciais inválidas", não "sessão expirada":
  // tratar como sessão expirada aqui esconde o erro real do usuário.
  if (res.status === 401 && !ehAuth) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
      }
      const newToken = await refreshPromise
      res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        body: opts.body instanceof FormData ? opts.body
          : opts.body ? JSON.stringify(opts.body) : undefined,
      })
    } catch {
      clearTokens()
      window.location.href = '/login'
      throw new Error('session_expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw Object.assign(new Error(err.message ?? 'request_failed'), { status: res.status, data: err })
  }

  if (res.status === 204) return null
  return res.json()
}

const api = {
  get:    (path, opts)   => request(path, { method: 'GET', ...opts }),
  post:   (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put:    (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  patch:  (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
  delete: (path, opts)   => request(path, { method: 'DELETE', ...opts }),

  upload: (path, formData, opts) => request(path, { method: 'POST', body: formData, ...opts }),

  auth: {
    login:   (empresa, nome, senha) => api.post('/api/auth/login', { empresa, nome, senha }),
    logout:  ()                 => api.post('/api/auth/logout'),
    me:      ()                 => api.get('/api/auth/me'),
    refresh: (refreshToken)     => api.post('/api/auth/refresh', { refreshToken }),
  },

  clients: {
    list:     (params) => api.get('/api/clients?' + new URLSearchParams(params ?? {})),
    get:      (id)     => api.get(`/api/clients/${id}`),
    create:   (data)   => api.post('/api/clients', data),
    update:   (id, d)  => api.put(`/api/clients/${id}`, d),
    delete:   (id)     => api.delete(`/api/clients/${id}`),
    processes:(id)     => api.get(`/api/clients/${id}/processes`),
    timeline: (id)     => api.get(`/api/clients/${id}/timeline`),
    financial:(id)     => api.get(`/api/clients/${id}/financial`),
  },

  signatures: {
    list:      (processId) => api.get('/api/signatures' + (processId ? `?processId=${processId}` : '')),
    create:    (data)      => api.post('/api/signatures', data),
    remove:    (id)        => api.delete(`/api/signatures/${id}`),
    getPublic: (id)        => api.get(`/api/signatures/public/${id}`),
    sign:      (id, data)  => api.post(`/api/signatures/public/${id}`, data),
  },

  diario: {
    publicacoes: (params) => api.get('/api/diario/publicacoes?' + new URLSearchParams(params ?? {})),
  },

  processes: {
    list:       (p)    => api.get('/api/processes?' + new URLSearchParams(p ?? {})),
    get:        (id)   => api.get(`/api/processes/${id}`),
    create:     (d)    => api.post('/api/processes', d),
    update:     (id,d) => api.put(`/api/processes/${id}`, d),
    movements:  (id)   => api.get(`/api/processes/${id}/movements`),
    addMovement:(id,d) => api.post(`/api/processes/${id}/movements`, d),
    phaseChange:(id,d) => api.post(`/api/processes/${id}/phase-change`, d),
    deadlines:  (id)   => api.get(`/api/processes/${id}/deadlines`),
    documents:  (id)   => api.get(`/api/processes/${id}/documents`),
    financial:  (id)   => api.get(`/api/processes/${id}/financial`),
  },

  deadlines: {
    list:     (p)  => api.get('/api/deadlines?' + new URLSearchParams(p ?? {})),
    upcoming: ()   => api.get('/api/deadlines/upcoming'),
    create:   (d)  => api.post('/api/deadlines', d),
    update:   (id,d)=>api.put(`/api/deadlines/${id}`, d),
    complete: (id) => api.post(`/api/deadlines/${id}/complete`),
  },

  tasks: {
    list:      (p)    => api.get('/api/tasks?' + new URLSearchParams(p ?? {})),
    create:    (d)    => api.post('/api/tasks', d),
    update:    (id,d) => api.put(`/api/tasks/${id}`, d),
    setStatus: (id,s) => api.post(`/api/tasks/${id}/status`, { status: s }),
  },

  financial: {
    entries:  (p)    => api.get('/api/financial/entries?' + new URLSearchParams(p ?? {})),
    create:   (d)    => api.post('/api/financial/entries', d),
    update:   (id,d) => api.put(`/api/financial/entries/${id}`, d),
    pay:      (id,d) => api.post(`/api/financial/entries/${id}/pay`, d),
    summary:  ()     => api.get('/api/financial/summary'),
    cashflow: ()     => api.get('/api/financial/cashflow'),
  },

  reports: {
    summary: (p) => api.get('/api/reports/summary?' + new URLSearchParams(p ?? {})),
  },

  audit: {
    list: (p) => api.get('/api/audit?' + new URLSearchParams(p ?? {})),
    log:  (d) => api.post('/api/audit', d),
  },

  documents: {
    list:   (p)  => api.get('/api/documents?' + new URLSearchParams(p ?? {})),
    upload: (fd) => api.upload('/api/documents/upload', fd),
    remove: (id) => api.delete(`/api/documents/${id}`),
    // O arquivo exige token, então não dá para usar link direto: baixamos o blob.
    blob: async (id) => {
      const token = getToken()
      const res = await fetch(`${BASE}/api/documents/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Não foi possível obter o arquivo.')
      return res.blob()
    },
    download: async (id, name) => {
      const blob = await api.documents.blob(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name || 'documento'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    },
    view: async (id) => {
      const blob = await api.documents.blob(id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    },
  },

  settings: {
    users:        (p)    => api.get('/api/settings/users?' + new URLSearchParams(p ?? {})),
    planUsage:    ()     => api.get('/api/settings/plan-usage'),
    createUser:   (d)    => api.post('/api/settings/users', d),
    updateUser:   (id,d) => api.put(`/api/settings/users/${id}`, d),
    deleteUser:   (id)   => api.delete(`/api/settings/users/${id}`),
    tenant:       ()     => api.get('/api/settings/tenant'),
    updateTenant: (d)    => api.put('/api/settings/tenant', d),
    units:        ()     => api.get('/api/settings/units'),
    office:       ()     => api.get('/api/settings/office'),
    saveOffice:   (d)    => api.put('/api/settings/office', d),
    config:       ()     => api.get('/api/settings/config'),
    saveConfig:   (d)    => api.put('/api/settings/config', d),
    terms:        ()     => api.get('/api/settings/terms'),
    acceptTerms:  (versao) => api.post('/api/settings/terms', { versao }),
    templates:    ()     => api.get('/api/settings/templates'),
    saveTemplates:(list) => api.put('/api/settings/templates', { templates: list }),
  },

  master: {
    companies:      ()     => api.get('/api/master/companies'),
    createCompany:  (d)    => api.post('/api/master/companies', d),
    updateCompany:  (id,d) => api.put(`/api/master/companies/${id}`, d),
    deleteCompany:  (id)   => api.delete(`/api/master/companies/${id}`),
    enterCompany:   (id)   => api.post(`/api/master/companies/${id}/enter`),
    plans:          ()     => api.get('/api/master/plans'),
    savePlans:      (plans)=> api.put('/api/master/plans', { plans }),
    branding:       ()     => api.get('/api/master/branding'),
    saveBranding:   (d)    => api.put('/api/master/branding', d),
  },

  // Marca do sistema (pública — sem login)
  branding: () => api.get('/api/branding'),

  dashboard: {
    kpis:      () => api.get('/api/dashboard/kpis'),
    deadlines: () => api.get('/api/deadlines/upcoming'),
  },
}

export { setTokens, clearTokens, getToken }
export default api
