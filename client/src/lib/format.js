// ── CPF / CNPJ ────────────────────────────────────────────────
export function formatCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function formatCnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function formatCpfCnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits)
}

export function formatPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export function formatCep(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{5})(\d{1,3})/, '$1-$2')
}

// ── Currency ─────────────────────────────────────────────────
export function formatCurrency(value, opts = {}) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(num)
}

export function parseCurrency(str) {
  if (typeof str === 'number') return str
  return parseFloat(
    String(str).replace(/[R$\s.]/g, '').replace(',', '.')
  ) || 0
}

// ── Dates ─────────────────────────────────────────────────────
export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', ...opts })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelative(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  const sec = Math.floor(diff / 1000)
  if (sec < 60)  return 'agora'
  if (sec < 3600) return `${Math.floor(sec / 60)}min atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  if (diff < 172800000) return 'ontem'
  return formatDate(iso)
}

export function toISODate(date) {
  if (!date) return null
  const d = new Date(date)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

export function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export function daysUntil(dueDate) {
  if (!dueDate) return null
  const diff = new Date(dueDate) - new Date()
  return Math.ceil(diff / 86400000)
}

// ── Process CNJ number ────────────────────────────────────────
export function formatProcessNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 20)
  // NNNNNNN-DD.AAAA.J.TT.OOOO
  return digits
    .replace(/(\d{7})(\d)/, '$1-$2')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{4})(\d)/, '$1.$2')
    .replace(/(\d{1})(\d)/, '$1.$2')
    .replace(/(\d{2})(\d)/, '$1.$2')
}

// ── Misc ──────────────────────────────────────────────────────
export function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function truncate(str, len = 40) {
  if (!str || str.length <= len) return str ?? ''
  return str.slice(0, len) + '…'
}

export function pluralize(count, singular, plural) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`
}
