import { useState } from 'react'
import { getCfg, setCfg } from '../../lib/tenantData'
import { useUiStore } from '../../stores/uiStore'
import { Button, Card, Input, Badge } from '../../components/ui'
import { STATES_BR } from '../../lib/constants'
import { syncAllProcesses, getLastSyncInfo } from '../../lib/datajudSync'
import {
  tribunalLogin,
  tribunalLogout,
  fetchTribunalProcesses,
  importTribunalProcesses,
  getStoredSession,
} from '../../lib/tribunalScraper'
import { currentTenantId } from '../../lib/tenant'

// ── Tribunal mapping ──────────────────────────────────────────────
const UF_TO_TRIBUNAL = {
  AC:'tjac', AL:'tjal', AM:'tjam', AP:'tjap', BA:'tjba', CE:'tjce',
  DF:'tjdft', ES:'tjes', GO:'tjgo', MA:'tjma', MG:'tjmg', MS:'tjms',
  MT:'tjmt', PA:'tjpa', PB:'tjpb', PE:'tjpe', PI:'tjpi', PR:'tjpr',
  RJ:'tjrj', RN:'tjrn', RO:'tjro', RR:'tjrr', RS:'tjrs', SC:'tjsc',
  SE:'tjse', SP:'tjsp', TO:'tjto',
}

const EXTRA_TRIBUNAIS = [
  { value: 'stj',  label: 'STJ — Superior Tribunal de Justiça' },
  { value: 'stf',  label: 'STF — Supremo Tribunal Federal' },
  { value: 'tst',  label: 'TST — Tribunal Superior do Trabalho' },
  { value: 'trf1', label: 'TRF-1ª Região' },
  { value: 'trf2', label: 'TRF-2ª Região' },
  { value: 'trf3', label: 'TRF-3ª Região' },
  { value: 'trf4', label: 'TRF-4ª Região' },
  { value: 'trf5', label: 'TRF-5ª Região' },
  { value: 'trf6', label: 'TRF-6ª Região' },
  { value: 'trt1', label: 'TRT-1 (RJ)' }, { value: 'trt2', label: 'TRT-2 (SP)' },
  { value: 'trt3', label: 'TRT-3 (MG)' }, { value: 'trt4', label: 'TRT-4 (RS)' },
  { value: 'trt5', label: 'TRT-5 (BA)' }, { value: 'trt6', label: 'TRT-6 (PE)' },
  { value: 'trt7', label: 'TRT-7 (CE)' }, { value: 'trt8', label: 'TRT-8 (PA/AP)' },
  { value: 'trt9', label: 'TRT-9 (PR)' }, { value: 'trt10',label: 'TRT-10 (DF/TO)' },
  { value: 'trt11',label: 'TRT-11 (AM/RR)' }, { value: 'trt12',label: 'TRT-12 (SC)' },
  { value: 'trt13',label: 'TRT-13 (PB)' }, { value: 'trt14',label: 'TRT-14 (RO/AC)' },
  { value: 'trt15',label: 'TRT-15 (Campinas)' }, { value: 'trt16',label: 'TRT-16 (MA)' },
  { value: 'trt17',label: 'TRT-17 (ES)' }, { value: 'trt18',label: 'TRT-18 (GO)' },
  { value: 'trt19',label: 'TRT-19 (AL)' }, { value: 'trt20',label: 'TRT-20 (SE)' },
  { value: 'trt21',label: 'TRT-21 (RN)' }, { value: 'trt22',label: 'TRT-22 (PI)' },
  { value: 'trt23',label: 'TRT-23 (MT)' }, { value: 'trt24',label: 'TRT-24 (MS)' },
]

// Portais com scraping autenticado
const PORTAIS = [
  {
    id: 'tjrs',
    label: 'TJRS — e-SAJ',
    description: 'Tribunal de Justiça do Rio Grande do Sul',
    url: 'https://esaj.tjrs.jus.br',
    color: 'blue',
  },
  {
    id: 'trt4',
    label: 'TRT-4 — PJe',
    description: 'Tribunal Regional do Trabalho 4ª Região (RS)',
    url: 'https://pje.trt4.jus.br',
    color: 'emerald',
  },
  {
    id: 'trf4',
    label: 'TRF-4 — e-Proc',
    description: 'Tribunal Regional Federal 4ª Região',
    url: 'https://eproc.trf4.jus.br',
    color: 'violet',
  },
]

