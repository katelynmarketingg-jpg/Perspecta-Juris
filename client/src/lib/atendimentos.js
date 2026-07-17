// ─────────────────────────────────────────────────────────────────────────
//  Fila de atendimento + histórico de atendimentos (presencial/online/WhatsApp).
//  Escritórios com recepção: cadastra o cliente e coloca na fila para um
//  colaborador; ao "atender", registra o tempo de espera e quem atendeu.
//  Por empresa (tenant).
// ─────────────────────────────────────────────────────────────────────────
import { currentTenantId } from './tenant'

const KEY = 'pj_atendimentos'
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const uid = () => 'at_' + Math.random().toString(36).slice(2, 10)
const authUser = () => lsGet('pj_auth', {})?.state?.user ?? {}

export const TIPOS_ATEND = [
  { value: 'presencial', label: 'Presencial', icone: '🏢' },
  { value: 'online',     label: 'Online',     icone: '💻' },
  { value: 'whatsapp',   label: 'WhatsApp',   icone: '💬' },
  { value: 'telefone',   label: 'Telefone',   icone: '📞' },
]
export const tipoAtend = (t) => TIPOS_ATEND.find(x => x.value === t) ?? { label: t, icone: '•' }

function all() {
  const tid = currentTenantId()
  return lsGet(KEY, []).filter(a => (a.tenantId ?? 'tenant_demo') === tid)
}
function saveAll(rows) {
  // preserva registros de outros tenants
  const tid = currentTenantId()
  const outros = lsGet(KEY, []).filter(a => (a.tenantId ?? 'tenant_demo') !== tid)
  lsSet(KEY, [...rows, ...outros])
}

export function getFila() {
  return all().filter(a => a.status === 'fila').sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}
export function filaCount() { return getFila().length }

export function addToFila({ clientId, clientName, colaborador, tipo = 'presencial', obs }) {
  const rows = all()
  rows.unshift({
    id: uid(), tenantId: currentTenantId(), clientId: clientId ?? null, clientName: clientName ?? '',
    colaborador: colaborador ?? '', tipo, obs: obs ?? '', status: 'fila',
    criadoEm: new Date().toISOString(), atendidoPor: null, atendidoEm: null,
    criadoPor: authUser().name ?? 'Recepção',
  })
  saveAll(rows)
}

export function atender(id, atendidoPor) {
  saveAll(all().map(a => a.id === id
    ? { ...a, status: 'atendido', atendidoPor: atendidoPor ?? authUser().name ?? '—', atendidoEm: new Date().toISOString() }
    : a))
}

export function removerAtendimento(id) { saveAll(all().filter(a => a.id !== id)) }

// Registra um atendimento já concluído (online/WhatsApp/telefone respondido)
export function registrarAtendimento({ clientId, clientName, tipo = 'online', obs }) {
  const now = new Date().toISOString()
  const rows = all()
  rows.unshift({
    id: uid(), tenantId: currentTenantId(), clientId: clientId ?? null, clientName: clientName ?? '',
    colaborador: '', tipo, obs: obs ?? '', status: 'atendido',
    criadoEm: now, atendidoPor: authUser().name ?? '—', atendidoEm: now, criadoPor: authUser().name ?? '—',
  })
  saveAll(rows)
}

export function getAtendimentosCliente(clientId) {
  return all().filter(a => a.clientId === clientId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

export function esperaMin(a) {
  const fim = a.atendidoEm ? new Date(a.atendidoEm) : new Date()
  return Math.max(0, Math.round((fim - new Date(a.criadoEm)) / 60000))
}

// Relatório de atendimentos concluídos, com filtro por período (YYYY-MM-DD).
export function getRelatorioAtendimentos({ de, ate } = {}) {
  let rows = all().filter(a => a.status === 'atendido')
  if (de)  rows = rows.filter(a => (a.atendidoEm ?? '') >= de)
  if (ate) rows = rows.filter(a => (a.atendidoEm ?? '') <= ate + 'T23:59:59')
  return rows.sort((a, b) => (b.atendidoEm ?? '').localeCompare(a.atendidoEm ?? ''))
}
