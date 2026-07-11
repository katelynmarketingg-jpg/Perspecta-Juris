import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  IconPlus, IconSearch, IconUpload, IconFileText, IconDownload,
  IconEye, IconTrash, IconLink, IconPenTool, IconCopy, IconCheck,
  IconFilter, IconX, IconFolder, IconEdit,
} from '../../components/ui'
import TemplatesTab from './DocumentGenerator'

const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback } }
const lsSet = (key, val) => localStorage.setItem(key, JSON.stringify(val))
const uid   = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)

const MOCK_DOCS = [
  { id: '1', name: 'Contrato de Honorários — Silva.pdf', type: 'pdf', size: 245000, client: 'José Silva', processTitle: 'Ação de Indenização 0001234', tags: ['contrato', 'honorários'], uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(), signatureStatus: 'signed' },
  { id: '2', name: 'Procuração — Maria Santos.pdf', type: 'pdf', size: 87000, client: 'Maria Santos', processTitle: 'Reclamação Trabalhista 0007890', tags: ['procuração'], uploadedAt: new Date(Date.now() - 86400000 * 12).toISOString(), signatureStatus: null },
  { id: '3', name: 'Petição Inicial — Divórcio Rodrigues.docx', type: 'docx', size: 320000, client: 'Carlos Rodrigues', processTitle: 'Divórcio Consensual 0002345', tags: ['petição', 'inicial'], uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(), signatureStatus: null },
  { id: '4', name: 'Sentença — Apelação Cível.pdf', type: 'pdf', size: 512000, client: 'José Silva', processTitle: 'Apelação Cível 0004521', tags: ['sentença'], uploadedAt: new Date(Date.now() - 86400000 * 20).toISOString(), signatureStatus: null },
  { id: '5', name: 'Recurso de Apelação — rascunho.docx', type: 'docx', size: 198000, client: 'José Silva', processTitle: 'Apelação Cível 0004521', tags: ['recurso', 'rascunho'], uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(), signatureStatus: null },
  { id: '6', name: 'Laudo Pericial — Execução Fiscal.pdf', type: 'pdf', size: 1240000, client: null, processTitle: 'Execução Fiscal 0006789', tags: ['laudo', 'pericial'], uploadedAt: new Date(Date.now() - 86400000 * 8).toISOString(), signatureStatus: null },
]

const MOCK_TEMPLATES = [
  { id: 't1', name: 'Contrato de Honorários', description: 'Contrato padrão de honorários advocatícios com cláusulas de êxito', variables: ['cliente_nome', 'cliente_cpf', 'processo_numero', 'valor_honorarios', 'percentual_exito', 'advogado_nome'], usedAt: new Date(Date.now() - 86400000 * 2).toISOString(), category: 'contrato' },
  { id: 't2', name: 'Procuração Ad Judicia', description: 'Procuração geral para representação judicial em todas as instâncias', variables: ['cliente_nome', 'cliente_cpf', 'cliente_rg', 'cliente_endereco', 'advogado_nome', 'advogado_oab'], usedAt: new Date(Date.now() - 86400000 * 7).toISOString(), category: 'procuração' },
  { id: 't3', name: 'Petição Inicial Cível', description: 'Modelo de petição inicial para ações cíveis com qualificação das partes', variables: ['autor_nome', 'reu_nome', 'vara', 'fatos', 'pedidos', 'valor_causa'], usedAt: new Date(Date.now() - 86400000 * 15).toISOString(), category: 'petição' },
  { id: 't4', name: 'Recurso de Apelação', description: 'Modelo de recurso de apelação com razões e contrarrazões', variables: ['processo_numero', 'apelante', 'apelado', 'fundamentos', 'pedido'], usedAt: new Date(Date.now() - 86400000 * 30).toISOString(), category: 'recurso' },
  { id: 't5', name: 'Notificação Extrajudicial', description: 'Notificação extrajudicial para cumprimento de obrigação', variables: ['notificante', 'notificado', 'notificado_endereco', 'objeto', 'prazo'], usedAt: null, category: 'notificação' },
]

const MOCK_SIGNATURES = [
  { id: 's1', docName: 'Contrato de Honorários — Silva.pdf', signatories: [{ name: 'José Silva', email: 'jose@email.com', status: 'signed', signedAt: new Date(Date.now() - 86400000 * 4).toISOString() }, { name: 'Dr. Carlos', email: 'carlos@advocacia.com', status: 'signed', signedAt: new Date(Date.now() - 86400000 * 5).toISOString() }], createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'completed' },
  { id: 's2', docName: 'Procuração Ad Judicia — Santos.pdf', signatories: [{ name: 'Maria Santos', email: 'maria@email.com', status: 'pending', signedAt: null }, { name: 'Dr. Carlos', email: 'carlos@advocacia.com', status: 'signed', signedAt: new Date(Date.now() - 86400000 * 1).toISOString() }], createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'pending' },
  { id: 's3', docName: 'Contrato — Rodrigues Ltda.pdf', signatories: [{ name: 'Carlos Rodrigues', email: 'carlos@email.com', status: 'pending', signedAt: null }], createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), status: 'pending' },
]

