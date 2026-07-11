import { useState, useMemo, useEffect } from 'react'
import { getPeticoes, savePeticao, deletePeticao, PETICAO_CATEGORIAS, PETICAO_AREAS } from '../../lib/peticoesModels'
import { buildVars, renderTemplate, ALL_VARIABLES } from '../../lib/templateEngine'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { Button, Card, Input, Select, Textarea } from '../../components/ui'
import { printDocumentos } from '../../lib/printDoc'

const catLabel = (v) => PETICAO_CATEGORIAS.find(c => c.value === v)?.label ?? v
const areaLabel = (v) => PETICAO_AREAS.find(a => a.value === v)?.label ?? v
const AREA_COLOR = { civel:'#3b82f6', trabalhista:'#f59e0b', familia:'#ec4899', previdenciario:'#10b981', consumidor:'#06b6d4', criminal:'#6b7280', tributario:'#ef4444', geral:'#8b5cf6' }

// ── Preview / impressão ─────────────────────────────────────────────────────
function PrintPreview({ text, titulo, onClose }) {
  const doPrint = () => printDocumentos([text], { titulo })
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Preview — {titulo}</p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={doPrint}>🖨️ Imprimir / PDF</Button>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2">✕</button>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-white text-black rounded-lg p-8" style={{ fontFamily:"'Times New Roman',serif", fontSize:'12pt', lineHeight:'1.9', textAlign:'justify' }}>
            <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'inherit', fontSize:'inherit', lineHeight:'inherit' }}>{text}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: gerar com dados de um cliente ────────────────────────────────────
function GerarModal({ peticao, onClose }) {
  const { showToast } = useUiStore()
  const user = useAuthStore(s => s.user)
  const tenant = useAuthStore(s => s.tenant)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState('')
  const [processes, setProcesses] = useState([])
  const [processId, setProcessId] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => { api.clients.list().then(r => setClients(Array.isArray(r) ? r : (r?.data ?? []))).catch(() => setClients([])) }, [])
  useEffect(() => {
    if (!clientId) { setProcesses([]); return }
    api.clients.processes(clientId).then(p => setProcesses(Array.isArray(p) ? p : [])).catch(() => setProcesses([]))
  }, [clientId])

  const gerar = () => {
    const cli = clients.find(c => c.id === clientId) ?? null
    const proc = processes.find(p => p.id === processId) ?? null
    const vars = buildVars(cli, proc, user, tenant)
    setPreview(renderTemplate(peticao.corpo, vars))
  }

  if (preview) return <PrintPreview text={preview} titulo={peticao.titulo} onClose={onClose} />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Gerar petição com cliente</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <Select label="Cliente" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Selecionar cliente..."
            options={clients.map(c => ({ value: c.id, label: c.name }))} />
          {processes.length > 0 && (
            <Select label="Processo (opcional)" value={processId} onChange={e => setProcessId(e.target.value)} placeholder="Nenhum"
              options={processes.map(p => ({ value: p.id, label: p.title }))} />
          )}
          <p className="text-xs text-[var(--text-muted)]">As variáveis do modelo serão preenchidas com os dados do cliente e do advogado. Placeholders [ASSIM] permanecem para ajuste manual.</p>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={gerar} disabled={!clientId}>Gerar e visualizar →</Button>
        </div>
      </div>
    </div>
  )
}

