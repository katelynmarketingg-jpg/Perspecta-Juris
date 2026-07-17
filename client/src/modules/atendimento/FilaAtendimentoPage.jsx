import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { getFila, addToFila, atender, removerAtendimento, esperaMin, TIPOS_ATEND, tipoAtend } from '../../lib/atendimentos'
import { registrar } from '../../lib/auditLog'

export default function FilaAtendimentoPage() {
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const meuNome = useAuthStore(s => s.user?.name) ?? 'Colaborador'
  const [fila, setFila] = useState([])
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [, tick] = useState(0)

  const reload = () => setFila(getFila())
  useEffect(() => {
    reload()
    api.clients.list?.({ limit: 500 }).then(r => setClients(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => {})
    api.settings.users().then(r => setUsers(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => {})
    const t = setInterval(() => tick(n => n + 1), 30000) // atualiza tempo de espera
    return () => clearInterval(t)
  }, [])

  const chamar = (a) => {
    atender(a.id, meuNome)
    registrar('atendimento', `atendeu ${a.clientName || 'cliente'} (${tipoAtend(a.tipo).label}, espera ${esperaMin(a)} min)`, { cliente: a.clientName })
    showToast('Atendimento registrado.', 'success')
    reload()
  }
  const remover = (a) => { removerAtendimento(a.id); reload() }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">🟠 Fila de Atendimento</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{fila.length} na fila {fila.length > 0 && '· ordenados por chegada'}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">+ Adicionar à fila</button>
      </div>

      {fila.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl">
          <p className="text-3xl mb-2">🪑</p>
          <p className="text-sm text-[var(--text-muted)]">Ninguém na fila. Adicione um cliente para atendimento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fila.map((a, i) => {
            const espera = esperaMin(a)
            const cor = espera >= 30 ? 'text-red-400' : espera >= 15 ? 'text-amber-400' : 'text-emerald-400'
            return (
              <div key={a.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                <span className="w-7 h-7 rounded-full bg-orange-500/15 text-orange-400 text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {a.clientId
                      ? <button onClick={() => navigate(`/app/clients/${a.clientId}`)} className="hover:underline">{a.clientName}</button>
                      : a.clientName || 'Cliente'}
                    <span className="ml-2 text-[11px] text-[var(--text-muted)]">{tipoAtend(a.tipo).icone} {tipoAtend(a.tipo).label}</span>
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {a.colaborador ? <>Para <b className="text-[var(--text-secondary)]">{a.colaborador}</b> · </> : ''}
                    espera <b className={cor}>{espera} min</b>{a.obs ? ` · ${a.obs}` : ''}
                  </p>
                </div>
                <button onClick={() => chamar(a)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 flex-shrink-0">✓ Atender</button>
                <button onClick={() => remover(a)} className="text-[var(--text-muted)] hover:text-red-400 text-sm flex-shrink-0" title="Remover">✕</button>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddFilaModal clients={clients} users={users} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); reload() }} />}
    </div>
  )
}

function AddFilaModal({ clients, users, onClose, onAdded }) {
  const { showToast } = useUiStore()
  const [busca, setBusca] = useState('')
  const [clientId, setClientId] = useState('')
  const [avulso, setAvulso] = useState('')
  const [colaborador, setColaborador] = useState('')
  const [tipo, setTipo] = useState('presencial')
  const [obs, setObs] = useState('')

  const filtrados = clients.filter(c => !busca || (c.name || '').toLowerCase().includes(busca.toLowerCase())).slice(0, 8)

  const salvar = () => {
    const cli = clients.find(c => c.id === clientId)
    const nome = cli?.name || avulso.trim()
    if (!nome) { showToast('Escolha um cliente ou digite um nome.', 'error'); return }
    addToFila({ clientId: cli?.id ?? null, clientName: nome, colaborador, tipo, obs })
    registrar('atendimento', `colocou ${nome} na fila de atendimento${colaborador ? ` (para ${colaborador})` : ''}`, { cliente: nome })
    showToast('Adicionado à fila.', 'success')
    onAdded()
  }
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
  const lbl = 'text-xs font-medium text-[var(--text-secondary)] mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Adicionar à fila</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={lbl}>Cliente</label>
            <input value={busca} onChange={e => { setBusca(e.target.value); setClientId('') }} placeholder="🔍 Buscar cliente cadastrado..." className={inputCls} />
            {busca && !clientId && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)]">
                {filtrados.map(c => (
                  <button key={c.id} onClick={() => { setClientId(c.id); setBusca(c.name); setAvulso('') }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">{c.name}</button>
                ))}
                {!filtrados.length && <p className="px-3 py-2 text-xs text-[var(--text-muted)]">Nenhum. Ou use o nome avulso abaixo.</p>}
              </div>
            )}
            {clientId && <p className="text-[11px] text-emerald-400 mt-1">✓ Cliente selecionado</p>}
          </div>
          <div>
            <label className={lbl}>Ou nome avulso (não cadastrado)</label>
            <input value={avulso} onChange={e => { setAvulso(e.target.value); setClientId(''); setBusca('') }} placeholder="Nome de quem chegou" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Atender com</label>
              <select value={colaborador} onChange={e => setColaborador(e.target.value)} className={inputCls}>
                <option value="">Qualquer um</option>
                {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
                {TIPOS_ATEND.map(t => <option key={t.value} value={t.value}>{t.icone} {t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Observação (opcional)</label>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: trouxe documentos, retorno..." className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancelar</button>
          <button onClick={salvar} className="btn-primary text-sm">Adicionar</button>
        </div>
      </div>
    </div>
  )
}
