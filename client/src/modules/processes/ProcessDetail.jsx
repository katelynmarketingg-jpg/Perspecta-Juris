import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '../../lib/api'
import { formatDate, formatDateTime, formatCurrency, truncate } from '../../lib/format'
import { LEGAL_AREAS, MOVEMENT_TYPES } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import {
  Button, Card, Badge, Tabs, Table, EmptyState, Spinner, Modal,
  Input, Select, Textarea, IconEdit, IconPlus, IconCalendar, IconDollar,
  IconFolder, IconClipboard,
} from '../../components/ui'
import AssinaturasTab from './AssinaturasTab'
import DiarioModal from './DiarioModal'

const STATUS_COLORS = { active: 'blue', won: 'green', lost: 'red', settled: 'purple', archived: 'gray' }
const STATUS_LABELS = { active: 'Ativo', won: 'Ganho', lost: 'Perdido', settled: 'Acordo', archived: 'Arquivado' }
const PRIORITY_COLORS = { urgent: 'red', high: 'yellow', normal: 'blue', low: 'gray' }
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' }

const TABS = [
  { value: 'timeline',    label: 'Movimentações', icon: '📋' },
  { value: 'assinaturas', label: 'Assinaturas', icon: '✍️' },
  { value: 'deadlines',   label: 'Prazos', icon: '⏰' },
  { value: 'financial',   label: 'Financeiro', icon: '💰' },
  { value: 'documents',   label: 'Documentos', icon: '📁' },
  { value: 'info',        label: 'Dados', icon: 'ℹ️' },
]

