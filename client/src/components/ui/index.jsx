// ─────────────────────────────────────────────────────────────
//  Design System — Perspecta Juris
// ─────────────────────────────────────────────────────────────
import { forwardRef, useState, useRef, useEffect } from 'react'

// ── Button ────────────────────────────────────────────────────
export function Button({ variant = 'primary', size = 'md', className = '', loading, disabled, children, ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:   'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
    secondary: 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] hover:border-brand-300',
    ghost:     'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
    danger:    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm',
    success:   'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    link:      'text-brand-500 hover:text-brand-600 underline-offset-2 hover:underline p-0 h-auto',
  }
  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${variant !== 'link' ? sizes[size] : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────
export const Input = forwardRef(function Input({ label, error, hint, prefix, suffix, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-[var(--text-muted)] text-sm">{prefix}</span>}
        <input
          ref={ref}
          className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''} ${className}`}
          {...props}
        />
        {suffix && <span className="absolute right-3 text-[var(--text-muted)] text-sm">{suffix}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
})

// ── Textarea ──────────────────────────────────────────────────
export const Textarea = forwardRef(function Textarea({ label, error, rows = 4, className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>}
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-y ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})

// ── Select ────────────────────────────────────────────────────
export const Select = forwardRef(function Select({ label, error, placeholder, options = [], className = '', ...props }, ref) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>}
      <select
        ref={ref}
        className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})

// ── Card ──────────────────────────────────────────────────────
export function Card({ className = '', children, onClick, hover }) {
  return (
    <div
      className={`rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-card)] ${hover ? 'hover:shadow-[var(--shadow-card-hover)] cursor-pointer transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE_COLORS = {
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gray:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  brand:  'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
}

export function Badge({ color = 'gray', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_COLORS[color] ?? BADGE_COLORS.gray} ${className}`}>
      {children}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`animate-spin text-current ${className}`}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-modal)] animate-slide-up flex flex-col max-h-[90vh]`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <IconX size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border)]">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === tab.value
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-full">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ columns, data, loading, empty = 'Nenhum registro encontrado.', onRowClick }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Spinner size={32} className="text-brand-500" />
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--text-muted)]">{empty}</td></tr>
          ) : data.map((row, i) => (
            <tr
              key={row.id ?? i}
              className={`border-b border-[var(--border)] last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''} transition-colors`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-4xl mb-4 text-[var(--text-muted)]">{icon}</div>}
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </Modal>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon, color = 'brand', trend }) {
  const colors = {
    brand:  'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400',
    green:  'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    red:    'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    yellow: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text-primary)]">{value ?? '—'}</p>
          {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl text-lg ${colors[color]}`}>{icon}</div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          <span>{trend >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(trend)}% vs mês anterior</span>
        </div>
      )}
    </Card>
  )
}

// ── Minimal icon set (SVG) ────────────────────────────────────
export function IconX({ size = 20, ...p })              { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
export function IconSearch({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
export function IconPlus({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
export function IconEdit({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
export function IconTrash({ size = 20, ...p })          { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }
export function IconChevronRight({ size = 20, ...p }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="9 18 15 12 9 6"/></svg> }
export function IconChevronDown({ size = 20, ...p })  { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="6 9 12 15 18 9"/></svg> }
export function IconFilter({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> }
export function IconDownload({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
export function IconEye({ size = 20, ...p })            { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
export function IconCheck({ size = 20, ...p })          { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg> }
export function IconAlertCircle({ size = 20, ...p })    { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
export function IconCalendar({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
export function IconUser({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
export function IconUsers({ size = 20, ...p })          { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
export function IconFolder({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> }
export function IconDollar({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
export function IconBriefcase({ size = 20, ...p })      { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
export function IconClock({ size = 20, ...p })          { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
export function IconClipboard({ size = 20, ...p })      { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> }
export function IconBarChart({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
export function IconSettings({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
export function IconLogOut({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
export function IconSun({ size = 20, ...p })            { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
export function IconMoon({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
export function IconScale({ size = 20, ...p })          { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="3" x2="12" y2="21"/><path d="M3 9l9-7 9 7"/><path d="M5 20h14"/><path d="M3 9h4l2 6H3l2-6z"/><path d="M17 9h4l-2 6h-4l2-6z"/></svg> }
export function IconExternalLink({ size = 20, ...p })   { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> }
export function IconMenu({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
export function IconGrid({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
export function IconBuilding({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M16 11h.01"/></svg> }
export function IconChevronLeft({ size = 20, ...p })    { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="15 18 9 12 15 6"/></svg> }
export function IconTrendingUp({ size = 20, ...p })     { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> }
export function IconTrendingDown({ size = 20, ...p })   { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg> }
export function IconArrowRight({ size = 20, ...p })     { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> }
export function IconUpload({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> }
export function IconFileText({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
export function IconLink({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> }
export function IconPenTool({ size = 20, ...p })        { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> }
export function IconCopy({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> }
export function IconZap({ size = 20, ...p })            { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
export function IconBookOpen({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }
export function IconStar({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
export function IconToggleLeft({ size = 20, ...p })     { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/></svg> }
export function IconToggleRight({ size = 20, ...p })    { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/></svg> }
export function IconActivity({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
export function IconTag({ size = 20, ...p })            { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> }
export function IconBarChart2({ size = 20, ...p })      { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
export function IconPieChart({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> }
export function IconUsers2({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
export function IconSparkles({ size = 20, ...p })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/></svg> }
export function IconMessageCircle({ size = 20, ...p })  { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
export function IconSend({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> }
export function IconHome({ size = 20, ...p })           { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
export function IconShield({ size = 20, ...p })         { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
export function IconCalculator({ size = 20, ...p })     { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></svg> }

// ── CustomSelect ───────────────────────────────────────────────
export function CustomSelect({ value, onChange, options = [], placeholder = 'Selecionar...', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors w-full"
      >
        <span className="flex-1 text-left truncate">{selected?.label ?? placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-modal min-w-full max-h-52 overflow-y-auto py-0.5">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-2.5 py-1 text-xs transition-colors hover:bg-white/[0.05] flex items-center gap-1.5 ${
                o.value === value ? 'text-accent-400 font-medium' : 'text-[var(--text-secondary)]'
              }`}
            >
              {o.color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: o.color }} />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
