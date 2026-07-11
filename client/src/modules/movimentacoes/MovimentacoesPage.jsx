import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { fetchPublicacoes, getOabConfig, getSeen, markSeen } from '../../lib/diarioOficial'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { Button, Card, IconActivity } from '../../components/ui'

const digits = (s) => String(s || '').replace(/\D/g, '')
const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const addDaysISO = (baseISO, n) => {
  const d = baseISO ? new Date(baseISO.slice(0, 10) + 'T00:00:00') : new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }

export default function MovimentacoesPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)
  const { showToast } = useUiStore()
  const cfg = getOabConfig()

  const [oab, setOab] = useState(cfg.oab)
  const [uf, setUf] = useState(cfg.uf)
  const [prazoDias, setPrazoDias] = useState(15)
  const [auto, setAuto] = useState(true)
  const [loading, setLoading] = useState(false)
  const [processos, setProcessos] = useState([])
  const [users, setUsers] = useState([])
  const [pubs, setPubs] = useState(null)
  const [error, setError] = useState('')
  const [feita, setFeita] = useState({})  // { pubId: true } processado nesta sessão

  useEffect(() => {
    api.processes.list().then(r => setProcessos(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => setProcessos([]))
    api.settings.users().then(u => setUsers(Array.isArray(u) ? u : (u?.data ?? []))).catch(() => setUsers([]))
    // histórico já processado (mostra na tela também)
    setPubs(lsGet('pj_movimentacoes', []))
  }, [])

  const matchProc = (pub) => processos.find(p => digits(p.judicialNumber) && digits(p.judicialNumber) === digits(pub.processo))
  const jaVisto = (id) => getSeen().includes(id)

  // Processa uma publicação: movimentação + tarefa + prazo
  const processar = async (pub) => {
    const proc = matchProc(pub)
    const pubDate = (pub.data || new Date().toISOString()).slice(0, 10)
    const prazoDate = addDaysISO(pubDate, Number(prazoDias) || 15)
    const oQueE = pub.tipo || 'Publicação'
    const resumo = (pub.texto || '').slice(0, 400)

    try {
      if (proc) {
        // 1) movimentação no processo
        await api.processes.addMovement(proc.id, {
          date: pubDate,
          description: `[DJEN — ${pub.tribunal || 'Diário'}] ${oQueE}: ${resumo}`,
          type: 'status', author: pub.orgao || pub.tribunal || 'Diário Oficial', isPublic: false,
        })
        // 2) tarefa para o cliente
        const responsavel = users.find(u => u.id === proc.assignedTo) || currentUser
        await api.tasks.create({
          title: `📰 ${oQueE} — ${proc.title}`,
          description: `Publicação do DJEN para o cliente. Prazo sugerido: ${fmtData(prazoDate)}.\n\n${resumo}`,
          status: 'todo', dueDate: prazoDate, priority: 'high',
          assignedTo: responsavel?.id ?? currentUser?.id, assignedToName: responsavel?.name ?? currentUser?.name ?? '',
          createdBy: currentUser?.id ?? '', createdByName: 'Sistema (DJEN)', acknowledged: false,
          processId: proc.id, clientId: proc.clientId,
        })
        // 3) prazo na aba Prazos
        await api.deadlines.create({
          title: `${oQueE} — a confirmar`, dueDate: prazoDate, processId: proc.id,
          clientId: proc.clientId, status: 'pending', needsReview: true,
        })
      }
      markSeen(pub.id)
      setFeita(f => ({ ...f, [pub.id]: proc ? 'ok' : 'sem-processo' }))
    } catch (e) {
      showToast('Erro ao processar: ' + (e.message || ''), 'error')
    }
  }

  const sincronizar = async () => {
    if (!oab.trim()) { setError('Informe o número da OAB (ou configure em Integrações).'); return }
    setLoading(true); setError('')
    try {
      const lista = await fetchPublicacoes({ oab, uf })
      // guarda na tela + persiste
      setPubs(lista)
      lsSet('pj_movimentacoes', lista)
      if (!lista.length) { setError('Nenhuma publicação encontrada nos últimos 30 dias.'); return }
      if (auto) {
        const novas = lista.filter(p => !jaVisto(p.id) && matchProc(p))
        for (const p of novas) await processar(p)
        if (novas.length) showToast(`${novas.length} publicação(ões) processada(s): movimentação + tarefa + prazo criados.`, 'success')
      }
    } catch (e) {
      setError((e.message || 'Falha') + ' — a consulta ao DJEN pode exigir o servidor/proxy ativo.')
    } finally { setLoading(false) }
  }

  const inputCls = 'px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
  const naoVinculadas = (pubs ?? []).filter(p => !matchProc(p)).length

  return (
    <div className="p-6 space-y-5 max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-accent-400"><IconActivity size={20} /></div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Movimentações</h1>
            <p className="text-sm text-[var(--text-muted)]">Publicações do Diário (DJEN/CNJ) por OAB — geram movimentação, tarefa e prazo automaticamente.</p>
          </div>
        </div>
      </div>

      {/* Barra de sincronização */}
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">OAB</label>
            <input className={inputCls + ' w-28'} value={oab} onChange={e => setOab(e.target.value)} placeholder="123456" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">UF</label>
            <input className={inputCls + ' w-16'} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} maxLength={2} />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Prazo sugerido (dias)</label>
            <input type="number" min="1" className={inputCls + ' w-24'} value={prazoDias} onChange={e => setPrazoDias(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] pb-2">
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Processar automático
          </label>
          <Button variant="primary" size="sm" onClick={sincronizar} loading={loading} className="ml-auto">🔄 Sincronizar Diário</Button>
        </div>
        {error && <p className="text-xs text-amber-400 mt-2">{error}</p>}
      </Card>

      {/* Resumo */}
      {pubs && pubs.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>{pubs.length} publicação(ões)</span>
          <span>· {pubs.length - naoVinculadas} vinculada(s) a processo</span>
          {naoVinculadas > 0 && <span>· {naoVinculadas} sem processo cadastrado</span>}
        </div>
      )}

      {/* Lista */}
      {!pubs ? null : pubs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl">
          <p className="text-3xl mb-2">📰</p>
          <p className="text-sm text-[var(--text-muted)]">Clique em “Sincronizar Diário” para buscar as publicações da sua OAB.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pubs.map((pub, i) => {
            const proc = matchProc(pub)
            const status = feita[pub.id] || (jaVisto(pub.id) ? 'ok' : null)
            return (
              <Card key={pub.id || i} className={`p-4 ${proc ? '' : 'opacity-80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-accent-400 font-medium">{pub.tribunal || 'DJEN'}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{fmtData(pub.data)}</span>
                      {pub.processo && <span className="text-[10px] font-mono text-[var(--text-muted)]">{pub.processo}</span>}
                      {proc
                        ? <button onClick={() => navigate(`/app/processes/${proc.id}`)} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">⚖ {proc.title}</button>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400">sem processo cadastrado</span>}
                    </div>
                    {pub.orgao && <p className="text-xs font-medium text-[var(--text-primary)]">{pub.orgao}</p>}
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-3">{pub.texto || pub.tipo}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {status === 'ok'
                      ? <span className="text-xs text-emerald-400">✓ Processado</span>
                      : status === 'sem-processo'
                        ? <span className="text-xs text-[var(--text-muted)]">visto</span>
                        : <Button variant="secondary" size="sm" onClick={() => processar(pub)} disabled={!proc}>{proc ? 'Processar' : '—'}</Button>}
                  </div>
                </div>
                {status === 'ok' && proc && (
                  <p className="text-[10px] text-emerald-400/80 mt-2">Criados: movimentação no processo · tarefa p/ {proc.title} · prazo na aba Prazos.</p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <p className="text-[11px] text-amber-300/90 leading-relaxed">⚠️ O prazo é <b>sugerido</b> (data da publicação + dias configurados) e vem marcado como “a confirmar” — confirme o prazo legal correto na aba Prazos. A sincronização automática (diária, mesmo com o app fechado) depende do servidor ligado.</p>
      </div>
    </div>
  )
}

function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)) }
