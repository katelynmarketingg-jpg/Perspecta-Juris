import { usePortalAuthStore } from '../../stores/portalAuthStore'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconBriefcase, IconFolder, IconMessageCircle, IconDollar, IconArrowRight, IconCheck, IconClock } from '../../components/ui'

const MOCK_PROCESSES = [
  {
    id: '1', number: '0012345-67.2024.8.26.0100', area: 'Cível', title: 'Apelação Cível — Silva x ABC Comércio',
    status: 'active', lastMovement: 'Intimação para contrarrazões de apelação', lastMovementAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    phase: 'Recursal',
  },
  {
    id: '2', number: '0098765-43.2023.5.02.0001', area: 'Trabalhista', title: 'Reclamação Trabalhista — Férias + FGTS',
    status: 'active', lastMovement: 'Audiência de instrução designada para 15/06/2026', lastMovementAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    phase: 'Instrução',
  },
  {
    id: '3', number: '0001234-56.2022.8.26.0200', area: 'Família', title: 'Divórcio Consensual',
    status: 'closed', lastMovement: 'Sentença homologatória transitada em julgado', lastMovementAt: new Date(Date.now() - 86400000 * 90).toISOString(),
    phase: 'Encerrado',
  },
]

const MOCK_ENTRIES = [
  { id: '1', description: 'Honorários iniciais — Apelação Cível', amount: 5000, status: 'paid', date: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: '2', description: 'Parcela 2/3 — Reclamação Trabalhista', amount: 1600, status: 'pending', date: new Date(Date.now() + 86400000 * 10).toISOString() },
  { id: '3', description: 'Custas processuais — TJSP', amount: 450, status: 'pending', date: new Date(Date.now() + 86400000 * 5).toISOString() },
]

const MOCK_DOCS = [
  { id: '1', name: 'Procuração ad Judicia', type: 'PDF', date: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: '2', name: 'Petição Inicial — Apelação', type: 'PDF', date: new Date(Date.now() - 86400000 * 40).toISOString() },
  { id: '3', name: 'Acordo Extrajudicial', type: 'DOCX', date: new Date(Date.now() - 86400000 * 10).toISOString() },
]

const statusConfig = {
  active: { label: 'Em andamento', cls: 'badge-green' },
  closed: { label: 'Encerrado',    cls: 'badge-gray' },
  paused: { label: 'Suspenso',     cls: 'badge-yellow' },
}

const fmt = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

export default function PortalDashboard() {
  const client   = usePortalAuthStore(s => s.client)
  const navigate = useNavigate()

  const activeProcesses = MOCK_PROCESSES.filter(p => p.status === 'active').length
  const pendingAmount   = MOCK_ENTRIES.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-500/20 via-brand-500/10 to-transparent border border-brand-500/30 p-5">
        <p className="text-xs text-brand-500 font-semibold uppercase tracking-wider mb-1">Bem-vindo(a) de volta</p>
        <h1 className="text-xl font-bold text-white">{client?.name}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {activeProcesses} processo{activeProcesses !== 1 ? 's' : ''} ativo{activeProcesses !== 1 ? 's' : ''} · Atualizado agora
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Processos',    value: MOCK_PROCESSES.length,  sub: `${activeProcesses} ativos`,        icon: <IconBriefcase size={16} />, color: 'text-blue-400',    bg: 'bg-blue-900/30', to: '/portal/processes' },
          { label: 'Documentos',   value: MOCK_DOCS.length,       sub: '1 novo',                            icon: <IconFolder size={16} />,    color: 'text-amber-400',   bg: 'bg-amber-900/30', to: '/portal/documents' },
          { label: 'Mensagens',    value: 2,                      sub: '2 não lidas',                       icon: <IconMessageCircle size={16} />, color: 'text-purple-400', bg: 'bg-purple-900/30', to: '/portal/messages' },
          { label: 'A Pagar',      value: fmt(pendingAmount),     sub: 'valores pendentes',                 icon: <IconDollar size={16} />,    color: 'text-red-400',     bg: 'bg-red-900/30', to: null },
        ].map(k => (
          <button
            key={k.label}
            onClick={() => k.to && navigate(k.to)}
            className={`card p-4 text-left hover:border-[var(--border-strong)] transition-all ${k.to ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{k.label}</p>
              <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{k.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Processos recentes */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-white">Seus Processos</h2>
            <button onClick={() => navigate('/portal/processes')} className="text-xs text-accent-400 hover:text-white transition-colors flex items-center gap-1">
              Ver todos <IconArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {MOCK_PROCESSES.map(p => (
              <div key={p.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate('/portal/processes')}>
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white flex-1 min-w-0 leading-snug">{p.title}</p>
                  <span className={`badge ${statusConfig[p.status].cls} flex-shrink-0`}>{statusConfig[p.status].label}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                  <IconClock size={10} />
                  {p.lastMovement}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {format(new Date(p.lastMovementAt), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Financeiro + Docs */}
        <div className="space-y-4">
          {/* Financeiro */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Financeiro</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {MOCK_ENTRIES.map(e => (
                <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center ${e.status === 'paid' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
                    {e.status === 'paid' ? <IconCheck size={12} /> : <IconClock size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{e.description}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {e.status === 'paid' ? 'Pago em ' : 'Vence em '}
                      {format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${e.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {fmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Documentos recentes */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-white">Documentos Recentes</h2>
              <button onClick={() => navigate('/portal/documents')} className="text-xs text-accent-400 hover:text-white transition-colors flex items-center gap-1">
                Ver todos <IconArrowRight size={11} />
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {MOCK_DOCS.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] flex items-center justify-center">
                    <span className={`text-[9px] font-bold ${d.type === 'PDF' ? 'text-red-400' : 'text-blue-400'}`}>{d.type}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{d.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{format(new Date(d.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <IconArrowRight size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
