import { useUiStore, TEMAS, ROTULO_DO_TEMA } from '../stores/uiStore'

// ─────────────────────────────────────────────────────────────────
//  Escolha do tema: Escuro · Médio · Claro.
//
//  Antes era um ícone de sol que ALTERNAVA entre dois temas. Um ícone que
//  gira não diz quais são as opções nem onde você está — e com três temas
//  isso piora. Aqui os três aparecem, e o atual fica marcado.
//
//  Os temas são os papéis do manual da marca: ESTRUTURA (preto),
//  INTELIGÊNCIA (cinza) e RESPIRO (claro).
// ─────────────────────────────────────────────────────────────────
export default function SeletorDeTema({ compacto = false }) {
  const theme = useUiStore(s => s.theme)
  const setTheme = useUiStore(s => s.setTheme)

  return (
    <div
      role="group"
      aria-label="Tema da tela"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]"
    >
      {TEMAS.map(t => {
        const atual = theme === t
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            aria-pressed={atual}
            title={`Tema ${ROTULO_DO_TEMA[t]}`}
            className={`${compacto ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} rounded-md font-medium transition-colors ${
              atual
                ? 'bg-brand-500 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {ROTULO_DO_TEMA[t]}
          </button>
        )
      })}
    </div>
  )
}