const ALL_TAGS = [...new Set(MOCK_DOCS.flatMap(d => d.tags))]

const fmtSize = b => b >= 1000000 ? `${(b/1000000).toFixed(1)} MB` : `${Math.round(b/1000)} KB`

const typeConfig = {
  pdf:  { label: 'PDF',  color: 'text-red-400',   bg: 'bg-red-900/30' },
  docx: { label: 'DOCX', color: 'text-blue-400',  bg: 'bg-blue-900/30' },
  xlsx: { label: 'XLSX', color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
}

const catConfig = {
  contrato:    { color: 'text-blue-400 bg-blue-900/30' },
  procuração:  { color: 'text-purple-400 bg-purple-900/30' },
  petição:     { color: 'text-amber-400 bg-amber-900/30' },
  recurso:     { color: 'text-red-400 bg-red-900/30' },
  notificação: { color: 'text-emerald-400 bg-emerald-900/30' },
}

function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    const files = [...e.dataTransfer.files]
    if (files.length) onUpload(files)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
        ${dragging ? 'border-brand-500 bg-[var(--bg-active)]' : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]'}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
        <IconUpload size={22} className="text-[var(--text-muted)]" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Arraste arquivos aqui ou <span className="text-accent-400">clique para selecionar</span></p>
        <p className="text-xs text-[var(--text-muted)] mt-1">PDF, DOCX, XLSX — máx. 50 MB</p>
      </div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={e => onUpload([...e.target.files])} />
    </div>
  )
}

