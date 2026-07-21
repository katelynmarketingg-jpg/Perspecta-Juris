// O Portal do Cliente ainda não tem backend: as telas antigas exibiam
// processos, valores e mensagens FICTÍCIOS. Enquanto não estiver pronto,
// mostramos um aviso honesto — um cliente jamais pode ver dado inventado
// sobre o próprio processo.
export default function PortalEmPreparacao() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-6">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500 mx-auto flex items-center justify-center shadow-orange mb-5">
          <span className="text-2xl">⚖️</span>
        </div>

        <h1 className="text-xl font-bold text-white">Portal do Cliente</h1>

        <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-semibold uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          em preparação
        </span>

        <p className="text-sm text-[var(--text-secondary)] mt-5 leading-relaxed">
          O acompanhamento on-line do seu processo <b>ainda está sendo preparado</b> e será
          liberado em breve.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
          Enquanto isso, fale direto com o escritório — sua advogada tem todas as
          informações atualizadas do seu caso.
        </p>

        <p className="text-[10px] text-[var(--text-muted)] mt-8">Perspecta Juris</p>
      </div>
    </div>
  )
}
