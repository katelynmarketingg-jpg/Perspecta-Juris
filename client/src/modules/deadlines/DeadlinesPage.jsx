import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { IconCalendar, IconPlus, IconCheck, IconClock, IconChevronLeft, IconChevronRight } from '../../components/ui'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MOCK = [
  { id: '1', title: 'Contestação — Silva x Construtora ABC', dueDate: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'pending', processTitle: 'Ação de Indenização 0001234' },
  { id: '2', title: 'Prazo recursal — Apelação', dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'pending', processTitle: 'Apelação Cível 0004521' },
  { id: '3', title: 'Petição inicial', dueDate: new Date(Date.now() + 86400000 * 10).toISOString(), status: 'pending', processTitle: 'Trabalhista 0007890' },
  { id: '4', title: 'Audiência de conciliação', dueDate: new Date(Date.now() + 86400000 * 1).toISOString(), status: 'pending', processTitle: 'Divórcio Consensual 0002345' },
  { id: '5', title: 'Recurso de Embargos', dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'done', processTitle: 'Execução Fiscal 0006789' },
]

function deadlineStatus(d) {
  if (d.status === 'done') return 'done'
  const d0 = new Date(d.dueDate); d0.setHours(0, 0, 0, 0)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((d0 - hoje) / 86400000)
  if (dias <= 0)  return 'overdue'   // hoje ou vencido → vermelho
  if (dias <= 7)  return 'soon'      // próximos 7 dias → amarelo
  return 'upcoming'                  // 8 dias ou mais → laranja claro
}

const STATUS = {
  overdue:  { label: 'Hoje / Vencido', cls: 'badge-red',    dot: 'bg-red-500',    text: 'text-red-400' },
  soon:     { label: 'Próx. 7 dias',   cls: 'badge-yellow',  dot: 'bg-amber-400',  text: 'text-amber-400' },
  upcoming: { label: '8+ dias',        cls: 'badge-orange',  dot: 'bg-orange-300', text: 'text-orange-300' },
  done:     { label: 'Concluído',      cls: 'badge-green',   dot: 'bg-emerald-500',text: 'text-emerald-400' },
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.deadlines.list()
      .then(d => setDeadlines(d))
      .catch(() => setDeadlines(MOCK))
      .finally(() => setLoading(false))
  }, [])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  })

  const filtered = deadlines.filter(d => {
    if (filter === 'pending') return d.status !== 'done'
    if (filter === 'done')    return d.status === 'done'
    if (filter === 'overdue') return deadlineStatus(d) === 'overdue'
    return true
  })

  const counts = {
    all:     deadlines.length,
    pending: deadlines.filter(d => d.status !== 'done').length,
    overdue: deadlines.filter(d => deadlineStatus(d) === 'overdue').length,
    done:    deadlines.filter(d => d.status === 'done').length,
  }

  const markDone = async (id) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: 'done' } : d))
    try { await api.deadlines.complete(id) } catch {}
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Prazos</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {counts.overdue > 0 && <span className="text-red-400">{counts.overdue} vencido{counts.overdue > 1 ? 's' : ''} · </span>}
            {counts.pending} pendente{counts.pending !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <IconPlus size={15} />
          Novo Prazo
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['all','Todos'],['pending','Pendentes'],['overdue','Vencidos'],['done','Concluídos']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === key ? 'bg-brand-500 border-brand-600 text-white' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-white'}`}>
            {label} <span className="opacity-50 ml-0.5">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* Calendar */}
        <div className="card p-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><IconChevronLeft size={15} /></button>
            <span className="text-sm font-semibold text-white capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</span>
            <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><IconChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-[var(--text-muted)] py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map(day => {
              const inMth  = day.getMonth() === month.getMonth()
              const today  = isSameDay(day, new Date())
              const items  = deadlines.filter(d => isSameDay(new Date(d.dueDate), day))
              const sts    = items.map(d => deadlineStatus(d))
              return (
                <div key={day.toISOString()}
                  className={`flex flex-col items-center py-1.5 rounded text-xs cursor-default ${today ? 'bg-brand-500 text-white font-bold' : inMth ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]' : 'text-[var(--text-muted)]'}`}>
                  {format(day, 'd')}
                  {items.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {sts.includes('overdue')  && <span className="w-1 h-1 rounded-full bg-red-500" />}
                      {sts.includes('soon')     && <span className="w-1 h-1 rounded-full bg-amber-400" />}
                      {sts.includes('upcoming') && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-3 flex-wrap">
            {[['bg-red-500','Vencido'],['bg-amber-400','Urgente'],['bg-blue-400','A vencer']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <span className={`w-1.5 h-1.5 rounded-full ${c}`} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="card p-8 flex justify-center"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="card p-10 text-center">
              <IconCalendar size={28} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum prazo encontrado.</p>
            </div>
          ) : filtered.map(d => {
            const st = deadlineStatus(d)
            const cfg = STATUS[st]
            return (
              <div key={d.id} className={`card p-4 flex items-start gap-3 hover:border-[var(--border-strong)] transition-colors ${st === 'done' ? 'opacity-50' : ''}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`text-sm font-medium ${st === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-white'}`}>{d.title}</p>
                    <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{d.processTitle}</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${cfg.text}`}>
                    <IconClock size={11} />
                    {format(new Date(d.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                {st !== 'done' && (
                  <button onClick={() => markDone(d.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors" title="Concluir">
                    <IconCheck size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
