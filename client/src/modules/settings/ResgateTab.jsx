import { useState, useMemo } from 'react'
import { Card, Button } from '../../components/ui'
import { useUiStore } from '../../stores/uiStore'
import { resumo, baixarBackup, enviarParaServidor, limparLocal } from '../../lib/resgateLocal'

const ROTULOS = {
  clients:      'Clientes',
  processes:    'Processos',
  deadlines:    'Prazos',
  tasks:        'Tarefas',
  movements:    'Movimentações',
  financial:    'Lançamentos financeiros',
  atendimentos: 'Fila de atendimento',
  auditoria:    'Registros de atividade',
}

export default function ResgateTab() {
  const { showToast } = useUiStore()
  const [dados, setDados]       = useState(() => resumo())
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [relatorio, setRelatorio] = useState(null)
  const [baixou, setBaixou]     = useState(false)

  const linhasComDado = useMemo(() => dados.linhas.filter(l => l.total > 0), [dados])

  const enviar = async () => {
    if (!baixou) {
      const ok = window.confirm(
        'Você ainda não baixou o backup.\n\n' +
        'Recomendo baixar antes: se algo der errado no envio, o arquivo é a sua garantia.\n\n' +
        'Enviar mesmo assim?'
      )
      if (!ok) return
    }
    setEnviando(true); setRelatorio(null)
    try {
      const rel = await enviarParaServidor(setProgresso)
      setRelatorio(rel)
      setDados(resumo())
      showToast(
        rel.erros.length === 0 ? 'Envio concluído.' : `Envio concluído com ${rel.erros.length} problema(s).`,
        rel.erros.length === 0 ? 'success' : 'error',
      )
    } catch (e) {
      showToast(e?.message ?? 'Falha no envio.', 'error')
    } finally {
      setEnviando(false); setProgresso(null)
    }
  }

  const limpar = () => {
    const ok = window.confirm(
      'Apagar do navegador os dados que já foram enviados?\n\n' +
      'Isto não afeta o servidor. Só faça se você já baixou o backup.'
    )
    if (!ok) return
    const apagadas = limparLocal()
    setDados(resumo())
    showToast(`${apagadas.length} conjunto(s) removido(s) do navegador.`, 'success')
  }

  const podeLimpar = relatorio?.tudoEnviado === true

  if (!dados.temAlgo) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Nada preso neste navegador</h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
          Não encontrei dados de trabalho guardados localmente. Tudo que você usa neste
          computador já vem do servidor.
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-3 leading-relaxed">
          Se você <b>sabe</b> que cadastrou coisas em outro computador ou em outro navegador,
          abra o sistema lá e volte nesta tela — os dados ficam guardados por navegador.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Encontrei dados guardados só neste navegador
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
          Estes registros <b>não estão no servidor</b>. Eles só existem neste computador e
          neste navegador — somem se você limpar o navegador, e ninguém mais da equipe os vê.
          Envie para o servidor para que fiquem seguros e disponíveis em qualquer lugar.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-muted)] text-left border-b border-[var(--border)]">
                <th className="py-1.5 font-medium">Tipo</th>
                <th className="py-1.5 font-medium text-right">Registros</th>
                <th className="py-1.5 font-medium pl-4">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhasComDado.map(l => (
                <tr key={l.nome} className="border-b border-[var(--border)]/50">
                  <td className="py-1.5 text-[var(--text-primary)]">{ROTULOS[l.nome] ?? l.nome}</td>
                  <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">{l.total}</td>
                  <td className="py-1.5 pl-4">
                    {l.enviavel && <span className="text-emerald-400">será enviado</span>}
                    {l.pendente && <span className="text-amber-400">aguarda próxima etapa</span>}
                    {l.soBackup && <span className="text-[var(--text-muted)]">só no backup</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {linhasComDado.some(l => l.pendente) && (
          <p className="text-[11px] text-amber-300/90 mt-3 leading-relaxed bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">
            <b>Sobre os lançamentos financeiros:</b> o banco ainda não tem as colunas de
            parcelamento (grupo de parcelas, número da parcela). Enviar agora gravaria o
            valor e <b>perderia o parcelamento em silêncio</b> — prefiro não fazer isso.
            Eles ficam íntegros no backup e sobem inteiros assim que essas colunas existirem.
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Passo 1 — backup</h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Baixe um arquivo com <b>tudo</b> que está neste navegador, inclusive o que ainda
          não pode ser enviado. Guarde em lugar seguro.
        </p>
        <Button variant="secondary" size="sm" onClick={() => { baixarBackup(); setBaixou(true); showToast('Backup baixado.', 'success') }}>
          {baixou ? '✓ Baixar de novo' : 'Baixar backup (.json)'}
        </Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Passo 2 — enviar</h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Envia para o servidor. Registros que já existem lá são reconhecidos e
          <b> não são duplicados</b> — pode rodar mais de uma vez sem medo.
        </p>
        <Button size="sm" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : `Enviar ${dados.totalEnviavel} registro(s) para o servidor`}
        </Button>
        {progresso && (
          <p className="text-[11px] text-[var(--text-muted)]">
            {progresso.etapa}: {progresso.feitos} de {progresso.total}…
          </p>
        )}
      </Card>

      {relatorio && (
        <Card className="p-5 space-y-2">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Resultado</h3>
          {Object.entries(relatorio.enviados).length > 0 && (
            <p className="text-xs text-emerald-400">
              Enviados: {Object.entries(relatorio.enviados).map(([k, v]) => `${v} ${ROTULOS[k] ?? k}`).join(' · ')}
            </p>
          )}
          {Object.entries(relatorio.jaExistiam).length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              Já estavam no servidor: {Object.entries(relatorio.jaExistiam).map(([k, v]) => `${v} ${ROTULOS[k] ?? k}`).join(' · ')}
            </p>
          )}
          {relatorio.erros.length > 0 && (
            <div className="text-xs text-red-400 space-y-1">
              <p className="font-medium">{relatorio.erros.length} não foram enviados:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {relatorio.erros.slice(0, 12).map((e, i) => (
                  <li key={i}>{e.tipo} “{e.nome ?? '—'}”: {e.motivo}</li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--text-muted)]">
                Nada foi apagado do navegador. Resolva e rode de novo.
              </p>
            </div>
          )}
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Passo 3 — limpar (opcional)</h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Só fica disponível depois de um envio <b>sem nenhum erro e sem pendência</b>.
          Remove do navegador o que já está guardado no servidor. Não mexe no servidor.
        </p>
        <Button variant="secondary" size="sm" onClick={limpar} disabled={!podeLimpar}>
          Limpar dados locais já enviados
        </Button>
        {!podeLimpar && (
          <p className="text-[11px] text-[var(--text-muted)]">
            Bloqueado — {relatorio ? 'ainda há erros ou pendências no envio.' : 'envie os dados primeiro.'}
          </p>
        )}
      </Card>
    </div>
  )
}
