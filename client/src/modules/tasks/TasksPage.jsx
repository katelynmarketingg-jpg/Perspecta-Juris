import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { IconPlus, IconClock, IconX } from '../../components/ui'
import { registrar } from '../../lib/auditLog'

const COLUMNS = [
  { key: 'todo',  label: 'A Fazer',      dot: 'bg-[var(--text-muted)]' },
  { key: 'doing', label: 'Em Andamento', dot: 'bg-accent-400' },
  { key: 'done',  label: 'Finalizadas',  dot: 'bg-emerald-500' },
]

const fmtDate = (iso) => iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : ''

// dias até o vencimento (0 = hoje, <0 = atrasada)
function diasAte(dueDate) {
  if (!dueDate) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + (dueDate.length === 10 ? 'T00:00:00' : '')); due.setHours(0, 0, 0, 0)
  return Math.round((due - hoje) / 86400000)
}
// classificação de urgência
function urgencia(t) {
  if (t.status === 'done') return 'done'
  const d = diasAte(t.dueDate)
  if (d == null) return 'semdata'
  if (d <= 0) return 'hoje'       // hoje ou atrasada → vermelho
  if (d <= 7) return 'semana'     // próximos 7 dias → amarelo
  return 'depois'                 // 8+ dias → laranja claro
}
const URG = {
  hoje:    { bar: 'border-l-red-500',     chip: 'bg-red-500/15 text-red-400',       label: 'Hoje / atrasada' },
  semana:  { bar: 'border-l-amber-400',   chip: 'bg-amber-500/15 text-amber-400',   label: 'Próximos 7 dias' },
  depois:  { bar: 'border-l-orange-300',  chip: 'bg-orange-400/15 text-orange-300', label: '8 dias ou mais' },
  semdata: { bar: 'border-l-[var(--border)]', chip: 'bg-[var(--bg-hover)] text-[var(--text-muted)]', label: 'Sem data' },
  done:    { bar: 'border-l-emerald-500', chip: 'bg-emerald-500/15 text-emerald-400', label: 'Finalizadas' },
}

// ── Modal: nova tarefa ──────────────────────────────────────────────
function NewTaskModal({ users, currentUser, onCreated, onClose }) {
  const { showToast } = useUiStore()
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'normal', assignedTo: currentUser?.id ?? '' })
  const set = (k) => (e) => setForm(d => ({ ...d, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim()) { showToast('Informe o título.', 'error'); return }
    const assignee = users.find(u => u.id === form.assignedTo)
    const payload = {
      ...form, status: 'todo',
      assignedToName: assignee?.name ?? currentUser?.name ?? '',
      createdBy: currentUser?.id ?? '', createdByName: currentUser?.name ?? 'Usuário',
      acknowledged: false,
    }
    try {
      const created = await api.tasks.create(payload)
      showToast('Tarefa criada.', 'success')
      onCreated(created)
      onClose()
    } catch (e) { showToast(e.message || 'Erro ao criar.', 'error') }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Nova tarefa</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><IconX size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Título *</label>
            <input value={form.title} onChange={set('title')} className={inputCls} placeholder="Ex: Protocolar petição inicial" /></div>
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={set('description')} rows={3} className={inputCls} placeholder="Detalhes da tarefa..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Prazo</label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} /></div>
            <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={set('priority')} className={inputCls}>
                <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select></div>
          </div>
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Atribuir para</label>
            <select value={form.assignedTo} onChange={set('assignedTo')} className={inputCls}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === currentUser?.id ? ' (eu)' : ''}</option>)}
            </select></div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancelar</button>
          <button onClick={save} className="btn-primary text-sm">Criar tarefa</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: detalhe / ciência ────────────────────────────────────────
