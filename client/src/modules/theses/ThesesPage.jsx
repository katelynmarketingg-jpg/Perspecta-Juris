import { useState, useMemo } from 'react'
import { IconSearch, IconBookOpen, IconExternalLink } from '../../components/ui'
import {
  VADE, COD, CATS, INDICE, buscarTemas, buscarCodigos, linkDoArtigo,
} from '../../lib/vademecum'

// ─────────────────────────────────────────────────────────────────────────
//  Vade Mecum — legislação oficial (Planalto) + índice remissivo por tema.
//
//  O índice e a busca vivem em lib/vademecum.js. Ficavam aqui dentro, e a
//  busca casava PEDAÇO de palavra: digitar "m" trazia "casaMento", "aliMentos"
//  e mais meia dúzia. Agora a busca é por palavra, sem acento, e o índice
//  cresceu de 51 para ~200 temas.
// ─────────────────────────────────────────────────────────────────────────

const googleSite = (t) => `https://www.google.com/search?q=${encodeURIComponent('site:planalto.gov.br ' + t)}`
const googleTerm = (t) => `https://www.google.com/search?q=${encodeURIComponent(t)}`

export default function ThesesPage() {
  const [q, setQ] = useState('')
  const termo = q.trim()
  const t = termo.toLowerCase()

  const temas   = useMemo(() => buscarTemas(termo), [termo])
  const codigos = useMemo(() => buscarCodigos(termo), [termo])

  const abrir = (url) => window.open(url, '_blank', 'noopener')
  // Abre NO ARTIGO, pela âncora do Planalto (#art136), em vez de largar a
  // pessoa no topo de um código de 2.000 artigos com o Ctrl+F na mão.
  const abrirRef = ([sigla, arts, , ancora]) => {
    if (sigla === 'Súmula') return abrir(googleTerm(arts))
    const link = linkDoArtigo(sigla, ancora)
    if (!link) return abrir(googleSite(`${arts} ${sigla}`))
    abrir(link)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><IconBookOpen size={20} /> Vade Mecum — Legislação</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Busque um <b>assunto</b> (ex.: divórcio, dano moral, furto, horas extras) e veja em <b>quais artigos e códigos</b> está — com link para o texto oficial do Planalto.</p>
      </div>

      <div className="relative">
        <IconSearch size={16} className="absolute left-3 top-3 text-[var(--text-muted)]" />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder='Ex.: "maus-tratos", "divórcio", "dano moral", "usucapião", "prazo", "furto"…'
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
      </div>

      {/* Resultados temáticos (o "índice remissivo") */}
      {termo && temas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Onde está sobre “{termo}”</p>
          {temas.map(tm => (
            <div key={tm.tema} className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{tm.tema}</p>
              <div className="space-y-1.5">
                {tm.refs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-accent-400 flex-shrink-0">{r[0]}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{r[1]}</span>
                    <span className="text-xs text-[var(--text-muted)]">— {r[2]}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={() => abrirRef(r)} className="text-[11px] text-accent-400 hover:underline flex items-center gap-1">📖 Abrir</button>
                      <button onClick={() => abrir(googleSite(`${r[1]} ${r[0] === 'Súmula' ? '' : (VADE.find(v => v.sigla === r[0])?.nome ?? r[0])}`))} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">🔎 Localizar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nada encontrado: dizer, em vez de deixar a tela vazia */}
      {termo.length >= 2 && temas.length === 0 && codigos.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Nenhum tema do índice responde a <b>“{termo}”</b>.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            O índice tem {INDICE.length} temas e {VADE.length} códigos e leis. Tente uma
            palavra mais curta ou o termo técnico — e use a busca no Planalto, abaixo.
          </p>
        </div>
      )}

      {/* Fallback: sempre oferece a busca oficial */}
      {termo && (
        <button onClick={() => abrir(googleSite(termo))}
          className="w-full text-left text-sm px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-500/40 flex items-center gap-2">
          <IconSearch size={14} /> {temas.length ? 'Não achou? ' : ''}Buscar <b>“{termo}”</b> em toda a legislação do Planalto
          <IconExternalLink size={13} className="ml-auto" />
        </button>
      )}

      {/* Lista de códigos/leis para navegar */}
      {codigos.length > 0 && CATS.map(cat => {
        const itens = codigos.filter(v => v.cat === cat)
        if (!itens.length) return null
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">{cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {itens.map(v => (
                <div key={v.sigla} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0"><IconBookOpen size={16} className="text-accent-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{v.sigla}</p>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug">{v.nome}</p>
                    {v.resumo && <p className="text-[11px] text-[var(--text-secondary)] leading-snug mt-1">{v.resumo}</p>}
                    <button onClick={() => abrir(v.url)} className="text-[11px] text-accent-400 hover:underline mt-1.5">📖 Abrir texto oficial</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <p className="text-center text-[11px] text-[var(--text-muted)]">{INDICE.length} temas · {VADE.length} códigos e leis · fonte oficial planalto.gov.br. Peça para ampliar quando faltar algum assunto.</p>
    </div>
  )
}
