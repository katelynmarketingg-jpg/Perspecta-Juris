// ─────────────────────────────────────────────────────────────────
// Tribunal Scraper Service
// Faz login e busca processos nos portais dos tribunais brasileiros
// usando credenciais do advogado (acessa sigilosos).
// ─────────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Sessões em memória: sessionId → { cookies, tribunal, expiresAt }
const SESSIONS = new Map()

// ── Cookie helpers ────────────────────────────────────────────────
function parseCookies(res) {
  const raw = res.headers.get('set-cookie') ?? ''
  const out = {}
  for (const part of raw.split(/,(?=[^ ])/)) {
    const [kv] = part.trim().split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) out[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim()
  }
  return out
}

function cookieHeader(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('; ')
}

function mergeCookies(base, incoming) {
  return { ...base, ...incoming }
}

// ── HTML helpers ──────────────────────────────────────────────────
function extractAttr(html, tag, attr, id = '') {
  const idPart = id ? `[^>]*id=["']${id}["'][^>]*` : '[^>]*'
  const re = new RegExp(`<${tag}${idPart}[^>]*${attr}=["']([^"']+)["']`, 'i')
  return html.match(re)?.[1] ?? ''
}

function extractField(html, name) {
  const re = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i')
  return html.match(re)?.[1] ?? ''
}

function extractCNJNumbers(html) {
  return [...new Set((html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) ?? []))]
}

function extractTableRows(html, tableId) {
  const tableRe = new RegExp(`<table[^>]*id=["']${tableId}["'][^>]*>([\\s\\S]*?)</table>`, 'i')
  const tableHtml = html.match(tableRe)?.[1] ?? html
  const rows = []
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const cells = []
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let c
    while ((c = cellRe.exec(m[1])) !== null) {
      cells.push(c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    }
    if (cells.length) rows.push(cells)
  }
  return rows
}

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)
}

// ─────────────────────────────────────────────────────────────────
// TJRS — e-SAJ (https://esaj.tjrs.jus.br)
// ─────────────────────────────────────────────────────────────────

async function loginTJRS(cpf, password) {
  // 1. GET login page → captura CSRF e cookies iniciais
  const r1 = await fetch('https://esaj.tjrs.jus.br/sajcas/login?service=https%3A%2F%2Fesaj.tjrs.jus.br%2Fesaj%2Fj_spring_cas_security_check', {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  })
  const html1 = await r1.text()
  const cookies1 = parseCookies(r1)
  const lt  = extractField(html1, 'lt')
  const exec = extractAttr(html1, 'input', 'value', 'execution') || extractField(html1, 'execution')

  // 2. POST login
  const body = new URLSearchParams({
    username: cpf.replace(/\D/g, ''),
    password,
    lt: lt || '',
    execution: exec || 'e1s1',
    _eventId: 'submit',
    pbEntrar: 'Entrar',
  })

  const r2 = await fetch('https://esaj.tjrs.jus.br/sajcas/login', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies1),
      Referer: 'https://esaj.tjrs.jus.br/sajcas/login',
    },
    body: body.toString(),
    redirect: 'follow',
  })

  const cookies2 = mergeCookies(cookies1, parseCookies(r2))
  const html2 = await r2.text()

  // Verifica se logou (deve redirecionar para o portal)
  const success = !html2.includes('senha incorreta') && !html2.includes('Usuário ou senha') && Object.keys(cookies2).some(k => k.toLowerCase().includes('session') || k.toLowerCase().includes('jsession') || k.toLowerCase().includes('sso'))

  if (!success) {
    throw new Error('Login TJRS falhou. Verifique CPF e senha.')
  }

  return cookies2
}