// ── Area guess from assuntos ──────────────────────────────────────
function guessArea(assuntos = []) {
  const txt = assuntos.map(a => (a.nome ?? '').toLowerCase()).join(' ')
  if (/trabalh|rescis|clt|empregad/.test(txt))  return 'trabalhista'
  if (/tribut|fiscal|imposto|icms|iss|irpf/.test(txt)) return 'tributario'
  if (/famíl|divórc|alimen|guarda|inventár/.test(txt)) return 'familia'
  if (/penal|crime|homicíd|roubo|tráfico/.test(txt))   return 'penal'
  if (/empresar|societár|contrat|falên/.test(txt))     return 'empresarial'
  if (/consumid|cdc|vício|produto/.test(txt))          return 'consumidor'
  if (/previdenc|inss|benefício|aposentad/.test(txt))  return 'previdenciario'
  return 'civel'
}

// ── DataJud search ────────────────────────────────────────────────
async function searchDatajud(oab, uf, tribunal, apiKey) {
  const index = tribunal || UF_TO_TRIBUNAL[uf] || 'tjsp'
  const key   = apiKey || 'cDZHYzlZa0JadVREZDJCendBdUFWZz09cDZHYzlZa0JadVREZDJCendBdUFWZz09'

  const res = await fetch(`/datajud/api_publica_${index}/_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `APIKey ${key}`,
    },
    body: JSON.stringify({
      query: {
        bool: {
          must: [
            { match: { 'advogados.oabNumero': oab } },
            { match: { 'advogados.oabEstado':  uf  } },
          ],
        },
      },
      size: 100,
      sort: [{ dataAjuizamento: { order: 'desc' } }],
      _source: ['numeroProcesso','classe','assuntos','tribunal','dataAjuizamento','grau','movimentos','partes','sistema'],
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`DataJud ${res.status}: ${txt.slice(0, 120)}`)
  }

  const json = await res.json()
  return json.hits?.hits ?? []
}

// ── Map DataJud hit → process ─────────────────────────────────────
function hitToProcess(hit) {
  const s   = hit._source ?? {}
  const pts = s.partes ?? []
  const atv = pts.find(p => p.polo === 'ativo')
  const pas = pts.find(p => p.polo === 'passivo')
  return {
    judicialNumber: s.numeroProcesso ?? '',
    title: `${s.classe?.nome ?? 'Processo'} — ${atv?.nome ?? s.tribunal ?? ''}`,
    processType: s.classe?.nome ?? '',
    court: s.tribunal ?? '',
    area: guessArea(s.assuntos),
    status: 'active',
    priority: 'normal',
    startedAt: s.dataAjuizamento?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    opposingParty: pas?.nome ?? '',
    summary: (s.assuntos ?? []).map(a => a.nome).join(', '),
    source: 'datajud',
    _movimentos: s.movimentos ?? [],
  }
}

// ── Import DataJud hits to localDb ────────────────────────────────
function lsGet(key, fb) { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fb } catch { return fb } }
function lsSet(key, v)  { localStorage.setItem(key, JSON.stringify(v)) }
const uidFn = () => Math.random().toString(36).slice(2,9) + Math.random().toString(36).slice(2,9)

function importDatajudHits(hits) {
  const procs = lsGet('pj_local_processes', [])
  const movs  = lsGet('pj_local_movements', [])
  const existing = new Set(procs.map(p => p.judicialNumber))
  let imported = 0

  hits.forEach(hit => {
    const p = hitToProcess(hit)
    if (existing.has(p.judicialNumber)) return
    const id = uidFn()
    const num = `P${String(procs.length + imported + 1).padStart(4,'0')}`
    const row = {
      id, tenantId: currentTenantId(),
      internalNumber: num,
      createdAt: new Date().toISOString(),
      ...p,
    }
    delete row._movimentos
    procs.push(row)
    existing.add(p.judicialNumber)
    imported++

    ;(p._movimentos ?? []).forEach(m => {
      movs.push({
        id: uidFn(), tenantId: currentTenantId(), processId: id,
        description: m.nome ?? m.descricao ?? 'Movimentação',
        date: (m.dataHora ?? new Date().toISOString()).slice(0, 10),
        type: 'system', author: 'DataJud / CNJ',
        isPublic: false, isAutomatic: true,
        createdAt: m.dataHora ?? new Date().toISOString(),
      })
    })

    movs.push({
      id: uidFn(), tenantId: 'tenant_demo', processId: id,
      description: `Processo importado via DataJud — ${p.court}`,
      date: new Date().toISOString().slice(0, 10),
      type: 'system', author: 'Sistema', isPublic: false, isAutomatic: true,
      createdAt: new Date().toISOString(),
    })
  })

  lsSet('pj_local_processes', procs)
  lsSet('pj_local_movements', movs)
  return imported
}

// ── MovimentsPreview ──────────────────────────────────────────────
function MovimentsPreview({ movimentos }) {
  if (!movimentos?.length) return <p className="text-xs text-[var(--text-muted)] italic">Sem movimentações</p>
  return (
    <div className="space-y-1 mt-2 max-h-36 overflow-y-auto pr-1">
      {movimentos.slice(0, 20).map((m, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 w-16 tabular-nums">
            {(m.dataHora ?? m.date ?? '').slice(0, 10)}
          </span>
          <span className="text-[11px] text-[var(--text-secondary)]">{m.nome ?? m.descricao ?? m.description}</span>
        </div>
      ))}
      {movimentos.length > 20 && (
        <p className="text-[10px] text-[var(--text-muted)]">+ {movimentos.length - 20} movimentações</p>
      )}
    </div>
  )
}

// ── Portal Card (TJRS / TRT-4 / TRF-4) ───────────────────────────
function PortalCard({ portal, oab, oabUF, onImported }) {
  const { showToast } = useUiStore()

  const stored = getStoredSession(portal.id)
  const [loggedIn, setLoggedIn] = useState(!!stored?.sessionId)
  const [cpf,      setCpf]      = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(false)
  const [procs,    setProcs]    = useState(null)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState(null)
  const [selected, setSelected] = useState(new Set())

  const colorMap = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  }
  const dotColor = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500' }[portal.color]
  const textColor = { blue: 'text-blue-400', emerald: 'text-emerald-400', violet: 'text-violet-400' }[portal.color]

  const doLogin = async () => {
    if (!cpf.trim() || !password.trim()) { setError('Informe CPF e senha.'); return }
    if (!oab.trim()) { setError('Salve o número de OAB acima antes de conectar.'); return }
    setError('')
    setLoading(true)
    try {
      await tribunalLogin(portal.id, cpf, password)
      setLoggedIn(true)
      setPassword('')
      showToast(`✅ Conectado ao ${portal.label}`, 'success')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const doLogout = async () => {
    await tribunalLogout(portal.id)
    setLoggedIn(false)
    setProcs(null)
    setSelected(new Set())
    showToast(`Desconectado do ${portal.label}`, 'info')
  }

  const doFetch = async () => {
    if (!oab.trim()) { setError('Informe o número de OAB acima.'); return }
    setError('')
    setFetching(true)
    setProcs(null)
    setSelected(new Set())
    try {
      const list = await fetchTribunalProcesses(portal.id, oab.trim(), oabUF || 'RS')
      setProcs(list)
      if (list.length === 0) setError('Nenhum processo encontrado para essa OAB.')
    } catch (e) {
      setError(e.message)
      // Se backend offline, mostra mensagem amigável
      if (e.message.includes('fetch') || e.message.includes('Failed')) {
        setError('O servidor backend está offline. Inicie o servidor (npm run dev:server) para usar os portais autenticados.')
      }
    } finally {
      setFetching(false)
    }
  }

  const toggleSelect = id => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const doImport = () => {
    if (!procs || selected.size === 0) return
    const toImport = procs.filter(p => selected.has(p.judicialNumber))
    const { added } = importTribunalProcesses(toImport)
    showToast(`${added} processo${added !== 1 ? 's' : ''} importado${added !== 1 ? 's' : ''} do ${portal.label}.`, 'success')
    setSelected(new Set())
    onImported?.()
  }

  const existingNums = new Set(lsGet('pj_local_processes', []).map(p => p.judicialNumber))

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-[var(--border)] ${colorMap[portal.color]} bg-opacity-50`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loggedIn ? dotColor : 'bg-[var(--text-muted)]'}`} />
          <div>
            <p className={`text-sm font-semibold ${textColor}`}>{portal.label}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{portal.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loggedIn && (
            <>
              <Badge color="green" className="text-[10px]">Conectado</Badge>
              <button onClick={doLogout} className="text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors">
                Desconectar
              </button>
            </>
          )}
          {!loggedIn && <Badge color="gray" className="text-[10px]">Desconectado</Badge>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!loggedIn ? (
          /* Login form */
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Acesse com seu CPF e senha do portal. O sistema entrará automaticamente para buscar
              todos os seus processos — incluindo os sigilosos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="CPF"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                type="text"
              />
              <Input
                label="Senha do portal"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button variant="secondary" size="sm" onClick={doLogin} loading={loading} disabled={!cpf || !password}>
              {loading ? 'Conectando…' : `Entrar no ${portal.label}`}
            </Button>
          </div>
        ) : (
          /* Connected state */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={doFetch} loading={fetching}>
                {fetching ? 'Buscando processos…' : 'Buscar meus processos'}
              </Button>
              {procs !== null && !fetching && (
                <span className="text-xs text-[var(--text-muted)]">
                  {procs.length} processo{procs.length !== 1 ? 's' : ''} encontrado{procs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Results */}
            {procs !== null && !fetching && procs.length > 0 && (
              <div className="space-y-2">
                {/* Bulk actions */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      const importable = procs.filter(p => !existingNums.has(p.judicialNumber))
                      setSelected(new Set(importable.map(p => p.judicialNumber)))
                    }}
                    className="text-xs text-accent-400 hover:underline"
                  >
                    Selecionar não importados
                  </button>
                  {selected.size > 0 && (
                    <Button variant="primary" size="sm" onClick={doImport}>
                      Importar {selected.size}
                    </Button>
                  )}
                </div>

                {/* Process list */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {procs.map(proc => {
                    const alreadyImported = existingNums.has(proc.judicialNumber)
                    const isSelected = selected.has(proc.judicialNumber)
                    const isExpanded = expanded === proc.judicialNumber

                    return (
                      <div
                        key={proc.judicialNumber}
                        className={`rounded-lg border px-3 py-2 transition-all ${
                          isSelected ? 'border-brand-500/40 bg-brand-500/5' :
                          'border-[var(--border)] bg-[var(--bg-card)]'
                        } ${alreadyImported ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <button
                            onClick={() => !alreadyImported && toggleSelect(proc.judicialNumber)}
                            disabled={alreadyImported}
                            className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                              alreadyImported ? 'border-[var(--border)] opacity-40 cursor-not-allowed' :
                              isSelected ? 'bg-brand-500 border-brand-500' : 'border-[var(--border)] hover:border-brand-400'
                            }`}
                          >
                            {isSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-[var(--text-muted)]">{proc.judicialNumber}</span>
                              <Badge color="gray">{proc.court}</Badge>
                              {proc.area && <Badge color="blue">{proc.area}</Badge>}
                              {alreadyImported && <Badge color="green">Importado</Badge>}
                            </div>
                            <p className="text-xs font-medium text-[var(--text-primary)] mt-0.5">{proc.title}</p>
                            {proc.startedAt && (
                              <p className="text-[10px] text-[var(--text-muted)]">
                                Ajuizado: {new Date(proc.startedAt).toLocaleDateString('pt-BR')}
                                {proc.opposingParty && ` · Parte contrária: ${proc.opposingParty}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function IntegrationTab() {
  const { showToast } = useUiStore()

  const [oab,      setOab]      = useState(() => getCfg('pj_cfg_oab', ''))
  const [uf,       setUf]       = useState(() => getCfg('pj_cfg_oab_uf', 'RS'))
  const [apiKey,   setApiKey]   = useState(() => getCfg('pj_cfg_datajud_key', ''))
  const [tribunal, setTribunal] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [results,  setResults]  = useState(null)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState(new Set())
  const [expanded, setExpanded] = useState(null)
  const [syncing,  setSyncing]  = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [autoSync, setAutoSync] = useState(() => {
    try { return getCfg('pj_cfg_autosync', 'true') !== 'false' } catch { return true }
  })

  const syncInfo = getLastSyncInfo()

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    setCfg('pj_cfg_autosync', next ? 'true' : 'false')
  }

  const runManualSync = async () => {
    setSyncing(true)
    setSyncProgress({ synced: 0, total: syncInfo.processCount, newMovements: 0 })
    try {
      const result = await syncAllProcesses((p) => setSyncProgress(p))
      if (result.newMovements > 0) {
        showToast(`⚖️ ${result.newMovements} nova${result.newMovements !== 1 ? 's' : ''} movimentaç${result.newMovements !== 1 ? 'ões' : 'ão'} importada${result.newMovements !== 1 ? 's' : ''}.`, 'success')
      } else {
        showToast('Sincronização concluída — nenhuma novidade.', 'success')
      }
    } catch (e) {
      showToast(`Erro na sincronização: ${e.message}`, 'error')
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }

  const saveConfig = () => {
    setCfg('pj_cfg_oab', oab)
    setCfg('pj_cfg_oab_uf', uf)
    if (apiKey) setCfg('pj_cfg_datajud_key', apiKey)
  }

  const search = async () => {
    if (!oab.trim()) { setError('Informe o número da OAB.'); return }
    setError('')
    setLoading(true)
    setResults(null)
    setSelected(new Set())
    saveConfig()
    try {
      const hits = await searchDatajud(oab.trim(), uf, tribunal, apiKey)
      setResults(hits)
      if (hits.length === 0) setError('Nenhum processo encontrado para essa OAB nesse tribunal.')
    } catch (e) {
      setError(`Erro na consulta: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = id => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (!results) return
    const existing = new Set(lsGet('pj_local_processes', []).map(p => p.judicialNumber))
    const importable = results.filter(h => !existing.has(h._source?.numeroProcesso))
    setSelected(new Set(importable.map(h => h._id)))
  }

  const doImport = () => {
    if (!results || selected.size === 0) return
    const toImport = results.filter(h => selected.has(h._id))
    const count = importDatajudHits(toImport)
    showToast(`${count} processo${count !== 1 ? 's' : ''} importado${count !== 1 ? 's' : ''} com sucesso.`, 'success')
    setSelected(new Set())
    setRefreshKey(k => k + 1)
  }

  const existingNums = new Set(lsGet('pj_local_processes', []).map(p => p.judicialNumber))

  return (
    <div className="space-y-6">

      {/* ── Sync status card ─────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">Sincronização automática — DataJud / CNJ</p>
            <div className="flex items-center gap-3 flex-wrap">
              {syncInfo.processCount > 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  {syncInfo.processCount} processo{syncInfo.processCount !== 1 ? 's' : ''} com número CNJ monitorado{syncInfo.processCount !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Nenhum processo com número CNJ importado ainda</p>
              )}
              {syncInfo.lastSync && (
                <p className="text-xs text-[var(--text-muted)]">
                  · Última sync: {syncInfo.lastSync.toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            {syncProgress && (
              <p className="text-xs text-accent-400 mt-1">
                Verificando {syncProgress.synced}/{syncProgress.total}…
                {syncProgress.newMovements > 0 && ` ${syncProgress.newMovements} nova${syncProgress.newMovements !== 1 ? 's' : ''} movimentação${syncProgress.newMovements !== 1 ? 'ões' : ''} encontrada${syncProgress.newMovements !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={toggleAutoSync}
                className={`w-9 h-5 rounded-full transition-colors relative ${autoSync ? 'bg-brand-500' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSync ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Auto (1h)</span>
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={runManualSync}
              loading={syncing}
              disabled={syncing || syncInfo.processCount === 0}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── OAB Config ───────────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">Configuração de OAB</p>
          <p className="text-xs text-[var(--text-muted)]">
            Usado tanto para a busca no DataJud quanto para os portais autenticados abaixo.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Número OAB"
            placeholder="123456"
            value={oab}
            onChange={e => { setOab(e.target.value.replace(/\D/g, '')); setCfg('pj_cfg_oab', e.target.value.replace(/\D/g, '')) }}
          />
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Estado (UF)</p>
            <select
              value={uf}
              onChange={e => { setUf(e.target.value); setCfg('pj_cfg_oab_uf', e.target.value) }}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
            >
              {STATES_BR.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* ── DataJud search ───────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">Busca DataJud — CNJ (processos públicos)</p>
          <p className="text-xs text-[var(--text-muted)]">
            A API pública do CNJ retorna processos não-sigilosos vinculados ao número de OAB.
            Para processos com sigilo, use os portais autenticados abaixo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Tribunal (opcional)</p>
            <select
              value={tribunal}
              onChange={e => setTribunal(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
            >
              <option value="">Auto (pelo UF configurado)</option>
              {EXTRA_TRIBUNAIS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <details className="text-xs">
          <summary className="text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
            Chave de API própria (opcional)
          </summary>
          <div className="mt-2">
            <Input
              label="APIKey DataJud"
              placeholder="Deixe vazio para usar a chave pública padrão"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Obtenha em{' '}
              <span className="text-accent-400">datajud.cnj.jus.br</span> para maior volume de consultas.
            </p>
          </div>
        </details>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={search} loading={loading} disabled={!oab.trim()}>
            {loading ? 'Buscando…' : 'Buscar no DataJud'}
          </Button>
          {results !== null && !loading && (
            <p className="text-xs text-[var(--text-muted)]">
              {results.length} processo{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/40 border border-red-800/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </Card>

      {/* Results */}
      {results !== null && !loading && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-xs text-accent-400 hover:underline">
                Selecionar não importados
              </button>
              {selected.size > 0 && (
                <span className="text-xs text-[var(--text-muted)]">({selected.size} selecionado{selected.size !== 1 ? 's' : ''})</span>
              )}
            </div>
            {selected.size > 0 && (
              <Button variant="primary" size="sm" onClick={doImport}>
                Importar {selected.size} processo{selected.size !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {results.map(hit => {
            const src  = hit._source ?? {}
            const proc = hitToProcess(hit)
            const alreadyImported = existingNums.has(proc.judicialNumber)
            const isSelected = selected.has(hit._id)
            const isExpanded = expanded === hit._id
            const parts = src.partes ?? []
            const atv = parts.find(p => p.polo === 'ativo')
            const pas = parts.find(p => p.polo === 'passivo')

            return (
              <Card key={hit._id} className={`transition-all ${isSelected ? 'border-brand-500/50' : ''} ${alreadyImported ? 'opacity-60' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => !alreadyImported && toggleSelect(hit._id)}
                      disabled={alreadyImported}
                      className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        alreadyImported ? 'border-[var(--border)] opacity-40 cursor-not-allowed' :
                        isSelected ? 'bg-brand-500 border-brand-500' : 'border-[var(--border)] hover:border-brand-400'
                      }`}
                    >
                      {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-[var(--text-muted)]">{src.numeroProcesso}</span>
                        <Badge color="gray">{src.tribunal ?? ''}</Badge>
                        {src.grau && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{src.grau === 'G1' ? '1º grau' : src.grau === 'G2' ? '2º grau' : src.grau}</span>}
                        {alreadyImported && <Badge color="green">Importado</Badge>}
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                        {src.classe?.nome ?? '—'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--text-muted)]">
                        {atv && <span>Ativo: <span className="text-[var(--text-secondary)]">{atv.nome}</span></span>}
                        {pas && <span>Passivo: <span className="text-[var(--text-secondary)]">{pas.nome}</span></span>}
                        {src.dataAjuizamento && (
                          <span>Ajuizado em: <span className="text-[var(--text-secondary)]">
                            {new Date(src.dataAjuizamento).toLocaleDateString('pt-BR')}
                          </span></span>
                        )}
                        {(src.assuntos ?? []).length > 0 && (
                          <span>Assunto: <span className="text-[var(--text-secondary)]">{src.assuntos[0]?.nome}</span></span>
                        )}
                      </div>
                      {(src.movimentos ?? []).length > 0 && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : hit._id)}
                          className="mt-2 text-[11px] text-accent-400 hover:underline"
                        >
                          {isExpanded ? '▲ Ocultar' : `▼ Ver ${src.movimentos.length} movimentaç${src.movimentos.length !== 1 ? 'ões' : 'ão'}`}
                        </button>
                      )}
                      {isExpanded && <MovimentsPreview movimentos={src.movimentos} />}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {results === null && !loading && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
          <p className="text-2xl mb-2">⚖️</p>
          <p className="text-xs text-[var(--text-muted)] space-y-1 max-w-sm mx-auto">
            Informe a OAB acima e clique em Buscar para importar processos públicos do DataJud / CNJ.
          </p>
        </div>
      )}

      {/* ── Portais Autenticados ──────────────────────────── */}
      <div>
        <div className="mb-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Portais autenticados — processos sigilosos</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Acesse os sistemas dos tribunais com suas credenciais para importar todos os processos,
            incluindo os com segredo de justiça. O sistema entra no portal como se fosse você.
          </p>
          <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            ⚠️ Requer que o servidor backend esteja rodando (<span className="font-mono">npm run dev</span> na pasta <span className="font-mono">sgj/</span>).
            As credenciais são enviadas diretamente ao tribunal — nunca armazenadas em banco de dados.
          </div>
        </div>

        <div className="space-y-4" key={refreshKey}>
          {PORTAIS.map(portal => (
            <PortalCard
              key={portal.id}
              portal={portal}
              oab={oab}
              oabUF={uf}
              onImported={() => setRefreshKey(k => k + 1)}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
