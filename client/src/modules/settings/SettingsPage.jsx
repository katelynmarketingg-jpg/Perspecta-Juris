import { useState, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import api from '../../lib/api'
import { getOffice, setOffice, tkey } from '../../lib/tenant'
import { pushOffice, saveConfigKey } from '../../lib/tenantData'
import { getPeticoes } from '../../lib/peticoesModels'
import {
  Button, Card, Input,
  IconTrash, IconEdit, IconCheck, IconX, IconBriefcase, IconTag, IconDollar, IconExternalLink, IconUsers, IconGrid, IconPlus,
} from '../../components/ui'
import IntegrationTab from './IntegrationTab'

// ── helpers ──────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)

function lsGet(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
]

const DEFAULT_FEE_TYPES = [
  { id: 'ft_fixo',       name: 'Honorário Fixo',       desc: 'Valor fixo pelo serviço' },
  { id: 'ft_exito',      name: 'Honorário de Êxito',   desc: 'Percentual sobre o resultado obtido' },
  { id: 'ft_misto',      name: 'Honorário Misto',       desc: 'Parte fixa + parte de êxito' },
  { id: 'ft_percentual', name: 'Percentual da Causa',   desc: 'Percentual sobre o valor da causa' },
  { id: 'ft_hora',       name: 'Por Hora Trabalhada',   desc: 'Cobrança por hora (R$/h)' },
  { id: 'ft_mensal',     name: 'Retainer Mensal',       desc: 'Mensalidade fixa de assessoria' },
]

// ── ColorPicker ───────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-offset-1 ring-offset-[var(--bg-card)] ring-white scale-110' : ''}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={value || '#6366f1'}
        onChange={e => onChange(e.target.value)}
        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
        title="Cor personalizada"
      />
    </div>
  )
}

