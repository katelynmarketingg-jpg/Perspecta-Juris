import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { IconBarChart2, IconPieChart, IconUsers2, IconTrendingUp, IconDollar, CustomSelect } from '../../components/ui'
import { getRelatorioAtendimentos, esperaMin, tipoAtend } from '../../lib/atendimentos'
import api from '../../lib/api'

const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

const PIE_COLORS = ['#c2410c', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-xs shadow-modal">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? fmt(p.value) : `${p.value}${p.dataKey === 'taxa' ? '%' : ''}`}
        </p>
      ))}
    </div>
  )
}

const PERIOD_OPTIONS = [
  { value: '30d',  label: 'Últimos 30 dias' },
  { value: '90d',  label: 'Últimos 90 dias' },
  { value: '6m',   label: 'Últimos 6 meses' },
  { value: '12m',  label: 'Últimos 12 meses' },
]

export default function ReportsPage() {
  const [period, setPeriod] = useState('6m')
  const [tab, setTab]       = useState('commercial')

  // Números REAIS do escritório (antes eram valores fixos no código).
  const MESES_POR_PERIODO = { '30d': 1, '90d': 3, '6m': 6, '12m': 12 }
  const [rep, setRep] = useState({ byArea: [], byLawyer: [], monthly: [], totals: {} })
  const [carregando, setCarregando] = useState(true)
  useEffect(() => {
    setCarregando(true)
    api.reports.summary({ months: MESES_POR_PERIODO[period] ?? 6 })
      .then(r => setRep({ byArea: r?.byArea ?? [], byLawyer: r?.byLawyer ?? [], monthly: r?.monthly ?? [], totals: r?.totals ?? {} }))
      .catch(() => setRep({ byArea: [], byLawyer: [], monthly: [], totals: {} }))
      .finally(() => setCarregando(false))
  }, [period])

  const BY_AREA   = rep.byArea
  const BY_LAWYER = rep.byLawyer
  const MONTHLY   = rep.monthly
  const semDados  = !carregando && BY_AREA.length === 0 && MONTHLY.every(m => !m.honorarios && !m.custas)

  const totalReceita   = rep.totals.receitaTotal ?? BY_AREA.reduce((s, a) => s + a.receita, 0)
  const totalProcessos = rep.totals.processos ?? BY_AREA.reduce((s, a) => s + a.processos, 0)
  const melhorArea     = [...BY_AREA].sort((a, b) => b.receita - a.receita)[0]

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-white">Relatórios Comerciais</h1>
        <CustomSelect
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          className="w-44"
        />
      </div>

      {semDados && (
        <div className="card p-4 border border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-300">Ainda não há dados neste período.</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Os relatórios são calculados a partir dos seus processos e lançamentos financeiros pagos. Conforme você usar o sistema, os números aparecem aqui.</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Receita Total',     value: fmt(totalReceita),   icon: <IconDollar size={16} />,       color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
          { label: 'Processos Ativos',  value: totalProcessos,      icon: <IconBarChart2 size={16} />,    color: 'text-blue-400',    bg: 'bg-blue-900/30' },
          { label: 'A Receber',         value: fmt(rep.totals.aReceber ?? 0), icon: <IconTrendingUp size={16} />, color: 'text-amber-400', bg: 'bg-amber-900/30' },
          { label: 'Melhor Área',       value: melhorArea?.area ?? '—',     icon: <IconPieChart size={16} />,     color: 'text-brand-500',   bg: 'bg-brand-500/20' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{k.label}</p>
              <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className={`text-xl font-bold ${k.color} truncate`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { key: 'commercial', label: 'Por Área Jurídica' },
          { key: 'lawyers',    label: 'Por Advogado' },
          { key: 'monthly',    label: 'Evolução Mensal' },
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

      {/* Por Área Jurídica */}
      {tab === 'commercial' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart receita */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Receita por Área</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={BY_AREA} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="area" tick={{ fill: '#4a4a4a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a4a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="receita" name="Receita" fill="#c2410c" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart distribuição */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Distribuição de Processos</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={BY_AREA}
                      dataKey="processos"
                      nameKey="area"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={48}
                    >
                      {BY_AREA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-shrink-0">
                  {BY_AREA.map((a, i) => (
                    <div key={a.area} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[var(--text-muted)]">{a.area}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Área</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Processos</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Receita</th>
                </tr>
              </thead>
              <tbody>
                {[...BY_AREA].sort((a, b) => b.receita - a.receita).map((a, i) => (
                  <tr key={a.area} className={`border-b border-[var(--border)] last:border-0 ${i === 0 ? 'bg-brand-500/5' : ''}`}>
                    <td className="px-4 py-3 text-white font-medium">{a.area}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{a.processos}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(a.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Por Advogado */}
      {tab === 'lawyers' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Receita por Advogado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={BY_LAWYER} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#4a4a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9a9a9a', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="receita" name="Receita" fill="#fb923c" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Advogado</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Processos</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Receita</th>
                </tr>
              </thead>
              <tbody>
                {BY_LAWYER.map((l, i) => (
                  <tr key={l.name} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-bold text-white">
                          {l.name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{l.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{l.processos}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(l.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolução Mensal */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Honorários vs Despesas — Últimos 6 Meses</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={MONTHLY} barGap={4} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#4a4a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a4a4a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9a9a9a' }} />
                <Bar dataKey="honorarios" name="Honorários"  fill="#c2410c" radius={[3,3,0,0]} />
                <Bar dataKey="custas"     name="Custas/Desp" fill="#7c3aed" radius={[3,3,0,0]} />
                <Bar dataKey="liquido"    name="Líquido"     fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Mês</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Honorários</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Custas</th>
                  <th className="px-4 py-3 text-right text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {MONTHLY.map((m, i) => (
                  <tr key={m.month} className={`border-b border-[var(--border)] last:border-0 ${i === MONTHLY.length - 1 ? 'bg-brand-500/5 font-semibold' : ''}`}>
                    <td className="px-4 py-3 text-white">{m.month}{i === MONTHLY.length - 1 ? ' (atual)' : ''}</td>
                    <td className="px-4 py-3 text-right text-accent-400">{fmt(m.honorarios)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{fmt(m.custas)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{fmt(m.liquido)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-app)]">
                  <td className="px-4 py-3 text-white font-bold">Total</td>
                  <td className="px-4 py-3 text-right text-accent-400 font-bold">{fmt(MONTHLY.reduce((s,m) => s + m.honorarios, 0))}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-bold">{fmt(MONTHLY.reduce((s,m) => s + m.custas, 0))}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">{fmt(MONTHLY.reduce((s,m) => s + m.liquido, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RelatorioAtendimentos />
    </div>
  )
}

// ── Relatório de atendimentos (tempo de espera, quem atendeu) ──────
function RelatorioAtendimentos() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const rows = getRelatorioAtendimentos({ de, ate })
  const totalEspera = rows.reduce((s, a) => s + esperaMin(a), 0)
  const mediaEspera = rows.length ? Math.round(totalEspera / rows.length) : 0

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">📞 Atendimentos</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Período:</span>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-white focus:border-brand-500 focus:outline-none" />
          <span className="text-[11px] text-[var(--text-muted)]">até</span>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-white focus:border-brand-500 focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[var(--bg-hover)] p-3"><p className="text-[11px] text-[var(--text-muted)]">Atendimentos</p><p className="text-xl font-bold text-white">{rows.length}</p></div>
        <div className="rounded-lg bg-[var(--bg-hover)] p-3"><p className="text-[11px] text-[var(--text-muted)]">Espera média</p><p className="text-xl font-bold text-amber-400">{mediaEspera} min</p></div>
        <div className="rounded-lg bg-[var(--bg-hover)] p-3"><p className="text-[11px] text-[var(--text-muted)]">Espera total</p><p className="text-xl font-bold text-white">{totalEspera} min</p></div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum atendimento no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
              <th className="px-2 py-2">Cliente</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Atendido por</th><th className="px-2 py-2 text-right">Espera</th><th className="px-2 py-2 text-right">Quando</th>
            </tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-b border-[var(--border)]/50">
                  <td className="px-2 py-2 text-white">{a.clientName || '—'}</td>
                  <td className="px-2 py-2 text-[var(--text-secondary)]">{tipoAtend(a.tipo).icone} {tipoAtend(a.tipo).label}</td>
                  <td className="px-2 py-2 text-[var(--text-secondary)]">{a.atendidoPor || '—'}</td>
                  <td className="px-2 py-2 text-right text-amber-400">{esperaMin(a)} min</td>
                  <td className="px-2 py-2 text-right text-[var(--text-muted)] text-xs">{a.atendidoEm ? new Date(a.atendidoEm).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