function TaskDetail({ task, currentUser, onAck, onReopen, onClose }) {
  const souRemetente = task.createdBy === currentUser?.id
  const resolvida = task.status === 'done'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Detalhe da tarefa</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><IconX size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-base font-semibold text-[var(--text-primary)]">{task.title}</p>
          {task.description && <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{task.description}</p>}
          <div className="text-xs text-[var(--text-muted)] space-y-1 pt-2 border-t border-[var(--border)]">
            <p>De <b className="text-[var(--text-secondary)]">{task.createdByName}</b> → para <b className="text-[var(--text-secondary)]">{task.assignedToName}</b></p>
            {task.dueDate && <p>Prazo: {fmtDate(task.dueDate)}</p>}
            {resolvida && <p className="text-emerald-400">✔ Finalizada por {task.completedByName} · {fmtDate(task.completedAt)}</p>}
            {task.acknowledged && <p className="text-blue-400">👁 Ciência dada por {task.createdByName}</p>}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2 flex-wrap">
          {resolvida && souRemetente && !task.acknowledged && (
            <button onClick={() => { onAck(task.id); onClose() }} className="text-sm px-3 py-2 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">👁 Dar ciência</button>
          )}
          {resolvida && souRemetente && (
            <button onClick={() => { onReopen(task.id); onClose() }} className="text-sm px-3 py-2 rounded-lg bg-orange-500/15 text-orange-300 hover:bg-orange-500/25">↻ Reabrir (seguir o caso)</button>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const currentUser = useAuthStore(s => s.user)
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('minhas')   // minhas | enviadas | todas
  const [urgFilter, setUrgFilter] = useState(null)  // hoje | semana | depois | null
  const [novo, setNovo] = useState(false)
  const [detail, setDetail] = useState(null)

  const load = () => api.tasks.list().then(d => setTasks(Array.isArray(d) ? d : (d?.data ?? []))).catch(() => setTasks([])).finally(() => setLoading(false))
  useEffect(() => {
    load()
    api.settings.users().then(u => setUsers(Array.isArray(u) ? u : (u?.data ?? []))).catch(() => setUsers([]))
  }, [])

  const patch = async (id, data) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    try { await api.tasks.update(id, data) } catch {}
  }
  const moveTask = (t, newStatus) => {
    const extra = newStatus === 'done'
      ? { status: 'done', completedBy: currentUser?.id, completedByName: currentUser?.name, completedAt: new Date().toISOString() }
      : { status: newStatus, completedBy: null, completedAt: null }
    patch(t.id, extra)
    if (newStatus === 'done' && t.status !== 'done') registrar('tarefa', `concluiu a tarefa "${t.title}"`, { clienteId: t.clientId })
  }
  const ack    = (id) => patch(id, { acknowledged: true, acknowledgedAt: new Date().toISOString() })
  const reopen = (id) => patch(id, { status: 'todo', acknowledged: false, completedBy: null, completedAt: null })

  // filtro por escopo
  const escopo = tasks.filter(t => {
    if (filtro === 'minhas')   return t.assignedTo === currentUser?.id
    if (filtro === 'enviadas') return t.createdBy === currentUser?.id
    return true
  })
  const visiveis = urgFilter ? escopo.filter(t => urgencia(t) === urgFilter) : escopo

  const abertas = escopo.filter(t => t.status !== 'done')
  const cont = {
    hoje:   abertas.filter(t => urgencia(t) === 'hoje').length,
    semana: abertas.filter(t => urgencia(t) === 'semana').length,
    depois: abertas.filter(t => urgencia(t) === 'depois').length,
  }
  const aguardandoCiencia = tasks.filter(t => t.status === 'done' && t.createdBy === currentUser?.id && !t.acknowledged).length
  const cols = COLUMNS.map(c => ({ ...c, tasks: visiveis.filter(t => t.status === c.key) }))

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Tarefas</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{abertas.length} em aberto · {escopo.filter(t => t.status === 'done').length} finalizadas</p>
        </div>
        <button onClick={() => setNovo(true)} className="btn-primary flex items-center gap-2"><IconPlus size={15} /> Nova Tarefa</button>
      </div>

      {/* Filtro de escopo */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {[['minhas', 'Minhas'], ['enviadas', 'Enviadas'], ['todas', 'Todas']].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filtro === k ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            {l}{k === 'enviadas' && aguardandoCiencia > 0 && <span className="ml-1 text-blue-300">({aguardandoCiencia})</span>}
          </button>
        ))}
      </div>

      {/* Discriminação por urgência */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {[['hoje', cont.hoje], ['semana', cont.semana], ['depois', cont.depois]].map(([k, n]) => (
          <button key={k} onClick={() => setUrgFilter(urgFilter === k ? null : k)}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${urgFilter === k ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-[var(--border)]'} ${k === 'hoje' ? 'bg-red-500/5' : k === 'semana' ? 'bg-amber-500/5' : 'bg-orange-400/5'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${k === 'hoje' ? 'bg-red-500' : k === 'semana' ? 'bg-amber-400' : 'bg-orange-300'}`} />
              <span className="text-2xl font-bold text-[var(--text-primary)]">{n}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">{URG[k].label}</p>
          </button>
        ))}
      </div>

      {/* Colunas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 overflow-auto pb-4">
          {cols.map(col => (
            <div key={col.key} className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${col.dot}`} /><span className="text-sm font-semibold text-[var(--text-primary)]">{col.label}</span></div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">{col.tasks.length}</span>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {col.tasks.length === 0 ? (
                  <div className="border border-dashed border-[var(--border)] rounded-xl p-6 text-center"><p className="text-xs text-[var(--text-muted)]">Nenhuma tarefa</p></div>
                ) : col.tasks.map(t => {
                  const u = urgencia(t)
                  const souRemetente = t.createdBy === currentUser?.id
                  const resolvidaParaMim = t.status === 'done' && souRemetente
                  return (
                    <div key={t.id} onClick={() => setDetail(t)}
                      className={`rounded-xl border border-[var(--border)] border-l-2 ${URG[u].bar} bg-[var(--bg-card)] p-3.5 space-y-2 hover:border-brand-500/40 transition-colors cursor-pointer`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>{t.title}</p>
                        {t.status !== 'done' && t.dueDate && (
                          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${URG[u].chip}`}>{diasAte(t.dueDate) <= 0 ? 'hoje' : `${diasAte(t.dueDate)}d`}</span>
                        )}
                      </div>
                      {t.description && <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">{t.description}</p>}

                      {t.status === 'done' && <p className="text-[10px] text-emerald-400">✔ Feita por {t.completedByName}</p>}
                      {resolvidaParaMim && !t.acknowledged && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">🔵 Resolvida — dar ciência</span>
                      )}
                      {t.acknowledged && <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300">👁 Ciente</span>}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.dueDate && <span className={`flex items-center gap-1 text-[10px] ${u === 'hoje' ? 'text-red-400' : u === 'semana' ? 'text-amber-400' : u === 'depois' ? 'text-orange-300' : 'text-[var(--text-muted)]'}`}><IconClock size={10} /> {fmtDate(t.dueDate)}</span>}
                          <span className="text-[10px] text-[var(--text-muted)] truncate">{filtro === 'enviadas' ? `→ ${t.assignedToName}` : t.assignedToName}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {col.key !== 'todo' && (
                            <button onClick={() => moveTask(t, col.key === 'done' ? 'doing' : 'todo')} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">←</button>
                          )}
                          {col.key !== 'done' && (
                            <button onClick={() => moveTask(t, col.key === 'todo' ? 'doing' : 'done')} className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-accent-400 hover:bg-brand-500/40">→</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {novo && <NewTaskModal users={users.length ? users : (currentUser ? [currentUser] : [])} currentUser={currentUser} onCreated={t => setTasks(prev => [t, ...prev])} onClose={() => setNovo(false)} />}
      {detail && <TaskDetail task={detail} currentUser={currentUser} onAck={ack} onReopen={reopen} onClose={() => setDetail(null)} />}
    </div>
  )
}
