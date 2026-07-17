import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { LEGAL_AREAS } from '../../lib/constants'
import { IconSearch, IconUsers, IconBriefcase } from '../../components/ui'

const norm = (s) => String(s ?? '').toLowerCase()
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
const areaLabel = (v) => LEGAL_AREAS.find(a => a.value === v)?.label ?? v

export default function PesquisasPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [processes, setProcesses] = useState([])
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('tudo')   // tudo | clientes | processos
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  useEffect(() => {
    api.clients.list?.({ limit: 1000 }).then(r => setClients(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => {})
    api.processes.list?.({ limit: 1000 }).then(r => setProcesses(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => {})
  }, [])

  const nomePorId = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients])
  const t = q.trim().toLowerCase()

  const noPeriodo = (iso) => {
    if (!iso) return !de && !ate
    const d = iso.slice(0, 10)
    if (de && d < de) return false
    if (ate && d > ate) return false
    return true
  }

  const clientesFiltrados = useMemo(() => {
    if (tipo === 'processos') return []
    return clients.filter(c => {
      if (!noPeriodo(c.createdAt)) return false
      if (!t) return true
      const alvo = [c.name, c.cpfCnpj, c.email, c.phone, c.notes, c.addressCity, c.companyName, c.fantasyName, c.representativeName].map(norm).join(' ')
      return alvo.includes(t)
    })
  }, [clients, t, tipo, de, ate])

  const processosFiltrados = useMemo(() => {
    if (tipo === 'clientes') return []
    return processes.filter(p => {
      if (!noPeriodo(p.startedAt ?? p.createdAt)) return false
      if (!t) return true
      const parte = nomePorId[p.clientId] ?? ''
      const alvo = [p.title, p.judicialNumber, p.internalNumber, p.opposingParty, areaLabel(p.area), p.summary, p.court, parte].map(norm).join(' ')
      return alvo.includes(t)
    })
  }, [processes, t, tipo, de, ate, nomePorId])

  const buscando = t || de || ate || tipo !== 'tudo'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><IconSearch size={20} /> Pesquisas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Busque qualquer coisa — nome, parte, número, observações — em clientes e processos, com filtro por período.</p>
      </div>

      {/* Atalhos com contagem */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/app/clients')} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left hover:border-brand-500/40 transition-colors">
          <div className="flex items-center gap-2 text-[var(--text-muted)]"><IconUsers size={16} /> <span className="text-sm">Clientes</span></div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{clients.length}</p>
          <p className="text-[11px] text-brand-500 mt-0.5">Abrir todos →</p>
        </button>
        <button onClick={() => navigate('/app/processes')} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left hover:border-brand-500/40 transition-colors">
          <div className="flex items-center gap-2 text-[var(--text-muted)]"><IconBriefcase size={16} /> <span className="text-sm">Processos</span></div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{processes.length}</p>
          <p className="text-[11px] text-brand-500 mt-0.5">Abrir todos →</p>
        </button>
      </div>

      {/* Busca */}
      <div className="space-y-2.5">
        <div className="relative">
          <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar por nome, parte, número, CPF, observações..."
            className="w-full pl-11 pr-3 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-base text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {[['tudo', 'Tudo'], ['clientes', 'Só clientes'], ['processos', 'Só processos']].map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)} className={`text-xs px-3 py-1.5 rounded-full border ${tipo === k ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>{l}</button>
          ))}
          <span className="text-[11px] text-[var(--text-muted)] ml-2">Período:</span>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
          <span className="text-[11px] text-[var(--text-muted)]">até</span>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
          {(de || ate) && <button onClick={() => { setDe(''); setAte('') }} className="text-[11px] text-[var(--text-muted)] hover:text-red-400">limpar período</button>}
        </div>
      </div>

      {/* Resultados */}
      {!buscando ? (
        <p className="text-center text-sm text-[var(--text-muted)] py-8">Digite algo ou use os filtros para pesquisar.</p>
      ) : (
        <div className="space-y-4">
          {clientesFiltrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Clientes ({clientesFiltrados.length})</p>
              <div className="space-y-1.5">
                {clientesFiltrados.slice(0, 50).map(c => (
                  <button key={c.id} onClick={() => navigate(`/app/clients/${c.id}`)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-brand-500/40 text-left">
                    <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0"><IconUsers size={15} className="text-blue-400" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{[c.cpfCnpj, c.phone, c.addressCity].filter(Boolean).join(' · ') || 'Cliente'}</p>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{fmtDate(c.createdAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {processosFiltrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Processos ({processosFiltrados.length})</p>
              <div className="space-y-1.5">
                {processosFiltrados.slice(0, 50).map(p => (
                  <button key={p.id} onClick={() => navigate(`/app/processes/${p.id}`)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-brand-500/40 text-left">
                    <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0"><IconBriefcase size={15} className="text-indigo-400" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{p.title}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{[p.judicialNumber, areaLabel(p.area), nomePorId[p.clientId]].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{fmtDate(p.startedAt ?? p.createdAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!clientesFiltrados.length && !processosFiltrados.length && (
            <p className="text-center text-sm text-[var(--text-muted)] py-8">Nada encontrado com esses critérios.</p>
          )}
        </div>
      )}
    </div>
  )
}
