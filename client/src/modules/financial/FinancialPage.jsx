import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { IconPlus, IconTrendingUp, IconTrendingDown, IconCheck, IconClock } from '../../components/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MOCK_ENTRIES = [
  { id: '1', type: 'income', description: 'Honorários — Silva x ABC', amount: 5000, dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), status: 'pending', client: 'José Silva', processTitle: 'Apelação Cível' },
  { id: '2', type: 'income', description: 'Honorários — Trabalhista Santos', amount: 3200, dueDate: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'overdue', client: 'Maria Santos', processTitle: 'Reclamação Trabalhista' },
  { id: '3', type: 'income', description: 'Cota 50% — Divórcio Rodrigues', amount: 1800, dueDate: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'paid', client: 'Carlos Rodrigues', processTitle: 'Divórcio Consensual' },
  { id: '4', type: 'expense', description: 'Custas processuais — TJSP', amount: 450, dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'pending', client: null, processTitle: 'Execução Fiscal' },
  { id: '5', type: 'expense', description: 'Aluguel escritório', amount: 3500, dueDate: new Date(Date.now() + 86400000 * 15).toISOString(), status: 'pending', client: null, processTitle: null },
  { id: '6', type: 'expense', description: 'Software jurídico (assinatura)', amount: 299, dueDate: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'paid', client: null, processTitle: null },
]

const MOCK_CASHFLOW = [
  { month: 'Dez', receitas: 8200, despesas: 4100 },
  { month: 'Jan', receitas: 6500, despesas: 3800 },
  { month: 'Fev', receitas: 9800, despesas: 4200 },
  { month: 'Mar', receitas: 7200, despesas: 3900 },
  { month: 'Abr', receitas: 11500, despesas: 4800 },
  { month: 'Mai', receitas: 10000, despesas: 5200 },
]

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
  const [cashflow, setCashflow] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.financial.entries().catch(() => MOCK_ENTRIES),
      api.financial.cashflow().catch(() => MOCK_CASHFLOW),
    ]).then(([e, c]) => {
      setEntries(e)
      setCashflow(c)
    }).finally(() => setLoading(false))
  }, [])

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
          Vence {format(new Date(e.dueDate), "dd/MM/yyyy", { locale: ptBR })}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Financeiro</h1>
        <button className="btn-primary flex items-center gap-2">
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
    </div>
  )
}