// ── AreasTab ──────────────────────────────────────────────────────
function AreasTab() {
  const { showToast } = useUiStore()
  const [areas, setAreas] = useState(() => lsGet(tkey('pj_local_areas'), []))
  const [editing, setEditing] = useState(null) // null | { id?, name, color }
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] })

  function save() {
    if (!form.name.trim()) return
    let next
    if (editing?.id) {
      next = areas.map(a => a.id === editing.id ? { ...a, ...form } : a)
      showToast('Área atualizada.', 'success')
    } else {
      next = [...areas, { id: uid(), ...form }]
      showToast('Área criada.', 'success')
    }
    setAreas(next)
    saveConfigKey('pj_local_areas', next)
    setEditing(null)
    setForm({ name: '', color: PRESET_COLORS[0] })
  }

  function remove(id) {
    const next = areas.filter(a => a.id !== id)
    setAreas(next)
    saveConfigKey('pj_local_areas', next)
    showToast('Área removida.', 'success')
  }

  function startEdit(area) {
    setEditing(area)
    setForm({ name: area.name, color: area.color || PRESET_COLORS[0] })
  }

  function cancel() {
    setEditing(null)
    setForm({ name: '', color: PRESET_COLORS[0] })
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <Card className="p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {editing?.id ? 'Editar área' : 'Nova área jurídica'}
        </p>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <Input
              label="Nome da área"
              placeholder="Ex: Cível, Trabalhista..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Cor</p>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={!form.name.trim()}>
            <IconCheck size={13} /> {editing?.id ? 'Salvar' : 'Adicionar'}
          </Button>
          {editing && (
            <Button variant="secondary" size="sm" onClick={cancel}>
              <IconX size={13} /> Cancelar
            </Button>
          )}
        </div>
      </Card>

      {/* List */}
      {areas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
          Nenhuma área cadastrada. Adicione acima ou use as áreas padrão do sistema.
        </Card>
      ) : (
        <div className="space-y-2">
          {areas.map(area => (
            <Card key={area.id} className="px-4 py-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: area.color || '#6366f1' }} />
              <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{area.name}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(area)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <IconEdit size={13} />
                </button>
                <button
                  onClick={() => remove(area.id)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Preencher formulário do serviço (fill + print) ────────────────
function FillFormModal({ service, onClose }) {
  const [vals, setVals] = useState({})
  const doPrint = () => {
    const rows = (service.formFields ?? []).map(f => `<div style="margin-bottom:14px"><div style="font-size:10pt;color:#555">${f.label}</div><div style="border-bottom:1px solid #000;min-height:22px;font-size:12pt">${(vals[f.id] ?? '').replace(/</g,'&lt;')}</div></div>`).join('')
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${service.name}</title>
<style>body{font-family:Arial,sans-serif;padding:30mm 25mm;max-width:210mm;margin:auto;color:#111}h1{font-size:15pt;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}@media print{body{padding:0}}</style></head>
<body><h1>${service.name}</h1>${rows}<script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Preencher — {service.name}</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {(service.formFields ?? []).length === 0
            ? <p className="text-sm text-[var(--text-muted)] text-center py-4">Este serviço não tem formulário configurado.</p>
            : service.formFields.map(f => (
              <div key={f.id}>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{f.label}</label>
                {f.type === 'textarea'
                  ? <textarea rows={3} value={vals[f.id] ?? ''} onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
                  : <input type={f.type === 'data' ? 'date' : f.type === 'numero' ? 'number' : 'text'} value={vals[f.id] ?? ''} onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />}
              </div>
            ))}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
          <Button variant="primary" size="sm" onClick={doPrint}>🖨️ Imprimir preenchido</Button>
        </div>
      </div>
    </div>
  )
}

// ── ServicesTab ───────────────────────────────────────────────────
const EMPTY_SVC = { name: '', areaId: '', contractType: 'fixed', defaultFee: '', percentage: '' }

// Lista inicial de serviços/honorários (o "o que é" já preenchido — você define os valores).
const mkSvc = (name, contractType) => ({ id: uid(), name, areaId: '', contractType, defaultFee: '', percentage: '', documentos: [], formFields: [] })
const DEFAULT_SERVICES = [
  mkSvc('Reclamação Trabalhista', 'success'),
  mkSvc('Acordo / Rescisão Trabalhista', 'fixed'),
  mkSvc('Aposentadoria (INSS)', 'success'),
  mkSvc('Auxílio-Doença / BPC-LOAS', 'success'),
  mkSvc('Revisão de Benefício', 'success'),
  mkSvc('Ação de Indenização', 'mixed'),
  mkSvc('Ação de Cobrança / Execução', 'success'),
  mkSvc('Inventário e Partilha', 'success'),
  mkSvc('Divórcio Consensual', 'fixed'),
  mkSvc('Pensão Alimentícia', 'fixed'),
  mkSvc('Guarda / Regulamentação de Visitas', 'fixed'),
  mkSvc('Ação contra Banco / Negativação Indevida', 'success'),
  mkSvc('Usucapião', 'fixed'),
  mkSvc('Assessoria Jurídica Mensal', 'monthly'),
  mkSvc('Defesa Criminal', 'fixed'),
  mkSvc('Consulta Jurídica', 'hourly'),
]
// Espelha os serviços em "tipos de honorário" — assim o processo continua buscando o valor.
const espelharHonorarios = (services) => saveConfigKey('pj_local_fee_types', services.map(s => ({
  id: s.id, name: s.name, contractType: s.contractType ?? 'fixed',
  amount: s.defaultFee === '' ? null : s.defaultFee, percentage: s.percentage === '' ? null : s.percentage, desc: '',
})))

function ServicesTab() {
  const { showToast } = useUiStore()
  const [areas]    = useState(() => lsGet(tkey('pj_local_areas'), []))
  const [services, setServices] = useState(() => {
    // Reset único: começa do zero (remove qualquer lista pré-preenchida anterior)
    return lsGet(tkey('pj_local_services'), [])
  })
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY_SVC)
  const [configuring, setConfiguring] = useState(null)  // service id
  const [filling, setFilling]   = useState(null)        // service object
  const modelos = getPeticoes()

  const persist = (next) => { setServices(next); saveConfigKey('pj_local_services', next); espelharHonorarios(next) }
  const updateSvc = (id, patch) => persist(services.map(s => s.id === id ? { ...s, ...patch } : s))

  function save() {
    if (!form.name.trim()) return
    let next
    if (editing?.id) { next = services.map(s => s.id === editing.id ? { ...s, ...form } : s); showToast('Serviço atualizado.', 'success') }
    else { next = [...services, { id: uid(), ...form, documentos: [], formFields: [] }]; showToast('Serviço criado.', 'success') }
    persist(next); setEditing(null); setForm(EMPTY_SVC)
  }
  function remove(id) { persist(services.filter(s => s.id !== id)); showToast('Serviço removido.', 'success') }
  function startEdit(svc) { setEditing(svc); setForm({ name: svc.name, areaId: svc.areaId || '', contractType: svc.contractType ?? 'fixed', defaultFee: svc.defaultFee ?? '', percentage: svc.percentage ?? '' }) }

  // Documentos vinculados
  const addDoc = (svc, modeloId) => {
    const mod = modelos.find(m => m.id === modeloId); if (!mod) return
    if ((svc.documentos ?? []).some(d => d.id === modeloId)) return
    updateSvc(svc.id, { documentos: [...(svc.documentos ?? []), { id: mod.id, name: mod.titulo }] })
  }
  const removeDoc = (svc, docId) => updateSvc(svc.id, { documentos: (svc.documentos ?? []).filter(d => d.id !== docId) })
  // Campos do formulário
  const addField = (svc) => updateSvc(svc.id, { formFields: [...(svc.formFields ?? []), { id: uid(), label: 'Novo campo', type: 'texto' }] })
  const updField = (svc, fid, patch) => updateSvc(svc.id, { formFields: (svc.formFields ?? []).map(f => f.id === fid ? { ...f, ...patch } : f) })
  const delField = (svc, fid) => updateSvc(svc.id, { formFields: (svc.formFields ?? []).filter(f => f.id !== fid) })

  const areaName = id => areas.find(a => a.id === id)?.name ?? '—'
  const areaColor = id => areas.find(a => a.id === id)?.color ?? '#64748b'
  const fmt = v => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 p-3">
        <p className="text-xs text-[var(--text-secondary)]">Aqui ficam seus <b>serviços e os honorários</b> de cada um. Cadastre cada serviço com a <b>forma de pagamento e o valor / % de êxito</b>. Ao criar um processo, esses honorários são <b>buscados automaticamente</b> (e podem ser ajustados no processo).</p>
      </div>
      <Card className="p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{editing?.id ? 'Editar serviço' : 'Novo serviço'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nome do serviço" placeholder="Ex: Ação Trabalhista, Inventário..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Área jurídica</p>
            <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              <option value="">Sem área</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        {/* Honorários do serviço */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Forma de pagamento</p>
            <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              {FEE_CONTRACTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {['fixed', 'mixed', 'monthly', 'hourly'].includes(form.contractType) &&
            <Input label={form.contractType === 'monthly' ? 'Valor mensal (R$)' : form.contractType === 'hourly' ? 'Valor por hora (R$)' : 'Valor dos honorários (R$)'} placeholder="0,00" prefix="R$" value={form.defaultFee} onChange={e => setForm(f => ({ ...f, defaultFee: e.target.value }))} />}
          {['success', 'mixed'].includes(form.contractType) &&
            <Input label="% de êxito" placeholder="20" suffix="%" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} />}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={!form.name.trim()}><IconCheck size={13} /> {editing?.id ? 'Salvar' : 'Adicionar'}</Button>
          {editing && <Button variant="secondary" size="sm" onClick={() => { setEditing(null); setForm(EMPTY_SVC) }}><IconX size={13} /> Cancelar</Button>}
        </div>
      </Card>

      {services.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--text-muted)]">Nenhum serviço cadastrado ainda.</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {services.map(svc => (
            <Card key={svc.id} className="p-4">
              <div className="flex items-center gap-3">
                {svc.areaId && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: areaColor(svc.areaId) }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{svc.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {svc.areaId ? areaName(svc.areaId) : 'Sem área'}
                    {' · '}{FEE_CONTRACTS.find(c => c.value === (svc.contractType ?? 'fixed'))?.label ?? 'Fixo'}
                    {svc.defaultFee ? ` · ${fmt(svc.defaultFee)}` : ''}
                    {svc.percentage ? ` · ${svc.percentage}% êxito` : ''}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(svc)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"><IconEdit size={13} /></button>
                  <button onClick={() => remove(svc.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/30 transition-colors"><IconTrash size={13} /></button>
                </div>
              </div>

              {/* Resumo de docs/form + ações */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">📄 {(svc.documentos ?? []).length} doc(s)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">📝 {(svc.formFields ?? []).length} campo(s)</span>
                <button onClick={() => setConfiguring(configuring === svc.id ? null : svc.id)} className="text-[11px] text-brand-500 hover:underline ml-auto">{configuring === svc.id ? 'Fechar' : '⚙ Configurar'}</button>
                {(svc.formFields ?? []).length > 0 && <button onClick={() => setFilling(svc)} className="text-[11px] text-emerald-400 hover:underline">📝 Preencher</button>}
              </div>

              {/* Painel de configuração */}
              {configuring === svc.id && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-4">
                  {/* Documentos */}
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Documentos utilizados</p>
                    <div className="space-y-1 mb-2">
                      {(svc.documentos ?? []).map(d => (
                        <div key={d.id} className="flex items-center justify-between text-xs bg-[var(--bg-hover)] rounded-lg px-2.5 py-1.5">
                          <span className="text-[var(--text-secondary)]">📄 {d.name}</span>
                          <button onClick={() => removeDoc(svc, d.id)} className="text-[var(--text-muted)] hover:text-red-400">✕</button>
                        </div>
                      ))}
                    </div>
                    <select value="" onChange={e => { if (e.target.value) addDoc(svc, e.target.value) }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)] focus:border-brand-500 focus:outline-none">
                      <option value="">+ Vincular documento (dos Modelos)…</option>
                      {modelos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                    </select>
                  </div>

                  {/* Formulário */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Formulário (preencher e imprimir)</p>
                      <button onClick={() => addField(svc)} className="text-[11px] text-brand-500 hover:underline">+ Campo</button>
                    </div>
                    <div className="space-y-1.5">
                      {(svc.formFields ?? []).map(f => (
                        <div key={f.id} className="flex items-center gap-2">
                          <input value={f.label} onChange={e => updField(svc, f.id, { label: e.target.value })} placeholder="Rótulo do campo"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
                          <select value={f.type} onChange={e => updField(svc, f.id, { type: e.target.value })}
                            className="px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-secondary)] focus:border-brand-500 focus:outline-none">
                            <option value="texto">Texto</option>
                            <option value="textarea">Parágrafo</option>
                            <option value="data">Data</option>
                            <option value="numero">Número</option>
                          </select>
                          <button onClick={() => delField(svc, f.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                        </div>
                      ))}
                      {(svc.formFields ?? []).length === 0 && <p className="text-[11px] text-[var(--text-muted)]">Sem campos. Adicione para criar um formulário imprimível.</p>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {filling && <FillFormModal service={filling} onClose={() => setFilling(null)} />}
    </div>
  )
}

// ── FeeTypesTab ───────────────────────────────────────────────────
const FEE_CONTRACTS = [
  { value: 'fixed',    label: 'Fixo' },
  { value: 'success',  label: 'Êxito (%)' },
  { value: 'mixed',    label: 'Fixo + Êxito' },
  { value: 'monthly',  label: 'Mensalidade' },
  { value: 'hourly',   label: 'Por hora' },
]
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const EMPTY_FEE = { name: '', contractType: 'fixed', amount: '', percentage: '', desc: '' }

function FeeTypesTab() {
  const { showToast } = useUiStore()
  const [types, setTypes] = useState(() => lsGet(tkey('pj_local_fee_types'), DEFAULT_FEE_TYPES))
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(EMPTY_FEE)
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  function save() {
    if (!form.name.trim()) return
    const clean = { ...form, amount: form.amount === '' ? null : Number(String(form.amount).replace(',', '.')), percentage: form.percentage === '' ? null : Number(String(form.percentage).replace(',', '.')) }
    let next
    if (editing?.id) { next = types.map(t => t.id === editing.id ? { ...t, ...clean } : t); showToast('Tipo atualizado.', 'success') }
    else { next = [...types, { id: uid(), ...clean }]; showToast('Tipo criado.', 'success') }
    setTypes(next); saveConfigKey('pj_local_fee_types', next); setEditing(null); setForm(EMPTY_FEE)
  }
  function remove(id) { const next = types.filter(t => t.id !== id); setTypes(next); saveConfigKey('pj_local_fee_types', next); showToast('Tipo removido.', 'success') }
  function startEdit(t) { setEditing(t); setForm({ name: t.name, contractType: t.contractType ?? 'fixed', amount: t.amount ?? '', percentage: t.percentage ?? '', desc: t.desc || '' }) }

  const contractLabel = (v) => FEE_CONTRACTS.find(c => c.value === v)?.label ?? '—'

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 p-3">
        <p className="text-xs text-[var(--text-secondary)]">Cadastre seus honorários com valores padrão. Ao criar um processo, esses valores são <b>buscados automaticamente</b> — e podem ser ajustados no processo.</p>
      </div>

      <Card className="p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {editing?.id ? 'Editar honorário' : 'Novo honorário'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input label="Nome" placeholder="Ex: Ação trabalhista" value={form.name} onChange={setF('name')} />
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Tipo de contrato</label>
            <select value={form.contractType} onChange={setF('contractType')} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              {FEE_CONTRACTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {['fixed', 'mixed', 'monthly', 'hourly'].includes(form.contractType) &&
            <Input label="Valor padrão (R$)" value={form.amount} onChange={setF('amount')} placeholder="0,00" prefix="R$" />}
          {['success', 'mixed'].includes(form.contractType) &&
            <Input label="% de êxito" value={form.percentage} onChange={setF('percentage')} placeholder="20" suffix="%" />}
          <Input label="Descrição" placeholder="Opcional" value={form.desc} onChange={setF('desc')} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={!form.name.trim()}>
            <IconCheck size={13} /> {editing?.id ? 'Salvar' : 'Adicionar'}
          </Button>
          {editing && <Button variant="secondary" size="sm" onClick={() => { setEditing(null); setForm(EMPTY_FEE) }}><IconX size={13} /> Cancelar</Button>}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {types.map(t => (
          <Card key={t.id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-900/40 flex items-center justify-center flex-shrink-0">
              <IconDollar size={13} className="text-accent-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {contractLabel(t.contractType)}
                {t.amount != null && t.amount !== '' && ` · ${brl(t.amount)}`}
                {t.percentage != null && t.percentage !== '' && ` · ${t.percentage}%`}
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"><IconEdit size={13} /></button>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/30 transition-colors"><IconTrash size={13} /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── OfficeTab ─────────────────────────────────────────────────────
function OfficeTab() {
  const { showToast } = useUiStore()
  const [data, setData] = useState(() => {
    const o = getOffice()
    return Object.keys(o).length ? o : {
      name: '', cnpj: '', oab: '', email: '', phone: '',
      addressStreet: '', addressCity: '', addressState: '', pixKey: '', cardLink: '',
      logoDataUrl: '', timbradoDataUrl: '', usarTimbrado: true,
    }
  })
  const set = field => e => setData(d => ({ ...d, [field]: e.target.value }))

  const uploadImg = (field) => (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 3_000_000) { showToast('Imagem muito grande (máx. 3MB).', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => { setData(d => ({ ...d, [field]: reader.result })); showToast('Imagem carregada — clique em Salvar.', 'success') }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function save() {
    setOffice(data)       // cache local (por escritório)
    pushOffice(data)      // grava no banco (sincroniza entre computadores)
    showToast('Dados salvos.', 'success')
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Nome do escritório" value={data.name} onChange={set('name')} placeholder="Advocacia Perspecta..." />
          </div>
          <Input label="CNPJ" value={data.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" />
          <Input label="OAB" value={data.oab} onChange={set('oab')} placeholder="OAB/SP 123.456" />
          <Input label="E-mail" type="email" value={data.email} onChange={set('email')} />
          <Input label="Telefone" value={data.phone} onChange={set('phone')} placeholder="(00) 00000-0000" />
          <div className="sm:col-span-2">
            <Input label="Endereço" value={data.addressStreet} onChange={set('addressStreet')} placeholder="Rua, Avenida..." />
          </div>
          <Input label="Cidade" value={data.addressCity} onChange={set('addressCity')} />
          <Input label="Estado" value={data.addressState} onChange={set('addressState')} placeholder="SP" />
        </div>
      </Card>

      {/* Identidade visual dos documentos */}
      <Card className="p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Identidade dos documentos (logo e papel timbrado)</h3>
        <p className="text-[11px] text-[var(--text-muted)] mb-3">Aplicado automaticamente em <b>todos os documentos gerados</b> (petições, contratos, modelos).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Logo */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Logo do escritório</p>
            {data.logoDataUrl
              ? <div className="flex items-center gap-3"><img src={data.logoDataUrl} alt="logo" className="h-14 max-w-[120px] object-contain bg-white rounded-lg p-1 border border-[var(--border)]" /><button onClick={() => setData(d => ({ ...d, logoDataUrl: '' }))} className="text-xs text-red-400 hover:underline">Remover</button></div>
              : <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] cursor-pointer hover:border-brand-500"><IconPlus size={13} /> Enviar logo (PNG/JPG)<input type="file" accept="image/*" className="hidden" onChange={uploadImg('logoDataUrl')} /></label>}
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Aparece no cabeçalho, junto do nome e dados do escritório.</p>
          </div>
          {/* Papel timbrado (imagem A4 opcional) */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Papel timbrado (imagem A4 — opcional)</p>
            {data.timbradoDataUrl
              ? <div className="flex items-center gap-3"><img src={data.timbradoDataUrl} alt="timbrado" className="h-14 max-w-[100px] object-contain bg-white rounded-lg p-1 border border-[var(--border)]" /><button onClick={() => setData(d => ({ ...d, timbradoDataUrl: '' }))} className="text-xs text-red-400 hover:underline">Remover</button></div>
              : <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] cursor-pointer hover:border-brand-500"><IconPlus size={13} /> Enviar papel timbrado (imagem A4)<input type="file" accept="image/*" className="hidden" onChange={uploadImg('timbradoDataUrl')} /></label>}
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Se enviar, vira o <b>fundo</b> das páginas (substitui o cabeçalho de texto).</p>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={data.usarTimbrado !== false} onChange={e => setData(d => ({ ...d, usarTimbrado: e.target.checked }))} />
          Usar identidade (logo/timbrado) nos documentos
        </label>
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Cobrança (para enviar ao cliente)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Chave PIX de recebimento" value={data.pixKey} onChange={set('pixKey')} placeholder="CNPJ, e-mail, telefone ou aleatória" />
          <Input label="Link de pagamento por cartão (padrão)" value={data.cardLink} onChange={set('cardLink')} placeholder="https://... (ou gerado pelo Asaas)" />
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-2">Usados ao “Cobrar via WhatsApp” em Pagamentos. Com o Asaas integrado, links de cartão e boleto são gerados automaticamente.</p>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={save}><IconCheck size={14} /> Salvar dados</Button>
      </div>
    </div>
  )
}

// Abas que podem ser liberadas/bloqueadas por usuário (Dashboard é sempre visível).
const PERM_TABS = [
  { to: '/app/atendimento', label: 'Fila de Atendimento' }, { to: '/app/pesquisas', label: 'Pesquisas' },
  { to: '/app/clients', label: 'Clientes' }, { to: '/app/processes', label: 'Processos' },
  { to: '/app/movimentacoes', label: 'Movimentações' }, { to: '/app/deadlines', label: 'Prazos' },
  { to: '/app/tasks', label: 'Tarefas' }, { to: '/app/financial', label: 'Financeiro' },
  { to: '/app/documents', label: 'Documentos' }, { to: '/app/modelos', label: 'Modelos' },
  { to: '/app/calculator', label: 'Calculadora' }, { to: '/app/theses', label: 'Legislação' },
  { to: '/app/automations', label: 'Automações' }, { to: '/app/reports', label: 'Relatórios' },
  { to: '/app/registros', label: 'Registros' },
]
const ALL_TABS = PERM_TABS.map(t => t.to)

// ── UsersTab (cadastro de logins da empresa) ──────────────────────
function UsersTab() {
  const { showToast } = useUiStore()
  const [users, setUsers] = useState([])
  const [usage, setUsage] = useState(null)
  const [form, setForm] = useState({ name: '', loginName: '', email: '', password: '', role: 'lawyer', menuAccess: null })
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  const ROLES = [
    { value: 'admin',  label: 'Administrador' },
    { value: 'lawyer', label: 'Advogado(a)' },
    { value: 'staff',  label: 'Assistente / Estagiário' },
  ]
  const roleLabel = (r) => ROLES.find(x => x.value === r)?.label ?? r

  const load = () => {
    api.settings.users().then(r => setUsers(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => setUsers([])).finally(() => setLoading(false))
    api.settings.planUsage().then(setUsage).catch(() => setUsage(null))
  }
  useEffect(() => { load() }, [])

  const full = !editing && usage && usage.limit != null && (usage.remaining ?? 0) <= 0

  const reset = () => { setForm({ name: '', loginName: '', email: '', password: '', role: 'lawyer', menuAccess: null }); setEditing(null) }

  const save = async () => {
    if (!form.name.trim() || !form.loginName.trim()) { showToast('Preencha nome e login.', 'error'); return }
    if (!editing && !form.password.trim()) { showToast('Defina uma senha.', 'error'); return }
    const menuAccess = form.role === 'admin' ? null : (form.menuAccess ?? ALL_TABS)
    try {
      if (editing) {
        const payload = { ...form, menuAccess }; if (!payload.password) delete payload.password
        await api.settings.updateUser(editing, payload)
        showToast('Login atualizado.', 'success')
      } else {
        await api.settings.createUser({ ...form, menuAccess })
        showToast('Login criado.', 'success')
      }
      reset(); load()
    } catch (e) { showToast(e.message || 'Erro ao salvar.', 'error') }
  }

  const edit = (u) => { setEditing(u.id); setForm({ name: u.name, loginName: u.loginName, email: u.email ?? '', password: '', role: u.role ?? 'lawyer', menuAccess: u.menuAccess ?? null }) }
  const remove = async (id) => {
    const u = users.find(x => x.id === id)
    if (!window.confirm(`Excluir o acesso de "${u?.name ?? 'este login'}"? A pessoa perde o acesso imediatamente.`)) return
    try {
      await api.settings.deleteUser(id)
      showToast('Acesso excluído.', 'success')
    } catch (e) {
      showToast(e.message || 'Não foi possível excluir este acesso.', 'error')
    }
    load()
  }

  const set = (k) => (e) => setForm(d => ({ ...d, [k]: e.target.value }))

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-brand-500/8 border border-brand-500/20 p-3">
        <p className="text-xs text-[var(--text-secondary)]">Cadastre os logins da sua equipe. Cada pessoa acessa com <b>o nome da empresa</b>, o <b>login</b> e a <b>senha</b> definidos aqui.</p>
        {usage && (
          <p className="text-xs mt-2 font-medium">
            Plano <b className="text-accent-400">{usage.planName}</b>:{' '}
            {usage.limit == null
              ? <span className="text-emerald-400">acessos ilimitados ({usage.used} em uso)</span>
              : <span className={(usage.remaining ?? 0) <= 0 ? 'text-red-400' : 'text-[var(--text-secondary)]'}>
                  {usage.used} de {usage.limit} acessos usados · {(usage.remaining ?? 0) > 0 ? `restam ${usage.remaining}` : 'limite atingido'}
                </span>}
          </p>
        )}
      </div>

      {/* Form */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{editing ? 'Editar login' : 'Novo login'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nome completo *" value={form.name} onChange={set('name')} placeholder="Ex: Ana Souza" />
          <Input label="Login (usuário) *" value={form.loginName} onChange={set('loginName')} placeholder="Ex: ana" />
          <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Perfil</label>
            <select value={form.role} onChange={set('role')} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <Input label={editing ? 'Nova senha (deixe vazio p/ manter)' : 'Senha *'} type="text" value={form.password} onChange={set('password')} placeholder="••••" />
        </div>

        {form.role === 'admin' ? (
          <p className="text-[11px] text-[var(--text-muted)]">👑 Administradores têm acesso a <b>todas as abas</b> e às configurações.</p>
        ) : (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Abas que este login pode acessar</label>
              <div className="flex gap-2 text-[11px]">
                <button type="button" onClick={() => setForm(d => ({ ...d, menuAccess: [...ALL_TABS] }))} className="text-accent-400 hover:underline">Marcar todas</button>
                <button type="button" onClick={() => setForm(d => ({ ...d, menuAccess: [] }))} className="text-[var(--text-muted)] hover:underline">Nenhuma</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {PERM_TABS.map(t => {
                const on = (form.menuAccess ?? ALL_TABS).includes(t.to)
                return (
                  <label key={t.to} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={on} className="accent-brand-500"
                      onChange={() => {
                        const cur = form.menuAccess ?? ALL_TABS
                        const next = on ? cur.filter(x => x !== t.to) : [...cur, t.to]
                        setForm(d => ({ ...d, menuAccess: next }))
                      }} />
                    {t.label}
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">O Dashboard aparece sempre. Deixe como preferir — o colaborador só verá as abas marcadas.</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {full && <span className="text-[11px] text-red-400 mr-auto">Limite do plano atingido — faça upgrade para adicionar mais logins.</span>}
          {editing && <Button variant="secondary" size="sm" onClick={reset}>Cancelar</Button>}
          <Button variant="primary" size="sm" onClick={save} disabled={full}>{editing ? 'Salvar' : 'Adicionar login'}</Button>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          : users.length === 0 ? <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum login cadastrado.</p>
          : users.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center text-sm font-bold text-accent-400 flex-shrink-0">
                  {u.name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{u.name} <span className="text-xs text-[var(--text-muted)]">@{u.loginName}</span></p>
                  <p className="text-xs text-[var(--text-muted)]">{roleLabel(u.role)}{u.email ? ` · ${u.email}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => edit(u)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><IconEdit size={14} /></button>
                {u.role !== 'master' && <button onClick={() => remove(u.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"><IconTrash size={14} /></button>}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── AppearanceTab (tema + ordem/posição dos botões) ───────────────
const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard' }, { to: '/app/clients', label: 'Clientes' },
  { to: '/app/processes', label: 'Processos' }, { to: '/app/movimentacoes', label: 'Movimentações' },
  { to: '/app/deadlines', label: 'Prazos' }, { to: '/app/tasks', label: 'Tarefas' },
  { to: '/app/financial', label: 'Financeiro' }, { to: '/app/documents', label: 'Documentos' },
  { to: '/app/modelos', label: 'Modelos' }, { to: '/app/calculator', label: 'Calculadora' },
  { to: '/app/theses', label: 'Legislação' }, { to: '/app/automations', label: 'Automações' },
  { to: '/app/reports', label: 'Relatórios' },
]

function AppearanceTab() {
  const { showToast } = useUiStore()
  const { theme, setTheme } = useUiStore()
  const tenantId = lsGet('pj_auth', {})?.state?.tenant?.id ?? 'demo'
  const KEY = `pj_navprefs_${tenantId}`
  const stored = lsGet(KEY, null)
  const initialOrder = stored?.order?.length ? stored.order : NAV_ITEMS.map(i => i.to)
  const [position, setPosition] = useState(stored?.position ?? 'side')
  const [order, setOrder] = useState(initialOrder)

  const label = (to) => NAV_ITEMS.find(i => i.to === to)?.label ?? to
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]; [next[i], next[j]] = [next[j], next[i]]; setOrder(next)
  }
  const save = () => { lsSet(KEY, { position, order }); window.dispatchEvent(new Event('pj-navprefs')); showToast('Aparência salva.', 'success') }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Tema + posição */}
      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Tema</h3>
          <div className="flex gap-2">
            {[['dark', '🌙 Escuro (noturno)'], ['light', '☀️ Claro']].map(([v, l]) => (
              <button key={v} onClick={() => setTheme(v)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${theme === v ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Posição dos botões</h3>
          <div className="flex gap-2">
            {[['side', '⬅️ Lateral (na barra esquerda)'], ['top', '⬆️ Em cima (ao lado do logo)']].map(([v, l]) => (
              <button key={v} onClick={() => setPosition(v)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors ${position === v ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Ordem dos botões */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Ordem dos botões</h3>
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {order.map((to, i) => (
            <div key={to} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-hover)]">
              <span className="text-[10px] text-[var(--text-muted)] w-5 text-center">{i + 1}</span>
              <span className="flex-1 text-sm text-[var(--text-primary)]">{label(to)}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">↓</button>
            </div>
          ))}
        </div>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button variant="primary" onClick={save}><IconCheck size={14} /> Salvar aparência</Button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'areas',        label: 'Áreas Jurídicas',      icon: IconBriefcase },
  { key: 'services',     label: 'Serviços e Honorários', icon: IconDollar },
  { key: 'users',        label: 'Usuários / Logins',     icon: IconUsers },
  { key: 'appearance',   label: 'Aparência',         icon: IconGrid },
  { key: 'office',       label: 'Escritório',        icon: IconTag },
  { key: 'integrations', label: 'Integrações',       icon: IconExternalLink },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('areas')

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Configurações</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Áreas, serviços, honorários, usuários e documentos do escritório</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-brand-500 text-accent-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'areas'        && <AreasTab />}
      {tab === 'services'     && <ServicesTab />}
      {tab === 'users'        && <UsersTab />}
      {tab === 'appearance'   && <AppearanceTab />}
      {tab === 'office'       && <OfficeTab />}
      {tab === 'integrations' && <IntegrationTab />}
    </div>
  )
}
