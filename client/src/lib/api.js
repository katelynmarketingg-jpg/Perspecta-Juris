import { localHandle } from './localDb'

const BASE = import.meta.env.VITE_API_URL ?? ''

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
    // Network error — backend unreachable, use local fallback
    return localHandle(path, opts.method ?? 'GET', opts.body ?? null)
  }

  // Backend/proxy failure (Vite returns 5xx — often an HTML error page —
  // when the API server is unreachable). This app is offline-first, so any
  // 5xx on an /api route falls back to the local database instead of failing.
  if (res.status >= 500 && res.status < 600 && path.startsWith('/api')) {
    const text = await res.text().catch(() => '')
    // Real backend JSON error (has a parseable message) → surface it.
    // Empty body, HTML proxy error, or dev mode → treat as "backend down".
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* not JSON */ }
    const looksLikeRealError = parsed && typeof parsed === 'object' && parsed.message && !import.meta.env.DEV
    if (!looksLikeRealError) {
      return localHandle(path, opts.method ?? 'GET', opts.body ?? null)
    }
    throw Object.assign(new Error(parsed.message ?? 'request_failed'), { status: res.status, data: parsed })
  }

  // Auto-refresh on 401 — exceto nos próprios endpoints de auth.
  // Um 401 do /login significa "credenciais inválidas", não "sessão expirada":
  // tratar como sessão expirada aqui esconde o erro real do usuário.
  const isAuthEndpoint = path.includes('/api/auth/login') || path.includes('/api/auth/refresh')
  if (res.status === 401 && !isAuthEndpoint) {
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

  settings: {
    users:        (p)    => api.get('/api/settings/users?' + new URLSearchParams(p ?? {})),
    createUser:   (d)    => api.post('/api/settings/users', d),
    updateUser:   (id,d) => api.put(`/api/settings/users/${id}`, d),
    deleteUser:   (id)   => api.delete(`/api/settings/users/${id}`),
    tenant:       ()     => api.get('/api/settings/tenant'),
    updateTenant: (d)    => api.put('/api/settings/tenant', d),
    units:        ()     => api.get('/api/settings/units'),
  },

  master: {
    companies:      ()     => api.get('/api/master/companies'),
    createCompany:  (d)    => api.post('/api/master/companies', d),
    updateCompany:  (id,d) => api.put(`/api/master/companies/${id}`, d),
    deleteCompany:  (id)   => api.delete(`/api/master/companies/${id}`),
    enterCompany:   (id)   => api.post(`/api/master/companies/${id}/enter`),
  },

  dashboard: {
    kpis:      () => api.get('/api/dashboard/kpis'),
    deadlines: () => api.get('/api/deadlines/upcoming'),
  },
}

export { setTokens, clearTokens, getToken }
export default api
