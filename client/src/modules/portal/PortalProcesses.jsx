import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconBriefcase, IconChevronDown, IconChevronRight, IconClock } from '../../components/ui'

const PROCESSES = [
  {
    id: '1', number: '0012345-67.2024.8.26.0100', area: 'Cível',
    title: 'Apelação Cível — Silva x ABC Comércio Ltda.',
    status: 'active', phase: 'Recursal', lawyer: 'Dra. Ana Souza',
    movements: [
      { id: 'a', date: new Date(Date.now() - 86400000 * 5).toISOString(),  text: 'Intimação para contrarrazões de apelação (prazo 15 dias)' },
      { id: 'b', date: new Date(Date.now() - 86400000 * 20).toISOString(), text: 'Recurso de apelação interposto pelo réu' },
      { id: 'c', date: new Date(Date.now() - 86400000 * 45).toISOString(), text: 'Sentença procedente em parte — condenação de R$ 18.500' },
      { id: 'd', date: new Date(Date.now() - 86400000 * 90).toISOString(), text: 'Audiência de instrução e julgamento realizada' },
      { id: 'e', date: new Date(Date.now() - 86400000 * 180).toISOString(),text: 'Processo distribuído ao 3º Vara Cível' },
    ],
  },
  {
    id: '2', number: '0098765-43.2023.5.02.0001', area: 'Trabalhista',
    title: 'Reclamação Trabalhista — Férias + FGTS + Horas Extras',
    status: 'active', phase: 'Instrução', lawyer: 'Dr. Bruno Lima',
    movements: [
      { id: 'a', date: new Date(Date.now() - 86400000 * 2).toISOString(),  text: 'Audiência de instrução designada para 15/06/2026 às 14h' },
      { id: 'b', date: new Date(Date.now() - 86400000 * 15).toISOString(), text: 'Defesa apresentada pelo reclamado — juntada aos autos' },
      { id: 'c', date: new Date(Date.now() - 86400000 * 30).toISOString(), text: 'Reclamação trabalhista distribuída à 2ª Vara do Trabalho' },
    ],
  },
  {
    id: '3', number: '0001234-56.2022.8.26.0200', area: 'Família',
    title: 'Divórcio Consensual — Partilha de Bens',
    status: 'closed', phase: 'Encerrado', lawyer: 'Dra. Carla Mendes',
    movements: [
      { id: 'a', date: new Date(Date.now() - 86400000 * 90).toISOString(),  text: 'Sentença homologatória transitada em julgado' },
      { id: 'b', date: new Date(Date.now() - 86400000 * 100).toISOString(), text: 'Acordo de partilha homologado pelo juiz' },
      { id: 'c', date: new Date(Date.now() - 86400000 * 130).toISOString(), text: 'Petição inicial protocolada — Divórcio Consensual' },
    ],
  },
]

const statusConfig = {
  active: { label: 'Em andamento', cls: 'badge-green' },
  closed: { label: 'Encerrado',    cls: 'badge-gray' },
}

const areaColors = {
  Cível:       'bg-blue-900/40 text-blue-400',
  Trabalhista: 'bg-amber-900/40 text-amber-400',
  Família:     'bg-pink-900/40 text-pink-400',
  Tributário:  'bg-purple-900/40 text-purple-400',
}

export default function PortalProcesses() {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Meus Processos</h1>

      {PROCESSES.map(p => (
        <div key={p.id} className="card overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            className="w-full px-4 py-4 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 ${areaColors[p.area] ?? 'bg-gray-800 text-gray-400'}`}>
              <IconBriefcase size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">{p.title}</p>
                <span className={`badge ${statusConfig[p.status].cls}`}>{statusConfig[p.status].label}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">{p.number}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                <span>{p.area}</span>
                <span>·</span>
                <span>Fase: {p.phase}</span>
                <span>·</span>
                <span>{p.lawyer}</span>
              </div>
            </div>
            <div className="flex-shrink-0 text-[var(--text-muted)] mt-1">
              {expanded === p.id ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </div>
          </button>

          {/* Timeline */}
          {expanded === p.id && (
            <div className="border-t border-[var(--border)] px-4 py-4">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Movimentações</p>
              <div className="space-y-0">
                {p.movements.map((m, i) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${i === 0 ? 'bg-brand-500' : 'bg-[var(--border-strong)]'}`} />
                      {i < p.movements.length - 1 && <div className="w-px flex-1 bg-[var(--border)] my-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className={`text-sm leading-snug ${i === 0 ? 'text-white font-medium' : 'text-[var(--text-secondary)]'}`}>
                        {m.text}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
                        <IconClock size={10} />
                        {format(new Date(m.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
