import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  IconPlus, IconSearch, IconUpload, IconFileText, IconDownload,
  IconEye, IconTrash, IconLink, IconPenTool, IconCopy, IconCheck,
  IconFilter, IconX, IconFolder, IconEdit,
} from '../../components/ui'
import TemplatesTab from './DocumentGenerator'


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

function TemplateModal({ template, onClose }) {
  const navigate = useNavigate()
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
            <button onClick={onClose} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-strong)] transition-colors">
              <IconEye size={14} />
              Fechar prévia
            </button>
            <button onClick={() => { onClose(); navigate('/app/clients') }} className="flex-1 btn-primary flex items-center justify-center gap-1.5 py-2.5">
              <IconDownload size={14} />
              Gerar no cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('documents')
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const { showToast } = useUiStore()
  const [docs, setDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [signatures, setSignatures] = useState([])
  const [signatureDoc, setSignatureDoc] = useState(null)
  const [templateModal, setTemplateModal] = useState(null)

  // Documentos vêm do servidor (arquivo real em disco, isolado por escritório).
  const normalize = (d) => ({
    ...d,
    size: d.fileSize ?? d.size ?? 0,
    type: String(d.type || d.name?.split('.').pop() || '').toLowerCase(),
    tags: Array.isArray(d.tags) ? d.tags : [],
    uploadedAt: d.createdAt ?? d.uploadedAt,
  })
  const loadDocs = () => {
    setLoadingDocs(true)
    return api.documents.list()
      .then(r => setDocs((Array.isArray(r) ? r : (r?.data ?? [])).map(normalize)))
      .catch(() => setDocs([]))
      .finally(() => setLoadingDocs(false))
  }
  // Pedidos de assinatura reais (servidor) — antes eram registros falsos no navegador.
  const loadSignatures = () =>
    api.signatures.list()
      .then(r => setSignatures(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => setSignatures([]))
  useEffect(() => { loadDocs(); loadSignatures() }, [])

  const allTags = [...new Set(docs.flatMap(d => d.tags ?? []))]
  const toggleTag = tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.client?.toLowerCase().includes(search.toLowerCase())
    const matchTags = activeTags.length === 0 || activeTags.every(t => d.tags.includes(t))
    return matchSearch && matchTags
  })

  // Envia os arquivos DE VERDADE para o servidor (ficam salvos em disco).
  const handleUpload = async (files) => {
    const lista = Array.from(files ?? [])
    if (!lista.length) return
    const fd = new FormData()
    lista.forEach(f => fd.append('file', f))
    try {
      await api.documents.upload(fd)
      showToast(lista.length > 1 ? 'Documentos enviados.' : 'Documento enviado.', 'success')
      loadDocs()
    } catch (e) {
      showToast(e?.message || 'Não foi possível enviar o documento.', 'error')
    }
  }

  const handleDelete = async (id) => {
    const d = docs.find(x => x.id === id)
    if (!window.confirm(`Excluir "${d?.name ?? 'este documento'}"? Essa ação não pode ser desfeita.`)) return
    try {
      await api.documents.remove(id)
      showToast('Documento excluído.', 'success')
      loadDocs()
    } catch (e) {
      showToast(e?.message || 'Não foi possível excluir o documento.', 'error')
    }
  }

  const handleDownload = async (d) => {
    try { await api.documents.download(d.id, d.name) }
    catch (e) { showToast(e?.message || 'Não foi possível baixar o arquivo.', 'error') }
  }
  const handleView = async (d) => {
    try { await api.documents.view(d.id) }
    catch (e) { showToast(e?.message || 'Não foi possível abrir o arquivo.', 'error') }
  }

  const handleCancelSignature = async (id) => {
    if (!window.confirm('Cancelar este pedido de assinatura? O link enviado ao cliente deixa de funcionar.')) return
    try {
      await api.signatures.remove(id)
      showToast('Pedido de assinatura cancelado.', 'success')
      loadSignatures()
    } catch (e) {
      showToast(e?.message || 'Não foi possível cancelar o pedido.', 'error')
    }
  }

  // A assinatura eletrônica é solicitada no cadastro do cliente, onde o
  // documento é gerado (a página de assinatura mostra o texto do documento).
  // Um arquivo enviado (PDF) não tem texto para exibir, por isso o pedido
  // não é feito aqui — levamos a advogada ao lugar certo.
  const irParaAssinatura = () => {
    showToast('A assinatura é solicitada no cadastro do cliente, onde o documento é gerado.', 'info', 6000)
    navigate('/app/clients')
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      {templateModal && <TemplateModal template={templateModal} onClose={() => setTemplateModal(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Documentos</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/app/clients')} title="Gere documentos no cadastro do cliente">
          <IconPlus size={15} />
          Novo Documento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { key: 'documents', label: 'Documentos', count: docs.length },
          { key: 'templates', label: 'Modelos' },
          { key: 'signatures', label: 'Assinaturas', count: signatures.filter(s => s.status !== 'assinado').length },
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
            {allTags.map(tag => (
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
                    <button onClick={() => handleView(doc)} title="Visualizar" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
                      <IconEye size={14} />
                    </button>
                    <button onClick={() => handleDownload(doc)} title="Baixar" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors">
                      <IconDownload size={14} />
                    </button>
                    <button onClick={irParaAssinatura} title="Solicitar assinatura (feita no cadastro do cliente)" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-accent-400 hover:bg-[var(--bg-active)] transition-colors">
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
          {signatures.length === 0 && (
            <div className="card p-10 text-center">
              <IconPenTool size={26} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Nenhum pedido de assinatura.</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Os pedidos são criados no <b>cadastro do cliente</b>, ao gerar um documento.</p>
            </div>
          )}
          {signatures.map(sig => {
            const assinado = sig.status === 'assinado'
            const docsList = Array.isArray(sig.documentos) ? sig.documentos : []
            const titulo = docsList.map(d => d.titulo || d.nome).filter(Boolean).join(' · ') || `${docsList.length} documento(s)`
            const link = `${window.location.origin}/assinar/${sig.id}`
            return (
              <div key={sig.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                      <IconPenTool size={16} className="text-accent-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{titulo}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {sig.clientName || 'Cliente'} · enviado {sig.createdAt ? format(new Date(sig.createdAt), "dd 'de' MMMM", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`badge border text-[10px] flex-shrink-0 ${assinado ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30' : 'text-amber-400 bg-amber-950/40 border-amber-800/30'}`}>
                    {assinado ? 'Assinado' : 'Aguardando'}
                  </span>
                </div>

                <div className="pl-12 text-xs text-[var(--text-secondary)]">
                  {assinado ? (
                    <>
                      Assinado por <b>{sig.signerName || sig.clientName}</b>
                      {sig.signedAt ? ` em ${format(new Date(sig.signedAt), "dd/MM/yyyy 'às' HH:mm")}` : ''}
                      {sig.validationCode ? <> · código de validação <b className="text-accent-400">{sig.validationCode}</b></> : null}
                    </>
                  ) : 'Aguardando o cliente assinar pelo link.'}
                </div>

                {!assinado && (
                  <div className="flex items-center gap-2 pl-12 flex-wrap">
                    <button onClick={() => { navigator.clipboard?.writeText(link); showToast('Link copiado.', 'success') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border)]">
                      <IconLink size={11} /> Copiar link
                    </button>
                    <button onClick={() => handleCancelSignature(sig.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40 transition-colors">
                      <IconX size={11} /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
