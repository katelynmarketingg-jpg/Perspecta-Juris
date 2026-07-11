import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  IconPlus, IconZap, IconToggleLeft, IconToggleRight, IconTrash,
  IconEdit, IconCheck, IconX, IconActivity, IconClock, IconAlertCircle,
  CustomSelect,
} from '../../components/ui'

const TRIGGERS = [
  { value: 'phase_change',       label: 'Mudança de fase processual' },
  { value: 'deadline_created',   label: 'Prazo criado' },
  { value: 'deadline_due',       label: 'Prazo vencendo (3 dias)' },
  { value: 'document_signed',    label: 'Documento assinado' },
  { value: 'payment_received',   label: 'Pagamento recebido' },
  { value: 'task_completed',     label: 'Tarefa concluída' },
  { value: 'client_created',     label: 'Novo cliente cadastrado' },
  { value: 'process_created',    label: 'Novo processo aberto' },
]

const CONDITIONS = [
  { value: 'any',               label: 'Qualquer caso' },
  { value: 'area_civel',        label: 'Área = Cível' },
  { value: 'area_trabalhista',  label: 'Área = Trabalhista' },
  { value: 'area_tributario',   label: 'Área = Tributário' },
  { value: 'area_familia',      label: 'Área = Família' },
  { value: 'value_gt_5000',     label: 'Valor honorários > R$ 5.000' },
  { value: 'responsible_me',    label: 'Advogado responsável = eu' },
]

const ACTIONS = [
  { value: 'create_task',       label: 'Criar tarefa', icon: '✅' },
  { value: 'create_deadline',   label: 'Criar prazo',  icon: '📅' },
  { value: 'send_whatsapp',     label: 'Enviar WhatsApp (Z-API)', icon: '💬' },
  { value: 'send_email',        label: 'Enviar e-mail', icon: '📧' },
  { value: 'notify_internal',   label: 'Notificação interna', icon: '🔔' },
  { value: 'create_document',   label: 'Gerar documento', icon: '📄' },
]

