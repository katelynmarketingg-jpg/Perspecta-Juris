import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { formatCpf, formatCnpj, formatPhone, formatCep, formatCurrency, formatDate } from '../../lib/format'
import { MARITAL_STATUS, STATES_BR, LEAD_SOURCES, LEGAL_AREAS } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { Button, Input, Select, Textarea, Card, Spinner } from '../../components/ui'
import { getTemplates, buildVars, renderTemplate } from '../../lib/templateEngine'
import { getPeticoes } from '../../lib/peticoesModels'
import { whatsappLink } from '../../lib/signatures'
import { printDocumentos } from '../../lib/printDoc'
import { registrar } from '../../lib/auditLog'

const FORMAS_PGTO = [
  { value: 'avista',    label: 'À vista',              icone: '💵' },
  { value: 'parcelado', label: 'Parcelado (boletos)',  icone: '🧾' },
  { value: 'link',      label: 'Link de pagamento',    icone: '🔗' },
]
const METODOS_RECEB = [
  { value: 'pix',           label: 'PIX' },
  { value: 'boleto',        label: 'Boleto' },
  { value: 'cartao',        label: 'Cartão' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
]
const metodoLabel = v => METODOS_RECEB.find(m => m.value === v)?.label ?? v

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v)  => localStorage.setItem(k, JSON.stringify(v))
const uid   = () => Math.random().toString(36).slice(2,9) + Math.random().toString(36).slice(2,9)

const empty = {
  type: 'person', name: '', cpfCnpj: '', rg: '', birthDate: '', nationality: 'Brasileira',
  maritalStatus: '', profession: '', email: '', phone: '', phoneSecondary: '',
  addressStreet: '', addressNumber: '', addressComplement: '', addressDistrict: '',
  addressCity: '', addressState: '', addressZip: '',
  companyName: '', fantasyName: '', representativeName: '', representativeCpf: '', representativePhone: '',
  bankName: '', bankAgency: '', bankAccount: '', bankPixKey: '',
  source: '', notes: '', isActive: true,
}

const AREA_LABEL  = (a) => LEGAL_AREAS.find(x => x.value === a)?.label ?? a
const STATUS_LABEL    = { active:'Ativo', won:'Ganho', lost:'Perdido', settled:'Acordo', archived:'Arquivado' }
const FIN_STATUS_LABEL= { pending:'Pendente', paid:'Pago', overdue:'Vencido', cancelled:'Cancelado' }

// ── Print preview ─────────────────────────────────────────────────
function PrintPreview({ text, templateName, onClose }) {
  const handlePrint = () => printDocumentos([text], { titulo: templateName })
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-3xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Preview — {templateName}</p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handlePrint}>🖨️ Imprimir / PDF</Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-white text-black rounded-lg shadow-inner p-8 min-h-96" style={{fontFamily:"'Times New Roman',serif",fontSize:'12pt',lineHeight:'1.8'}}>
            <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontFamily:'inherit',fontSize:'inherit',lineHeight:'inherit'}}>{text}</pre>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
          <Button variant="primary" size="sm" onClick={handlePrint}>🖨️ Imprimir</Button>
        </div>
      </div>
    </div>
  )
}

