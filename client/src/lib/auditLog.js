// ─────────────────────────────────────────────────────────────────────────
//  Registro de atividades (audit log) — quem fez o quê e quando.
//  Ex.: "Fulano deu baixa no pagamento X", "Ciclana concluiu a tarefa Y".
//  Por empresa (tenant), com filtros por tipo de atividade.
// ─────────────────────────────────────────────────────────────────────────
import api from './api'

const KEY = 'pj_audit_log'
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const uid = () => 'a_' + Math.random().toString(36).slice(2, 10)

function authState() { return lsGet('pj_auth', {})?.state ?? {} }

export const TIPOS_ATIVIDADE = [
  { value: 'pagamento',    label: 'Pagamentos',    icone: '💰', cor: '#10b981' },
  { value: 'tarefa',       label: 'Tarefas',       icone: '✅', cor: '#f59e0b' },
  { value: 'calculo',      label: 'Cálculos',      icone: '🧮', cor: '#8b5cf6' },
  { value: 'cliente',      label: 'Clientes',      icone: '👥', cor: '#3b82f6' },
  { value: 'processo',     label: 'Processos',     icone: '⚖️', cor: '#6366f1' },
  { value: 'documento',    label: 'Documentos',    icone: '📄', cor: '#06b6d4' },
  { value: 'assinatura',   label: 'Assinaturas',   icone: '✍️', cor: '#ec4899' },
  { value: 'atendimento',  label: 'Atendimentos',  icone: '📞', cor: '#14b8a6' },
  { value: 'movimentacao', label: 'Movimentações', icone: '📰', cor: '#0ea5e9' },
  { value: 'config',       label: 'Configurações', icone: '⚙️', cor: '#64748b' },
]
export const tipoInfo = (t) => TIPOS_ATIVIDADE.find(x => x.value === t) ?? { label: t, icone: '•', cor: '#64748b' }

// Registra uma atividade. tipo ∈ TIPOS_ATIVIDADE; descricao = texto; meta = extras.
export function registrar(tipo, descricao, meta = {}) {
  try {
    const { user, tenant } = authState()
    const entry = {
      id: uid(), tipo, descricao, meta,
      autor: user?.name ?? 'Usuário', autorId: user?.id ?? null,
      tenantId: tenant?.id ?? 'tenant_demo',
      createdAt: new Date().toISOString(),
    }
    const all = lsGet(KEY, [])
    all.unshift(entry)
    lsSet(KEY, all.slice(0, 2000))
    // Grava no servidor: autor, IP e data/hora vêm de lá (valor probatório).
    api.audit.log({ tipo, descricao, meta, resourceId: meta?.id ?? null }).catch(() => {})
    return entry
  } catch { return null }
}

// Lista os registros da empresa atual, com filtros opcionais.
export function getRegistros({ tipo, autor, busca } = {}) {
  const { tenant } = authState()
  const tid = tenant?.id ?? 'tenant_demo'
  let rows = lsGet(KEY, []).filter(r => (r.tenantId ?? 'tenant_demo') === tid)
  if (tipo) rows = rows.filter(r => r.tipo === tipo)
  if (autor) rows = rows.filter(r => r.autor === autor)
  if (busca) {
    const q = busca.toLowerCase()
    rows = rows.filter(r => r.descricao?.toLowerCase().includes(q) || r.autor?.toLowerCase().includes(q))
  }
  return rows
}

export function autoresDistintos() {
  const { tenant } = authState()
  const tid = tenant?.id ?? 'tenant_demo'
  return [...new Set(lsGet(KEY, []).filter(r => (r.tenantId ?? 'tenant_demo') === tid).map(r => r.autor).filter(Boolean))]
}

// ── Leitura a partir do servidor (fonte oficial) ───────────────────
// Cai no cache local apenas se estiver sem conexão.
export async function fetchRegistros() {
  try {
    const rows = await api.audit.list({ limit: 1000 })
    if (Array.isArray(rows)) return rows
  } catch { /* offline */ }
  return getRegistros()
}

// Filtro puro, aplicado sobre a lista já carregada.
export function filtrarRegistros(rows, { tipo, autor, busca } = {}) {
  let out = Array.isArray(rows) ? rows : []
  if (tipo) out = out.filter(r => r.tipo === tipo)
  if (autor) out = out.filter(r => r.autor === autor)
  if (busca) {
    const q = busca.toLowerCase()
    out = out.filter(r => r.descricao?.toLowerCase().includes(q) || r.autor?.toLowerCase().includes(q))
  }
  return out
}

export function autoresDe(rows) {
  return [...new Set((rows ?? []).map(r => r.autor).filter(Boolean))]
}
