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

// Máscara de telefone.
//
// Antes o hífen saía mesmo sem nada depois dele: `(\d{0,4})` casa com vazio,
// então seis dígitos viravam "(51) 9977-". Num campo controlado isso TRAVA o
// apagar — a pessoa dá backspace no hífen, os dígitos não mudam, a máscara
// repõe o hífen, e o valor volta exatamente igual. Não há tecla que resolva:
// o campo fica preso ali para sempre.
//
// A regra, e vale para qualquer máscara: separador só entra quando há algo
// depois dele.
export function formatPhone(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`                 // ainda digitando o DDD

  const tamanhoDoPrefixo = d.length > 10 ? 5 : 4    // celular (9 dígitos) ou fixo (8)
  const prefixo = d.slice(2, 2 + tamanhoDoPrefixo)
  const sufixo  = d.slice(2 + tamanhoDoPrefixo)
  return `(${d.slice(0, 2)}) ${prefixo}` + (sufixo ? `-${sufixo}` : '')
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

// ── Número do processo (padrão CNJ) ───────────────────────────
//
// NNNNNNN-DD.AAAA.J.TT.OOOO
//
// A versão anterior encadeava cinco `replace` sobre o texto JÁ formatado, e
// cada regex casa a PRIMEIRA ocorrência em qualquer lugar da string — não a
// posição pretendida. O resultado era o número embaralhado:
//
//   00012341220268260100  →  0.0.01.23.4-1220268260100
//
// E isso ia para o banco: o campo é gravado já formatado. Número de processo
// torto não é cosmético — é por ele que a publicação do Diário encontra o
// processo. Publicação que não casa é prazo que ninguém vê.
//
// Agora o corte é por POSIÇÃO, que é como o padrão CNJ é definido, e o
// separador só entra quando há algo depois dele (senão o campo trava no
// apagar, como travava o telefone).
const PARTES_CNJ = [
  [0,  7,  ''],   // número sequencial
  [7,  9,  '-'],  // dígito verificador
  [9,  13, '.'],  // ano
  [13, 14, '.'],  // segmento do Judiciário
  [14, 16, '.'],  // tribunal
  [16, 20, '.'],  // unidade de origem
]

export function formatProcessNumber(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 20)
  if (!d) return ''
  let saida = ''
  for (const [inicio, fim, separador] of PARTES_CNJ) {
    const pedaco = d.slice(inicio, fim)
    if (!pedaco) break
    saida += (saida ? separador : '') + pedaco
  }
  return saida
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
