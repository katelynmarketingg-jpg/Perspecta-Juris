import { useState, useEffect, useRef } from 'react'
import { Button, Input, Spinner } from '../../components/ui'
import { getTemplates, buildVars, renderTemplate, saveTemplate, deleteTemplate, TEMPLATE_CATEGORIES, ALL_VARIABLES } from '../../lib/templateEngine'
import { printDocumentos } from '../../lib/printDoc'
import { useUiStore } from '../../stores/uiStore'
import api from '../../lib/api'

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const uid   = () => Math.random().toString(36).slice(2,9) + Math.random().toString(36).slice(2,9)

const CAT_COLORS = {
  procuracao: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  contrato:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  declaracao: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  notificacao:'bg-amber-500/10 text-amber-400 border-amber-500/20',
  acordo:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
  carta:      'bg-sky-500/10 text-sky-400 border-sky-500/20',
  peticao:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  recurso:    'bg-pink-500/10 text-pink-400 border-pink-500/20',
  outro:      'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

// ── Print preview ─────────────────────────────────────────────────
function PrintPreview({ text, templateName, onClose }) {
  const handlePrint = () => printDocumentos([text], { titulo: templateName })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Preview — {templateName}</p>
            <p className="text-xs text-[var(--text-muted)]">Revise o documento antes de imprimir</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handlePrint}>
              🖨️ Imprimir
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="p-6">
          <div className="bg-white text-black rounded-lg shadow-inner p-8 min-h-96" style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', lineHeight: '1.8' }}>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}>
              {text}
            </pre>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>🖨️ Imprimir / Salvar PDF</Button>
        </div>
      </div>
    </div>
  )
}

