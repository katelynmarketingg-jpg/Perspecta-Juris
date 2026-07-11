import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../lib/api'
import { formatCurrency, formatDate, daysUntil } from '../../lib/format'
import { LEGAL_AREAS } from '../../lib/constants'
import { useAuthStore } from '../../stores/authStore'
import {
  KpiCard, Card, Badge, Spinner, Button,
  IconUsers, IconBriefcase, IconDollar, IconCalendar, IconClipboard, IconPlus,
} from '../../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

// ── helpers de agregação mensal ────────────────────────────────────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthKey = (iso) => { const d = new Date(iso); return isNaN(d) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const arr = (r) => Array.isArray(r) ? r : (r?.data ?? [])
const isEntrada = (e) => ['income', 'receivable', 'revenue'].includes(e.type)
const areaLabel = (v) => LEGAL_AREAS.find(a => a.value === v)?.label ?? (v || 'Não informada')
const AREA_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16', '#6366f1', '#14b8a6', '#a855f7']

// últimos N meses como [{key:'2026-07', label:'jul/26'}]
function ultimosMeses(n) {
  const out = []
  const d = new Date(); d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: `${MESES[m.getMonth()]}/${String(m.getFullYear()).slice(2)}` })
  }
  return out
}
// próximos N meses (inclui o atual)
function proximosMeses(n) {
  const out = []
  const d = new Date(); d.setDate(1)
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1)
    out.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: `${MESES[m.getMonth()]}/${String(m.getFullYear()).slice(2)}` })
  }
  return out
}

function DeadlineRow({ deadline }) {
  const days = daysUntil(deadline.dueDate)
  const color = days == null ? 'gray' : days < 0 ? 'red' : days === 0 ? 'red' : days <= 3 ? 'yellow' : 'blue'
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{deadline.title}</p>
        <p className="text-xs text-[var(--text-muted)]">{formatDate(deadline.dueDate)}</p>
      </div>
      <Badge color={color}>
        {days == null ? '—' : days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? 'Hoje' : `${days}d`}
      </Badge>
    </div>
  )
}

