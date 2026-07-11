import { useState, useMemo, useEffect } from 'react'
import { CALCULADORAS, RAMOS, getCalc, DISCLAIMER, brl, paramsInfo, parametrosDesatualizados } from '../../lib/legalCalc'
import { Button, Card, Input, Spinner } from '../../components/ui'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import PrevidenciarioPlanner from './PrevidenciarioPlanner'
import ParametrosModal from './ParametrosModal'
import { registrar } from '../../lib/auditLog'

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v)  => localStorage.setItem(k, JSON.stringify(v))
const uid   = () => Math.random().toString(36).slice(2, 10)
const ramoOf = (r) => RAMOS.find(x => x.value === r)

// ── Dynamic field renderer ─────────────────────────────────────────────────
function Field({ field, value, onChange }) {
  const base = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{field.label}</span>
        <select className={base} value={value ?? field.default ?? ''} onChange={e => onChange(e.target.value)}>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {field.help && <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{field.help}</span>}
      </label>
    )
  }

  if (field.type === 'periodos') {
    const rows = Array.isArray(value) ? value : [{ inicio: '', fim: '' }]
    const upd = (i, k, v) => { const r = rows.map((x, j) => j === i ? { ...x, [k]: v } : x); onChange(r) }
    return (
      <div>
        <span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{field.label}</span>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" className={base} value={r.inicio || ''} onChange={e => upd(i, 'inicio', e.target.value)} />
              <span className="text-[var(--text-muted)] text-xs">a</span>
              <input type="date" className={base} value={r.fim || ''} onChange={e => upd(i, 'fim', e.target.value)} />
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => onChange([...rows, { inicio: '', fim: '' }])} className="text-xs text-brand-500 mt-2 hover:underline">+ Adicionar período</button>
      </div>
    )
  }

  if (field.type === 'valores') {
    const rows = Array.isArray(value) ? value : [{ desc: '', valor: '' }]
    const upd = (i, k, v) => { const r = rows.map((x, j) => j === i ? { ...x, [k]: v } : x); onChange(r) }
    return (
      <div>
        <span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{field.label}</span>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={base} placeholder="Descrição" value={r.desc || ''} onChange={e => upd(i, 'desc', e.target.value)} />
              <input className={base + ' max-w-[130px]'} placeholder="R$ 0,00" value={r.valor || ''} onChange={e => upd(i, 'valor', e.target.value)} />
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => onChange([...rows, { desc: '', valor: '' }])} className="text-xs text-brand-500 mt-2 hover:underline">+ Adicionar item</button>
      </div>
    )
  }

  const inputType = field.type === 'date' ? 'date' : (field.type === 'number' || field.type === 'currency' || field.type === 'percent') ? 'text' : 'text'
  const prefix = field.type === 'currency' ? 'R$' : null
  const suffix = field.type === 'percent' ? '%' : null

  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{field.label}{field.required && ' *'}</span>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-xs text-[var(--text-muted)]">{prefix}</span>}
        <input
          type={inputType}
          inputMode={field.type === 'currency' || field.type === 'percent' || field.type === 'number' ? 'decimal' : undefined}
          className={`${base} ${prefix ? 'pl-9' : ''} ${suffix ? 'pr-8' : ''}`}
          value={value ?? field.default ?? ''}
          placeholder={field.type === 'currency' ? '0,00' : ''}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="absolute right-3 text-xs text-[var(--text-muted)]">{suffix}</span>}
      </div>
      {field.help && <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{field.help}</span>}
    </label>
  )
}

