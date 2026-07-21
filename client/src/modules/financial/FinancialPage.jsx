import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { IconPlus, IconTrendingUp, IconTrendingDown, IconCheck, IconClock } from '../../components/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

const statusConfig = {
  paid:    { label: 'Pago',    cls: 'badge-green' },
  pending: { label: 'Pendente',cls: 'badge-yellow' },
  overdue: { label: 'Vencido', cls: 'badge-red' },
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-xs shadow-modal">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function FinancialPage() {
  const [tab, setTab] = useState('receivable')
  const [entries, setEntries] = useState([])
  const [erroCarga, setErroCarga] = useState(false)
  const [cashflow, setCashflow] = useState([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [showNew, setShowNew] = useState(false)

  const load = () => {
    setErroCarga(false)
    Promise.all([
      api.financial.entries().catch(() => { setErroCarga(true); return [] }),
      api.financial.cashflow().catch(() => []),
      api.clients.list?.().catch(() => []) ?? Promise.resolve([]),
    ]).then(([e, c, cl]) => {
      const clients = Array.isArray(cl) ? cl : (cl?.data ?? [])
      setClients(clients)
      const nomePorId = Object.fromEntries(clients.map(x => [x.id, x.name]))
      // Honorários de êxito são estimativas (não caixa) — ficam fora do Financeiro/relatórios.
      // Normaliza o vocabulário: a aba do cliente usa receivable/payable; aqui usamos income/expense.
      const norm = (Array.isArray(e) ? e : [])
        .filter(x => x.feeKind !== 'exito' && x.status !== 'exito')
        .map(x => ({
          ...x,
          type: (x.type === 'income' || x.type === 'receivable') ? 'income' : 'expense',
          amount: Number(x.amount) || 0,
          client: x.client ?? nomePorId[x.clientId] ?? null,
        }))
      setEntries(norm)
      setCashflow(c)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const income   = entries.filter(e => e.type === 'income')
  const expenses = entries.filter(e => e.type === 'expense')

  const totalReceivable = income.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0)
  const totalPayable    = expenses.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0)
  const totalPaid       = income.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)
  const totalSpent      = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)

  const markPaid = async (id) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'paid' } : e))
    try { await api.financial.pay(id) } catch {}
  }

  const EntryRow = ({ e }) => (
    <div className="card p-4 flex items-start gap-3 hover:border-[var(--border-strong)] transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${e.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm font-medium text-white">{e.description}</p>
          <span className={`badge ${statusConfig[e.status]?.cls ?? 'badge-gray'}`}>{statusConfig[e.status]?.label}</span>
        </div>
        {(e.client || e.processTitle) && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{[e.client, e.processTitle].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
          <IconClock size={11} />
          {e.dueDate ? `Vence ${format(new Date(e.dueDate), "dd/MM/yyyy", { locale: ptBR })}` : 'Sem vencimento'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${e.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
          {e.type === 'expense' ? '−' : '+'}{fmt(e.amount)}
        </span>
        {e.status !== 'paid' && (
          <button onClick={() => markPaid(e.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors" title="Marcar como pago">
            <IconCheck size={14} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-5 page-enter">
      {erroCarga && (
        <div className="card p-4 border border-red-500/40 bg-red-500/5">
          <p className="text-sm text-red-300 font-medium">Não foi possível carregar os lançamentos do servidor.</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">A lista abaixo pode estar incompleta. Recarregue a página (Cmd+Shift+R). <b>Nada foi apagado</b> — é só uma falha de conexão.</p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Financeiro</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowNew(true)}>
          <IconPlus size={15} />
          Novo Lançamento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'A Receber', value: totalReceivable, icon: <IconTrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
          { label: 'A Pagar',   value: totalPayable,   icon: <IconTrendingDown size={16} />, color: 'text-red-400',     bg: 'bg-red-900/30' },
          { label: 'Recebido (mês)', value: totalPaid, icon: <IconTrendingUp size={16} />, color: 'text-blue-400',    bg: 'bg-blue-900/30' },
          { label: 'Pago (mês)',     value: totalSpent, icon: <IconTrendingDown size={16} />, color: 'text-amber-400',  bg: 'bg-amber-900/30' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{k.label}</p>
              <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { key: 'receivable', label: 'A Receber' },
          { key: 'payable',    label: 'A Pagar' },
          { key: 'cashflow',   label: 'Fluxo de Caixa' },
          { key: 'dre',        label: 'DRE' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-brand-500 text-accent-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="card p-8 flex justify-center"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'receivable' ? (
        <div className="space-y-2">
          {income.length === 0 ? <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma receita lançada.</div>
            : income.map(e => <EntryRow key={e.id} e={e} />)}
        </div>
      ) : tab === 'payable' ? (
        <div className="space-y-2">
          {expenses.length === 0 ? <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma despesa lançada.</div>
            : expenses.map(e => <EntryRow key={e.id} e={e} />)}
        </div>
      ) : tab === 'cashflow' ? (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-5">Fluxo de Caixa — Últimos 6 Meses</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cashflow} barGap={4} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#4a4a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a4a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9a9a9a' }} />
              <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#c2410c" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">DRE — Demonstrativo de Resultado</h3>
          <div className="space-y-1 text-sm">
            {[
              { label: 'Receita Bruta de Honorários', value: income.reduce((s, e) => s + e.amount, 0), positive: true },
              { label: '(−) Custas Processuais', value: -expenses.filter(e => e.description?.toLowerCase().includes('custa')).reduce((s, e) => s + e.amount, 0), positive: false },
              { label: '(−) Despesas Administrativas', value: -expenses.filter(e => !e.description?.toLowerCase().includes('custa')).reduce((s, e) => s + e.amount, 0), positive: false },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between py-2.5 ${i < 2 ? 'border-b border-[var(--border)]' : 'border-t-2 border-[var(--border-strong)] font-semibold'}`}>
                <span className="text-[var(--text-secondary)]">{row.label}</span>
                <span className={row.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(Math.abs(row.value))}</span>
              </div>
            ))}
            {(() => {
              const lucro = income.reduce((s, e) => s + e.amount, 0) - expenses.reduce((s, e) => s + e.amount, 0)
              return (
                <div className="flex justify-between py-2.5 border-t-2 border-brand-500 font-bold">
                  <span className="text-white">Resultado Líquido</span>
                  <span className={lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(lucro)}</span>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {showNew && <NovoLancamentoModal clients={clients} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
    </div>
  )
}

// ── Novo lançamento (receita/despesa) ─────────────────────────────
const FREQS = {
  unica:      { label: 'Única (não repete)', inc: null },
  diaria:     { label: 'Todo dia',           inc: { dias: 1 } },
  semanal:    { label: 'Toda semana',        inc: { dias: 7 } },
  quinzenal:  { label: 'A cada 15 dias',     inc: { dias: 14 } },
  mensal:     { label: 'Todo mês (dia X)',   inc: { meses: 1 } },
  bimestral:  { label: 'A cada 2 meses',     inc: { meses: 2 } },
  trimestral: { label: 'A cada 3 meses',     inc: { meses: 3 } },
  semestral:  { label: 'A cada 6 meses',     inc: { meses: 6 } },
  anual:      { label: 'Todo ano',           inc: { meses: 12 } },
}

function NovoLancamentoModal({ clients, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'receivable', description: '', amount: '', dueDate: '', clientId: '', status: 'pending', freq: 'unica', repeticoes: 12 })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(d => ({ ...d, [k]: e.target.value }))
  const recorrente = form.freq !== 'unica'

  const salvar = async () => {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const base = {
      type: form.type, description: form.description, status: form.status,
      amount: parseFloat(String(form.amount).replace(',', '.')) || 0,
      clientId: form.clientId || null,
    }
    try {
      const inc = FREQS[form.freq]?.inc
      if (!recorrente || !inc) {
        await api.financial.create({ ...base, dueDate: form.dueDate || null })
      } else {
        const n = Math.min(60, Math.max(1, parseInt(form.repeticoes) || 1))
        const grupo = 'rec_' + Math.random().toString(36).slice(2, 8)
        const start = form.dueDate ? new Date(form.dueDate + 'T00:00:00') : new Date()
        for (let i = 0; i < n; i++) {
          const d = new Date(start)
          if (inc.dias)  d.setDate(d.getDate() + inc.dias * i)
          if (inc.meses) d.setMonth(d.getMonth() + inc.meses * i)
          await api.financial.create({
            ...base, description: `${form.description} (${i + 1}/${n})`,
            dueDate: d.toISOString().slice(0, 10),
            recorrenciaId: grupo, frequencia: form.freq,
          })
        }
      }
    } catch {}
    setSaving(false)
    onSaved()
  }
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none'
  const lbl = 'text-xs font-medium text-[var(--text-secondary)] mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-white">Novo lançamento</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo</label>
              <select value={form.type} onChange={set('type')} className={inputCls}>
                <option value="receivable">A receber</option>
                <option value="payable">A pagar</option>
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
          </div>
          <div><label className={lbl}>Descrição *</label>
            <input value={form.description} onChange={set('description')} placeholder="Ex.: Honorários — Fulano" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Valor (R$) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0,00" className={inputCls} />
            </div>
            <div><label className={lbl}>Vencimento</label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} />
            </div>
          </div>
          <div><label className={lbl}>Cliente (opcional)</label>
            <select value={form.clientId} onChange={set('clientId')} className={inputCls}>
              <option value="">Nenhum</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {/* Frequência / recorrência */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Frequência</label>
              <select value={form.freq} onChange={set('freq')} className={inputCls}>
                {Object.entries(FREQS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {recorrente && (
              <div><label className={lbl}>Quantas vezes</label>
                <input type="number" min="1" max="60" value={form.repeticoes} onChange={set('repeticoes')} className={inputCls} />
              </div>
            )}
          </div>
          {recorrente && <p className="text-[11px] text-[var(--text-muted)]">Serão criados <b>{Math.min(60, Math.max(1, parseInt(form.repeticoes) || 1))}</b> lançamentos ({FREQS[form.freq].label.toLowerCase()}), a partir do vencimento.</p>}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white">Cancelar</button>
          <button onClick={salvar} disabled={saving || !form.description.trim() || !form.amount} className="btn-primary text-sm disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
