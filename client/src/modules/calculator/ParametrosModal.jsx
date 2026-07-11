import { useState } from 'react'
import { getPrevParams, salvarPrevParams, limparPrevParams, paramsInfo, TABUA_IBGE, INPC_FATOR, brl } from '../../lib/legalCalc'
import { buscarINPCdoIBGE, parsePares } from '../../lib/prevParamsFetch'
import { Button } from '../../components/ui'
import { useUiStore } from '../../stores/uiStore'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
const paresParaTexto = (obj) => Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n')

export default function ParametrosModal({ onClose, onSaved }) {
  const { showToast } = useUiStore()
  const info = paramsInfo()
  const [ano, setAno] = useState(info.ano)
  const [sm, setSm] = useState(info.salarioMinimo)
  const [teto, setTeto] = useState(info.tetoINSS)
  const [tabuaTxt, setTabuaTxt] = useState(paresParaTexto(TABUA_IBGE))
  const [inpcTxt, setInpcTxt] = useState(paresParaTexto(INPC_FATOR))
  const [buscando, setBuscando] = useState(false)

  const buscarINPC = async () => {
    setBuscando(true)
    try {
      const { fatores, ultimoPeriodo } = await buscarINPCdoIBGE()
      setInpcTxt(paresParaTexto(fatores))
      showToast(`INPC atualizado do IBGE (até ${ultimoPeriodo.slice(4)}/${ultimoPeriodo.slice(0,4)}). Revise e salve.`, 'success')
    } catch (e) {
      showToast('Não foi possível buscar do IBGE agora: ' + (e.message || '') + ' — atualize manualmente.', 'error')
    } finally { setBuscando(false) }
  }

  const salvar = () => {
    const tabua = parsePares(tabuaTxt)
    const inpc = parsePares(inpcTxt)
    salvarPrevParams({
      ano: Number(ano) || new Date().getFullYear(),
      salarioMinimo: parseFloat(String(sm).replace(/\./g, '').replace(',', '.')) || undefined,
      tetoINSS: parseFloat(String(teto).replace(/\./g, '').replace(',', '.')) || undefined,
      tabua: Object.keys(tabua).length ? tabua : undefined,
      inpc: Object.keys(inpc).length ? inpc : undefined,
    })
    showToast('Parâmetros salvos e aplicados aos cálculos.', 'success')
    onSaved?.()
    onClose()
  }

  const restaurar = () => {
    limparPrevParams()
    showToast('Parâmetros restaurados ao padrão do sistema.', 'success')
    onSaved?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">⚙️ Parâmetros previdenciários</p>
            <p className="text-xs text-[var(--text-muted)]">Atualize a tábua IBGE, o INPC, o salário mínimo e o teto quando saírem os novos valores.</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-[var(--text-secondary)] mb-1 block">Ano de referência</label><input className={inputCls} value={ano} onChange={e => setAno(e.target.value)} /></div>
            <div><label className="text-xs text-[var(--text-secondary)] mb-1 block">Salário mínimo (R$)</label><input className={inputCls} value={sm} onChange={e => setSm(e.target.value)} /></div>
            <div><label className="text-xs text-[var(--text-secondary)] mb-1 block">Teto INSS (R$)</label><input className={inputCls} value={teto} onChange={e => setTeto(e.target.value)} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Fatores INPC (ano = fator)</label>
              <Button variant="secondary" size="sm" onClick={buscarINPC} loading={buscando}>🔄 Buscar do IBGE</Button>
            </div>
            <textarea rows={5} value={inpcTxt} onChange={e => setInpcTxt(e.target.value)} className={inputCls + ' font-mono text-xs'} placeholder="2010=2.52&#10;2011=2.38&#10;..." />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Fator acumulado de cada ano (julho) até hoje. O botão busca da API do IBGE; você pode ajustar antes de salvar.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1 block">Tábua IBGE — expectativa de sobrevida (idade = anos)</label>
            <textarea rows={5} value={tabuaTxt} onChange={e => setTabuaTxt(e.target.value)} className={inputCls + ' font-mono text-xs'} placeholder="45=35.3&#10;46=34.4&#10;..." />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Cole a coluna E(X) da Tábua Completa de Mortalidade (ambos os sexos) do IBGE — uma idade por linha.</p>
          </div>

          <div className="rounded-lg bg-[var(--bg-hover)] p-3 text-[11px] text-[var(--text-muted)]">
            Última atualização: {info.updatedAt ? new Date(info.updatedAt).toLocaleString('pt-BR') : 'padrão do sistema'} · Teto atual {brl(info.tetoINSS)} · SM {brl(info.salarioMinimo)}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-between gap-2">
          <button onClick={restaurar} className="text-xs text-[var(--text-muted)] hover:text-red-400">Restaurar padrão</button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={salvar}>Salvar e aplicar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