// ── Editor de modelo ────────────────────────────────────────────────────────
function Editor({ peticao, onSave, onClose }) {
  const { showToast } = useUiStore()
  const [form, setForm] = useState(peticao ?? { titulo: '', categoria: 'inicial', area: 'geral', tags: [], corpo: '' })
  const set = (k) => (e) => setForm(d => ({ ...d, [k]: e.target.value }))
  const insertVar = (key) => setForm(d => ({ ...d, corpo: (d.corpo || '') + `{{${key}}}` }))

  const salvar = () => {
    if (!form.titulo.trim() || !form.corpo.trim()) { showToast('Preencha título e corpo.', 'error'); return }
    const tags = typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags
    onSave(savePeticao({ ...form, tags }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-6 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{peticao ? 'Editar modelo' : 'Novo modelo de petição'}</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Input label="Título" value={form.titulo} onChange={set('titulo')} placeholder="Ex: Petição Inicial — Usucapião" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Categoria" value={form.categoria} onChange={set('categoria')} options={PETICAO_CATEGORIAS} />
              <Select label="Área" value={form.area} onChange={set('area')} options={PETICAO_AREAS} />
            </div>
            <Input label="Tags (separadas por vírgula)" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={set('tags')} placeholder="usucapião, posse" />
            <Textarea label="Corpo da petição" rows={16} value={form.corpo} onChange={set('corpo')} className="font-mono text-xs" placeholder="Use {{cliente.nome}}, {{advogado.oab}}... e [PLACEHOLDERS] para ajuste manual." />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Variáveis</p>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {ALL_VARIABLES.map(g => (
                <div key={g.group}>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] mb-1">{g.group}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.vars.map(v => (
                      <button key={v.key} onClick={() => insertVar(v.key)} title={v.label}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-brand-500/20 hover:text-accent-400">
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={salvar}>Salvar modelo</Button>
        </div>
      </div>
    </div>
  )
}

// ── Detalhe do modelo ───────────────────────────────────────────────────────
function Detalhe({ peticao, onBack, onEdit, onDelete }) {
  const { showToast } = useUiStore()
  const [gerar, setGerar] = useState(false)

  const copiar = () => { navigator.clipboard.writeText(peticao.corpo); showToast('Texto copiado.', 'success') }
  const baixar = () => {
    const blob = new Blob(['﻿' + peticao.corpo], { type: 'application/msword' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${peticao.titulo}.doc`; a.click()
    showToast('Modelo baixado (.doc).', 'success')
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <button onClick={onBack} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mb-4">← Voltar aos modelos</button>
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${AREA_COLOR[peticao.area]}22`, color: AREA_COLOR[peticao.area] }}>{areaLabel(peticao.area)}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">{catLabel(peticao.categoria)}</span>
            {peticao.readonly && <span className="text-[10px] text-[var(--text-muted)]">modelo padrão</span>}
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{peticao.titulo}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => setGerar(true)}>📝 Gerar com cliente</Button>
          <Button variant="secondary" size="sm" onClick={copiar}>📋 Copiar</Button>
          <Button variant="secondary" size="sm" onClick={baixar}>⬇️ Baixar .doc</Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(peticao)}>✏️ {peticao.readonly ? 'Duplicar e editar' : 'Editar'}</Button>
          {!peticao.readonly && <Button variant="secondary" size="sm" onClick={() => onDelete(peticao)}>🗑️</Button>}
        </div>
      </div>

      <Card className="p-6">
        <div className="bg-white text-black rounded-lg p-8" style={{ fontFamily:"'Times New Roman',serif", fontSize:'12pt', lineHeight:'1.9' }}>
          <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'inherit', fontSize:'inherit', lineHeight:'inherit' }}>{peticao.corpo}</pre>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">💡 Variáveis <code className="text-accent-400">{'{{cliente.nome}}'}</code> são preenchidas ao gerar com um cliente. Trechos [ASSIM] são preenchidos manualmente.</p>
      </Card>

      {gerar && <GerarModal peticao={peticao} onClose={() => setGerar(false)} />}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
export default function ModelosPage() {
  const { showToast } = useUiStore()
  const [refresh, setRefresh] = useState(0)
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [cat, setCat] = useState('')
  const [ativo, setAtivo] = useState(null)   // petição em detalhe
  const [editing, setEditing] = useState(null) // {} = novo, obj = editar
  const [confirmDel, setConfirmDel] = useState(null)

  const peticoes = useMemo(() => getPeticoes(), [refresh])
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return peticoes.filter(p =>
      (!area || p.area === area) && (!cat || p.categoria === cat) &&
      (!term || p.titulo.toLowerCase().includes(term) || (p.tags || []).join(' ').toLowerCase().includes(term) || p.corpo.toLowerCase().includes(term))
    )
  }, [peticoes, q, area, cat])

  const handleEdit = (p) => setEditing(p.readonly ? { ...p, id: undefined, titulo: p.titulo + ' (cópia)', readonly: false } : p)
  const handleDelete = (p) => { deletePeticao(p.id); setConfirmDel(null); setAtivo(null); setRefresh(x => x + 1); showToast('Modelo excluído.', 'success') }

  if (ativo) return (
    <div className="h-full overflow-y-auto">
      <Detalhe peticao={ativo} onBack={() => setAtivo(null)} onEdit={handleEdit} onDelete={setConfirmDel} />
      {editing && <Editor peticao={editing.id ? editing : editing} onSave={(saved) => { setEditing(null); setRefresh(x => x + 1); setAtivo(saved); showToast('Modelo salvo.', 'success') }} onClose={() => setEditing(null)} />}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg-card)] rounded-2xl p-5 max-w-sm w-full">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Excluir modelo?</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">"{confirmDel.titulo}" será removido permanentemente.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDel(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={() => handleDelete(confirmDel)}>Excluir</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Modelos de Petições</h1>
          <Button variant="primary" size="sm" onClick={() => setEditing({})}>+ Novo modelo</Button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">Banco de petições — gere com os dados do cliente, copie ou baixe.</p>

        {/* Busca */}
        <div className="relative mb-4">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar petição (ex.: cobrança, apelação, alimentos...)"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
          <span className="absolute left-3 top-2.5 text-[var(--text-muted)]">🔍</span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setArea('')} className={`text-xs px-3 py-1.5 rounded-full border ${!area ? 'bg-brand-500 text-white border-brand-500' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>Todas as áreas</button>
          {PETICAO_AREAS.map(a => (
            <button key={a.value} onClick={() => setArea(area === a.value ? '' : a.value)}
              className={`text-xs px-3 py-1.5 rounded-full border ${area === a.value ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
              style={area === a.value ? { background: AREA_COLOR[a.value] } : {}}>{a.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-6">
          <button onClick={() => setCat('')} className={`text-xs px-3 py-1 rounded-full ${!cat ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>Todas categorias</button>
          {PETICAO_CATEGORIAS.map(c => (
            <button key={c.value} onClick={() => setCat(cat === c.value ? '' : c.value)}
              className={`text-xs px-3 py-1 rounded-full ${cat === c.value ? 'bg-brand-500/20 text-accent-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>{c.label}</button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">Nenhum modelo encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => (
              <Card key={p.id} className="p-4 cursor-pointer hover:border-brand-500/40 transition-all group flex flex-col" onClick={() => setAtivo(p)}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${AREA_COLOR[p.area]}22`, color: AREA_COLOR[p.area] }}>{areaLabel(p.area)}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">{catLabel(p.categoria)}</span>
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-brand-400 transition-colors">{p.titulo}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 flex-1">{p.corpo.replace(/\{\{[^}]+\}\}/g, '___').slice(0, 120)}…</p>
                {p.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">{t}</span>)}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && <Editor peticao={editing.id ? editing : (editing.titulo ? editing : null)} onSave={(saved) => { setEditing(null); setRefresh(x => x + 1); setAtivo(saved); showToast('Modelo salvo.', 'success') }} onClose={() => setEditing(null)} />}
    </div>
  )
}
