// ─────────────────────────────────────────────────────────────────────────
//  O aviso que aparece no canto da tela.
//
//  O uiStore tinha showToast() desde sempre, e 23 telas o chamavam — cerca de
//  140 vezes. Só que NINGUÉM lia `toast` para desenhar coisa nenhuma. Todo
//  aviso de sucesso e todo aviso de erro do sistema caía no vazio.
//
//  Era isso que fazia "Calcular Planejamento Previdenciário" parecer quebrado:
//  faltando a data de nascimento, o código dizia "Informe a data de
//  nascimento" e voltava — mas a frase não tinha onde aparecer, e a tela ficava
//  parada, sem explicação nenhuma.
//
//  Um sistema que engole os próprios avisos é pior do que um que não avisa: a
//  pessoa clica de novo, achando que não funcionou.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useUiStore } from '../../stores/uiStore'

const ESTILOS = {
  success: { borda: 'border-emerald-500/50', fundo: 'bg-emerald-500/15', texto: 'text-emerald-200', icone: '✓' },
  error:   { borda: 'border-red-500/50',     fundo: 'bg-red-500/15',     texto: 'text-red-200',     icone: '✕' },
  warning: { borda: 'border-amber-500/50',   fundo: 'bg-amber-500/15',   texto: 'text-amber-200',   icone: '⚠' },
  info:    { borda: 'border-sky-500/50',     fundo: 'bg-sky-500/15',     texto: 'text-sky-200',     icone: 'ℹ' },
}

export default function Toaster() {
  const toast = useUiStore(s => s.toast)
  const clearToast = useUiStore(s => s.clearToast)
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    if (!toast) return
    // Um quadro depois, para a transição ter de onde sair.
    const t = setTimeout(() => setEntrando(true), 10)
    return () => { clearTimeout(t); setEntrando(false) }
  }, [toast?.id])

  if (!toast) return null
  const e = ESTILOS[toast.type] ?? ESTILOS.info

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-md pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        onClick={clearToast}
        className={`pointer-events-auto cursor-pointer flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl
          ${e.borda} ${e.fundo} ${e.texto}
          transition-all duration-200 ${entrando ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <span className="text-base leading-5 flex-shrink-0" aria-hidden="true">{e.icone}</span>
        <p className="text-sm leading-5 flex-1">{toast.message}</p>
        <button
          onClick={(ev) => { ev.stopPropagation(); clearToast() }}
          className="text-xs opacity-60 hover:opacity-100 flex-shrink-0 -mr-1"
          aria-label="Fechar aviso"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
