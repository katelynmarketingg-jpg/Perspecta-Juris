import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconFolder, IconArrowRight } from '../../components/ui'

const DOCS = [
  { id: '1', name: 'Procuração ad Judicia', process: 'Apelação Cível', type: 'PDF', size: '180 KB', date: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: '2', name: 'Petição Inicial — Apelação Cível', process: 'Apelação Cível', type: 'PDF', size: '420 KB', date: new Date(Date.now() - 86400000 * 40).toISOString() },
  { id: '3', name: 'Sentença 1ª Instância', process: 'Apelação Cível', type: 'PDF', size: '340 KB', date: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: '4', name: 'Contrato de Honorários', process: 'Reclamação Trabalhista', type: 'PDF', size: '210 KB', date: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: '5', name: 'Acordo Extrajudicial', process: 'Divórcio Consensual', type: 'DOCX', size: '95 KB', date: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: '6', name: 'Certidão de Casamento', process: 'Divórcio Consensual', type: 'PDF', size: '75 KB', date: new Date(Date.now() - 86400000 * 95).toISOString() },
]

export default function PortalDocuments() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Meus Documentos</h1>

      <div className="card overflow-hidden">
        <div className="divide-y divide-[var(--border)]">
          {DOCS.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors group">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                d.type === 'PDF' ? 'bg-red-900/30 border-red-800/40' : 'bg-blue-900/30 border-blue-800/40'
              }`}>
                <span className={`text-[9px] font-bold ${d.type === 'PDF' ? 'text-red-400' : 'text-blue-400'}`}>{d.type}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-accent-400 transition-colors">{d.name}</p>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                  <span>{d.process}</span>
                  <span>·</span>
                  <span>{d.size}</span>
                  <span>·</span>
                  <span>{format(new Date(d.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>
              <IconArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-accent-400 transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center">
        Dúvidas sobre algum documento? <button className="text-accent-400 hover:text-white transition-colors">Envie uma mensagem ao seu advogado.</button>
      </p>
    </div>
  )
}