export default function DashboardPage() {
  const { user, tenant } = useAuthStore()
  const navigate = useNavigate()
  const [clients, setClients]       = useState([])
  const [processes, setProcesses]   = useState([])
  const [entries, setEntries]       = useState([])
  const [deadlines, setDeadlines]   = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.clients.list(),
      api.processes.list(),
      api.financial.entries(),
      api.deadlines.upcoming().catch(() => []),
    ]).then(([c, p, f, d]) => {
      setClients(arr(c)); setProcesses(arr(p)); setEntries(arr(f)); setDeadlines(arr(d))
    }).finally(() => setLoading(false))
  }, [])

  // ── Métricas computadas ──────────────────────────────────────────
  const M = useMemo(() => {
    const mesAtual = monthKey(new Date().toISOString())
    const meses6 = ultimosMeses(6)
    const prox6 = proximosMeses(6)

    // Entrada de caixa (recebido) por mês — usa paidAt, senão dueDate/createdAt
    const caixaPorMes = Object.fromEntries(meses6.map(m => [m.key, 0]))
    entries.filter(e => isEntrada(e) && e.status === 'paid').forEach(e => {
      const k = monthKey(e.paidAt || e.dueDate || e.createdAt)
      if (k in caixaPorMes) caixaPorMes[k] += (e.amount ?? 0)
    })
    const entradaCaixa = meses6.map(m => ({ label: m.label, valor: Math.round(caixaPorMes[m.key]) }))

    // Novos clientes por mês
    const cliPorMes = Object.fromEntries(meses6.map(m => [m.key, 0]))
    clients.forEach(c => { const k = monthKey(c.createdAt); if (k in cliPorMes) cliPorMes[k]++ })
    const novosClientes = meses6.map(m => ({ label: m.label, valor: cliPorMes[m.key] }))

    // Processos por área
    const areaCount = {}
    processes.forEach(p => { const a = p.area || 'outro'; areaCount[a] = (areaCount[a] ?? 0) + 1 })
    const porArea = Object.entries(areaCount)
      .map(([a, n]) => ({ area: areaLabel(a), valor: n }))
      .sort((x, y) => y.valor - x.valor)

    // Previsão de entrada (a receber pendente) por mês de vencimento
    const prevPorMes = Object.fromEntries(prox6.map(m => [m.key, 0]))
    let previsaoTotal = 0, vencidosReceber = 0
    entries.filter(e => isEntrada(e) && e.status !== 'paid' && e.status !== 'cancelled').forEach(e => {
      const val = e.amount ?? 0
      const k = monthKey(e.dueDate)
      if (k && k in prevPorMes) { prevPorMes[k] += val; previsaoTotal += val }
      else if (e.dueDate && new Date(e.dueDate) < new Date()) vencidosReceber += val
    })
    const previsao = prox6.map(m => ({ label: m.label, valor: Math.round(prevPorMes[m.key]) }))

    return {
      entradaCaixa, novosClientes, porArea, previsao,
      caixaMesAtual: Math.round(caixaPorMes[mesAtual] ?? 0),
      novosClientesMes: cliPorMes[mesAtual] ?? 0,
      previsaoMesAtual: Math.round(prevPorMes[mesAtual] ?? 0),
      vencidosReceber: Math.round(vencidosReceber),
      clientesAtivos: clients.filter(c => c.isActive !== false).length,
      processosAtivos: processes.filter(p => p.status === 'active').length,
    }
  }, [clients, processes, entries])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{tenant?.name} — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/app/clients/new')}><IconPlus size={14} /> Cliente</Button>
          <Button variant="primary"   size="sm" onClick={() => navigate('/app/processes/new')}><IconPlus size={14} /> Processo</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size={32} className="text-brand-500" /></div>
      ) : (
        <>
          {/* KPIs mensais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Entrada de caixa (mês)"  value={formatCurrency(M.caixaMesAtual)}     icon={<IconDollar size={18} />}    color="green" />
            <KpiCard label="Novos clientes (mês)"    value={M.novosClientesMes}                  icon={<IconUsers size={18} />}     color="brand" />
            <KpiCard label="Previsão a receber (mês)" value={formatCurrency(M.previsaoMesAtual)} icon={<IconDollar size={18} />}    color="blue" />
            <KpiCard label="Clientes ativos"         value={M.clientesAtivos}                    icon={<IconUsers size={18} />}     color="purple" />
            <KpiCard label="Processos ativos"        value={M.processosAtivos}                   icon={<IconBriefcase size={18} />} color="yellow" />
          </div>

          {M.vencidosReceber > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-red-300">⚠️ {formatCurrency(M.vencidosReceber)} em recebimentos vencidos (boletos não pagos).</p>
              <Link to="/app/financial" className="text-xs text-red-300 hover:underline">Ver financeiro</Link>
            </div>
          )}

          {/* Entrada de caixa + Novos clientes */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">💰 Entrada de caixa — últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={M.entradaCaixa} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={v => [formatCurrency(v), 'Recebido']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="valor" fill="#22c55e" radius={[4, 4, 0, 0]} name="Recebido" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">👥 Entrada de clientes — últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={M.novosClientes} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip formatter={v => [v, 'Novos clientes']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="valor" fill="#f97316" radius={[4, 4, 0, 0]} name="Novos clientes" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Processos por área + Previsão de entrada */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">⚖️ Processos por área jurídica</h3>
              {M.porArea.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-10">Nenhum processo cadastrado ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, M.porArea.length * 34)}>
                  <BarChart data={M.porArea} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => [v, 'Processos']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--bg-hover)' }} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} name="Processos">
                      {M.porArea.map((_, i) => <Cell key={i} fill={AREA_COLORS[i % AREA_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">📈 Previsão de entrada (boletos a receber)</h3>
                <span className="text-xs text-[var(--text-muted)]">Total 6m: <b className="text-emerald-400">{formatCurrency(M.previsao.reduce((s, x) => s + x.valor, 0))}</b></span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={M.previsao} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={v => [formatCurrency(v), 'Previsto']} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Previsto" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-[var(--text-muted)] mt-2">Baseado nos lançamentos "a receber" por mês de vencimento. Integração com boletos (Asaas) em breve.</p>
            </Card>
          </div>

          {/* Próximos prazos */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Próximos Prazos</h3>
              <Link to="/app/deadlines" className="text-xs text-brand-500 hover:underline">Ver todos</Link>
            </div>
            {!deadlines.length ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">Nenhum prazo nos próximos 30 dias.</p>
            ) : (
              <div>{deadlines.slice(0, 6).map(d => <DeadlineRow key={d.id} deadline={d} />)}</div>
            )}
          </Card>

          {/* Quick actions */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Novo Cliente',    icon: <IconUsers size={18} />,     to: '/app/clients/new',    color: 'bg-brand-500' },
              { label: 'Novo Processo',   icon: <IconBriefcase size={18} />, to: '/app/processes/new',  color: 'bg-blue-500' },
              { label: 'Novo Prazo',      icon: <IconCalendar size={18} />,  to: '/app/deadlines',      color: 'bg-amber-500' },
              { label: 'Nova Tarefa',     icon: <IconClipboard size={18} />, to: '/app/tasks',          color: 'bg-purple-500' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.to)}
                className="card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-card-hover)] transition-all text-left">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${a.color} flex-shrink-0`}>{a.icon}</div>
                <span className="text-sm font-medium text-[var(--text-primary)]">{a.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