// ── Document print modal ──────────────────────────────────────────
function PrintDocModal({ client, processes, onClose }) {
  // Junta TODOS os modelos: documentos (templateEngine) + petições (banco de Modelos)
  const modelos = [
    ...getTemplates().map(t => ({ id: 'tpl:' + t.id, name: t.name, body: t.body, group: 'Documentos', category: t.category })),
    ...getPeticoes().map(p => ({ id: 'pet:' + p.id, name: p.titulo, body: p.corpo, group: 'Petições', category: p.categoria })),
  ]
  const grupos = ['Documentos', 'Petições']
  const [selected, setSelected] = useState({})   // { [id]: true }
  const [processId, setProcessId] = useState('')
  const [busca, setBusca] = useState('')
  const [preview, setPreview] = useState(null)
  const storedUser   = lsGet('pj_auth', {})?.state?.user ?? lsGet('pj_user', null)
  const storedTenant = lsGet('pj_auth', {})?.state?.tenant ?? lsGet('pj_tenant', null)

  const toggle = (mid) => setSelected(s => ({ ...s, [mid]: !s[mid] }))
  const escolhidos = modelos.filter(m => selected[m.id])
  const filtro = busca.trim().toLowerCase()
  const listaFiltrada = (g) => modelos.filter(m => m.group === g && (!filtro || m.name.toLowerCase().includes(filtro)))

  const generate = () => {
    if (!escolhidos.length) return
    const proc = processes.find(p => p.id === processId) ?? null
    const vars = buildVars(client, proc, storedUser, storedTenant)
    if (escolhidos.length === 1) {
      setPreview({ text: renderTemplate(escolhidos[0].body, vars), name: escolhidos[0].name })
      return
    }
    // vários → imprime juntos (uma página cada) com logo/timbrado
    printDocumentos(escolhidos.map(m => renderTemplate(m.body, vars)), { titulo: 'Documentos' })
    onClose()
  }

  if (preview) return <PrintPreview text={preview.text} templateName={preview.name} onClose={() => setPreview(null)} />

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Gerar documento(s)</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar modelo..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />

          <div className="max-h-64 overflow-y-auto space-y-3 -mr-1 pr-1">
            {grupos.map(g => listaFiltrada(g).length > 0 && (
              <div key={g}>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">{g}</p>
                <div className="space-y-1">
                  {listaFiltrada(g).map(m => (
                    <label key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer">
                      <input type="checkbox" checked={!!selected[m.id]} onChange={() => toggle(m.id)} className="accent-brand-500" />
                      <span className="text-sm text-[var(--text-primary)]">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {modelos.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-4">Nenhum modelo cadastrado.</p>}
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Processo <span className="text-[var(--text-muted)]">(opcional)</span></p>
            <select value={processId} onChange={e => setProcessId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none">
              <option value="">Nenhum processo</option>
              {processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{escolhidos.length} selecionado(s) · dados de {client.name || 'cliente'} preenchidos automaticamente.</p>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={generate} disabled={!escolhidos.length}>Gerar {escolhidos.length > 1 ? `${escolhidos.length} docs` : ''} →</Button>
        </div>
      </div>
    </div>
  )
}

// ── Cobrar via WhatsApp (PIX / cartão / boleto) ───────────────────
function CobrarModal({ entry, client, onClose }) {
  const { showToast } = useUiStore()
  const office = lsGet('pj_local_office', {})
  const [metodo, setMetodo] = useState('pix')
  const [pixKey, setPixKey] = useState(office.pixKey ?? '')
  const [link, setLink] = useState('')

  const valor = formatCurrency(entry.amount ?? 0)
  const venc = entry.dueDate ? formatDate(entry.dueDate) : null
  const nome = (client.name || '').split(' ')[0]

  const montarMensagem = () => {
    const cab = `Olá ${nome ? nome : ''}! Segue a cobrança referente a: ${entry.description}\n💰 Valor: ${valor}${venc ? `\n📅 Vencimento: ${venc}` : ''}`
    if (metodo === 'pix') {
      return `${cab}\n\n🔑 *Pagamento via PIX*\nChave: ${pixKey || '(configure a chave PIX nas Configurações)'}\n\nApós o pagamento, por favor envie o comprovante. Obrigado!`
    }
    if (metodo === 'cartao') {
      return `${cab}\n\n💳 *Pagamento com cartão de crédito*\nAcesse o link: ${link || office.cardLink || '(cole o link de pagamento)'}`
    }
    return `${cab}\n\n🧾 *Boleto bancário*\n${link || '(cole o link ou a linha digitável do boleto)'}`
  }

  const enviar = () => {
    if (metodo === 'pix' && !pixKey.trim()) { showToast('Informe a chave PIX (ou configure em Configurações → Escritório).', 'error'); return }
    if (metodo !== 'pix' && !link.trim() && !(metodo === 'cartao' && office.cardLink)) { showToast('Cole o link de pagamento.', 'error'); return }
    if (!client.phone) { showToast('Cliente sem telefone/WhatsApp cadastrado.', 'error'); return }
    window.open(whatsappLink(client.phone, montarMensagem()), '_blank')
    onClose()
  }

  const opt = (v, ic, label) => (
    <button onClick={() => setMetodo(v)}
      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${metodo === v ? 'border-brand-500 bg-brand-500/10 text-accent-400' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-brand-500/40'}`}>
      <span className="text-xl">{ic}</span><span className="text-xs font-medium">{label}</span>
    </button>
  )
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Cobrar via WhatsApp</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-[var(--bg-hover)] p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">{entry.description}</p>
            <p className="text-xs text-[var(--text-muted)]">{valor}{venc ? ` · vence ${venc}` : ''} · para {client.phone || 'sem telefone'}</p>
          </div>
          <div className="flex gap-2">
            {opt('pix', '🔑', 'PIX')}
            {opt('cartao', '💳', 'Cartão')}
            {opt('boleto', '🧾', 'Boleto')}
          </div>
          {metodo === 'pix' && (
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Chave PIX de recebimento</label>
              <input value={pixKey} onChange={e => setPixKey(e.target.value)} className={inputCls} placeholder="CNPJ, e-mail, telefone..." />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Padrão vem de Configurações → Escritório.</p>
            </div>
          )}
          {metodo !== 'pix' && (
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{metodo === 'cartao' ? 'Link de pagamento (cartão)' : 'Link / linha digitável do boleto'}</label>
              <input value={link} onChange={e => setLink(e.target.value)} className={inputCls} placeholder={metodo === 'cartao' ? (office.cardLink || 'https://...') : 'https://... ou 00190.00009...'} />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Com o Asaas integrado, este link é gerado automaticamente.</p>
            </div>
          )}
          <div className="rounded-lg border border-[var(--border)] p-3 bg-[var(--bg-input)]">
            <p className="text-[10px] text-[var(--text-muted)] mb-1">Prévia da mensagem:</p>
            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{montarMensagem()}</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={enviar}>💬 Enviar no WhatsApp</Button>
        </div>
      </div>
    </div>
  )
}

// ── Gera o corpo textual de um boleto/recibo para impressão ───────
function corpoBoleto(entry, client, office) {
  return [
    'RECIBO / COBRANÇA',
    '',
    `Sacado: ${client.name || '—'}`,
    client.cpfCnpj ? `CPF/CNPJ: ${client.cpfCnpj}` : null,
    '',
    `Referente a: ${entry.description}`,
    `Valor: ${formatCurrency(entry.amount ?? 0)}`,
    entry.dueDate ? `Vencimento: ${formatDate(entry.dueDate)}` : null,
    entry.parcela ? `Parcela: ${entry.parcela.num} de ${entry.parcela.total}` : null,
    '',
    'FORMA DE PAGAMENTO',
    office.pixKey ? `PIX: ${office.pixKey}` : null,
    entry.paymentLink ? `Link de pagamento: ${entry.paymentLink}` : null,
    office.bankName ? `Banco: ${office.bankName}${office.bankAgency ? ` · Ag. ${office.bankAgency}` : ''}${office.bankAccount ? ` · C/C ${office.bankAccount}` : ''}` : null,
    '',
    `Emitido em ${new Date().toLocaleDateString('pt-BR')}.`,
  ].filter(l => l !== null).join('\n')
}

// Imprime o(s) boleto(s) de um lançamento — se for parcela, imprime o grupo todo.
function imprimirBoletos(entry, client) {
  const office = lsGet('pj_local_office', {})
  const all = lsGet('pj_local_financial_entries', [])
  const grupo = entry.groupId ? all.filter(f => f.groupId === entry.groupId) : [entry]
  const corpos = grupo.sort((a, b) => (a.parcela?.num ?? 0) - (b.parcela?.num ?? 0)).map(e => corpoBoleto(e, client, office))
  printDocumentos(corpos, { titulo: `Boleto — ${client.name || ''}` })
}

// ── Dar baixa (registrar recebimento) ─────────────────────────────
function BaixaModal({ entry, clientName, onDone, onClose }) {
  const { showToast } = useUiStore()
  const [metodo, setMetodo] = useState(entry.receivedVia ?? entry.paymentMethod ?? 'pix')
  const [dataReceb, setDataReceb] = useState(new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState(entry.receivedAmount ?? entry.amount ?? '')

  const confirmar = () => {
    const v = parseFloat(String(valor).replace(',', '.')) || (entry.amount ?? 0)
    onDone(entry.id, { status: 'paid', paidAt: new Date(dataReceb + 'T12:00:00').toISOString(), receivedVia: metodo, receivedAmount: v, needsReview: false })
    registrar('pagamento', `deu baixa no pagamento "${entry.description}" (${formatCurrency(v)} · via ${metodoLabel(metodo)})`, { cliente: clientName, entryId: entry.id })
    showToast('Baixa registrada.', 'success')
    onClose()
  }
  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Dar baixa no pagamento</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="rounded-lg bg-[var(--bg-hover)] p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">{entry.description}</p>
            <p className="text-xs text-[var(--text-muted)]">Valor previsto: {formatCurrency(entry.amount ?? 0)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Como entrou</label>
              <select value={metodo} onChange={e => setMetodo(e.target.value)} className={inputCls}>
                {METODOS_RECEB.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Data</label>
              <input type="date" value={dataReceb} onChange={e => setDataReceb(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Valor recebido (R$)</label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={confirmar}>✓ Confirmar baixa</Button>
        </div>
      </div>
    </div>
  )
}

// ── Criar / editar lançamento ─────────────────────────────────────
function PaymentModal({ clientId, clientName, processes, entry, onSaved, onClose }) {
  const { showToast } = useUiStore()
  const editing = !!entry
  const [form, setForm] = useState(() => ({
    type: entry?.type ?? 'receivable',
    description: entry?.description ?? '',
    amount: entry?.amount ?? '',
    dueDate: entry?.dueDate ?? '',
    processId: entry?.processId ?? '',
    status: entry?.status ?? 'pending',
    formaPagamento: entry?.formaPagamento ?? 'avista',
    paymentMethod: entry?.paymentMethod ?? 'pix',
    parcelas: entry?.parcela?.total ?? 2,
    paymentLink: entry?.paymentLink ?? '',
    notes: entry?.notes ?? '',
  }))
  const set = f => e => setForm(d => ({ ...d, [f]: e?.target ? e.target.value : e }))

  const valorNum = parseFloat(String(form.amount).replace(',', '.')) || 0
  const nParc = Math.max(1, parseInt(form.parcelas) || 1)
  const parcelado = form.formaPagamento === 'parcelado' && !editing

  const gerarLink = () => showToast('Integração com Asaas/banco para gerar link automaticamente em breve. Por ora, cole o link manualmente.', 'info', 5000)

  const save = () => {
    if (!form.description || !form.amount) { showToast('Preencha descrição e valor.', 'error'); return }
    const all = lsGet('pj_local_financial_entries', [])
    const base = {
      tenantId: 'tenant_demo', clientId, type: form.type, description: form.description,
      processId: form.processId, status: form.status, formaPagamento: form.formaPagamento,
      paymentMethod: form.paymentMethod, paymentLink: form.paymentLink, notes: form.notes,
      updatedAt: new Date().toISOString(),
    }

    if (editing) {
      const next = all.map(f => f.id === entry.id ? { ...f, ...base, amount: valorNum, dueDate: form.dueDate } : f)
      lsSet('pj_local_financial_entries', next)
      registrar('pagamento', `editou o lançamento "${form.description}" (${formatCurrency(valorNum)})`, { cliente: clientName, entryId: entry.id })
      showToast('Lançamento atualizado.', 'success')
      onSaved(); onClose(); return
    }

    let novos = []
    if (parcelado && nParc > 1) {
      const groupId = 'grp_' + uid()
      const first = form.dueDate ? new Date(form.dueDate + 'T00:00:00') : new Date()
      const centavos = Math.round(valorNum * 100)
      const base_c = Math.floor(centavos / nParc)
      for (let i = 0; i < nParc; i++) {
        const d = new Date(first); d.setMonth(d.getMonth() + i)
        const c = i === nParc - 1 ? centavos - base_c * (nParc - 1) : base_c  // última parcela ajusta centavos
        novos.push({
          id: 'fin_' + uid(), ...base, needsReview: false,
          amount: c / 100, description: `${form.description} (${i + 1}/${nParc})`,
          dueDate: d.toISOString().slice(0, 10), parcela: { num: i + 1, total: nParc }, groupId,
          createdAt: new Date().toISOString(),
        })
      }
    } else {
      novos.push({ id: 'fin_' + uid(), ...base, needsReview: false, amount: valorNum, dueDate: form.dueDate, createdAt: new Date().toISOString() })
    }
    lsSet('pj_local_financial_entries', [...all, ...novos])
    registrar('pagamento', `criou ${novos.length > 1 ? `${novos.length} parcelas de` : 'o lançamento'} "${form.description}" (${formatCurrency(valorNum)})`, { cliente: clientName, entryId: novos[0].id })
    showToast(novos.length > 1 ? `${novos.length} parcelas criadas.` : 'Lançamento criado.', 'success')
    onSaved(); onClose()
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none'
  const lbl = 'text-xs font-medium text-[var(--text-secondary)] mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{editing ? 'Editar lançamento' : 'Criar lançamento'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.type} onChange={set('type')} className={inputCls}>
                <option value="receivable">A receber</option>
                <option value="payable">A pagar</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descrição *</label>
            <input value={form.description} onChange={set('description')} placeholder="Ex: Honorários advocatícios" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor total (R$) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className={lbl}>{parcelado ? '1º vencimento' : 'Vencimento'}</label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')} className={inputCls} />
            </div>
          </div>

          {/* Forma de pagamento */}
          <div>
            <label className={lbl}>Forma de pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_PGTO.map(fp => (
                <button key={fp.value} type="button" onClick={() => set('formaPagamento')(fp.value)}
                  disabled={editing && fp.value === 'parcelado'}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition-colors ${form.formaPagamento === fp.value ? 'border-brand-500 bg-brand-500/10 text-accent-400' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-brand-500/40'} ${editing && fp.value === 'parcelado' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <span className="text-lg">{fp.icone}</span><span className="text-[10px] font-medium leading-tight">{fp.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parcelamento */}
          {parcelado && (
            <div className="rounded-xl border border-[var(--border)] p-3 space-y-2 bg-[var(--bg-input)]">
              <div className="flex items-center gap-3">
                <label className="text-xs text-[var(--text-secondary)]">Nº de boletos</label>
                <input type="number" min="2" max="48" value={form.parcelas} onChange={set('parcelas')}
                  className="w-20 px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" />
                {valorNum > 0 && <span className="text-xs text-[var(--text-muted)]">≈ {nParc}× de {formatCurrency(valorNum / nParc)}, mensais</span>}
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">Serão criados {nParc} lançamentos, um por mês a partir do 1º vencimento. Você poderá imprimir e enviar cada boleto.</p>
            </div>
          )}

          {/* Link de pagamento */}
          {form.formaPagamento === 'link' && (
            <div>
              <label className={lbl}>Link de pagamento</label>
              <div className="flex gap-2">
                <input value={form.paymentLink} onChange={set('paymentLink')} placeholder="https://... (link do banco/Asaas)" className={inputCls} />
                <Button variant="secondary" size="sm" onClick={gerarLink} className="whitespace-nowrap">Gerar</Button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Espaço reservado para gerar o link automaticamente via Asaas / banco.</p>
            </div>
          )}

          {/* Como será recebido */}
          <div>
            <label className={lbl}>Meio de recebimento</label>
            <select value={form.paymentMethod} onChange={set('paymentMethod')} className={inputCls}>
              {METODOS_RECEB.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Vínculo com processo */}
          <div>
            <label className={lbl}>Processo vinculado</label>
            <select value={form.processId} onChange={set('processId')} className={inputCls}>
              <option value="">Nenhum</option>
              {processes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="rounded-lg bg-[var(--bg-hover)] p-2.5">
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">🔌 Espaço reservado para integração com o <b>Asaas</b> (emissão automática de boletos e conciliação).</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={save}>{editing ? 'Salvar' : parcelado ? `Criar ${nParc} boletos` : 'Criar'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Documents section ─────────────────────────────────────────────
function DocumentsSection({ clientId, client, processes }) {
  const { showToast } = useUiStore()
  const FOLDERS_KEY = `pj_folders_${clientId}`
  const DOCS_KEY    = `pj_docs_${clientId}`

  const [folders,  setFolders]  = useState(() => lsGet(FOLDERS_KEY, [{ id: 'root', name: 'Geral', color: '#6366f1' }]))
  const [docs,     setDocs]     = useState(() => lsGet(DOCS_KEY, []))
  const [dragging, setDragging] = useState(null)
  const [over,     setOver]     = useState(null)
  const [newFolder,setNewFolder]= useState(false)
  const [folderName,setFolderName] = useState('')
  const [printModal,setPrintModal] = useState(false)
  const fileRef = useRef()

  const saveFolders = f => { setFolders(f); lsSet(FOLDERS_KEY, f) }
  const saveDocs    = d => { setDocs(d);    lsSet(DOCS_KEY, d) }

  const createFolder = () => {
    if (!folderName.trim()) return
    const f = { id: uid(), name: folderName.trim(), color: '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0') }
    saveFolders([...folders, f])
    setFolderName(''); setNewFolder(false)
    showToast(`Pasta "${f.name}" criada.`, 'success')
  }

  const uploadFile = e => {
    const files = [...(e.target.files ?? [])]
    const newDocs = files.map(f => ({ id: uid(), name: f.name, size: f.size, type: f.type, folderId: 'root', uploadedAt: new Date().toISOString() }))
    saveDocs([...docs, ...newDocs])
    showToast(`${files.length} arquivo${files.length!==1?'s':''} adicionado${files.length!==1?'s':''}.`, 'success')
    e.target.value = ''
  }

  const deleteFolder = id => {
    if (id === 'root') return
    saveDocs(docs.map(d => d.folderId === id ? { ...d, folderId: 'root' } : d))
    saveFolders(folders.filter(f => f.id !== id))
  }

  const moveDoc = (docId, folderId) => { saveDocs(docs.map(d => d.id === docId ? { ...d, folderId } : d)); setDragging(null); setOver(null) }
  const fmtSize = b => b >= 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${Math.round(b/1000)} KB`
  const fileIcon = t => t?.includes('pdf') ? '📄' : t?.includes('image') ? '🖼️' : t?.includes('word') ? '📝' : '📎'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>⬆️ Enviar arquivo</Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={uploadFile} />
        <Button variant="secondary" size="sm" onClick={() => setNewFolder(true)}>📁 Nova pasta</Button>
        <Button variant="primary" size="sm" onClick={() => setPrintModal(true)}>🖨️ Gerar documento</Button>
      </div>

      {newFolder && (
        <div className="flex items-center gap-2">
          <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') createFolder(); if (e.key==='Escape') setNewFolder(false) }}
            placeholder="Nome da pasta"
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] border border-brand-500 text-sm text-[var(--text-primary)] focus:outline-none" />
          <Button variant="primary" size="sm" onClick={createFolder}>Criar</Button>
          <button onClick={() => setNewFolder(false)} className="text-xs text-[var(--text-muted)]">Cancelar</button>
        </div>
      )}

      <div className="space-y-3">
        {folders.map(folder => {
          const folderDocs = docs.filter(d => d.folderId === folder.id)
          const isOver = over === folder.id
          return (
            <div key={folder.id}
              onDragOver={e => { e.preventDefault(); setOver(folder.id) }}
              onDragLeave={() => setOver(null)}
              onDrop={e => { e.preventDefault(); if (dragging) moveDoc(dragging, folder.id) }}
              className={`rounded-xl border transition-all ${isOver ? 'border-brand-500 bg-brand-500/5' : 'border-[var(--border)] bg-[var(--bg-card)]'}`}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span style={{ color: folder.color }}>📁</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{folder.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-full">{folderDocs.length}</span>
                </div>
                {folder.id !== 'root' && (
                  <button onClick={() => deleteFolder(folder.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs transition-colors">Excluir</button>
                )}
              </div>
              <div className="p-3">
                {folderDocs.length === 0 ? (
                  <p className="text-center py-4 text-xs text-[var(--text-muted)]">
                    {isOver ? 'Solte aqui para mover' : 'Nenhum arquivo — arraste aqui ou envie acima'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {folderDocs.map(doc => (
                      <div key={doc.id} draggable
                        onDragStart={() => setDragging(doc.id)}
                        onDragEnd={() => { setDragging(null); setOver(null) }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-grab transition-all ${dragging===doc.id?'opacity-40 border-brand-500':'border-[var(--border)] hover:border-brand-500/40 hover:bg-[var(--bg-hover)]'}`}>
                        <span className="text-xl flex-shrink-0">{fileIcon(doc.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{doc.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{doc.size ? fmtSize(doc.size) : ''} · {formatDate(doc.uploadedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {printModal && <PrintDocModal client={client} processes={processes} onClose={() => setPrintModal(false)} />}
    </div>
  )
}

// ── Área de Trabalho (cálculos, teses, modelos salvos por cliente) ──
function WorkspaceSection({ clientId, client, processes }) {
  const { showToast } = useUiStore()
  const navigate = useNavigate()
  const currentUser = useAuthStore(s => s.user)?.name || 'Usuário'
  const storedTenant = lsGet('pj_auth', {})?.state?.tenant ?? null
  const KEY = `pj_workspace_${clientId}`
  const [ws, setWs] = useState(() => lsGet(KEY, { calculos: [], teses: [], modelos: [] }))
  const [picker, setPicker] = useState(null) // 'calculo' | 'tese' | 'modelo'
  const [preview, setPreview] = useState(null)

  const save = (next) => { setWs(next); lsSet(KEY, next) }
  const addItem = (tipo, item) => save({ ...ws, [tipo]: [{ ...item, id: uid(), addedAt: new Date().toISOString(), addedBy: currentUser }, ...ws[tipo]] })
  const delItem = (tipo, id) => save({ ...ws, [tipo]: ws[tipo].filter(x => x.id !== id) })

  const gerarModelo = (modelo) => {
    const tpl = getTemplates().find(t => t.id === modelo.templateId)
    if (!tpl) { showToast('Modelo não encontrado.', 'error'); return }
    const vars = buildVars(client, processes[0] ?? null, lsGet('pj_auth', {})?.state?.user ?? null, storedTenant)
    setPreview({ text: renderTemplate(tpl.body, vars), name: tpl.name })
  }

  if (preview) return <PrintPreview text={preview.text} templateName={preview.name} onClose={() => setPreview(null)} />

  const calcHistory = lsGet('pj_calc_history', [])
  const teses = lsGet('pj_local_theses', [])
  const templates = getTemplates()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Área de Trabalho</h2>
        <p className="text-xs text-[var(--text-muted)]">Cálculos, teses e modelos salvos para {client.name || 'este cliente'}.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cálculos */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">🧮 Cálculos salvos</h3>
            <button onClick={() => setPicker('calculo')} className="text-xs text-brand-500 hover:underline">+ Vincular</button>
          </div>
          <div className="space-y-2 flex-1">
            {ws.calculos.length === 0
              ? <p className="text-xs text-[var(--text-muted)] py-4 text-center">Nenhum cálculo vinculado.</p>
              : ws.calculos.map(c => (
                <div key={c.id} className="rounded-lg border border-[var(--border)] p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{c.titulo}</p>
                      <p className="text-xs text-brand-400 font-mono">{c.valor}</p>
                    </div>
                    <button onClick={() => delItem('calculos', c.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{c.ramo} · por {c.addedBy} · {formatDate(c.addedAt)}</p>
                </div>
              ))}
          </div>
          <button onClick={() => navigate('/app/calculator')} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mt-3">Abrir Calculadora →</button>
        </Card>

        {/* Teses */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">📚 Teses usadas</h3>
            <button onClick={() => setPicker('tese')} className="text-xs text-brand-500 hover:underline">+ Adicionar</button>
          </div>
          <div className="space-y-2 flex-1">
            {ws.teses.length === 0
              ? <p className="text-xs text-[var(--text-muted)] py-4 text-center">Nenhuma tese vinculada.</p>
              : ws.teses.map(t => (
                <div key={t.id} className="rounded-lg border border-[var(--border)] p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t.titulo}</p>
                    <button onClick={() => delItem('teses', t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                  {t.resumo && <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{t.resumo}</p>}
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">por {t.addedBy} · {formatDate(t.addedAt)}</p>
                </div>
              ))}
          </div>
          <button onClick={() => navigate('/app/theses')} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mt-3">Abrir Teses →</button>
        </Card>

        {/* Modelos */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">📄 Modelos prontos</h3>
            <button onClick={() => setPicker('modelo')} className="text-xs text-brand-500 hover:underline">+ Adicionar</button>
          </div>
          <div className="space-y-2 flex-1">
            {ws.modelos.length === 0
              ? <p className="text-xs text-[var(--text-muted)] py-4 text-center">Nenhum modelo vinculado.</p>
              : ws.modelos.map(m => (
                <div key={m.id} className="rounded-lg border border-[var(--border)] p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{m.nome}</p>
                    <button onClick={() => delItem('modelos', m.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                  <button onClick={() => gerarModelo(m)} className="text-xs text-brand-500 hover:underline mt-2">🖨️ Gerar com dados do cliente</button>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Pickers */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPicker(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {picker === 'calculo' ? 'Vincular cálculo do histórico' : picker === 'tese' ? 'Vincular tese' : 'Vincular modelo'}
              </p>
              <button onClick={() => setPicker(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {picker === 'calculo' && (calcHistory.length === 0
                ? <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum cálculo no histórico. Faça um na aba Calculadora.</p>
                : calcHistory.map(c => (
                  <button key={c.id} onClick={() => { addItem('calculos', { titulo: c.titulo, ramo: c.ramo, valor: c.headline?.value }); setPicker(null); showToast('Cálculo vinculado.', 'success') }}
                    className="w-full text-left rounded-lg border border-[var(--border)] p-3 hover:border-brand-500/40">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{c.titulo}</p>
                    <p className="text-xs text-brand-400 font-mono">{c.headline?.value}</p>
                  </button>
                )))}
              {picker === 'tese' && (teses.length === 0
                ? <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhuma tese cadastrada. Crie na aba Teses.</p>
                : teses.map(t => (
                  <button key={t.id} onClick={() => { addItem('teses', { titulo: t.title, resumo: t.summary }); setPicker(null); showToast('Tese vinculada.', 'success') }}
                    className="w-full text-left rounded-lg border border-[var(--border)] p-3 hover:border-brand-500/40">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t.title}</p>
                    {t.summary && <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{t.summary}</p>}
                  </button>
                )))}
              {picker === 'modelo' && (templates.length === 0
                ? <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum modelo. Crie em Documentos → Modelos.</p>
                : templates.map(t => (
                  <button key={t.id} onClick={() => { addItem('modelos', { templateId: t.id, nome: t.name }); setPicker(null); showToast('Modelo vinculado.', 'success') }}
                    className="w-full text-left rounded-lg border border-[var(--border)] p-3 hover:border-brand-500/40">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t.name}</p>
                    {t.category && <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.category}</p>}
                  </button>
                )))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarefas + Observações gerais (por cliente) ──────────────────────
function TasksSection({ clientId, clientName, onTasksChange }) {
  const { showToast } = useUiStore()
  const currentUser = useAuthStore(s => s.user)?.name || 'Usuário'
  const TKEY = `pj_ctasks_${clientId}`
  const OKEY = `pj_cobs_${clientId}`
  const FKEY = 'pj_funcionarios'

  const [tasks, setTasks] = useState(() => lsGet(TKEY, []))
  const [obs, setObs]     = useState(() => lsGet(OKEY, []))
  const [funcs, setFuncs] = useState(() => lsGet(FKEY, [currentUser]))
  const [taskForm, setTaskForm] = useState({ titulo: '', descricao: '', para: currentUser })
  const [obsForm, setObsForm]   = useState({ assunto: '', texto: '' })

  const saveTasks = (n) => { setTasks(n); lsSet(TKEY, n); onTasksChange?.() }
  const saveObs   = (n) => { setObs(n);   lsSet(OKEY, n) }
  const rememberFunc = (name) => { if (name && !funcs.includes(name)) { const n = [...funcs, name]; setFuncs(n); lsSet(FKEY, n) } }

  const addTask = () => {
    if (!taskForm.titulo.trim()) { showToast('Informe o título da tarefa.', 'error'); return }
    rememberFunc(taskForm.para.trim())
    saveTasks([{ id: uid(), ...taskForm, de: currentUser, status: 'aberta', createdAt: new Date().toISOString() }, ...tasks])
    setTaskForm({ titulo: '', descricao: '', para: currentUser })
    showToast('Tarefa criada.', 'success')
  }
  const concluirTask = (id) => saveTasks(tasks.map(t => t.id === id ? { ...t, status: 'concluida', concluidoPor: currentUser, concluidoEm: new Date().toISOString() } : t))
  const reabrirTask  = (id) => saveTasks(tasks.map(t => t.id === id ? { ...t, status: 'aberta', concluidoPor: null, concluidoEm: null } : t))
  const delTask = (id) => saveTasks(tasks.filter(t => t.id !== id))

  const addObs = () => {
    if (!obsForm.texto.trim()) { showToast('Escreva a observação.', 'error'); return }
    saveObs([{ id: uid(), ...obsForm, autor: currentUser, createdAt: new Date().toISOString(), concluido: false }, ...obs])
    setObsForm({ assunto: '', texto: '' })
    showToast('Observação adicionada.', 'success')
  }
  const concluirObs = (id) => saveObs(obs.map(o => o.id === id ? { ...o, concluido: true, concluidoPor: currentUser, concluidoEm: new Date().toISOString() } : o))
  const delObs = (id) => saveObs(obs.filter(o => o.id !== id))

  const abertas = tasks.filter(t => t.status !== 'concluida')
  const concluidas = tasks.filter(t => t.status === 'concluida')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Tarefas & Observações</h2>
        <p className="text-xs text-[var(--text-muted)]">Atribuições da equipe e mural de observações de {clientName || 'este cliente'}.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── TAREFAS ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">✅ Tarefas</h3>
          <Card className="p-4 space-y-3">
            <Input label="Título da tarefa" value={taskForm.titulo} onChange={e => setTaskForm(d => ({ ...d, titulo: e.target.value }))} placeholder="Ex: Protocolar petição inicial" />
            <Textarea label="Descrição" rows={2} value={taskForm.descricao} onChange={e => setTaskForm(d => ({ ...d, descricao: e.target.value }))} placeholder="Detalhes da tarefa..." />
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Atribuir para</label>
              <input list="funcs-list" value={taskForm.para} onChange={e => setTaskForm(d => ({ ...d, para: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none" placeholder="Nome do funcionário" />
              <datalist id="funcs-list">{funcs.map(f => <option key={f} value={f} />)}</datalist>
            </div>
            <Button variant="primary" size="sm" className="w-full" onClick={addTask}>Criar tarefa</Button>
          </Card>

          {abertas.length === 0 && concluidas.length === 0 && (
            <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">Nenhuma tarefa ainda.</div>
          )}
          {abertas.map(t => (
            <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t.titulo}</p>
                <button onClick={() => delTask(t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
              </div>
              {t.descricao && <p className="text-xs text-[var(--text-secondary)] mt-1">{t.descricao}</p>}
              <div className="flex items-center justify-between mt-3">
                <p className="text-[10px] text-[var(--text-muted)]">De <b className="text-[var(--text-secondary)]">{t.de}</b> → <b className="text-[var(--text-secondary)]">{t.para}</b> · {formatDate(t.createdAt)}</p>
                <button onClick={() => concluirTask(t.id)} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">Concluir</button>
              </div>
            </div>
          ))}
          {concluidas.map(t => (
            <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-hover)] p-4 opacity-70 group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text-primary)] line-through">{t.titulo}</p>
                <button onClick={() => delTask(t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
              </div>
              <p className="text-[10px] text-emerald-400 mt-2">✔ Concluída por <b>{t.concluidoPor}</b> em {formatDate(t.concluidoEm)}</p>
              <button onClick={() => reabrirTask(t.id)} className="text-[10px] text-[var(--text-muted)] hover:text-brand-500 mt-1">Reabrir</button>
            </div>
          ))}
        </div>

        {/* ── OBSERVAÇÕES ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">📌 Observações gerais</h3>
          <Card className="p-4 space-y-3">
            <Input label="Assunto" value={obsForm.assunto} onChange={e => setObsForm(d => ({ ...d, assunto: e.target.value }))} placeholder="Sobre o que é? Ex: Reunião com cliente" />
            <Textarea label="Observação" rows={3} value={obsForm.texto} onChange={e => setObsForm(d => ({ ...d, texto: e.target.value }))} placeholder="Escreva aqui — todos da equipe podem ver..." />
            <Button variant="primary" size="sm" className="w-full" onClick={addObs}>Adicionar observação</Button>
          </Card>

          {obs.length === 0 && (
            <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">Nenhuma observação ainda.</div>
          )}
          {obs.map(o => (
            <div key={o.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 group">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-accent-400">{formatDate(o.createdAt)}</span>
                {o.assunto && <span className="text-xs font-medium text-[var(--text-primary)]">{o.assunto}</span>}
                <button onClick={() => delObs(o.id)} className="ml-auto text-[var(--text-muted)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{o.texto}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-2">— {o.autor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ClientPage ────────────────────────────────────────────────
export default function ClientPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const isNew = !id

  const [data,      setData]     = useState(empty)
  const [client,    setClient]   = useState(null)
  const [processes, setProcesses]= useState([])
  const [financial, setFinancial]= useState([])
  const [loading,   setLoading]  = useState(!isNew)
  const [saving,    setSaving]   = useState(false)
  const [errors,    setErrors]   = useState({})
  const [showBank,  setShowBank] = useState(false)
  const [payModal,  setPayModal] = useState(false)
  const [editEntry, setEditEntry]= useState(null)
  const [baixaEntry,setBaixaEntry]=useState(null)
  const [cobrar,    setCobrar]   = useState(null)
  const [tab,       setTab]      = useState('cadastro')
  const [openTasks, setOpenTasks]= useState(0)

  const refreshOpenTasks = () => {
    if (!id) return
    const t = lsGet(`pj_ctasks_${id}`, [])
    setOpenTasks(t.filter(x => x.status !== 'concluida').length)
  }

  useEffect(() => {
    if (isNew) return
    Promise.all([api.clients.get(id), api.clients.processes(id)])
      .then(([c, p]) => { setClient(c); setData({ ...empty, ...c }); setProcesses(Array.isArray(p) ? p : []) })
      .catch(() => { showToast('Cliente não encontrado.', 'error'); navigate('/app/clients') })
      .finally(() => setLoading(false))
    const allFin = lsGet('pj_local_financial_entries', [])
    setFinancial(allFin.filter(f => f.clientId === id))
    refreshOpenTasks()
  }, [id])

  const set = (field) => (e) => {
    let v = e?.target ? e.target.value : e
    if (field === 'cpfCnpj') { const d = v.replace(/\D/g,''); v = d.length <= 11 ? formatCpf(d) : formatCnpj(d) }
    if (['phone','phoneSecondary','representativePhone'].includes(field)) v = formatPhone(v)
    if (field === 'addressZip') v = formatCep(v)
    setData(d => ({ ...d, [field]: v }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!data.name?.trim())  e.name  = 'Nome obrigatório.'
    if (!data.phone?.trim()) e.phone = 'Telefone obrigatório.'
    setErrors(e); return Object.keys(e).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { ...data, cpfCnpj: (data.cpfCnpj ?? '').replace(/\D/g,'') }
      if (isNew) {
        const created = await api.clients.create(payload)
        showToast('Cliente cadastrado com sucesso.', 'success')
        navigate(`/app/clients/${created.id}`)
      } else {
        await api.clients.update(id, payload)
        setClient({ ...client, ...data })
        showToast('Salvo.', 'success')
      }
    } catch (err) { showToast(err.message || 'Erro ao salvar.', 'error') }
    finally { setSaving(false) }
  }

  const totalReceived = financial.filter(f => f.type==='receivable' && f.status==='paid').reduce((s,f) => s+(f.amount??0), 0)
  const totalPending  = financial.filter(f => f.type==='receivable' && f.status==='pending').reduce((s,f) => s+(f.amount??0), 0)
  const totalOverdue  = financial.filter(f => f.type==='receivable' && f.status==='overdue').reduce((s,f) => s+(f.amount??0), 0)
  const aOrganizar    = financial.filter(f => f.needsReview).length

  // Persiste alterações de um lançamento (data, status, organizado)
  const updateEntry = (entryId, patch) => {
    const all = lsGet('pj_local_financial_entries', [])
    const next = all.map(f => f.id === entryId ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f)
    lsSet('pj_local_financial_entries', next)
    setFinancial(next.filter(f => f.clientId === id))
  }

  // Recarrega a lista a partir do localStorage (após criar/editar/parcelar)
  const reloadFinancial = () => setFinancial(lsGet('pj_local_financial_entries', []).filter(f => f.clientId === id))

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={32} className="text-brand-500" /></div>

  const displayName = data.name || (isNew ? 'Novo cliente' : '—')

  const TABS = [
    { key: 'cadastro',   label: 'Cadastro' },
    { key: 'processos',  label: 'Processos', count: processes.length, disabled: isNew },
    { key: 'pagamentos', label: 'Pagamentos', count: financial.length, disabled: isNew },
    { key: 'documentos', label: 'Documentos', disabled: isNew },
    { key: 'area',       label: 'Área de Trabalho', disabled: isNew },
    { key: 'tarefas',    label: 'Tarefas', disabled: isNew },
  ]

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] flex-shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/app/clients')} className="text-xs text-[var(--text-muted)] hover:text-brand-500 transition-colors flex-shrink-0">
              ← Clientes
            </button>
            <span className="text-[var(--border)]">/</span>
            <h1 className="text-base font-bold text-[var(--text-primary)] truncate">
              {isNew ? 'Novo Cliente' : displayName}
            </h1>
            {/* PF / PJ toggle */}
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => setData(d=>({...d,type:'person'}))}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium border transition-colors ${data.type==='person'?'bg-blue-500/20 text-blue-300 border-blue-500/40':'text-[var(--text-muted)] border-[var(--border)] hover:border-blue-500/30'}`}>
                PF
              </button>
              <button onClick={() => setData(d=>({...d,type:'company'}))}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium border transition-colors ${data.type==='company'?'bg-purple-500/20 text-purple-300 border-purple-500/40':'text-[var(--text-muted)] border-[var(--border)] hover:border-purple-500/30'}`}>
                PJ
              </button>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={save} loading={saving}>
            {isNew ? 'Cadastrar' : 'Salvar'}
          </Button>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-[var(--border)] px-6 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => !t.disabled && setTab(t.key)}
              disabled={t.disabled}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                t.disabled ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--text-muted)]' :
                tab === t.key ? 'border-brand-500 text-accent-400 font-medium' :
                'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab===t.key?'bg-brand-500/20 text-accent-400':'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                  {t.count}
                </span>
              )}
              {t.key === 'tarefas' && openTasks > 0 && (
                <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-[0_0_6px_rgba(249,115,22,0.6)]" title={`${openTasks} tarefa(s) em aberto`}>
                  {openTasks}
                </span>
              )}
              {t.key === 'pagamentos' && aOrganizar > 0 && (
                <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-[0_0_6px_rgba(249,115,22,0.6)]" title={`${aOrganizar} lançamento(s) a organizar`}>
                  {aOrganizar}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-8 py-6 max-w-[1500px]">

            {/* ── CADASTRO ── */}
            {tab === 'cadastro' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

                  {/* Col 1 — Dados Pessoais */}
                  <div className="space-y-4">
                    <Card className="p-5 space-y-3">
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Dados Pessoais</h3>
                      <Input label={data.type==='company'?'Razão Social *':'Nome completo *'} value={data.name} onChange={set('name')} error={errors.name} placeholder={data.type==='company'?'Razão social':'Nome completo'} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label={data.type==='company'?'CNPJ':'CPF'} value={data.cpfCnpj} onChange={set('cpfCnpj')} placeholder={data.type==='company'?'00.000.000/0001-00':'000.000.000-00'} />
                        {data.type==='person'  && <Input label="RG" value={data.rg} onChange={set('rg')} />}
                        {data.type==='company' && <Input label="Nome Fantasia" value={data.fantasyName} onChange={set('fantasyName')} />}
                      </div>
                      {data.type==='person' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <Input label="Nascimento" type="date" value={data.birthDate} onChange={set('birthDate')} />
                            <Select label="Estado Civil" value={data.maritalStatus} onChange={set('maritalStatus')} options={MARITAL_STATUS} placeholder="Selecionar..." />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input label="Profissão" value={data.profession} onChange={set('profession')} />
                            <Input label="Nacionalidade" value={data.nationality} onChange={set('nationality')} />
                          </div>
                        </>
                      )}
                      {data.type==='company' && (
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Representante" value={data.representativeName} onChange={set('representativeName')} />
                          <Input label="CPF Representante" value={data.representativeCpf} onChange={set('representativeCpf')} />
                          <Input label="Tel. Representante" value={data.representativePhone} onChange={set('representativePhone')} />
                        </div>
                      )}
                    </Card>

                    <Card className="p-5 space-y-3">
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Contato</h3>
                      <Input label="Telefone / WhatsApp *" value={data.phone} onChange={set('phone')} error={errors.phone} placeholder="(00) 00000-0000" />
                      <Input label="Telefone 2" value={data.phoneSecondary} onChange={set('phoneSecondary')} placeholder="(00) 00000-0000" />
                      <Input label="E-mail" type="email" value={data.email} onChange={set('email')} />
                      <Select label="Como nos encontrou?" value={data.source} onChange={set('source')} options={LEAD_SOURCES} placeholder="Selecionar..." />
                    </Card>
                  </div>

                  {/* Col 2 — Endereço */}
                  <div className="space-y-4">
                    <Card className="p-5 space-y-3">
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Endereço</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1"><Input label="CEP" value={data.addressZip} onChange={set('addressZip')} placeholder="00000-000" /></div>
                        <div className="col-span-2"><Input label="Logradouro" value={data.addressStreet} onChange={set('addressStreet')} placeholder="Rua, Avenida..." /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Input label="Número" value={data.addressNumber} onChange={set('addressNumber')} />
                        <div className="col-span-2"><Input label="Complemento" value={data.addressComplement} onChange={set('addressComplement')} placeholder="Apto, Sala..." /></div>
                      </div>
                      <Input label="Bairro" value={data.addressDistrict} onChange={set('addressDistrict')} />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><Input label="Cidade" value={data.addressCity} onChange={set('addressCity')} /></div>
                        <Select label="UF" value={data.addressState} onChange={set('addressState')} options={STATES_BR.map(s=>({value:s,label:s}))} placeholder="UF" />
                      </div>
                    </Card>

                    <Card className="p-5">
                      <button onClick={() => setShowBank(!showBank)} className="w-full flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Dados Bancários</h3>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform text-[var(--text-muted)] ${showBank?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {showBank && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <Input label="Banco" value={data.bankName} onChange={set('bankName')} placeholder="Itaú, Bradesco..." />
                          <Input label="Agência" value={data.bankAgency} onChange={set('bankAgency')} placeholder="0000" />
                          <Input label="Conta" value={data.bankAccount} onChange={set('bankAccount')} placeholder="00000-0" />
                          <Input label="Chave PIX" value={data.bankPixKey} onChange={set('bankPixKey')} placeholder="CPF, e-mail..." />
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Col 3 — Observações */}
                  <div className="space-y-4 md:col-span-2 xl:col-span-1">
                    <Card className="p-5 space-y-3 h-full flex flex-col">
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Observações</h3>
                      <Textarea value={data.notes} onChange={set('notes')} rows={10} className="flex-1" placeholder="Anotações relevantes sobre o cliente, histórico de atendimento, particularidades do caso..." />
                    </Card>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
                  <Button variant="primary" onClick={save} loading={saving}>
                    {isNew ? 'Cadastrar Cliente' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            )}

            {/* ── PROCESSOS ── */}
            {tab === 'processos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Processos</h2>
                    <p className="text-xs text-[var(--text-muted)]">{processes.length} processo{processes.length!==1?'s':''} vinculado{processes.length!==1?'s':''} a este cliente</p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => navigate(`/app/processes/new?clientId=${id}`)}>
                    + Novo processo
                  </Button>
                </div>
                {processes.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-[var(--border)] rounded-xl">
                    <p className="text-4xl mb-3">⚖️</p>
                    <p className="text-sm text-[var(--text-muted)]">Nenhum processo cadastrado</p>
                    <Button variant="primary" size="sm" className="mt-4" onClick={() => navigate(`/app/processes/new?clientId=${id}`)}>
                      Cadastrar primeiro processo
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {processes.map(p => (
                      <div key={p.id} onClick={() => navigate(`/app/processes/${p.id}`)}
                        className="flex flex-col p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-brand-500/40 cursor-pointer transition-all group">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            p.status==='active'?'bg-blue-500/10 text-blue-400 border-blue-500/20':
                            p.status==='won'?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':
                            p.status==='lost'?'bg-red-500/10 text-red-400 border-red-500/20':
                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>{STATUS_LABEL[p.status]??p.status}</span>
                          {p.area && <span className="text-[10px] text-[var(--text-muted)]">{AREA_LABEL(p.area)}</span>}
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-brand-400 transition-colors line-clamp-2">{p.title}</p>
                        {p.judicialNumber && <p className="font-mono text-[10px] text-[var(--text-muted)] mt-1">{p.judicialNumber}</p>}
                        {p.court && <p className="text-xs text-[var(--text-muted)] mt-1">{p.court}{p.courtDistrict?` — ${p.courtDistrict}`:''}</p>}
                        <div className="flex items-center gap-1 text-xs text-brand-500 mt-3 pt-3 border-t border-[var(--border)] group-hover:gap-2 transition-all">
                          Abrir processo <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAGAMENTOS ── */}
            {tab === 'pagamentos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna principal — lançamentos */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">Lançamentos</h2>
                      <p className="text-xs text-[var(--text-muted)]">{financial.length} lançamento{financial.length!==1?'s':''}</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => setPayModal(true)}>+ Novo lançamento</Button>
                  </div>
                  {aOrganizar > 0 && (
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-orange-300">🟠 <b>{aOrganizar}</b> lançamento(s) gerado(s) pelo processo aguardando organização — confira datas/parcelas e gere os boletos.</p>
                      <button onClick={() => financial.filter(f => f.needsReview).forEach(f => updateEntry(f.id, { needsReview: false }))}
                        className="text-xs text-orange-300 hover:underline whitespace-nowrap flex-shrink-0">Marcar todos organizados</button>
                    </div>
                  )}
                  {financial.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl">
                      <p className="text-3xl mb-2">💰</p>
                      <p className="text-sm text-[var(--text-muted)]">Nenhum lançamento</p>
                      <Button variant="primary" size="sm" className="mt-3" onClick={() => setPayModal(true)}>Criar lançamento</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {financial.map(f => (
                        <div key={f.id} className={`p-4 rounded-xl border ${f.needsReview ? 'border-orange-500/40 bg-orange-500/5' : 'border-[var(--border)] bg-[var(--bg-card)]'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${f.needsReview?'bg-orange-500':f.status==='paid'?'bg-emerald-500':f.status==='overdue'?'bg-red-500':f.status==='cancelled'?'bg-gray-500':'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)]">{f.description}</p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                {f.needsReview && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-medium">🟠 A organizar</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${f.status==='paid'?'bg-emerald-500/10 text-emerald-400':f.status==='overdue'?'bg-red-500/10 text-red-400':'bg-amber-500/10 text-amber-400'}`}>
                                  {FIN_STATUS_LABEL[f.status]??f.status}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">{f.type==='receivable'?'A receber':'A pagar'}</span>
                                {f.dueDate && <span className="text-xs text-[var(--text-muted)]">Venc: {formatDate(f.dueDate)}</span>}
                                {f.parcela && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-accent-400">Parcela {f.parcela.num}/{f.parcela.total}</span>}
                                {f.processId && processes.find(p=>p.id===f.processId) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">⚖️ {processes.find(p=>p.id===f.processId).title}</span>}
                                {f.status==='paid' && f.receivedVia && <span className="text-[10px] text-[var(--text-muted)]">via {metodoLabel(f.receivedVia)}</span>}
                              </div>
                            </div>
                            <p className={`text-sm font-bold flex-shrink-0 ${f.status==='paid'?'text-emerald-400':f.status==='overdue'?'text-red-400':'text-[var(--text-primary)]'}`}>
                              {f.type==='payable'?'-':''}{formatCurrency(f.amount??0)}
                            </p>
                          </div>
                          {/* Ações */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)] flex-wrap">
                            <button onClick={() => setEditEntry(f)}
                              className="text-[11px] px-2 py-1 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">✏️ Editar</button>
                            {f.status !== 'paid' && (
                              <button onClick={() => setBaixaEntry(f)}
                                className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">✓ Dar baixa</button>
                            )}
                            {f.status === 'paid' && (
                              <button onClick={() => { updateEntry(f.id, { status: 'pending', paidAt: null, receivedVia: null, receivedAmount: null }); registrar('pagamento', `estornou a baixa de "${f.description}"`, { cliente: data.name, entryId: f.id }) }}
                                className="text-[11px] px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-500/25">↩ Estornar</button>
                            )}
                            <button onClick={() => imprimirBoletos(f, data)}
                              className="text-[11px] px-2 py-1 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">🖨️ Imprimir boleto{f.groupId ? 's' : ''}</button>
                            {f.type !== 'payable' && (
                              <button onClick={() => setCobrar(f)}
                                className="text-[11px] px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30">💬 WhatsApp</button>
                            )}
                            {f.needsReview && (
                              <button onClick={() => updateEntry(f.id, { needsReview: false })}
                                className="text-[11px] px-2 py-1 rounded-md bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 ml-auto">Organizado ✓</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coluna lateral — resumo + banco */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-xs text-emerald-400 mb-0.5">Recebido</p>
                    <p className="text-2xl font-bold text-emerald-300">{formatCurrency(totalReceived)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-xs text-amber-400 mb-0.5">A receber</p>
                    <p className="text-2xl font-bold text-amber-300">{formatCurrency(totalPending)}</p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-xs text-red-400 mb-0.5">Vencido</p>
                    <p className="text-2xl font-bold text-red-300">{formatCurrency(totalOverdue)}</p>
                  </div>
                  {(data.bankName || data.bankPixKey) && (
                    <Card className="p-4">
                      <button onClick={() => setShowBank(!showBank)} className="w-full flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Dados bancários</h3>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform text-[var(--text-muted)] ${showBank?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {showBank && (
                        <div className="mt-3 space-y-2">
                          {data.bankName    && <div><p className="text-[10px] text-[var(--text-muted)]">Banco</p><p className="text-sm text-[var(--text-primary)]">{data.bankName}</p></div>}
                          {data.bankAgency  && <div><p className="text-[10px] text-[var(--text-muted)]">Agência</p><p className="text-sm text-[var(--text-primary)]">{data.bankAgency}</p></div>}
                          {data.bankAccount && <div><p className="text-[10px] text-[var(--text-muted)]">Conta</p><p className="text-sm text-[var(--text-primary)]">{data.bankAccount}</p></div>}
                          {data.bankPixKey  && <div><p className="text-[10px] text-[var(--text-muted)]">Chave PIX</p><p className="text-sm text-[var(--text-primary)]">{data.bankPixKey}</p></div>}
                        </div>
                      )}
                    </Card>
                  )}
                  <div className="rounded-lg bg-[var(--bg-hover)] p-3">
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">💡 Crie cobranças à vista, parceladas (boletos) ou por link. Imprima os boletos, dê baixa e envie pelo WhatsApp. Integração automática com o <b>Asaas</b> em breve.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── DOCUMENTOS ── */}
            {tab === 'documentos' && (
              <DocumentsSection clientId={id} client={data} processes={processes} />
            )}

            {/* ── ÁREA DE TRABALHO ── */}
            {tab === 'area' && (
              <WorkspaceSection clientId={id} client={data} processes={processes} />
            )}

            {/* ── TAREFAS ── */}
            {tab === 'tarefas' && (
              <TasksSection clientId={id} clientName={data.name} onTasksChange={refreshOpenTasks} />
            )}

          </div>
        </div>
      </div>

      {(payModal || editEntry) && (
        <PaymentModal
          clientId={id}
          clientName={data.name}
          processes={processes}
          entry={editEntry}
          onSaved={reloadFinancial}
          onClose={() => { setPayModal(false); setEditEntry(null) }}
        />
      )}
      {baixaEntry && (
        <BaixaModal entry={baixaEntry} clientName={data.name} onDone={updateEntry} onClose={() => setBaixaEntry(null)} />
      )}
      {cobrar && (
        <CobrarModal entry={cobrar} client={data} onClose={() => setCobrar(null)} />
      )}
    </div>
  )
}
