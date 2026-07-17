// Offline-first localStorage database — used automatically when backend is unreachable
// Multi-empresa: cada tenant (empresa) tem seus próprios usuários e dados.

const P = 'pj_local_'
const DEMO = 'tenant_demo'   // empresa padrão (dados existentes)

const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)

function table(name)        { try { return JSON.parse(localStorage.getItem(P + name) ?? '[]') } catch { return [] } }
function saveTable(n, rows) { localStorage.setItem(P + n, JSON.stringify(rows)) }
function getOne(n, id)      { return table(n).find(r => r.id === id) ?? null }

// ── Sessão atual (empresa/usuário logado) ──────────────────────
function session()      { try { return JSON.parse(localStorage.getItem('pj_session') ?? 'null') } catch { return null } }
function setSession(s)   { localStorage.setItem('pj_session', JSON.stringify(s)) }
// tenant atual: sessão → estado persistido do login (pj_auth) → demo
function curTenant() {
  const s = session()
  if (s?.tenantId) return s.tenantId
  try {
    const persisted = JSON.parse(localStorage.getItem('pj_auth') ?? 'null')
    return persisted?.state?.tenant?.id ?? persisted?.state?.user?.tenantId ?? DEMO
  } catch { return DEMO }
}

// ── Seed inicial: empresa admin (master) + primeiro escritório ─────────
// Faz upsert por id (não apaga seus dados) — garante os logins mesmo se já
// houver semeadura antiga no navegador.
function seedAuth() {
  const now = new Date().toISOString()

  // Empresas (tenants)
  const tens = table('tenants')
  const ensureTenant = (t) => { if (!tens.find(x => x.id === t.id)) tens.push({ createdAt: now, updatedAt: now, ...t }) }
  ensureTenant({ id: 'tnt_master', name: 'Perspecta Admin',        slug: 'admin',     cnpj: '',                    plan: 'master',       isActive: true })
  ensureTenant({ id: DEMO,         name: 'Perspecta',              slug: 'perspecta', cnpj: '00.000.000/0001-00',  plan: 'professional', isActive: true })
  ensureTenant({ id: 'tnt_kn',     name: 'KN Advocacia Criminal',  slug: 'kn',        cnpj: '',                    plan: 'professional', isActive: true })
  saveTable('tenants', tens)

  // Usuários (upsert por id — atualiza login/senha sem tocar em outros usuários)
  const us = table('users')
  const upsertUser = (u) => { const i = us.findIndex(x => x.id === u.id); if (i >= 0) us[i] = { ...us[i], ...u }; else us.push({ createdAt: now, ...u }) }
  // Master do sistema (administra TODOS os acessos / cria escritórios) — separado
  upsertUser({ id: 'usr_master',   tenantId: 'tnt_master', name: 'Administradora', loginName: 'admin', email: 'admin@perspecta.com', role: 'master', password: '001' })
  // SEU login (escritório Perspecta)
  upsertUser({ id: 'user_katelyn', tenantId: DEMO,         name: 'Katelyn',        loginName: 'kat',   email: 'kat@perspecta.com',   role: 'admin',  password: '001' })
  // Escritório KN Advocacia Criminal — Karen e Nathi (podem editar depois)
  upsertUser({ id: 'usr_karen',    tenantId: 'tnt_kn',     name: 'Karen',          loginName: 'karen', email: 'karen@kn.adv.br',     role: 'admin',  password: '001' })
  upsertUser({ id: 'usr_nathi',    tenantId: 'tnt_kn',     name: 'Nathi',          loginName: 'nathi', email: 'nathi@kn.adv.br',     role: 'admin',  password: '001' })
  saveTable('users', us)
}
seedAuth()

const tenants = () => table('tenants')
const usersT  = () => table('users')
// filtra linhas pela empresa atual (linhas sem tenantId contam como demo)
const scope   = (rows) => { const t = curTenant(); return rows.filter(r => (r.tenantId ?? DEMO) === t) }

function insertRow(name, data) {
  const row = { tenantId: curTenant(), createdAt: new Date().toISOString(), ...data, id: data.id ?? uid() }
  saveTable(name, [...table(name), row])
  return row
}

function updateRow(name, id, data) {
  const rows = table(name).map(r => r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r)
  saveTable(name, rows)
  return rows.find(r => r.id === id) ?? null
}

