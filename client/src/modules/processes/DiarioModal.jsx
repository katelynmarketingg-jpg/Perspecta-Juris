import { useState } from 'react'
import { fetchPublicacoes, getOabConfig } from '../../lib/diarioOficial'
import { useUiStore } from '../../stores/uiStore'
import { Button } from '../../components/ui'
import api from '../../lib/api'

const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : ''

export default function DiarioModal({ process, onImported, onClose }) {
  const { showToast } = useUiStore()
  const cfg = getOabConfig()
  const [modo, setModo] = useState(process.judicialNumber ? 'processo' : 'oab')
  const [oab, setOab] = useState(cfg.oab)
  const [uf, setUf] = useState(cfg.uf)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [importados, setImportados] = useState({})

  const buscar = async () => {
    setLoading(true); setError(''); setResults(null)
    try {
      const params = modo === 'processo'
        ? { numeroProcesso: process.judicialNumber }
        : { oab, uf }
      const pubs = await fetchPublicacoes(params)
      setResults(pubs)
      if (!pubs.length) setError('Nenhuma publicação encontrada no período (últimos ' + (modo === 'processo' ? '365' : '30') + ' dias).')
    } catch (e) {
      setError(e.message + ' — a consulta ao DJEN pode exigir o servidor/proxy ativo.')
    } finally { setLoading(false) }
  }

  const importar = async (pub, i) => {
    try {
      await api.processes.addMovement(process.id, {
        date: (pub.data || new Date().toISOString()).slice(0, 10),
        description: `[DJEN — ${pub.tribunal || 'Diário Oficial'}] ${pub.tipo}: ${pub.texto?.slice(0, 500) || 'Publicação'}`,
        type: 'status',
        author: pub.orgao || pub.tribunal || 'Diário Oficial',
        isPublic: false,
      })
      setImportados(s => ({ ...s, [i]: true }))
      showToast('Publicação importada como movimentação.', 'success')
      onImported?.()
    } catch { showToast('Erro ao importar.', 'error') }
  }

  const inputCls = 'px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Diário Oficial — DJEN (CNJ)</p>
            <p className="text-xs text-[var(--text-muted)]">Intimações e publicações do Diário de Justiça Eletrônico Nacional.</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Modo de busca */}
          <div className="flex gap-2">
            {process.judicialNumber && (
              <button onClick={() => setModo('processo')} className={`text-xs px-3 py-1.5 rounded-full border ${modo === 'processo' ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                Por nº do processo
              </button>
            )}
            <button onClick={() => setModo('oab')} className={`text-xs px-3 py-1.5 rounded-full border ${modo === 'oab' ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
              Por OAB
            </button>
          </div>

          {modo === 'processo' ? (
            <p className="text-xs text-[var(--text-secondary)]">Processo: <span className="font-mono">{process.judicialNumber}</span></p>
          ) : (
            <div className="flex gap-2">
              <input className={inputCls + ' flex-1'} value={oab} onChange={e => setOab(e.target.value)} placeholder="Número OAB" />
              <input className={inputCls + ' w-20'} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
            </div>
          )}

          <Button variant="primary" size="sm" onClick={buscar} loading={loading} className="w-full">🔍 Buscar no Diário</Button>

          {error && <p className="text-xs text-amber-400">{error}</p>}

          {results && results.length > 0 && (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {results.map((pub, i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-accent-400 font-medium">{pub.tribunal || 'DJEN'}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{fmtData(pub.data)}</span>
                    {pub.processo && <span className="text-[10px] font-mono text-[var(--text-muted)]">{pub.processo}</span>}
                  </div>
                  {pub.orgao && <p className="text-xs font-medium text-[var(--text-primary)]">{pub.orgao}</p>}
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-3">{pub.texto || pub.tipo}</p>
                  <div className="flex justify-end mt-2">
                    {importados[i]
                      ? <span className="text-xs text-emerald-400">✓ Importado</span>
                      : <button onClick={() => importar(pub, i)} className="text-xs text-brand-500 hover:underline">+ Importar como movimentação</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