async function searchTJRSByOAB(oabNum, oabUF, cookies = {}) {
  const url = `https://esaj.tjrs.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMOAB&dadosConsulta.valorConsultaNuOab=${oabNum}&dadosConsulta.valorConsultaEstadoOAB=${oabUF}&dadosConsulta.localPesquisa.cdLocal=-1&campo=codigo&id=0&tipo=acao`

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
    },
    redirect: 'follow',
  })

  const html = await res.text()
  const processes = []
  const rows = extractTableRows(html, 'tabelaTodasDemandas')

  for (const row of rows.slice(1)) { // pula cabeçalho
    const num = row.find(c => c.match(/\d{7}-\d{2}\.\d{4}/))
    if (!num) continue
    processes.push({
      judicialNumber: num,
      title: row[1] || '',
      court: 'TJRS',
      tribunal: 'tjrs',
      area: 'civel',
      status: 'active',
      priority: 'normal',
      startedAt: row.find(c => c.match(/\d{2}\/\d{2}\/\d{4}/)) || '',
      opposingParty: row[2] || '',
      source: 'tjrs_esaj',
    })
  }

  // fallback: extrai pelo menos os números CNJ
  if (!processes.length) {
    const nums = extractCNJNumbers(html)
    nums.forEach(n => {
      if (n.includes('.8.21.')) { // 8.21 = TJRS
        processes.push({ judicialNumber: n, court: 'TJRS', tribunal: 'tjrs', area: 'civel', status: 'active', priority: 'normal', source: 'tjrs_esaj', title: `Processo ${n}` })
      }
    })
  }

  return processes
}

// ─────────────────────────────────────────────────────────────────
// TRT-4 — PJe (https://pje.trt4.jus.br)
// ─────────────────────────────────────────────────────────────────

async function loginTRT4(cpf, password) {
  // PJe usa Keycloak para auth
  const r1 = await fetch('https://pje.trt4.jus.br/pjekz/auth/realms/pje/protocol/openid-connect/auth?client_id=pje&redirect_uri=https%3A%2F%2Fpje.trt4.jus.br%2Fpjekz%2F&response_type=code', {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  })
  const html1 = await r1.text()
  const cookies1 = parseCookies(r1)

  // Extrai action do form de login
  const actionRe = /action="([^"]+)"/i
  const action = html1.match(actionRe)?.[1] ?? ''

  if (!action) throw new Error('Não foi possível acessar a página de login do TRT-4.')

  const body = new URLSearchParams({ username: cpf.replace(/\D/g, ''), password, credentialId: '' })
  const r2 = await fetch(action.replace(/&amp;/g, '&'), {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies1),
      Referer: 'https://pje.trt4.jus.br/',
    },
    body: body.toString(),
    redirect: 'follow',
  })

  const cookies2 = mergeCookies(cookies1, parseCookies(r2))
  const html2 = await r2.text()

  if (html2.includes('Invalid username') || html2.includes('Credenciais inválidas')) {
    throw new Error('Login TRT-4 falhou. Verifique CPF e senha.')
  }

  return cookies2
}

async function searchTRT4ByOAB(oabNum, cookies = {}) {
  // Consulta pública do TRT-4 por OAB
  const url = `https://pje.trt4.jus.br/consultaprocessual/detalhe-consulta/nomeAdvogado?oabNumero=${oabNum}&oabEstado=RS`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
    },
  })

  if (!res.ok) return []

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('json')) {
    const json = await res.json().catch(() => null)
    if (!json) return []
    const list = Array.isArray(json) ? json : (json.processos ?? json.data ?? [])
    return list.map(p => ({
      judicialNumber: p.numero ?? p.numeroProcesso ?? '',
      title: p.assunto ?? p.classe ?? 'Processo Trabalhista',
      court: 'TRT-4',
      tribunal: 'trt4',
      area: 'trabalhista',
      status: 'active',
      priority: 'normal',
      startedAt: p.dataDistribuicao?.slice(0, 10) ?? '',
      source: 'trt4_pje',
    }))
  }

  // Fallback: extrai números do HTML
  const html = await res.text().catch(() => '')
  return extractCNJNumbers(html)
    .filter(n => n.includes('.5.04.'))
    .map(n => ({ judicialNumber: n, court: 'TRT-4', tribunal: 'trt4', area: 'trabalhista', status: 'active', priority: 'normal', source: 'trt4_pje', title: `Processo ${n}` }))
}

// ─────────────────────────────────────────────────────────────────
// TRF-4 — e-Proc (https://eproc.trf4.jus.br)
// ─────────────────────────────────────────────────────────────────