// ── Result panel ────────────────────────────────────────────────────────────
function ResultPanel({ calc, inputs, result, onSave }) {
  const { showToast } = useUiStore()

  const printPDF = () => {
    const win = window.open('', '_blank')
    const linhas = result.linhas.map(l => `<tr><td>${l.label}</td><td style="text-align:right">${l.value}</td></tr>`).join('')
    const mem = result.memoria.map(m => `<li>${m}</li>`).join('')
    const crit = result.criterios.map(c => `<li>${c}</li>`).join('')
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${calc.titulo}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#111;padding:30px;max-width:800px;margin:auto}
h1{font-size:15pt;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:12pt;margin-top:22px;color:#444}
table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:6px 4px;border-bottom:1px solid #ddd}
.total{font-size:14pt;font-weight:bold;background:#f4f4f4;padding:12px;border-radius:6px;margin-top:12px;display:flex;justify-content:space-between}
ul{padding-left:18px;line-height:1.7}.disc{margin-top:24px;font-size:9pt;color:#777;border-top:1px solid #ddd;padding-top:10px}
@media print{body{padding:0}}</style></head><body>
<h1>${calc.titulo}</h1><p style="color:#666">${ramoOf(calc.ramo)?.label} — ${new Date().toLocaleDateString('pt-BR')}</p>
<div class="total"><span>${result.headline.label}</span><span>${result.headline.value}</span></div>
<h2>Composição</h2><table>${linhas}</table>
<h2>Memória de cálculo</h2><ul>${mem}</ul>
${crit ? `<h2>Critérios utilizados</h2><ul>${crit}</ul>` : ''}
<h2>Base legal / observações</h2><p>${calc.baseLegal || '—'}</p>
<div class="disc">${DISCLAIMER}</div>
<script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
  }

  const exportCSV = () => {
    const rows = [['Item', 'Valor'], ...result.linhas.map(l => [l.label, l.value]), ['', ''], [result.headline.label, result.headline.value]]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${calc.id}-${Date.now()}.csv`
    a.click()
    showToast('CSV exportado.', 'success')
  }

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="rounded-xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-violet-600/5 p-5">
        <p className="text-xs text-[var(--text-muted)] mb-1">{result.headline.label}</p>
        <p className="text-3xl font-bold text-[var(--text-primary)]">{result.headline.value}</p>
      </div>

      {/* Breakdown */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Composição</h4>
        <div className="space-y-1.5">
          {result.linhas.map((l, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b border-[var(--border)] last:border-0">
              <span className="text-[var(--text-secondary)]">{l.label}</span>
              <span className="font-medium text-[var(--text-primary)] font-mono">{l.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Memória de cálculo */}
      <Card className="p-4">
        <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">📐 Memória de cálculo</h4>
        <ol className="space-y-1.5 text-xs text-[var(--text-secondary)] font-mono list-decimal list-inside">
          {result.memoria.map((m, i) => <li key={i} className="leading-relaxed">{m}</li>)}
        </ol>
      </Card>

      {/* Critérios */}
      {result.criterios?.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Critérios utilizados</h4>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
            {result.criterios.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Card>
      )}

      {/* Base legal */}
      {calc.baseLegal && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">⚖️ Base legal</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{calc.baseLegal}</p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={printPDF}>🖨️ Exportar PDF</Button>
        <Button variant="secondary" size="sm" onClick={exportCSV}>📊 Exportar Excel/CSV</Button>
        <Button variant="secondary" size="sm" onClick={onSave}>💾 Salvar no histórico</Button>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <p className="text-[11px] text-amber-300/90 leading-relaxed">⚠️ {DISCLAIMER}</p>
      </div>
    </div>
  )
}

// ── Calculation runner (form + result) ──────────────────────────────────────
function CalcRunner({ calc, onBack }) {
  const { showToast } = useUiStore()
  const initial = useMemo(() => {
    const o = {}
    calc.campos.forEach(f => { if (f.default !== undefined) o[f.name] = f.default })
    return o
  }, [calc])
  const [inputs, setInputs] = useState(initial)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const set = (name) => (v) => setInputs(d => ({ ...d, [name]: v }))

  const run = () => {
    const missing = calc.campos.filter(f => f.required && !inputs[f.name])
    if (missing.length) { setError(`Preencha: ${missing.map(m => m.label).join(', ')}`); return }
    setError('')
    try { setResult(calc.compute(inputs)) }
    catch (e) { setError('Erro no cálculo: ' + e.message) }
  }

  const saveHistory = () => {
    if (!result) return
    const hist = lsGet('pj_calc_history', [])
    hist.unshift({ id: uid(), calcId: calc.id, titulo: calc.titulo, ramo: calc.ramo, headline: result.headline, inputs, createdAt: new Date().toISOString() })
    lsSet('pj_calc_history', hist.slice(0, 100))
    registrar('calculo', `salvou o cálculo "${calc.titulo}"${result.headline ? ` — ${result.headline}` : ''}`)
    showToast('Cálculo salvo no histórico.', 'success')
  }

  const rc = ramoOf(calc.ramo)

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <button onClick={onBack} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mb-4">← Voltar às calculadoras</button>

      <div className="flex items-start gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${rc?.color}22` }}>{rc?.icon}</div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{calc.titulo}</h1>
          <p className="text-sm text-[var(--text-muted)]">{calc.descricao}</p>
          {calc.casos && <p className="text-xs text-[var(--text-muted)] mt-1"><span className="font-medium">Usado em:</span> {calc.casos}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div>
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Dados do cálculo</h3>
            {calc.campos.map(f => (
              <Field key={f.name} field={f} value={inputs[f.name]} onChange={set(f.name)} />
            ))}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button variant="primary" className="w-full" onClick={run}>Calcular</Button>
          </Card>
        </div>

        {/* Result */}
        <div>
          {result
            ? <ResultPanel calc={calc} inputs={inputs} result={result} onSave={saveHistory} />
            : <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)] h-full flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">🧮</span>
                Preencha os dados e clique em <span className="font-medium text-[var(--text-secondary)]">Calcular</span> para ver o resultado e a memória de cálculo.
              </div>}
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function CalculatorPage() {
  const [view, setView] = useState('list')     // list | calc | previdenciario | history
  const [activeCalc, setActiveCalc] = useState(null)
  const [q, setQ] = useState('')
  const [ramo, setRamo] = useState('')
  const [history, setHistory] = useState(() => lsGet('pj_calc_history', []))
  const [params, setParams] = useState(false)
  const [pInfo, setPInfo] = useState(() => paramsInfo())
  const isAdmin = useAuthStore(s => s.user?.role) === 'master'
  const desatualizado = isAdmin && parametrosDesatualizados()   // aviso só p/ administradora

  useEffect(() => { if (view === 'history') setHistory(lsGet('pj_calc_history', [])) }, [view])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return CALCULADORAS.filter(c =>
      (!ramo || c.ramo === ramo) &&
      (!term || c.titulo.toLowerCase().includes(term) || c.descricao.toLowerCase().includes(term) || (c.casos || '').toLowerCase().includes(term))
    )
  }, [q, ramo])

  if (view === 'calc' && activeCalc) return <div className="h-full overflow-y-auto"><CalcRunner calc={activeCalc} onBack={() => setView('list')} /></div>
  if (view === 'previdenciario') return <div className="h-full overflow-y-auto"><PrevidenciarioPlanner onBack={() => setView('list')} /></div>

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Calculadora Jurídica</h1>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setParams(true)}>⚙️ Parâmetros</Button>
            <Button variant={view === 'history' ? 'primary' : 'secondary'} size="sm" onClick={() => setView(view === 'history' ? 'list' : 'history')}>
              🕑 Histórico {history.length > 0 && `(${history.length})`}
            </Button>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4">Cálculos jurídicos por ramo do Direito, com memória de cálculo e exportação.</p>

        {desatualizado && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-5 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-300">📅 Os parâmetros previdenciários (tábua IBGE / INPC) são de <b>{pInfo.ano}</b>. Verifique se saíram valores novos e atualize.</p>
            <button onClick={() => setParams(true)} className="text-xs text-amber-300 hover:underline whitespace-nowrap flex-shrink-0">Atualizar agora</button>
          </div>
        )}
        {params && <ParametrosModal onClose={() => setParams(false)} onSaved={() => setPInfo(paramsInfo())} />}

        {view === 'history' ? (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-16 text-sm text-[var(--text-muted)]">Nenhum cálculo salvo ainda.</div>
            ) : history.map(h => (
              <Card key={h.id} className="p-4 flex items-center justify-between hover:border-brand-500/40 cursor-pointer"
                onClick={() => { const c = getCalc(h.calcId); if (c) { setActiveCalc(c); setView('calc') } }}>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{h.titulo}</p>
                  <p className="text-xs text-[var(--text-muted)]">{ramoOf(h.ramo)?.label} · {new Date(h.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <p className="text-sm font-bold text-brand-400 font-mono">{h.headline?.value}</p>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Highlight: Planejamento Previdenciário */}
            <Card className="p-5 mb-6 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => setView('previdenciario')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl flex-shrink-0">👵</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">Planejamento Previdenciário Automático</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Cadastre os vínculos do CNIS e o sistema analisa todas as regras de aposentadoria, a melhor data e a estimativa de RMI.</p>
                </div>
                <Button variant="primary" size="sm" className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-500">Abrir →</Button>
              </div>
            </Card>

            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 relative">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cálculo (ex.: rescisão, correção, pensão...)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
                <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">🔍</span>
              </div>
            </div>

            {/* Ramo chips */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              <button onClick={() => setRamo('')} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!ramo ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>Todos</button>
              {RAMOS.map(r => (
                <button key={r.value} onClick={() => setRamo(ramo === r.value ? '' : r.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${ramo === r.value ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                  style={ramo === r.value ? { background: r.color } : {}}>
                  {r.icon} {r.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-[var(--text-muted)]">Nenhum cálculo encontrado.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(c => {
                  const rc = ramoOf(c.ramo)
                  return (
                    <Card key={c.id} className="p-4 cursor-pointer hover:border-brand-500/40 transition-all group flex flex-col"
                      onClick={() => { setActiveCalc(c); setView('calc') }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${rc?.color}22` }}>{rc?.icon}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${rc?.color}18`, color: rc?.color }}>{rc?.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-brand-400 transition-colors">{c.titulo}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 flex-1">{c.descricao}</p>
                      <p className="text-xs text-brand-500 mt-3 font-medium">Iniciar cálculo →</p>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