function SignatureModal({ doc, onClose, onSend }) {
  const [copied, setCopied] = useState(false)
  const [names, setNames] = useState(['', ''])
  const [emails, setEmails] = useState(['', ''])
  const link = `https://assinar.perspecta.app/${doc.id}`

  const copyLink = () => {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <IconPenTool size={15} className="text-accent-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Solicitar Assinatura</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[240px]">{doc.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]">
            <IconX size={15} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Link de Assinatura</label>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2">
                <p className="text-xs text-[var(--text-secondary)] truncate">{link}</p>
              </div>
              <button onClick={copyLink} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${copied ? 'bg-emerald-900/40 text-emerald-400' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white'}`}>
                {copied ? <><IconCheck size={12} /> Copiado</> : <><IconCopy size={12} /> Copiar</>}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Signatários</label>
            <div className="mt-1.5 space-y-2">
              {['Cliente', 'Advogado responsável'].map((role, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={names[i]} onChange={e => setNames(n => n.map((v, j) => j === i ? e.target.value : v))} placeholder={role} className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]" />
                  <input value={emails[i]} onChange={e => setEmails(n => n.map((v, j) => j === i ? e.target.value : v))} placeholder="E-mail" className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-hover)] rounded-xl p-3 text-xs text-[var(--text-muted)] flex items-start gap-2">
            <IconLink size={12} className="mt-0.5 flex-shrink-0" />
            O link é válido por 30 dias. Cada signatário recebe por e-mail e pode assinar pelo celular sem instalar nenhum app.
          </div>

          <button
            onClick={() => onSend(doc, names.map((name, i) => ({ name, email: emails[i] })).filter(s => s.name.trim()))}
            className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
          >
            <IconPenTool size={14} />
            Enviar para Assinatura
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateModal({ template, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg shadow-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-white">{template.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{template.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]">
            <IconX size={15} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Variáveis do modelo</label>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map(v => (
                <span key={v} className="px-2 py-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-mono text-accent-400">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 block">Preencher variáveis</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {template.variables.map(v => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] w-36 flex-shrink-0">{v}</span>
                  <input
                    placeholder={`Valor para ${v}`}
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] transition-colors">
              <IconEye size={14} />
              Visualizar
            </button>
            <button className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-2.5">
              <IconDownload size={14} />
              Gerar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [tab, setTab] = useState('documents')
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [docs, setDocs] = useState(() => lsGet('pj_local_documents', MOCK_DOCS))
  const [signatures, setSignatures] = useState(() => lsGet('pj_local_signatures', MOCK_SIGNATURES))
  const [signatureDoc, setSignatureDoc] = useState(null)
  const [templateModal, setTemplateModal] = useState(null)

  const toggleTag = tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.client?.toLowerCase().includes(search.toLowerCase())
    const matchTags = activeTags.length === 0 || activeTags.every(t => d.tags.includes(t))
    return matchSearch && matchTags
  })

  const handleUpload = files => {
    const newDocs = files.map((f, i) => ({
      id: uid(),
      name: f.name,
      type: f.name.split('.').pop().toLowerCase(),
      size: f.size,
      client: null,
      processTitle: null,
      tags: [],
      uploadedAt: new Date().toISOString(),
      signatureStatus: null,
    }))
    setDocs(prev => {
      const next = [...newDocs, ...prev]
      lsSet('pj_local_documents', next)
      return next
    })
  }

  const handleDelete = id => {
    setDocs(prev => {
      const next = prev.filter(d => d.id !== id)
      lsSet('pj_local_documents', next)
      return next
    })
  }

  const handleSendSignature = (doc, signatories) => {
    const newSig = {
      id: uid(),
      docName: doc.name,
      signatories: signatories.map(s => ({ ...s, status: 'pending', signedAt: null })),
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    const updatedDocs = docs.map(d => d.id === doc.id ? { ...d, signatureStatus: 'pending' } : d)
    setSignatures(prev => {
      const next = [newSig, ...prev]
      lsSet('pj_local_signatures', next)
      return next
    })
    setDocs(updatedDocs)
    lsSet('pj_local_documents', updatedDocs)
    setSignatureDoc(null)
  }

  const handleCancelSignature = id => {
    setSignatures(prev => {
      const next = prev.filter(s => s.id !== id)
      lsSet('pj_local_signatures', next)
      return next
    })
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      {signatureDoc && <SignatureModal doc={signatureDoc} onClose={() => setSignatureDoc(null)} onSend={handleSendSignature} />}
      {templateModal && <TemplateModal template={templateModal} onClose={() => setTemplateModal(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Documentos</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => {}}>
          <IconPlus size={15} />
          Novo Documento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { key: 'documents', label: 'Documentos', count: docs.length },
          { key: 'templates', label: 'Modelos',    count: MOCK_TEMPLATES.length },
          { key: 'signatures', label: 'Assinaturas', count: signatures.filter(s => s.status === 'pending').length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              tab === t.key ? 'border-brand-500 text-accent-400' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}>
            {t.label}
            {t.count > 0 && <span className={`text-[10px] px-1.5 rounded-full font-semibold ${tab === t.key ? 'bg-brand-500/20 text-accent-400' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── DOCUMENTOS ── */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <UploadZone onUpload={handleUpload} />

          {/* Search + tags */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar documentos..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${activeTags.includes(tag) ? 'bg-brand-500 border-brand-600 text-white' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
                {tag}
              </button>
            ))}
            {activeTags.length > 0 && (
              <button onClick={() => setActiveTags([])} className="px-2 py-0.5 rounded-full text-xs text-[var(--text-muted)] hover:text-white flex items-center gap-1">
                <IconX size={10} /> limpar
              </button>
            )}
          </div>

          {/* File list */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="card p-10 text-center">
                <IconFolder size={28} className="text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">Nenhum documento encontrado.</p>
              </div>
            ) : filtered.map(doc => {
              const tc = typeConfig[doc.type] ?? { label: doc.type?.toUpperCase(), color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-hover)]' }
              return (
                <div key={doc.id} className="card p-4 flex items-center gap-3 hover:border-[var(--border-strong)] transition-colors group">
                  {/* Type badge */}
                  <div className={`w-10 h-10 rounded-xl ${tc.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-[10px] font-bold ${tc.color}`}>{tc.label}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                      {doc.signatureStatus === 'signed' && (
                        <span className="badge badge-green flex items-center gap-1"><IconCheck size={9} /> Assinado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {doc.client && <span className="text-xs text-[var(--text-muted)]">{doc.client}</span>}
                      {doc.processTitle && <span className="text-xs text-[var(--text-muted)]">· {doc.processTitle}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {doc.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{t}</span>
                      ))}
                      <span className="text-[10px] text-[var(--text-muted)]">{fmtSize(doc.size)} · {format(new Date(doc.uploadedAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Visualizar" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
                      <IconEye size={14} />
                    </button>
                    <button title="Baixar" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
                      <IconDownload size={14} />
                    </button>
                    <button onClick={() => setSignatureDoc(doc)} title="Solicitar assinatura" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-accent-400 hover:bg-[var(--bg-active)] transition-colors">
                      <IconPenTool size={14} />
                    </button>
                    <button onClick={() => handleDelete(doc.id)} title="Excluir" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40 transition-colors">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODELOS ── */}
      {tab === 'templates' && <TemplatesTab />}

      {/* ── ASSINATURAS ── */}
      {tab === 'signatures' && (
        <div className="space-y-3">
          {signatures.map(sig => (
            <div key={sig.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <IconPenTool size={16} className="text-accent-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{sig.docName}</p>
                    <p className="text-xs text-[var(--text-muted)]">Enviado {format(new Date(sig.createdAt), "dd 'de' MMMM", { locale: ptBR })}</p>
                  </div>
                </div>
                <span className={`badge border text-[10px] ${sig.status === 'completed' ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30' : 'text-amber-400 bg-amber-950/40 border-amber-800/30'}`}>
                  {sig.status === 'completed' ? 'Concluído' : 'Aguardando'}
                </span>
              </div>

              {/* Signatories */}
              <div className="flex flex-col gap-1.5 pl-12">
                {sig.signatories.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.status === 'signed' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <span className="text-xs text-[var(--text-secondary)]">{s.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{s.email}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {s.status === 'signed' && s.signedAt ? `Assinado ${format(new Date(s.signedAt), 'dd/MM HH:mm')}` : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>

              {sig.status === 'pending' && (
                <div className="flex items-center gap-2 pl-12">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border)]">
                    <IconLink size={11} /> Copiar link
                  </button>
                  <button onClick={() => handleCancelSignature(sig.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40 transition-colors">
                    <IconX size={11} /> Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