async function loginTRF4(cpf, password) {
  const r1 = await fetch('https://eproc.trf4.jus.br/eproc/login.php', {
    headers: { 'User-Agent': UA },
  })
  const cookies1 = parseCookies(r1)
  const html1 = await r1.text()
  const hidden = {}
  const hiddenRe = /<input[^>]+type=["']hidden["'][^>]*>/gi
  let hm
  while ((hm = hiddenRe.exec(html1)) !== null) {
    const nameM = hm[0].match(/name=["']([^"']+)["']/)
    const valM  = hm[0].match(/value=["']([^"']*)["']/)
    if (nameM) hidden[nameM[1]] = valM?.[1] ?? ''
  }

  const body = new URLSearchParams({
    ...hidden,
    txtUsuario: cpf.replace(/\D/g, ''),
    pwdSenha: password,
    chkLembrar: 'S',
    acao: 'usuario_login',
  })

  const r2 = await fetch('https://eproc.trf4.jus.br/eproc/controlador.php', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(cookies1),
      Referer: 'https://eproc.trf4.jus.br/eproc/login.php',
    },
    body: body.toString(),
    redirect: 'follow',
  })

  const cookies2 = mergeCookies(cookies1, parseCookies(r2))
  const html2 = await r2.text()

  if (html2.includes('Usuário ou senha inválidos') || html2.includes('login.php')) {
    throw new Error('Login TRF-4 falhou. Verifique CPF e senha.')
  }

  return cookies2
}

async function searchTRF4ByOAB(oabNum, cookies = {}) {
  const url = `https://eproc.trf4.jus.br/eproc/controlador.php?acao=processo_consulta_publica&num_oab=${oabNum}&suf_oab=RS`
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
    },
    redirect: 'follow',
  })

  const html = await res.text().catch(() => '')
  const processes = []
  const rows = extractTableRows(html, 'tblProcessos')

  for (const row of rows.slice(1)) {
    const num = row.find(c => c.match(/\d{7}-\d{2}\.\d{4}/))
    if (!num) continue
    processes.push({
      judicialNumber: num,
      title: row[1] || `Processo ${num}`,
      court: 'TRF-4',
      tribunal: 'trf4',
      area: 'civel',
      status: 'active',
      priority: 'normal',
      startedAt: row.find(c => c.match(/\d{2}\/\d{2}\/\d{4}/)) || '',
      source: 'trf4_eproc',
    })
  }

  if (!processes.length) {
    extractCNJNumbers(html)
      .filter(n => n.includes('.4.04.'))
      .forEach(n => processes.push({ judicialNumber: n, court: 'TRF-4', tribunal: 'trf4', area: 'civel', status: 'active', priority: 'normal', source: 'trf4_eproc', title: `Processo ${n}` }))
  }

  return processes
}

// ─────────────────────────────────────────────────────────────────
// Exports públicos
// ─────────────────────────────────────────────────────────────────

export async function createSession(tribunal, credentials) {
  const id = generateId()
  let cookies = {}

  if (tribunal === 'tjrs') {
    cookies = await loginTJRS(credentials.cpf, credentials.password)
  } else if (tribunal === 'trt4') {
    cookies = await loginTRT4(credentials.cpf, credentials.password)
  } else if (tribunal === 'trf4') {
    cookies = await loginTRF4(credentials.cpf, credentials.password)
  } else {
    throw new Error(`Tribunal não suportado: ${tribunal}`)
  }

  SESSIONS.set(id, {
    tribunal,
    cookies,
    expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4h
  })

  return id
}

export async function getProcessesByOAB(tribunal, oabNum, oabUF, sessionId) {
  const session = sessionId ? SESSIONS.get(sessionId) : null
  const cookies = session?.tribunal === tribunal ? session.cookies : {}

  if (tribunal === 'tjrs') return searchTJRSByOAB(oabNum, oabUF, cookies)
  if (tribunal === 'trt4') return searchTRT4ByOAB(oabNum, cookies)
  if (tribunal === 'trf4') return searchTRF4ByOAB(oabNum, cookies)

  throw new Error(`Tribunal não suportado: ${tribunal}`)
}

export function listSessions() {
  const now = Date.now()
  const result = {}
  for (const [id, s] of SESSIONS) {
    if (s.expiresAt < now) { SESSIONS.delete(id); continue }
    result[s.tribunal] = { sessionId: id, expiresAt: new Date(s.expiresAt).toISOString() }
  }
  return result
}

export function logout(sessionId) {
  SESSIONS.delete(sessionId)
}
