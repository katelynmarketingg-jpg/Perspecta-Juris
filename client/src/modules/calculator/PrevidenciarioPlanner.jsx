import { useState, useRef } from 'react'
import { analisarPlanejamento } from '../../lib/previdenciaPlanner'
import { fmtData, brl } from '../../lib/legalCalc'
import { extractPdfText, parseCnisText } from '../../lib/cnisParser'
import { Button, Card } from '../../components/ui'
import { useUiStore } from '../../stores/uiStore'

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
const uid = () => Math.random().toString(36).slice(2, 10)

const novoVinculo = () => ({ id: uid(), origem: '', inicio: '', fim: '', salario: '', atividade: 'comum', grau: '25', ppp: false, pendencia: '' })

export default function PrevidenciarioPlanner({ onBack }) {
  const { showToast } = useUiStore()
  const [segurado, setSegurado] = useState({ nome: '', nascimento: '', sexo: 'M', dataFiliacao: '', categoria: 'empregado' })
  const [vinculos, setVinculos] = useState([novoVinculo()])
  const [extra, setExtra] = useState({ tempoServicoMilitarDias: '', tempoRegimeProprioDias: '' })
  const [analise, setAnalise] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const setSeg = (k) => (e) => setSegurado(d => ({ ...d, [k]: e.target.value }))
  const setV = (id, k, v) => setVinculos(vs => vs.map(x => x.id === id ? { ...x, [k]: v } : x))
  const addV = () => setVinculos(vs => [...vs, novoVinculo()])
  const delV = (id) => setVinculos(vs => vs.filter(x => x.id !== id))

  // ── Importação do CNIS ──
  const aplicarParse = (parsed) => {
    if (!parsed.vinculos.length && !parsed.segurado.nome) {
      showToast('Não foi possível identificar vínculos. Revise o texto ou lance manualmente.', 'error')
      return
    }
    setSegurado(s => ({
      ...s,
      nome: parsed.segurado.nome || s.nome,
      nascimento: parsed.segurado.nascimento || s.nascimento,
    }))
    if (parsed.vinculos.length) {
      setVinculos(parsed.vinculos.map(v => ({ ...novoVinculo(), ...v })))
    }
    setImportOpen(false)
    setImportText('')
    showToast(`CNIS importado: ${parsed.stats.vinculos} vínculo(s) e ${parsed.stats.competencias} competência(s). Confira os dados.`, 'success')
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      let text = ''
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file)
      } else {
        text = await file.text()
      }
      aplicarParse(parseCnisText(text))
    } catch (err) {
      showToast('Erro ao ler o arquivo: ' + err.message, 'error')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const onPaste = () => {
    if (!importText.trim()) { showToast('Cole o texto do CNIS.', 'error'); return }
    setImporting(true)
    try { aplicarParse(parseCnisText(importText)) }
    catch (err) { showToast('Erro ao processar: ' + err.message, 'error') }
    finally { setImporting(false) }
  }

  const calcular = () => {
    if (!segurado.nascimento) { showToast('Informe a data de nascimento.', 'error'); return }
    const validos = vinculos.filter(v => v.inicio && v.fim)
    if (!validos.length) { showToast('Adicione ao menos um vínculo com datas.', 'error'); return }
    const filiadoAntesReforma = segurado.dataFiliacao ? new Date(segurado.dataFiliacao) < new Date('2019-11-13') : true
    setAnalise(analisarPlanejamento(segurado, validos, { ...extra, filiadoAntesReforma }))
  }

  const printReport = () => {
    if (!analise) return
    const r = analise.resumo
    const cenariosHtml = analise.cenarios.map(c => `
      <div style="border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-weight:bold">
          <span>${c.regra}</span>
          <span style="color:${c.elegivelAgora ? '#059669' : '#b45309'}">${c.elegivelAgora ? 'JÁ PODE' : (c.dataProvavel ? fmtData(c.dataProvavel.toISOString().slice(0,10)) : 'Não alcançável')}</span>
        </div>
        <table style="width:100%;margin-top:6px;font-size:10pt">
          ${c.requisitos.map(req => `<tr><td>${req.label}</td><td>Exigido: ${req.exigido}</td><td>Atual: ${req.atual}</td><td style="color:${req.ok ? '#059669' : '#dc2626'}">${req.ok ? '✔' : '✗'}</td></tr>`).join('')}
        </table>
        <p style="font-size:10pt;margin-top:6px"><b>RMI estimada:</b> ${c.rmi ? brl(c.rmi) : '—'} · ${c.obs}</p>
      </div>`).join('')
    const alertasHtml = analise.alertas.map(a => `<li>${a.texto}</li>`).join('') || '<li>Nenhuma pendência detectada.</li>'
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Planejamento Previdenciário</title>
<style>body{font-family:Arial,sans-serif;font-size:11pt;color:#111;padding:30px;max-width:840px;margin:auto}h1{font-size:16pt;border-bottom:2px solid #059669;padding-bottom:8px}h2{font-size:12pt;margin-top:22px;color:#065f46}table{width:100%;border-collapse:collapse}td{padding:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10.5pt}.box{background:#ecfdf5;border-radius:8px;padding:14px;margin-top:10px}.disc{margin-top:24px;font-size:9pt;color:#777;border-top:1px solid #ddd;padding-top:10px}@media print{body{padding:0}}</style></head><body>
<h1>Relatório de Planejamento Previdenciário</h1>
<p style="color:#666">Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<h2>1. Dados do segurado</h2>
<div class="grid"><span><b>Nome:</b> ${r.nome || '—'}</span><span><b>Sexo:</b> ${r.sexo}</span><span><b>Nascimento:</b> ${fmtData(r.nascimento)}</span><span><b>Idade:</b> ${r.idade} anos</span></div>
<h2>2. Resumo do CNIS</h2>
<div class="grid"><span><b>Vínculos:</b> ${r.qtdeVinculos}</span><span><b>Carência:</b> ${r.carencia} contribuições</span><span><b>Tempo total:</b> ${r.tempoTotalStr}</span><span><b>Até a Reforma:</b> ${r.tempoReformaStr}</span><span><b>Tempo comum:</b> ${r.comumStr}</span><span><b>Tempo especial:</b> ${r.especialStr}</span><span><b>Tempo rural:</b> ${r.ruralStr}</span><span><b>Média salários:</b> ${brl(r.media)}</span></div>
<div class="box"><b>Situação:</b> ${analise.situacao}${analise.melhor ? ` · <b>Melhor regra:</b> ${analise.melhor.regra}` : ''}</div>
<h2>3. Análise das regras de aposentadoria</h2>
${cenariosHtml}
<h2>4. Pendências e alertas (CNIS)</h2><ul>${alertasHtml}</ul>
<div class="disc">${analise.disclaimer}</div>
<script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <button onClick={onBack} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mb-4">← Voltar às calculadoras</button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">👵</div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Planejamento Previdenciário Automático</h1>
          <p className="text-sm text-[var(--text-muted)]">Cadastre os vínculos do CNIS — o sistema cruza com as regras da EC 103/2019.</p>
        </div>
      </div>

      {/* Importar CNIS */}
      <Card className="p-4 mb-4 border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg flex-shrink-0">📄</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Importar CNIS</p>
              <p className="text-xs text-[var(--text-muted)]">Suba o extrato em PDF ou cole o texto — os vínculos são preenchidos automaticamente.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => fileRef.current?.click()} loading={importing}>
              ⬆️ Subir CNIS (PDF)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(o => !o)}>📋 Colar texto</Button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={onFile} />
        </div>

        {importOpen && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <textarea
              value={importText} onChange={e => setImportText(e.target.value)}
              rows={6} placeholder="Cole aqui o texto do CNIS (Ctrl+A / Ctrl+C no extrato e cole aqui)..."
              className={inputCls + ' resize-y font-mono text-xs'}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" onClick={() => { setImportOpen(false); setImportText('') }}>Cancelar</Button>
              <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={onPaste} loading={importing}>Processar texto</Button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-[var(--text-muted)] mt-2">⚠️ O CNIS não tem layout único — a leitura é automática mas pode falhar. Sempre confira e ajuste os vínculos importados antes de calcular.</p>
      </Card>

      {/* Segurado */}
      <Card className="p-5 mb-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Dados do segurado</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block col-span-2 md:col-span-1"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Nome</span><input className={inputCls} value={segurado.nome} onChange={setSeg('nome')} /></label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Nascimento *</span><input type="date" className={inputCls} value={segurado.nascimento} onChange={setSeg('nascimento')} /></label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Sexo</span>
            <select className={inputCls} value={segurado.sexo} onChange={setSeg('sexo')}><option value="M">Masculino</option><option value="F">Feminino</option></select>
          </label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Data de filiação ao INSS</span><input type="date" className={inputCls} value={segurado.dataFiliacao} onChange={setSeg('dataFiliacao')} /></label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Categoria</span>
            <select className={inputCls} value={segurado.categoria} onChange={setSeg('categoria')}>
              <option value="empregado">Empregado</option><option value="individual">Contribuinte individual</option>
              <option value="facultativo">Facultativo</option><option value="rural">Segurado especial (rural)</option><option value="domestico">Doméstico</option>
            </select>
          </label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Serviço militar (dias)</span><input className={inputCls} value={extra.tempoServicoMilitarDias} onChange={e => setExtra(d => ({ ...d, tempoServicoMilitarDias: e.target.value }))} placeholder="0" /></label>
          <label className="block"><span className="text-xs text-[var(--text-secondary)] mb-1 block">Tempo em RPPS/CTC (dias)</span><input className={inputCls} value={extra.tempoRegimeProprioDias} onChange={e => setExtra(d => ({ ...d, tempoRegimeProprioDias: e.target.value }))} placeholder="0" /></label>
        </div>
      </Card>

      {/* Vínculos */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Vínculos / contribuições (CNIS)</h3>
          <Button variant="secondary" size="sm" onClick={addV}>+ Vínculo</Button>
        </div>
        <div className="space-y-3">
          {vinculos.map((v, i) => (
            <div key={v.id} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">Vínculo {i + 1}</span>
                {vinculos.length > 1 && <button onClick={() => delV(v.id)} className="text-xs text-[var(--text-muted)] hover:text-red-400">Remover</button>}
              </div>
              <label className="block mb-2"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Empresa / origem do vínculo</span>
                <input className={inputCls} value={v.origem ?? ''} onChange={e => setV(v.id, 'origem', e.target.value)} placeholder="Nome da empresa (preenchido do CNIS)" /></label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="block"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Início</span><input type="date" className={inputCls} value={v.inicio} onChange={e => setV(v.id, 'inicio', e.target.value)} /></label>
                <label className="block"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Fim</span><input type="date" className={inputCls} value={v.fim} onChange={e => setV(v.id, 'fim', e.target.value)} /></label>
                <label className="block"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Salário contrib.</span><input className={inputCls} value={v.salario} onChange={e => setV(v.id, 'salario', e.target.value)} placeholder="R$" /></label>
                <label className="block"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Atividade</span>
                  <select className={inputCls} value={v.atividade} onChange={e => setV(v.id, 'atividade', e.target.value)}>
                    <option value="comum">Comum</option><option value="especial">Especial</option><option value="rural">Rural</option>
                  </select>
                </label>
              </div>
              {v.atividade === 'especial' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <label className="block"><span className="text-[10px] text-[var(--text-muted)] mb-1 block">Grau (anos)</span>
                    <select className={inputCls} value={v.grau} onChange={e => setV(v.id, 'grau', e.target.value)}>
                      <option value="15">15 anos</option><option value="20">20 anos</option><option value="25">25 anos</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 mt-5 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" checked={v.ppp} onChange={e => setV(v.id, 'ppp', e.target.checked)} /> Possui PPP/LTCAT
                  </label>
                </div>
              )}
              <input className={inputCls + ' mt-2'} value={v.pendencia} onChange={e => setV(v.id, 'pendencia', e.target.value)} placeholder="Pendência/indicador do CNIS (opcional)" />
            </div>
          ))}
        </div>
        <Button variant="primary" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500" onClick={calcular}>
          Calcular Planejamento Previdenciário
        </Button>
      </Card>

      {/* Resultado */}
      {analise && (
        <div className="space-y-4">
          {/* Situação */}
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">Situação previdenciária</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{analise.situacao}</p>
            {analise.melhor && <p className="text-sm text-emerald-400 mt-1">Melhor regra: {analise.melhor.regra} · RMI estimada {brl(analise.melhor.rmi)}</p>}
          </div>

          {/* Resumo CNIS */}
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Resumo do CNIS</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                ['Idade', `${analise.resumo.idade} anos`],
                ['Tempo total', analise.resumo.tempoTotalStr],
                ['Até 13/11/2019', analise.resumo.tempoReformaStr],
                ['Carência', `${analise.resumo.carencia} contrib.`],
                ['Tempo comum', analise.resumo.comumStr],
                ['Tempo especial', analise.resumo.especialStr],
                ['Tempo rural', analise.resumo.ruralStr],
                ['Média salários', brl(analise.resumo.media)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[var(--bg-hover)] p-3">
                  <p className="text-[10px] text-[var(--text-muted)]">{k}</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{v}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Cenários */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Comparativo entre regras</h3>
            <div className="space-y-3">
              {analise.cenarios.map((c, i) => {
                const best = analise.melhor === c
                return (
                  <Card key={i} className={`p-4 ${best ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{c.regra} {best && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 ml-1">RECOMENDADA</span>}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.obs}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${c.elegivelAgora ? 'bg-emerald-500/20 text-emerald-400' : c.dataProvavel ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-400'}`}>
                        {c.elegivelAgora ? '✅ Já pode' : c.dataProvavel ? fmtData(c.dataProvavel.toISOString().slice(0, 10)) : 'Não alcançável'}
                      </span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {c.requisitos.map((req, j) => (
                        <div key={j} className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">{req.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[var(--text-muted)]">exig. {req.exigido}</span>
                            <span className={req.ok ? 'text-emerald-400' : 'text-red-400'}>{req.atual} {req.ok ? '✔' : '✗'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
                      <span>RMI estimada: <b className="text-[var(--text-secondary)]">{c.rmi ? brl(c.rmi) : '—'}</b></span>
                      {c.vantagens?.length > 0 && <span>✔ {c.vantagens[0]}</span>}
                      {c.desvantagens?.length > 0 && <span>✖ {c.desvantagens[0]}</span>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Alertas */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">⚠️ Pendências e alertas</h3>
            {analise.alertas.length === 0 ? (
              <p className="text-xs text-emerald-400">Nenhuma pendência detectada nos vínculos informados.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] list-disc list-inside">
                {analise.alertas.map((a, i) => <li key={i}>{a.texto}</li>)}
              </ul>
            )}
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={printReport}>🖨️ Gerar Relatório (PDF)</Button>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-[11px] text-amber-300/90 leading-relaxed">⚠️ {analise.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
