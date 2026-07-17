import { useState, useEffect } from 'react'
import { getPeticoes } from '../../lib/peticoesModels'
import { getTemplates, buildVars, renderTemplate } from '../../lib/templateEngine'
import { createRequest, getRequestsByProcess, deleteRequest, signLink, whatsappLink } from '../../lib/signatures'
import { imprimirComprovante } from '../../lib/signatureProof'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { Button, Card } from '../../components/ui'
import api from '../../lib/api'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '—'

// ── Modal: nova coleta (checklist de modelos) ───────────────────────────────
function NovaColeta({ process, client, onCreated, onClose }) {
  const { showToast } = useUiStore()
  const user = useAuthStore(s => s.user)
  const tenant = useAuthStore(s => s.tenant)
  const [sel, setSel] = useState({})   // { 'pet:id': true, 'tpl:id': true }
  const [modo, setModo] = useState('link')

  const peticoes = getPeticoes()
  const templates = getTemplates()
  const toggle = (key) => setSel(s => ({ ...s, [key]: !s[key] }))
  const anySelected = Object.values(sel).some(Boolean)

  const gerarDocs = () => {
    const vars = buildVars(client, process, user, tenant)
    const docs = []
    peticoes.forEach(p => { if (sel[`pet:${p.id}`]) docs.push({ titulo: p.titulo, corpo: renderTemplate(p.corpo, vars) }) })
    templates.forEach(t => { if (sel[`tpl:${t.id}`]) docs.push({ titulo: t.name, corpo: renderTemplate(t.body, vars) }) })
    return docs
  }

  const printAll = () => {
    const docs = gerarDocs()
    if (!docs.length) { showToast('Selecione ao menos um documento.', 'error'); return }
    const win = window.open('', '_blank')
    const body = docs.map(d => `<div class="page"><pre>${d.corpo.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></div>`).join('')
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Documentos</title>
<style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.9;color:#000}.page{width:210mm;min-height:297mm;padding:35mm 25mm;page-break-after:always}pre{white-space:pre-wrap;word-break:break-word;font-family:inherit}@media print{@page{size:A4;margin:0}}</style></head>
<body>${body}<script>window.onload=()=>window.print()<\/script></body></html>`)
    win.document.close()
    onClose()
  }

  const criarLink = async () => {
    const docs = gerarDocs()
    if (!docs.length) { showToast('Selecione ao menos um documento.', 'error'); return }
    try {
      const req = await createRequest({
        processId: process.id, clientId: client?.id, clientName: client?.name,
        clientPhone: client?.phone, documentos: docs, modo: 'link',
      })
      showToast('Link de assinatura gerado.', 'success')
      onCreated(req)
      onClose()
    } catch (e) { showToast('Erro ao gerar link: ' + (e.message || ''), 'error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Selecione o que será gerado</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 max-h-[55vh] overflow-y-auto space-y-4">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Petições</p>
            <div className="space-y-1.5">
              {peticoes.map(p => (
                <label key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer">
                  <input type="checkbox" checked={!!sel[`pet:${p.id}`]} onChange={() => toggle(`pet:${p.id}`)} />
                  <span className="text-sm text-[var(--text-primary)]">{p.titulo}</span>
                </label>
              ))}
            </div>
          </div>
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Modelos de documento</p>
              <div className="space-y-1.5">
                {templates.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer">
                    <input type="checkbox" checked={!!sel[`tpl:${t.id}`]} onChange={() => toggle(`tpl:${t.id}`)} />
                    <span className="text-sm text-[var(--text-primary)]">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {!client && <p className="text-xs text-amber-400">⚠️ Processo sem cliente vinculado — os dados não serão preenchidos automaticamente.</p>}
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={printAll} disabled={!anySelected}>🖨️ Imprimir agora</Button>
          <Button variant="primary" size="sm" onClick={criarLink} disabled={!anySelected}>🔗 Gerar link de assinatura</Button>
        </div>
      </div>
    </div>
  )
}

// ── Detalhe de um pedido assinado ───────────────────────────────────────────
function RequestCard({ req, onDelete }) {
  const { showToast } = useUiStore()
  const [open, setOpen] = useState(false)
  const link = signLink(req.id)
  const assinado = req.status === 'assinado'

  const copyLink = () => { navigator.clipboard.writeText(link); showToast('Link copiado.', 'success') }
  const wa = () => {
    const msg = `Olá ${req.clientName || ''}! Segue o link para assinar seus documentos no escritório:\n${link}\n\nCódigo de validação: ${req.validationCode}`
    window.open(whatsappLink(req.clientPhone, msg), '_blank')
  }

  return (
    <Card className={`p-4 ${assinado ? 'border-emerald-500/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${assinado ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {assinado ? '✅ Assinado' : '⏳ Pendente'}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{req.documentos.length} documento(s)</span>
            <span className="text-[10px] text-[var(--text-muted)]">Cód. {req.validationCode}</span>
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)] mt-1">{req.documentos.map(d => d.titulo).join(', ')}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Criado em {fmtDate(req.createdAt)}{assinado && ` · assinado em ${fmtDate(req.signedAt)}`}</p>
        </div>
        <button onClick={() => onDelete(req.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs flex-shrink-0">✕</button>
      </div>

      {!assinado && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={wa}>💬 Enviar no WhatsApp</Button>
          <Button variant="secondary" size="sm" onClick={copyLink}>🔗 Copiar link</Button>
          <Button variant="secondary" size="sm" onClick={() => window.open(link, '_blank')}>Abrir p/ assinar</Button>
        </div>
      )}

      {assinado && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(o => !o)} className="text-xs text-brand-500 hover:underline">{open ? 'Ocultar' : 'Ver comprovação'}</button>
            <button onClick={() => imprimirComprovante(req)} className="text-xs px-2 py-1 rounded-md bg-brand-500/15 text-accent-400 hover:bg-brand-500/25">📄 Comprovante (PDF)</button>
          </div>
          {open && (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] mb-1">Assinatura de {req.signer?.nome}</p>
                  {req.signatureImg && <img src={req.signatureImg} alt="assinatura" className="bg-white rounded-lg border border-[var(--border)] w-full" />}
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">CPF: {req.signer?.cpf}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] mb-1">Foto de comprovação</p>
                  {req.photoImg && <img src={req.photoImg} alt="comprovação" className="rounded-lg border border-[var(--border)] w-full max-h-40 object-cover" />}
                </div>
              </div>
              {/* Trilha de auditoria */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-2.5 space-y-1 text-[10px] text-[var(--text-muted)]">
                <p><b className="text-[var(--text-secondary)]">Hash SHA-256:</b> <span className="break-all font-mono">{req.documentHash || '—'}</span></p>
                <p><b className="text-[var(--text-secondary)]">IP:</b> {req.evidencias?.ip || '—'} · <b className="text-[var(--text-secondary)]">Localização:</b> {req.evidencias?.geo ? `${req.evidencias.geo.lat.toFixed(4)}, ${req.evidencias.geo.lon.toFixed(4)}` : 'não autorizada'}</p>
                <p><b className="text-[var(--text-secondary)]">Dispositivo:</b> {req.evidencias?.userAgent || '—'}</p>
                <p><b className="text-[var(--text-secondary)]">Consentimento LGPD:</b> {req.consent ? 'aceito ✔' : 'não registrado'} · <b className="text-[var(--text-secondary)]">Assinado:</b> {fmtDate(req.signedAt)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Tab principal ───────────────────────────────────────────────────────────
export default function AssinaturasTab({ process }) {
  const [client, setClient] = useState(null)
  const [reqs, setReqs] = useState([])
  const [nova, setNova] = useState(false)

  useEffect(() => {
    if (process.clientId) api.clients.get(process.clientId).then(setClient).catch(() => setClient(null))
  }, [process.clientId])

  const refresh = () => getRequestsByProcess(process.id).then(setReqs).catch(() => setReqs([]))
  useEffect(() => { refresh() }, [process.id])
  const onDelete = async (id) => { await deleteRequest(id).catch(() => {}); refresh() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Gere documentos dos modelos e colete a assinatura do cliente (impressa ou por link/WhatsApp).</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setNova(true)}>+ Nova coleta</Button>
      </div>

      {reqs.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-[var(--border)] rounded-xl">
          <p className="text-3xl mb-2">✍️</p>
          <p className="text-sm text-[var(--text-muted)]">Nenhuma coleta de assinatura ainda.</p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => setNova(true)}>Criar primeira coleta</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reqs.map(r => <RequestCard key={r.id} req={r} onDelete={onDelete} />)}
        </div>
      )}

      {nova && <NovaColeta process={process} client={client} onCreated={refresh} onClose={() => { setNova(false); refresh() }} />}
    </div>
  )
}