const MOCK_RULES = [
  {
    id: '1', name: 'Alerta de prazo próximo', enabled: true,
    trigger: 'deadline_due', condition: 'any', action: 'notify_internal',
    executions: 12, lastRun: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '2', name: 'WhatsApp ao novo cliente', enabled: true,
    trigger: 'client_created', condition: 'any', action: 'send_whatsapp',
    executions: 4, lastRun: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '3', name: 'Tarefa para honorário alto', enabled: false,
    trigger: 'process_created', condition: 'value_gt_5000', action: 'create_task',
    executions: 2, lastRun: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: '4', name: 'E-mail ao assinar contrato', enabled: true,
    trigger: 'document_signed', condition: 'any', action: 'send_email',
    executions: 7, lastRun: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
]

const MOCK_LOGS = [
  { id: '1', ruleId: '1', ruleName: 'Alerta de prazo próximo', status: 'success', entity: 'Prazo — Silva x ABC', at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: '2', ruleId: '2', ruleName: 'WhatsApp ao novo cliente', status: 'success', entity: 'Cliente — João Ferreira', at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: '3', ruleId: '4', ruleName: 'E-mail ao assinar contrato', status: 'success', entity: 'Contrato — Rodrigues Imobiliária', at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: '4', ruleId: '1', ruleName: 'Alerta de prazo próximo', status: 'error', entity: 'Prazo — Santos Trabalhista', at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: '5', ruleId: '3', ruleName: 'Tarefa para honorário alto', status: 'success', entity: 'Processo — Execução Fiscal', at: new Date(Date.now() - 86400000 * 20).toISOString() },
]

const triggerLabel = v  => TRIGGERS.find(t => t.value === v)?.label ?? v
const condLabel    = v  => CONDITIONS.find(c => c.value === v)?.label ?? v
const actionLabel  = v  => ACTIONS.find(a => a.value === v)?.label ?? v
const actionIcon   = v  => ACTIONS.find(a => a.value === v)?.icon ?? '⚙️'

function RuleModal({ rule, onClose, onSave }) {
  const [name, setName]      = useState(rule?.name ?? '')
  const [trigger, setTrigger] = useState(rule?.trigger ?? TRIGGERS[0].value)
  const [condition, setCondition] = useState(rule?.condition ?? CONDITIONS[0].value)
  const [action, setAction]  = useState(rule?.action ?? ACTIONS[0].value)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-modal">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-white">{rule ? 'Editar Regra' : 'Nova Regra de Automação'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"><IconX size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Nome da regra</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Alertar vencimento de prazo"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Trigger */}
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-blue-900/40 flex items-center justify-center text-xs text-blue-400 font-bold">1</div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Gatilho</p>
            </div>
            <CustomSelect value={trigger} onChange={setTrigger} options={TRIGGERS} />
          </div>

          {/* Condition */}
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-amber-900/40 flex items-center justify-center text-xs text-amber-400 font-bold">2</div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Condição</p>
            </div>
            <CustomSelect value={condition} onChange={setCondition} options={CONDITIONS} />
          </div>

          {/* Action */}
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-emerald-900/40 flex items-center justify-center text-xs text-emerald-400 font-bold">3</div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Ação</p>
            </div>
            <CustomSelect
              value={action}
              onChange={setAction}
              options={ACTIONS.map(a => ({ ...a, label: `${a.icon} ${a.label}` }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-[var(--text-muted)] hover:bg-white/10 transition-colors">Cancelar</button>
          <button
            onClick={() => { onSave({ name, trigger, condition, action }); onClose() }}
            disabled={!name.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            {rule ? 'Salvar' : 'Criar Regra'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const [tab, setTab]     = useState('rules')
  const [rules, setRules] = useState(MOCK_RULES)
  const [logs]            = useState(MOCK_LOGS)
  const [modal, setModal] = useState(null) // null | 'new' | rule-object

  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const deleteRule = (id) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const saveRule = (data) => {
    if (modal && modal.id) {
      setRules(prev => prev.map(r => r.id === modal.id ? { ...r, ...data } : r))
    } else {
      setRules(prev => [...prev, { id: String(Date.now()), executions: 0, lastRun: null, enabled: true, ...data }])
    }
  }

  const activeCount = rules.filter(r => r.enabled).length

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Automações</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{activeCount} regra{activeCount !== 1 ? 's' : ''} ativa{activeCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <IconPlus size={15} />
          Nova Regra
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Regras ativas',     value: activeCount,                  color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
          { label: 'Execuções totais',  value: rules.reduce((s,r) => s + r.executions, 0), color: 'text-blue-400', bg: 'bg-blue-900/30' },
          { label: 'Com erro (últ. 7d)',value: logs.filter(l => l.status === 'error').length, color: 'text-red-400', bg: 'bg-red-900/30' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-2">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { key: 'rules', label: 'Regras' },
          { key: 'logs',  label: 'Histórico' },
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

      {/* Rules tab */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="card p-12 text-center">
              <IconZap size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Nenhuma regra criada ainda.</p>
              <button onClick={() => setModal('new')} className="mt-4 btn-primary text-sm px-4 py-2">Criar primeira regra</button>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className={`card p-4 transition-all ${rule.enabled ? '' : 'opacity-50'}`}>
              <div className="flex items-start gap-3">
                {/* Flow indicators */}
                <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" title="Gatilho" />
                    <div className="w-px h-3 bg-[var(--border)]" />
                    <div className="w-2 h-2 rounded-full bg-amber-500" title="Condição" />
                    <div className="w-px h-3 bg-[var(--border)]" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500" title="Ação" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{rule.name}</p>
                    {rule.enabled
                      ? <span className="badge badge-green">Ativa</span>
                      : <span className="badge badge-gray">Inativa</span>
                    }
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span><span className="text-blue-400 font-medium">Gatilho:</span> {triggerLabel(rule.trigger)}</span>
                    <span><span className="text-amber-400 font-medium">Se:</span> {condLabel(rule.condition)}</span>
                    <span><span className="text-emerald-400 font-medium">Então:</span> {actionIcon(rule.action)} {actionLabel(rule.action)}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><IconActivity size={11} />{rule.executions} execuções</span>
                    {rule.lastRun && (
                      <span className="flex items-center gap-1">
                        <IconClock size={11} />
                        Última: {format(new Date(rule.lastRun), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-1.5 rounded-lg transition-colors ${rule.enabled ? 'text-emerald-400 hover:bg-emerald-900/30' : 'text-[var(--text-muted)] hover:bg-white/10'}`}
                    title={rule.enabled ? 'Desativar' : 'Ativar'}
                  >
                    {rule.enabled ? <IconToggleRight size={18} /> : <IconToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => setModal(rule)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                    title="Editar"
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/30 transition-colors"
                    title="Excluir"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="card p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma execução registrada.</div>
          ) : logs.map(log => (
            <div key={log.id} className="card p-3.5 flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                log.status === 'success' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
              }`}>
                {log.status === 'success' ? <IconCheck size={14} /> : <IconAlertCircle size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{log.ruleName}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{log.entity}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-medium ${log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {log.status === 'success' ? 'Sucesso' : 'Erro'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {format(new Date(log.at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <RuleModal
          rule={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={saveRule}
        />
      )}
    </div>
  )
}