// ── Generate modal ────────────────────────────────────────────────
function GenerateModal({ template, onClose }) {
  const { showToast } = useUiStore()
  const [clients,  setClients]  = useState([])
  const [processes,setProcesses]= useState([])
  const [clientId, setClientId] = useState('')
  const [processId,setProcessId]= useState('')
  const [preview,  setPreview]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.clients.list({ limit: 200 }),
      api.processes.list({ limit: 200 }),
    ]).then(([c, p]) => {
      setClients(Array.isArray(c) ? c : (c?.data ?? []))
      setProcesses(Array.isArray(p) ? p : (p?.data ?? []))
      setLoading(false)
    })
  }, [])

  // Auto-select process when client changes
  useEffect(() => {
    if (!clientId) return
    const procs = processes.filter(p => p.clientId === clientId)
    if (procs.length === 1) setProcessId(procs[0].id)
    else setProcessId('')
  }, [clientId])

  const clientProcesses = processes.filter(p => !clientId || p.clientId === clientId)

  const storedUser = lsGet('pj_user', null)
  const storedTenant = lsGet('pj_tenant', null)

  const generate = () => {
    const client  = clients.find(c => c.id === clientId) ?? null
    const process = processes.find(p => p.id === processId) ?? null
    const vars = buildVars(client, process, storedUser, storedTenant)
    const text = renderTemplate(template.body, vars)
    setPreview(text)
  }

  if (preview) {
    return <PrintPreview text={preview} templateName={template.name} onClose={() => setPreview(null)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{template.name}</p>
            <p className="text-xs text-[var(--text-muted)]">Selecione o cliente e processo para gerar o documento</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner size={24} className="text-brand-500" /></div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Cliente</p>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
                >
                  <option value="">— Selecionar cliente —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Processo <span className="text-[var(--text-muted)]">(opcional)</span></p>
                <select
                  value={processId}
                  onChange={e => setProcessId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
                >
                  <option value="">— Nenhum processo —</option>
                  {clientProcesses.map(p => (
                    <option key={p.id} value={p.id}>{p.title}{p.judicialNumber ? ` — ${p.judicialNumber}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Variáveis usadas */}
              <div className="rounded-lg bg-[var(--bg-hover)] p-3">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Campos preenchidos automaticamente</p>
                <div className="flex flex-wrap gap-1">
                  {template.variables.map(v => (
                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 font-mono border border-brand-500/20">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={generate} disabled={loading}>
            Gerar documento →
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Template editor ───────────────────────────────────────────────
function TemplateEditor({ template, onSave, onClose }) {
  const [name,     setName]     = useState(template?.name ?? '')
  const [category, setCategory] = useState(template?.category ?? 'outro')
  const [desc,     setDesc]     = useState(template?.description ?? '')
  const [body,     setBody]     = useState(template?.body ?? '')
  const textRef = useRef(null)

  const insertVar = (v) => {
    const el = textRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const newVal = body.slice(0, start) + `{{${v}}}` + body.slice(end)
    setBody(newVal)
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + v.length + 4
      el.focus()
    }, 0)
  }

  const handleSave = () => {
    if (!name.trim() || !body.trim()) return
    const vars = [...body.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1].trim())
    onSave({ ...(template ?? {}), id: template?.id ?? uid(), name, category, description: desc, body, variables: [...new Set(vars)] })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-6 px-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{template ? 'Editar modelo' : 'Novo modelo'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
          {/* Left: meta */}
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome do modelo *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none"
                placeholder="Ex: Procuração Ad Judicia" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
                {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Descrição</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none resize-none"
                placeholder="Breve descrição do modelo..." />
            </div>

            {/* Variable palette */}
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Inserir variável no cursor</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {ALL_VARIABLES.map(group => (
                  <div key={group.group}>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">{group.group}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.vars.map(v => (
                        <button key={v.key} onClick={() => insertVar(v.key)}
                          title={v.label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-500 hover:text-brand-400 transition-colors font-mono">
                          {v.key}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: body */}
          <div className="lg:col-span-2 p-5 flex flex-col">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Texto do documento
              <span className="ml-2 text-[var(--text-muted)] font-normal">Use {'{{variavel}}'} para campos dinâmicos</span>
            </label>
            <textarea
              ref={textRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="flex-1 w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none resize-none font-mono"
              style={{ minHeight: '480px' }}
              placeholder="Digite o texto do documento aqui..."
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!name.trim() || !body.trim()}>
            Salvar modelo
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main: Templates tab ───────────────────────────────────────────
// ── Multi-generate modal (vários documentos de uma vez) ───────────
function MultiGenerateModal({ templates, onClose }) {
  const { showToast } = useUiStore()
  const [clients, setClients] = useState([])
  const [processes, setProcesses] = useState([])
  const [clientId, setClientId] = useState('')
  const [processId, setProcessId] = useState('')
  const storedUser   = lsGet('pj_auth', {})?.state?.user ?? lsGet('pj_user', null)
  const storedTenant = lsGet('pj_auth', {})?.state?.tenant ?? lsGet('pj_tenant', null)

  useEffect(() => { api.clients.list({ limit: 200 }).then(r => setClients(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => setClients([])) }, [])
  useEffect(() => {
    if (!clientId) { setProcesses([]); return }
    api.clients.processes(clientId).then(p => setProcesses(Array.isArray(p) ? p : [])).catch(() => setProcesses([]))
  }, [clientId])

  const gerar = () => {
    const client = clients.find(c => c.id === clientId) ?? null
    const process = processes.find(p => p.id === processId) ?? null
    const vars = buildVars(client, process, storedUser, storedTenant)
    printDocumentos(templates.map(t => renderTemplate(t.body, vars)), { titulo: 'Documentos' })
    showToast(`${templates.length} documento(s) gerado(s).`, 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Gerar {templates.length} documento(s)</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-[var(--bg-hover)] p-3 max-h-28 overflow-y-auto">
            {templates.map(t => <p key={t.id} className="text-xs text-[var(--text-secondary)]">• {t.name}</p>)}
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              <option value="">Selecionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {processes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Processo (opcional)</label>
              <select value={processId} onChange={e => setProcessId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
                <option value="">Nenhum</option>
                {processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)]">Todos serão preenchidos com os dados do cliente e impressos juntos (uma página cada).</p>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={gerar} disabled={!clientId}>Gerar e imprimir →</Button>
        </div>
      </div>
    </div>
  )
}

export default function TemplatesTab() {
  const { showToast } = useUiStore()
  const [templates,   setTemplates]   = useState(() => getTemplates())
  const [generating,  setGenerating]  = useState(null)  // template being generated
  const [editing,     setEditing]     = useState(null)   // template being edited (or 'new')
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState('')
  const [selectMode,  setSelectMode]  = useState(false)
  const [selected,    setSelected]    = useState({})     // { [id]: true }
  const [multiGen,    setMultiGen]    = useState(null)   // array of templates

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !catFilter || t.category === catFilter
    return matchSearch && matchCat
  })

  const handleSave = (tpl) => {
    const updated = saveTemplate(tpl)
    setTemplates(updated)
    setEditing(null)
    showToast('Modelo salvo com sucesso.', 'success')
  }

  const handleDelete = (id) => {
    if (!confirm('Excluir este modelo?')) return
    const updated = deleteTemplate(id)
    setTemplates(updated)
    showToast('Modelo excluído.', 'success')
  }

  const catLabel = (cat) => TEMPLATE_CATEGORIES.find(c => c.value === cat)?.label ?? cat

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelos..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
          <option value="">Todas as categorias</option>
          {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button variant={selectMode ? 'primary' : 'secondary'} size="sm" onClick={() => { setSelectMode(m => !m); setSelected({}) }}>
          {selectMode ? 'Cancelar seleção' : '☑ Selecionar vários'}
        </Button>
        {!selectMode && <Button variant="primary" size="sm" onClick={() => setEditing('new')}>+ Novo modelo</Button>}
      </div>

      {selectMode && (
        <div className="flex items-center justify-between rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-2.5">
          <p className="text-sm text-[var(--text-secondary)]">{Object.values(selected).filter(Boolean).length} selecionado(s)</p>
          <Button variant="primary" size="sm" disabled={!Object.values(selected).some(Boolean)}
            onClick={() => setMultiGen(templates.filter(t => selected[t.id]))}>
            Gerar selecionados com dados do cliente →
          </Button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">
          Nenhum modelo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(tpl => (
            <div key={tpl.id}
              onClick={() => selectMode && setSelected(s => ({ ...s, [tpl.id]: !s[tpl.id] }))}
              className={`rounded-xl border bg-[var(--bg-card)] p-4 flex flex-col gap-3 transition-colors ${selectMode ? 'cursor-pointer' : ''} ${selectMode && selected[tpl.id] ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-[var(--border)] hover:border-brand-500/30'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[tpl.category] ?? CAT_COLORS.outro}`}>
                    {catLabel(tpl.category)}
                  </span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1.5">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{tpl.description}</p>
                  )}
                </div>
                {selectMode && (
                  <input type="checkbox" checked={!!selected[tpl.id]} readOnly className="w-4 h-4 flex-shrink-0 accent-brand-500" />
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {(tpl.variables ?? []).slice(0, 5).map(v => (
                  <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] font-mono border border-[var(--border)]">
                    {`{{${v}}}`}
                  </span>
                ))}
                {(tpl.variables ?? []).length > 5 && (
                  <span className="text-[10px] text-[var(--text-muted)]">+{tpl.variables.length - 5}</span>
                )}
              </div>

              <div className={`flex items-center gap-2 mt-auto pt-2 border-t border-[var(--border)] ${selectMode ? 'hidden' : ''}`}>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => setGenerating(tpl)}>
                  Gerar documento
                </Button>
                <button onClick={() => setEditing(tpl)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                {!tpl.id.startsWith('tpl_') && (
                  <button onClick={() => handleDelete(tpl.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {generating && (
        <GenerateModal template={generating} onClose={() => setGenerating(null)} />
      )}
      {multiGen && (
        <MultiGenerateModal templates={multiGen} onClose={() => { setMultiGen(null); setSelectMode(false); setSelected({}) }} />
      )}
      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