function removeRow(name, id) {
  saveTable(name, table(name).filter(r => r.id !== id))
  return null
}

const STATUS_LABELS = { active: 'Ativo', won: 'Ganho', lost: 'Perdido', settled: 'Acordo', archived: 'Arquivado' }

function autoMovement(processId, description, type = 'system') {
  if (!processId) return
  insertRow('movements', {
    processId,
    description,
    type,
    date: new Date().toISOString().slice(0, 10),
    author: 'Sistema',
    isPublic: false,
    isAutomatic: true,
  })
}

export function localHandle(path, method = 'GET', body = null) {
  const [url, qs] = path.split('?')
  const q = new URLSearchParams(qs ?? '')
  let m

  // ── Auth ────────────────────────────────────────────────────
  if (url === '/api/auth/login' && method === 'POST') {
    const { empresa, nome, senha } = body ?? {}
    const emp = (empresa ?? '').trim().toLowerCase()
    const candidatos = usersT().filter(u =>
      u.loginName.toLowerCase() === (nome ?? '').trim().toLowerCase() && u.password === senha
    )
    let user = null
    for (const c of candidatos) {
      const tn = tenants().find(t => t.id === c.tenantId)
      if (!emp || tn?.name.toLowerCase() === emp || tn?.slug === emp) { user = c; break }
    }
    if (!user)
      throw Object.assign(new Error('Empresa, nome ou senha inválidos.'), { status: 401 })
    const tenant = tenants().find(t => t.id === user.tenantId)
    if (tenant && tenant.isActive === false)
      throw Object.assign(new Error('Empresa desativada. Contate o administrador.'), { status: 403 })
    setSession({ userId: user.id, tenantId: user.tenantId, role: user.role })
    return {
      accessToken:  `mock_${user.id}_${Date.now()}`,
      refreshToken: `mock_r_${user.id}_${Date.now()}`,
      user:   { id: user.id, name: user.name, role: user.role, email: user.email, tenantId: user.tenantId },
      tenant,
    }
  }
  if (url === '/api/auth/me') {
    let s = session()
    if (!s) {
      try { const p = JSON.parse(localStorage.getItem('pj_auth') ?? 'null'); if (p?.state?.user?.id) s = { userId: p.state.user.id, tenantId: p.state.tenant?.id ?? p.state.user.tenantId } } catch {}
    }
    const user = usersT().find(u => u.id === s?.userId)
      ?? usersT().find(u => u.tenantId === DEMO && u.role !== 'master')
      ?? usersT()[0]
    const tenant = tenants().find(t => t.id === (s?.tenantId ?? user?.tenantId)) ?? tenants().find(t => t.id === DEMO)
    return { user, tenant }
  }
  if (url === '/api/auth/logout'  && method === 'POST') { localStorage.removeItem('pj_session'); return null }
  if (url === '/api/auth/refresh' && method === 'POST') {
    const s = session()
    return {
      accessToken:  `mock_${s?.userId ?? 'u'}_${Date.now()}`,
      refreshToken: `mock_r_${s?.userId ?? 'u'}_${Date.now()}`,
    }
  }

  // ── Master (administrador do sistema) — empresas ─────────────
  if (url === '/api/master/companies') {
    if (method === 'GET') {
      return tenants().filter(t => t.id !== 'tnt_master').map(t => ({
        ...t,
        usersCount:     usersT().filter(u => u.tenantId === t.id).length,
        clientsCount:   table('clients').filter(c => (c.tenantId ?? DEMO) === t.id).length,
        processesCount: table('processes').filter(p => (p.tenantId ?? DEMO) === t.id).length,
      }))
    }
    if (method === 'POST') {
      const now = new Date().toISOString()
      const id = 'tnt_' + uid()
      const slug = (body.slug ?? body.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const tenant = { id, name: body.name, slug, cnpj: body.cnpj ?? '', plan: body.plan ?? 'starter', isActive: true, createdAt: now, updatedAt: now }
      saveTable('tenants', [...tenants(), tenant])
      // usuário administrador da nova empresa
      saveTable('users', [...usersT(), {
        id: 'usr_' + uid(), tenantId: id,
        name: body.adminName ?? 'Administrador',
        loginName: body.adminLogin ?? body.name,
        email: body.adminEmail ?? '',
        role: 'admin', password: body.adminPassword ?? '123', createdAt: now,
      }])
      return { ...tenant, usersCount: 1, clientsCount: 0, processesCount: 0 }
    }
  }
  if ((m = url.match(/^\/api\/master\/companies\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    return updateRow('tenants', id, body)
    if (method === 'DELETE') { removeRow('tenants', id); saveTable('users', usersT().filter(u => u.tenantId !== id)); return null }
  }

  // ── Clients ─────────────────────────────────────────────────
  if (url === '/api/clients') {
    if (method === 'GET') {
      let rows = scope(table('clients'))
      const search = q.get('search') ?? q.get('q')
      if (search) rows = rows.filter(r =>
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.cpfCnpj?.includes(search) ||
        r.email?.toLowerCase().includes(search.toLowerCase())
      )
      const isActive = q.get('isActive')
      if (isActive !== null && isActive !== '') rows = rows.filter(r => String(r.isActive ?? true) === isActive)
      return rows
    }
    if (method === 'POST') return insertRow('clients', body)
  }
  if ((m = url.match(/^\/api\/clients\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'GET')    return getOne('clients', id)
    if (method === 'PUT')    return updateRow('clients', id, body)
    if (method === 'DELETE') return removeRow('clients', id)
  }
  if ((m = url.match(/^\/api\/clients\/([^/]+)\/processes$/)) && method === 'GET')
    return table('processes').filter(r => r.clientId === m[1])
  if ((m = url.match(/^\/api\/clients\/([^/]+)\/timeline$/)) && method === 'GET')
    return table('movements').filter(r => r.clientId === m[1]).sort((a, b) => b.createdAt?.localeCompare(a.createdAt))
  if ((m = url.match(/^\/api\/clients\/([^/]+)\/financial$/)) && method === 'GET')
    return table('financial_entries').filter(r => r.clientId === m[1])

  // ── Signatures (coleta de assinaturas) ───────────────────────
  if (url === '/api/signatures') {
    if (method === 'GET') {
      let rows = table('signatures')
      if (q.get('processId')) rows = rows.filter(r => r.processId === q.get('processId'))
      return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    }
    if (method === 'POST') return insertRow('signatures', {
      ...body,
      status: 'pendente',
      validationCode: String(Math.floor(100000 + Math.random() * 900000)),
    })
  }
  if ((m = url.match(/^\/api\/signatures\/public\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'GET') {
      const r = getOne('signatures', id)
      if (!r) throw Object.assign(new Error('Pedido de assinatura não encontrado.'), { status: 404 })
      return { id: r.id, clientName: r.clientName, documentos: r.documentos, modo: r.modo, status: r.status, validationCode: r.validationCode, createdAt: r.createdAt, signer: r.signer, signatureImg: r.signatureImg, photoImg: r.photoImg }
    }
    if (method === 'POST') {
      // Guarda todo o pacote de evidências (assinatura, selfie, hash, IP, geo, consentimento…)
      updateRow('signatures', id, { ...(body ?? {}), status: 'assinado', signedAt: new Date().toISOString() })
      return { ok: true, status: 'assinado' }
    }
  }
  if ((m = url.match(/^\/api\/signatures\/([^/]+)$/))) {
    if (method === 'DELETE') return removeRow('signatures', m[1])
  }

  // ── Processes ────────────────────────────────────────────────
  if (url === '/api/processes') {
    if (method === 'GET') {
      let rows = scope(table('processes'))
      if (q.get('clientId')) rows = rows.filter(r => r.clientId === q.get('clientId'))
      const search = q.get('search') ?? q.get('q')
      if (search) rows = rows.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.judicialNumber?.toLowerCase().includes(search.toLowerCase())
      )
      if (q.get('area'))   rows = rows.filter(r => r.area === q.get('area'))
      if (q.get('status')) rows = rows.filter(r => r.status === q.get('status'))
      return rows
    }
    if (method === 'POST') return insertRow('processes', body)
  }
  if ((m = url.match(/^\/api\/processes\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'GET')    return getOne('processes', id)
    if (method === 'PUT') {
      const current = getOne('processes', id)
      const updated = updateRow('processes', id, body)
      if (body.status && current?.status !== body.status) {
        const from = STATUS_LABELS[current?.status] ?? current?.status
        const to   = STATUS_LABELS[body.status] ?? body.status
        autoMovement(id, `Status alterado: ${from} → ${to}`, 'status')
      }
      if (body.priority && current?.priority !== body.priority) {
        const map = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' }
        autoMovement(id, `Prioridade alterada para: ${map[body.priority] ?? body.priority}`, 'system')
      }
      return updated
    }
    if (method === 'DELETE') return removeRow('processes', id)
  }
  if ((m = url.match(/^\/api\/processes\/([^/]+)\/movements$/))) {
    if (method === 'GET')  return table('movements').filter(r => r.processId === m[1]).sort((a, b) => b.createdAt?.localeCompare(a.createdAt))
    if (method === 'POST') return insertRow('movements', { ...body, processId: m[1] })
  }
  if ((m = url.match(/^\/api\/processes\/([^/]+)\/deadlines$/)) && method === 'GET')
    return table('deadlines').filter(r => r.processId === m[1])
  if ((m = url.match(/^\/api\/processes\/([^/]+)\/documents$/)) && method === 'GET')
    return []
  if ((m = url.match(/^\/api\/processes\/([^/]+)\/financial$/)) && method === 'GET')
    return table('financial_entries').filter(r => r.processId === m[1])

  // ── Deadlines ────────────────────────────────────────────────
  if (url === '/api/deadlines') {
    if (method === 'GET')  return scope(table('deadlines')).filter(r => !r.completedAt)
    if (method === 'POST') {
      const row = insertRow('deadlines', body)
      const fmt = body.dueDate ? new Date(body.dueDate).toLocaleDateString('pt-BR') : ''
      autoMovement(body.processId, `Prazo cadastrado: "${body.title}"${fmt ? ` — ${fmt}` : ''}`, 'deadline')
      return row
    }
  }
  if (url === '/api/deadlines/upcoming' && method === 'GET') {
    const cutoff = new Date(Date.now() + 86400000 * 30).toISOString()
    return scope(table('deadlines')).filter(r => !r.completedAt && r.dueDate <= cutoff)
      .sort((a, b) => a.dueDate?.localeCompare(b.dueDate))
      .slice(0, 10)
  }
  if ((m = url.match(/^\/api\/deadlines\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT') return updateRow('deadlines', id, body)
    if (method === 'DELETE') return removeRow('deadlines', id)
  }
  if ((m = url.match(/^\/api\/deadlines\/([^/]+)\/complete$/)) && method === 'POST') {
    const deadline = getOne('deadlines', m[1])
    const updated  = updateRow('deadlines', m[1], { completedAt: new Date().toISOString() })
    autoMovement(deadline?.processId, `Prazo concluído: "${deadline?.title}"`, 'deadline')
    return updated
  }

  // ── Tasks ────────────────────────────────────────────────────
  if (url === '/api/tasks') {
    if (method === 'GET')  return scope(table('tasks'))
    if (method === 'POST') {
      const row = insertRow('tasks', body)
      autoMovement(body.processId, `Tarefa criada: "${body.title}"`, 'task')
      return row
    }
  }
  if ((m = url.match(/^\/api\/tasks\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    return updateRow('tasks', id, body)
    if (method === 'DELETE') return removeRow('tasks', id)
  }
  if ((m = url.match(/^\/api\/tasks\/([^/]+)\/status$/)) && method === 'POST') {
    const task    = getOne('tasks', m[1])
    const updated = updateRow('tasks', m[1], { status: body?.status })
    if (body?.status === 'done') {
      autoMovement(task?.processId, `Tarefa concluída: "${task?.title}"`, 'task')
    }
    return updated
  }

  // ── Financial ────────────────────────────────────────────────
  if (url === '/api/financial/entries') {
    if (method === 'GET')  return scope(table('financial_entries'))
    if (method === 'POST') {
      const row = insertRow('financial_entries', body)
      if (body.processId) {
        const fmt = body.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(body.amount) : ''
        const tipo = body.type === 'income' ? 'Receita' : 'Despesa'
        autoMovement(body.processId, `${tipo} lançada: "${body.description}"${fmt ? ` — ${fmt}` : ''}`, 'financial')
      }
      return row
    }
  }
  if ((m = url.match(/^\/api\/financial\/entries\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT') return updateRow('financial_entries', id, body)
  }
  if ((m = url.match(/^\/api\/financial\/entries\/([^/]+)\/pay$/)) && method === 'POST')
    return updateRow('financial_entries', m[1], { status: 'paid', paidAt: new Date().toISOString() })
  if (url === '/api/financial/summary' && method === 'GET') {
    const entries = table('financial_entries')
    return {
      totalReceivable: entries.filter(e => e.type === 'income'  && e.status !== 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
      totalPayable:    entries.filter(e => e.type === 'expense' && e.status !== 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
      totalPaid:       entries.filter(e => e.type === 'income'  && e.status === 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
      totalSpent:      entries.filter(e => e.type === 'expense' && e.status === 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
    }
  }
  if (url === '/api/financial/cashflow' && method === 'GET') return []

  // ── Dashboard ────────────────────────────────────────────────
  if (url === '/api/dashboard/kpis' && method === 'GET') {
    const cli = scope(table('clients')), proc = scope(table('processes'))
    const dl = scope(table('deadlines')), tk = scope(table('tasks')), fin = scope(table('financial_entries'))
    return {
      activeClients:    cli.length,
      activeProcesses:  proc.filter(r => r.status === 'active').length,
      upcomingDeadlines:dl.filter(r => !r.completedAt).length,
      pendingTasks:     tk.filter(r => r.status !== 'done').length,
      monthlyRevenue:   fin.filter(e => e.type === 'income' && e.status === 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
      monthlyPayable:   fin.filter(e => e.type === 'expense' && e.status !== 'paid').reduce((s, e) => s + (e.amount ?? 0), 0),
    }
  }

  // ── Settings ─────────────────────────────────────────────────
  if (url === '/api/settings/tenant') {
    const tn = tenants().find(t => t.id === curTenant()) ?? tenants()[0]
    if (method === 'GET') return tn
    if (method === 'PUT') { updateRow('tenants', tn.id, body); return { ...tn, ...body } }
  }
  if (url === '/api/settings/users') {
    if (method === 'GET')  return usersT().filter(u => u.tenantId === curTenant()).map(({ password, ...u }) => u)
    if (method === 'POST') {
      const u = { id: 'usr_' + uid(), tenantId: curTenant(), name: body.name, loginName: body.loginName ?? body.name,
        email: body.email ?? '', role: body.role ?? 'lawyer', password: body.password ?? '123', createdAt: new Date().toISOString() }
      saveTable('users', [...usersT(), u])
      const { password, ...safe } = u
      return safe
    }
  }
  if ((m = url.match(/^\/api\/settings\/users\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    { const u = updateRow('users', id, body); const { password, ...safe } = u ?? {}; return safe }
    if (method === 'DELETE') return removeRow('users', id)
  }
  if (url === '/api/settings/units' && method === 'GET') return []

  // ── Settings — Areas ──────────────────────────────────────────
  if (url === '/api/settings/areas') {
    if (method === 'GET')  return table('areas')
    if (method === 'POST') return insertRow('areas', body)
  }
  if ((m = url.match(/^\/api\/settings\/areas\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    return updateRow('areas', id, body)
    if (method === 'DELETE') return removeRow('areas', id)
  }

  // ── Settings — Services ───────────────────────────────────────
  if (url === '/api/settings/services') {
    if (method === 'GET')  return table('services')
    if (method === 'POST') return insertRow('services', body)
  }
  if ((m = url.match(/^\/api\/settings\/services\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    return updateRow('services', id, body)
    if (method === 'DELETE') return removeRow('services', id)
  }

  // ── Settings — Fee types ──────────────────────────────────────
  if (url === '/api/settings/fee-types') {
    if (method === 'GET')  return table('fee_types')
    if (method === 'POST') return insertRow('fee_types', body)
  }
  if ((m = url.match(/^\/api\/settings\/fee-types\/([^/]+)$/))) {
    const id = m[1]
    if (method === 'PUT')    return updateRow('fee_types', id, body)
    if (method === 'DELETE') return removeRow('fee_types', id)
  }

  console.warn('[localDb] sem handler para:', method, url)
  return null
}
