import { useState, useMemo, useEffect } from 'react'
import { fetchRegistros, filtrarRegistros, autoresDe, TIPOS_ATIVIDADE, tipoInfo } from '../../lib/auditLog'
import { Card } from '../../components/ui'

const fmt = (iso) => new Date(iso).toLocaleString('pt-BR')
const sameDay = (a, b) => a.toDateString() === b.toDateString()

export default function RegistrosPage() {
  const [tipo, setTipo] = useState('')
  const [autor, setAutor] = useState('')
  const [busca, setBusca] = useState('')

  // Os registros vêm do SERVIDOR (fonte oficial, com autor/IP/hora do servidor).
  const [todos, setTodos] = useState([])
  const [carregando, setCarregando] = useState(true)
  useEffect(() => { fetchRegistros().then(r => setTodos(r ?? [])).finally(() => setCarregando(false)) }, [])

  const registros = useMemo(() => filtrarRegistros(todos, { tipo, autor, busca }), [todos, tipo, autor, busca])
  const autores = useMemo(() => autoresDe(todos), [todos])

  // agrupa por dia
  const grupos = useMemo(() => {
    const g = {}
    for (const r of registros) {
      const d = new Date(r.createdAt)
      const hoje = new Date()
      const ontem = new Date(Date.now() - 86400000)
      const chave = sameDay(d, hoje) ? 'Hoje' : sameDay(d, ontem) ? 'Ontem' : d.toLocaleDateString('pt-BR')
      ;(g[chave] ??= []).push(r)
    }
    return g
  }, [registros])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Registros de atividade</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Histórico do que cada colaborador fez — pagamentos, tarefas, cálculos, documentos e mais.</p>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição ou colaborador..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
            <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">🔍</span>
          </div>
          <select value={autor} onChange={e => setAutor(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
            <option value="">Todos os colaboradores</option>
            {autores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTipo('')} className={`text-xs px-3 py-1.5 rounded-full border ${!tipo ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>Tudo</button>
          {TIPOS_ATIVIDADE.map(t => (
            <button key={t.value} onClick={() => setTipo(tipo === t.value ? '' : t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${tipo === t.value ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              style={tipo === t.value ? { background: t.cor } : {}}>
              {t.icone} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {registros.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm text-[var(--text-muted)]">Nenhum registro {tipo || autor || busca ? 'com esses filtros' : 'ainda'}.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grupos).map(([dia, itens]) => (
            <div key={dia}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">{dia}</p>
              <div className="space-y-1.5">
                {itens.map(r => {
                  const info = tipoInfo(r.tipo)
                  return (
                    <Card key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${info.cor}22` }}>{info.icone}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)]">{r.descricao}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          <b className="text-[var(--text-secondary)]">{r.autor}</b> · {new Date(r.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {r.meta?.cliente ? ` · ${r.meta.cliente}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${info.cor}18`, color: info.cor }}>{info.label}</span>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-[var(--text-muted)]">{registros.length} registro(s) exibido(s).</p>
    </div>
  )
}