function MovementForm({ processId, onCreated, onClose }) {
  const { showToast } = useUiStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', type: 'outro', author: '', isPublic: false })
  const set = f => e => setForm(d => ({ ...d, [f]: e?.target?.type === 'checkbox' ? e.target.checked : (e?.target ? e.target.value : e) }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return
    setLoading(true)
    try {
      await api.processes.addMovement(processId, form)
      showToast('Movimentação adicionada.', 'success')
      onCreated()
      onClose()
    } catch { showToast('Erro ao salvar movimentação.', 'error') } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Data" type="date" value={form.date} onChange={set('date')} required />
        <Select label="Tipo" value={form.type} onChange={set('type')} options={MOVEMENT_TYPES} />
      </div>
      <Textarea label="Descrição *" value={form.description} onChange={set('description')} rows={4} placeholder="Descreva a movimentação..." required />
      <Input label="Autor / Origem" value={form.author} onChange={set('author')} placeholder="Ex: 2ª Vara Cível de São Paulo" />
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input type="checkbox" checked={form.isPublic} onChange={set('isPublic')} className="rounded border-[var(--border)]" />
        Visível no portal do cliente
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={loading}>Adicionar</Button>
      </div>
    </form>
  )
}

export default function ProcessDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const { user } = useAuthStore()

  const [process, setProcess]     = useState(null)
  const [movements, setMovements] = useState([])
  const [deadlines, setDeadlines] = useState([])
  const [financial, setFinancial] = useState([])
  const [tab, setTab]             = useState('timeline')
  const [loading, setLoading]     = useState(true)
  const [showMovModal, setShowMovModal]     = useState(false)
  const [showDiario, setShowDiario]         = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const statusRef = useRef(null)

  useEffect(() => {
    const h = e => { if (!statusRef.current?.contains(e.target)) setShowStatusPicker(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const changeStatus = async (newStatus) => {
    if (newStatus === process.status) { setShowStatusPicker(false); return }
    try {
      await api.processes.update(id, { status: newStatus })
      await loadProcess()
      setShowStatusPicker(false)
      showToast('Status atualizado.', 'success')
    } catch { showToast('Erro ao atualizar status.', 'error') }
  }

  async function loadProcess() {
    const [p, m, d, f] = await Promise.all([
      api.processes.get(id),
      api.processes.movements(id),
      api.processes.deadlines(id),
      api.processes.financial(id),
    ])
    setProcess(p)
    setMovements(m)
    setDeadlines(d)
    setFinancial(f)
  }

  useEffect(() => {
    loadProcess().catch(() => {
      showToast('Processo não encontrado.', 'error')
      navigate('/app/processes')
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size={32} className="text-brand-500" /></div>
  if (!process) return null

  const areaLabel = LEGAL_AREAS.find(a => a.value === process.area)?.label ?? process.area

  const tabsWithCounts = TABS.map(t => ({
    ...t,
    count: t.value === 'timeline' ? movements.length
         : t.value === 'deadlines' ? deadlines.length
         : t.value === 'financial' ? financial.length
         : undefined,
  }))

  const financialColumns = [
    { key: 'description', label: 'Descrição' },
    { key: 'type',   label: 'Tipo', render: v => <Badge color={v === 'receivable' ? 'green' : 'red'}>{v === 'receivable' ? 'A Receber' : 'A Pagar'}</Badge> },
    { key: 'amount', label: 'Valor', render: v => formatCurrency(v) },
    { key: 'dueDate', label: 'Vencimento', render: v => formatDate(v) },
    { key: 'status', label: 'Status', render: v => <Badge color={v === 'paid' ? 'green' : v === 'pending' ? 'yellow' : 'red'}>{v === 'paid' ? 'Pago' : v === 'pending' ? 'Pendente' : 'Em atraso'}</Badge> },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link to="/app/processes" className="hover:text-brand-500">Processos</Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">{process.internalNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-[var(--text-muted)]">{process.internalNumber}</span>

            {/* Status — clicável */}
            <div ref={statusRef} className="relative">
              <button
                onClick={() => setShowStatusPicker(o => !o)}
                title="Clique para alterar o status"
                className="focus:outline-none"
              >
                <Badge color={STATUS_COLORS[process.status] ?? 'gray'}>
                  {STATUS_LABELS[process.status]} ▾
                </Badge>
              </button>
              {showStatusPicker && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-modal py-0.5 min-w-[140px]">
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => changeStatus(val)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.05] transition-colors flex items-center gap-2 ${val === process.status ? 'text-accent-400 font-semibold' : 'text-[var(--text-secondary)]'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full bg-${STATUS_COLORS[val] ?? 'gray'}-400`} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Badge color={PRIORITY_COLORS[process.priority] ?? 'gray'}>{PRIORITY_LABELS[process.priority]}</Badge>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{process.title}</h1>
          <div className="flex gap-3 mt-1 text-sm text-[var(--text-secondary)] flex-wrap">
            <span>📚 {areaLabel}</span>
            {process.judicialNumber && <span className="font-mono text-xs">{process.judicialNumber}</span>}
            {process.court && <span>🏛 {process.court}</span>}
          </div>
          {process.feeAmount && (
            <p className="mt-1 text-sm text-emerald-600 font-medium">
              💰 {process.feeType === 'fixed' ? 'Fixo: ' : process.feeType === 'success' ? 'Êxito: ' : ''}
              {process.feeAmount ? formatCurrency(process.feeAmount) : ''}
              {process.feePercentage ? ` + ${process.feePercentage}%` : ''}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(`/app/processes/${id}/edit`)}>
          <IconEdit size={15} /> Editar
        </Button>
      </div>

      {/* Summary */}
      {process.summary && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Resumo do Caso</h3>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{process.summary}</p>
        </Card>
      )}

      {/* Tabs */}
      <Card>
        <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

        <div className="p-5">
          {/* Assinaturas */}
          {tab === 'assinaturas' && <AssinaturasTab process={process} />}

          {/* Timeline */}
          {tab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowDiario(true)}>
                  📰 Diário Oficial
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowMovModal(true)}>
                  <IconPlus size={14} /> Movimentação
                </Button>
              </div>
              {movements.length === 0 ? (
                <EmptyState icon="📋" title="Sem movimentações" description="Adicione a primeira movimentação do processo." action={<Button variant="primary" size="sm" onClick={() => setShowMovModal(true)}><IconPlus size={14} /> Adicionar</Button>} />
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border)]" />
                  <div className="space-y-3 pl-12">
                    {movements.map(m => {
                      const isAuto = m.isAutomatic || m.author === 'Sistema'
                      const dotColor = {
                        status:    'border-blue-500',
                        deadline:  'border-amber-500',
                        task:      'border-emerald-500',
                        financial: 'border-purple-500',
                        system:    'border-gray-500',
                      }[m.type] ?? 'border-brand-500'
                      return (
                        <div key={m.id} className="relative">
                          <div className={`absolute -left-8 top-2 w-3 h-3 rounded-full border-2 ${dotColor} bg-[var(--bg-card)]`} />
                          <div className={`card p-3 transition-shadow ${isAuto ? 'border-dashed opacity-80' : 'hover:shadow-[var(--shadow-card-hover)]'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                              <div className="flex items-center gap-2">
                                {isAuto
                                  ? <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] font-medium">⚙ Sistema</span>
                                  : <Badge color="gray">{MOVEMENT_TYPES.find(t => t.value === m.type)?.label ?? m.type}</Badge>
                                }
                                {m.isPublic && <Badge color="blue">Público</Badge>}
                              </div>
                              <time className="text-xs text-[var(--text-muted)]">{formatDate(m.date)}</time>
                            </div>
                            <p className={`text-sm ${isAuto ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{m.description}</p>
                            {m.author && !isAuto && <p className="text-xs text-[var(--text-muted)] mt-1">Por: {m.author}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deadlines */}
          {tab === 'deadlines' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => navigate(`/app/deadlines?processId=${id}`)}>
                  <IconPlus size={14} /> Novo Prazo
                </Button>
              </div>
              {deadlines.length === 0 ? (
                <EmptyState icon={<IconCalendar size={36} />} title="Sem prazos" description="Nenhum prazo cadastrado para este processo." />
              ) : (
                deadlines.map(d => (
                  <div key={d.id} className="card p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{d.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatDate(d.dueDate)}</p>
                    </div>
                    <Badge color={d.status === 'done' ? 'green' : new Date(d.dueDate) < new Date() ? 'red' : 'yellow'}>
                      {d.status === 'done' ? 'Concluído' : new Date(d.dueDate) < new Date() ? 'Vencido' : 'Pendente'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Financial */}
          {tab === 'financial' && (
            <div className="space-y-3">
              {financial.length === 0 ? (
                <EmptyState icon={<IconDollar size={36} />} title="Sem lançamentos" description="Nenhum lançamento financeiro para este processo." />
              ) : (
                <Table columns={financialColumns} data={financial} />
              )}
            </div>
          )}

          {/* Documents */}
          {tab === 'documents' && (
            <EmptyState icon={<IconFolder size={36} />} title="Sem documentos" description="Nenhum documento cadastrado para este processo." action={<Button variant="secondary"><IconPlus size={14} /> Enviar Documento</Button>} />
          )}

          {/* Info */}
          {tab === 'info' && (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {[
                ['Nº Interno', process.internalNumber],
                ['Nº Processo', process.judicialNumber],
                ['Área', areaLabel],
                ['Tipo', process.processType],
                ['Status', STATUS_LABELS[process.status]],
                ['Prioridade', PRIORITY_LABELS[process.priority]],
                ['Tribunal', process.court],
                ['Vara', process.courtDistrict],
                ['Cidade/UF', [process.courtCity, process.courtState].filter(Boolean).join(' / ')],
                ['Juiz(a)', process.judgeName],
                ['Parte Contrária', process.opposingParty],
                ['Adv. Contrário', process.opposingLawyer],
                ['OAB Contrário', process.opposingOab],
                ['Abertura', formatDate(process.startedAt)],
                ['Encerramento', formatDate(process.closedAt)],
              ].map(([k, v]) => v ? (
                <div key={k}>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">{k}</dt>
                  <dd className="text-[var(--text-primary)]">{v}</dd>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      </Card>

      {/* Add Movement Modal */}
      <Modal open={showMovModal} onClose={() => setShowMovModal(false)} title="Nova Movimentação" size="md">
        <MovementForm processId={id} onCreated={loadProcess} onClose={() => setShowMovModal(false)} />
      </Modal>

      {/* Diário Oficial */}
      {showDiario && <DiarioModal process={process} onImported={loadProcess} onClose={() => setShowDiario(false)} />}
    </div>
  )
}
