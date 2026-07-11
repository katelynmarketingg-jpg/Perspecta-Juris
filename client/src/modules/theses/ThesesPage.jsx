import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { IconPlus, IconSearch, IconStar, IconBookOpen, IconX, IconTag, IconEdit, IconTrash } from '../../components/ui'

const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
const lsSet = (key, val) => localStorage.setItem(key, JSON.stringify(val))
const uid   = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)

const MOCK_THESES = [
  {
    id: 't1',
    title: 'Prescrição Intercorrente em Execução Fiscal — STJ',
    category: 'Tributário',
    summary: 'O prazo prescricional de 5 anos flui durante o processo de execução fiscal quando o exequente é intimado e não promove os atos processuais necessários para seu andamento.',
    content: `## Tese\n\nO prazo prescricional de 5 anos flui durante o processo de execução fiscal quando o exequente é intimado e não promove os atos processuais necessários para seu andamento.\n\n## Fundamento Legal\n\n- Art. 40 da LEF (Lei n.º 6.830/80)\n- Súmula 314/STJ: "Em execução fiscal, não localizados bens penhoráveis, suspende-se o processo por um ano, findo o qual se inicia o prazo da prescrição quinquenal intercorrente."\n- REsp 1.340.553/RS (Recurso Especial — julgado sob o rito dos recursos repetitivos)\n\n## Aplicação Prática\n\nUsar para requerer extinção de execuções fiscais paralisadas há mais de 5 anos sem impulso do exequente. Verificar se houve citação válida e intimação do Fisco para dar andamento.`,
    tags: ['prescrição', 'execução fiscal', 'STJ', 'tributário'],
    starred: true,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 't2',
    title: 'Dano Moral In Re Ipsa — Negativação Indevida',
    category: 'Cível',
    summary: 'A inscrição indevida em cadastro de inadimplentes gera dano moral presumido (in re ipsa), dispensando comprovação de prejuízo concreto pelo autor da ação.',
    content: `## Tese\n\nA inscrição indevida em cadastro de inadimplentes gera dano moral presumido (in re ipsa), dispensando comprovação de prejuízo concreto pelo autor da ação.\n\n## Fundamento Legal\n\n- Súmula 385/STJ (exceção: prévia inscrição legítima)\n- REsp 1.059.663/MS\n\n## Valores de Referência\n\n| Tribunal | Faixa usual |\n|---|---|\n| TJSP | R$ 5.000 a R$ 15.000 |\n| TJRJ | R$ 3.000 a R$ 10.000 |\n| STJ  | Mantém se proporcional |`,
    tags: ['dano moral', 'negativação', 'in re ipsa', 'consumidor'],
    starred: false,
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 't3',
    title: 'Horas Extras — Cargo de Confiança — §2º art. 224 CLT',
    category: 'Trabalhista',
    summary: 'O bancário que exerce cargo de confiança com poderes de mando e gestão não faz jus às horas extras após a 6ª hora diária, mas sim após a 8ª, conforme art. 224, §2º da CLT.',
    content: `## Tese\n\nO bancário que exerce cargo de confiança com poderes de mando e gestão não faz jus às horas extras após a 6ª hora diária, mas sim após a 8ª, conforme §2º do art. 224 da CLT. A mera gratificação de função superior a 1/3 do salário cria presunção relativa de cargo de confiança.\n\n## Fundamento\n\n- Art. 224, §2º da CLT\n- Súmula 102/TST\n- OJ 313/TST`,
    tags: ['horas extras', 'bancário', 'cargo de confiança', 'CLT'],
    starred: true,
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 't4',
    title: 'Desconsideração da Personalidade Jurídica — Grupo Econômico',
    category: 'Empresarial',
    summary: 'A teoria da desconsideração da personalidade jurídica exige demonstração de abuso da personalidade jurídica, caracterizado por desvio de finalidade ou confusão patrimonial.',
    content: `## Tese\n\nA teoria da desconsideração da personalidade jurídica exige demonstração de abuso da personalidade jurídica, caracterizado por desvio de finalidade ou confusão patrimonial (teoria maior — art. 50 CC). Em relações de consumo, basta a insolvência associada ao encerramento irregular (teoria menor — art. 28 CDC).\n\n## Atenção\n\nCom o CPC/2015 (art. 133-137), o incidente de desconsideração deve ser instaurado em contraditório prévio, salvo se deferido liminarmente em casos de urgência.`,
    tags: ['desconsideração', 'personalidade jurídica', 'grupo econômico', 'empresarial'],
    starred: false,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
  {
    id: 't5',
    title: 'Usucapião Extrajudicial — Procedimento Cartorário',
    category: 'Imobiliário',
    summary: 'O CPC/2015 introduziu a usucapião extrajudicial via cartório de registro de imóveis (art. 216-A da LRP), dispensando processo judicial quando há consenso e requisitos documentais.',
    content: `## Tese\n\nO CPC/2015 introduziu a usucapião extrajudicial via cartório de registro de imóveis, conforme art. 216-A da LRP. O procedimento dispensa o processo judicial quando há anuência de eventuais interessados e apresentação dos documentos exigidos.\n\n## Documentos Necessários\n\n1. Ata notarial lavrada pelo tabelião\n2. Planta e memorial descritivo\n3. Certidões negativas\n4. Justo título ou documentos que demonstrem a origem, a continuidade e a natureza da posse`,
    tags: ['usucapião', 'extrajudicial', 'cartório', 'imobiliário'],
    starred: false,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
]

const ALL_CATEGORIES = [...new Set(MOCK_THESES.map(t => t.category))]
const ALL_TAGS = [...new Set(MOCK_THESES.flatMap(t => t.tags))]

const catColor = {
  'Tributário':   'text-amber-400 bg-amber-900/30',
  'Cível':        'text-blue-400 bg-blue-900/30',
  'Trabalhista':  'text-emerald-400 bg-emerald-900/30',
  'Empresarial':  'text-purple-400 bg-purple-900/30',
  'Imobiliário':  'text-orange-400 bg-orange-900/30',
}

function ThesisDetail({ thesis, onClose, onToggleStar }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl my-8 shadow-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catColor[thesis.category] ?? 'text-[var(--text-muted)] bg-[var(--bg-hover)]'}`}>{thesis.category}</span>
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{thesis.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Atualizado {format(new Date(thesis.updatedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onToggleStar(thesis.id)} className={`p-2 rounded-lg transition-colors ${thesis.starred ? 'text-amber-400 hover:bg-amber-900/30' : 'text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-hover)]'}`}>
              <IconStar size={15} fill={thesis.starred ? 'currentColor' : 'none'} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]">
              <IconX size={15} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Markdown-style content rendered as formatted text */}
          <div className="prose-sm text-[var(--text-secondary)] space-y-3">
            {thesis.content.split('\n\n').map((block, i) => {
              if (block.startsWith('## ')) return <h3 key={i} className="text-sm font-semibold text-white mt-4 first:mt-0">{block.replace('## ', '')}</h3>
              if (block.startsWith('- ')) return <ul key={i} className="space-y-1 pl-4">{block.split('\n').map((li, j) => <li key={j} className="text-xs text-[var(--text-secondary)] list-disc">{li.replace('- ', '')}</li>)}</ul>
              if (block.includes('|---')) {
                const rows = block.trim().split('\n').filter(r => !r.includes('|---'))
                return (
                  <div key={i} className="overflow-x-auto">
                    <table className="w-full text-xs">
                      {rows.map((row, j) => {
                        const cells = row.split('|').filter(Boolean).map(c => c.trim())
                        return j === 0
                          ? <thead key={j}><tr>{cells.map((c, k) => <th key={k} className="text-left py-1.5 pr-4 text-[var(--text-muted)] font-medium border-b border-[var(--border)]">{c}</th>)}</tr></thead>
                          : <tbody key={j}><tr>{cells.map((c, k) => <td key={k} className="py-1.5 pr-4 text-[var(--text-secondary)]">{c}</td>)}</tr></tbody>
                      })}
                    </table>
                  </div>
                )
              }
              if (block.match(/^\d+\./m)) return <ol key={i} className="space-y-1 pl-4">{block.split('\n').map((li, j) => <li key={j} className="text-xs text-[var(--text-secondary)] list-decimal">{li.replace(/^\d+\.\s/, '')}</li>)}</ol>
              return <p key={i} className="text-xs text-[var(--text-secondary)] leading-relaxed">{block}</p>
            })}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-[var(--border)]">
            {thesis.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ThesesPage() {
  const [theses, setTheses] = useState(() => lsGet('pj_local_theses', MOCK_THESES))
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeTags, setActiveTags] = useState([])
  const [starredOnly, setStarredOnly] = useState(false)
  const [detail, setDetail] = useState(null)

  const toggleStar = id => setTheses(prev => {
    const next = prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t)
    lsSet('pj_local_theses', next)
    return next
  })
  const toggleTag = tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const filtered = theses.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.summary.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    const matchCat = activeCategory === 'all' || t.category === activeCategory
    const matchTags = activeTags.length === 0 || activeTags.every(tag => t.tags.includes(tag))
    const matchStar = !starredOnly || t.starred
    return matchSearch && matchCat && matchTags && matchStar
  })

  return (
    <div className="p-6 space-y-5 page-enter">
      {detail && <ThesisDetail thesis={detail} onClose={() => setDetail(null)} onToggleStar={id => { toggleStar(id); setDetail(prev => ({ ...prev, starred: !prev.starred })) }} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Banco de Teses</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{filtered.length} tese{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <IconPlus size={15} />
          Nova Tese
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título, conteúdo ou tags..."
          className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStarredOnly(s => !s)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${starredOnly ? 'bg-amber-900/40 border-amber-700 text-amber-400' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
            <IconStar size={10} fill={starredOnly ? 'currentColor' : 'none'} /> Favoritas
          </button>
          <div className="w-px bg-[var(--border)] mx-1" />
          {['all', ...ALL_CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeCategory === cat ? 'bg-brand-500 border-brand-600 text-white' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
              {cat === 'all' ? 'Todas' : cat}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${activeTags.includes(tag) ? 'bg-[var(--bg-active)] border-brand-500/50 text-accent-400' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              <IconTag size={8} /> {tag}
            </button>
          ))}
          {activeTags.length > 0 && (
            <button onClick={() => setActiveTags([])} className="px-2 py-0.5 rounded-full text-[10px] text-[var(--text-muted)] hover:text-white flex items-center gap-1">
              <IconX size={9} /> limpar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <IconBookOpen size={28} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">Nenhuma tese encontrada.</p>
          </div>
        ) : filtered.map(thesis => (
          <div key={thesis.id} className="card p-4 hover:border-[var(--border-strong)] transition-colors cursor-pointer group" onClick={() => setDetail(thesis)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catColor[thesis.category] ?? 'text-[var(--text-muted)] bg-[var(--bg-hover)]'}`}>{thesis.category}</span>
                  <h3 className="text-sm font-semibold text-white">{thesis.title}</h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">{thesis.summary}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {thesis.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{tag}</span>
                  ))}
                  <span className="text-[10px] text-[var(--text-muted)]">· {format(new Date(thesis.updatedAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleStar(thesis.id)} className={`p-1.5 rounded-lg transition-colors ${thesis.starred ? 'text-amber-400' : 'text-[var(--text-muted)] hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}>
                  <IconStar size={14} fill={thesis.starred ? 'currentColor' : 'none'} />
                </button>
                <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-all">
                  <IconEdit size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
