import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import { formatProcessNumber } from '../../lib/format'
import { LEGAL_AREAS, PROCESS_TYPES, CONTRACT_TYPES } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import { Button, Input, Select, Textarea, Card, Spinner } from '../../components/ui'

const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9)
const numBR = (v) => v === '' || v == null ? 0 : parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0

const empty = {
  title: '', area: '', subArea: '', processType: '', judicialNumber: '',
  court: '', courtDistrict: '', courtCity: '', courtState: '',
  judgeName: '', opposingParty: '',
  feeType: 'fixed', feeAmount: '', feePercentage: '', feeNotes: '',
  priority: 'normal', summary: '',
  // Cobrança (não persistido no processo — gera débitos)
  cobranca: 'avista', entrada: '', parcelas: '1', primeiroVenc: '',
}

const addMonthsISO = (baseISO, n) => {
  const d = baseISO ? new Date(baseISO + 'T00:00:00') : new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

// Gera os débitos (lançamentos "a receber") a partir da forma de cobrança
function gerarDebitos({ cobranca, feeAmount, entrada, parcelas, primeiroVenc }, { clientId, processId, processTitle }) {
  const total = numBR(feeAmount)
  if (total <= 0) return []
  const nowISO = new Date().toISOString()
  const venc0 = primeiroVenc || new Date().toISOString().slice(0, 10)
  const nParc = Math.max(1, parseInt(parcelas) || 1)
  const mk = (amount, dueDate, label) => ({
    id: 'fin_' + uid(), tenantId: 'tenant_demo', clientId, processId,
    type: 'receivable', status: 'pending',
    description: `Honorários — ${processTitle}${label ? ` (${label})` : ''}`,
    amount: Math.round(amount * 100) / 100, dueDate,
    needsReview: true, createdViaProcess: true,
    createdAt: nowISO, updatedAt: nowISO,
  })
  const out = []
  if (cobranca === 'avista') {
    out.push(mk(total, venc0, 'à vista'))
  } else if (cobranca === 'parcelado') {
    const val = total / nParc
    for (let i = 0; i < nParc; i++) out.push(mk(val, addMonthsISO(venc0, i), `${i + 1}/${nParc}`))
  } else if (cobranca === 'entrada') {
    const ent = numBR(entrada)
    if (ent > 0) out.push(mk(ent, venc0, 'entrada'))
    const restante = total - ent
    const val = restante / nParc
    for (let i = 0; i < nParc; i++) out.push(mk(val, addMonthsISO(venc0, i + 1), `parcela ${i + 1}/${nParc}`))
  } else if (cobranca === 'mensal') {
    for (let i = 0; i < nParc; i++) out.push(mk(total, addMonthsISO(venc0, i), `mês ${i + 1}/${nParc}`))
  }
  return out
}

export default function ProcessForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const [data, setData]     = useState({ ...empty, clientId: searchParams.get('clientId') ?? '' })
  const [loading, setLoading]   = useState(false)
  const [loadingData, setLoadingData] = useState(!!id)
  const [clients, setClients] = useState([])
  const [users, setUsers]     = useState([])
  const [feeTypes, setFeeTypes] = useState([])
  const [errors, setErrors]   = useState({})
  const isEdit = Boolean(id)

  useEffect(() => {
    Promise.all([
      api.clients.list({ limit: 200, isActive: true }),
      api.settings.users(),
    ]).then(([c, u]) => {
      setClients(Array.isArray(c) ? c : (c?.data ?? []))
      setUsers(Array.isArray(u) ? u : (u?.data ?? []))
    })
    setFeeTypes(lsGet('pj_local_fee_types', []))

    if (id) {
      api.processes.get(id).then(row => { setData({ ...empty, ...row }); setLoadingData(false) })
        .catch(() => navigate('/app/processes'))
    }
  }, [id])

  const set = (field) => (e) => {
    let v = e?.target ? e.target.value : e
    if (field === 'judicialNumber') v = formatProcessNumber(v)
    setData(d => ({ ...d, [field]: v }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  // Buscar honorário salvo nas configurações
  const aplicarHonorario = (ftId) => {
    const ft = feeTypes.find(f => f.id === ftId)
    if (!ft) return
    setData(d => ({
      ...d,
      feeType: ft.contractType ?? 'fixed',
      feeAmount: ft.amount != null ? String(ft.amount).replace('.', ',') : '',
      feePercentage: ft.percentage != null ? String(ft.percentage) : '',
      feeNotes: ft.desc ? `${ft.name} — ${ft.desc}` : ft.name,
    }))
    showToast(`Honorário "${ft.name}" aplicado. Ajuste se necessário.`, 'success')
  }

  const validate = () => {
    const e = {}
    if (!data.title.trim()) e.title = 'Título obrigatório.'
    if (!data.clientId)     e.clientId = 'Cliente obrigatório.'
    if (!data.area)         e.area = 'Área jurídica obrigatória.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...data,
        feeAmount:     data.feeAmount     ? numBR(data.feeAmount)     : null,
        feePercentage: data.feePercentage ? numBR(data.feePercentage) : null,
      }
      delete payload.cobranca; delete payload.entrada; delete payload.parcelas; delete payload.primeiroVenc

      let processId = id
      if (isEdit) {
        await api.processes.update(id, payload)
      } else {
        const created = await api.processes.create(payload)
        processId = created.id
      }

      // Auto-criar débitos (somente na criação e se houver valor)
      let nDebitos = 0
      if (!isEdit && numBR(data.feeAmount) > 0) {
        const debitos = gerarDebitos(data, { clientId: data.clientId, processId, processTitle: data.title })
        if (debitos.length) {
          const all = lsGet('pj_local_financial_entries', [])
          lsSet('pj_local_financial_entries', [...all, ...debitos])
          nDebitos = debitos.length
        }
      }

      showToast(
        isEdit ? 'Processo atualizado.'
        : nDebitos ? `Processo criado. ${nDebitos} lançamento(s) gerado(s) em Pagamentos.` : 'Processo criado com sucesso.',
        'success'
      )
      navigate(`/app/processes/${processId}`)
    } catch (err) {
      showToast(err.message || 'Erro ao salvar processo.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) return <div className="flex items-center justify-center h-full py-24"><Spinner size={32} className="text-brand-500" /></div>

  const processTypes = PROCESS_TYPES[data.area] ?? []
  const lawyerOptions = users.filter(u => ['admin', 'advogado', 'lawyer', 'estagiario', 'staff'].includes(u.role))
    .map(u => ({ value: u.id, label: `${u.name}${u.oabNumber ? ` — OAB ${u.oabNumber}` : ''}` }))

  // preview dos débitos
  const previewDebitos = numBR(data.feeAmount) > 0
    ? gerarDebitos(data, { clientId: data.clientId, processId: 'preview', processTitle: data.title || 'Processo' })
    : []
  const totalPreview = previewDebitos.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1500px] mx-auto px-8 py-6">
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mb-2 transition-colors">← Voltar</button>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{isEdit ? 'Editar Processo' : 'Novo Processo'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            {/* Coluna 1 — Identificação + Tribunal */}
            <div className="space-y-5">
              <Card className="p-5 space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Identificação</h3>
                <Input label="Título do Processo *" value={data.title} onChange={set('title')} error={errors.title} placeholder="Ex: Ação de Indenização por Danos Morais" />
                <Select label="Cliente *" value={data.clientId} onChange={set('clientId')} error={errors.clientId}
                  options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Selecionar cliente..." />
                <Select label="Advogado Responsável" value={data.assignedTo ?? ''} onChange={set('assignedTo')} options={lawyerOptions} placeholder="Selecionar..." />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Área Jurídica *" value={data.area} onChange={e => { set('area')(e); setData(d => ({ ...d, processType: '' })) }}
                    error={errors.area} options={LEGAL_AREAS} placeholder="Selecionar..." />
                  <Select label="Tipo" value={data.processType} onChange={set('processType')}
                    options={processTypes.map(t => ({ value: t, label: t }))} placeholder="Selecionar..." disabled={!processTypes.length} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Número CNJ" value={data.judicialNumber} onChange={set('judicialNumber')} placeholder="0000000-00.0000.0.00.0000" />
                  <Select label="Prioridade" value={data.priority} onChange={set('priority')}
                    options={[{ value: 'low', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }]} />
                </div>
              </Card>

              <Card className="p-5 space-y-3">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Tribunal / Vara</h3>
                <Input label="Tribunal" value={data.court} onChange={set('court')} placeholder="TJSP, TRT, STJ..." />
                <Input label="Vara / Câmara" value={data.courtDistrict} onChange={set('courtDistrict')} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Input label="Cidade" value={data.courtCity} onChange={set('courtCity')} /></div>
                  <Input label="UF" value={data.courtState} onChange={set('courtState')} />
                </div>
                <Input label="Juiz(a)" value={data.judgeName} onChange={set('judgeName')} />
                <Input label="Parte Contrária" value={data.opposingParty} onChange={set('opposingParty')} placeholder="Nome da parte contrária" />
              </Card>
            </div>

            {/* Coluna 2 — Honorários + Cobrança */}
            <div className="space-y-5">
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Honorários</h3>
                  {feeTypes.length > 0 && (
                    <select onChange={e => { if (e.target.value) aplicarHonorario(e.target.value); e.target.value = '' }} defaultValue=""
                      className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:border-brand-500 focus:outline-none max-w-[55%]">
                      <option value="">↓ Buscar dos salvos…</option>
                      {feeTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                </div>
                <Select label="Tipo de Contrato" value={data.feeType} onChange={set('feeType')} options={CONTRACT_TYPES} />
                <div className="grid grid-cols-2 gap-3">
                  {['fixed', 'mixed', 'monthly', 'hourly'].includes(data.feeType) &&
                    <Input label="Valor (R$)" value={data.feeAmount} onChange={set('feeAmount')} prefix="R$" placeholder="0,00" />}
                  {['success', 'mixed'].includes(data.feeType) &&
                    <Input label="% Êxito" value={data.feePercentage} onChange={set('feePercentage')} suffix="%" />}
                </div>
                <Textarea label="Observações sobre Honorários" value={data.feeNotes} onChange={set('feeNotes')} rows={2} />
              </Card>

              {/* Cobrança → gera débitos */}
              {!isEdit && (
                <Card className="p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Forma de pagamento</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Gera automaticamente os lançamentos em Pagamentos. O colaborador organiza depois.</p>
                  <Select label="Cobrança" value={data.cobranca} onChange={set('cobranca')} options={[
                    { value: 'avista', label: 'À vista' },
                    { value: 'entrada', label: 'Entrada + parcelas' },
                    { value: 'parcelado', label: 'Parcelado' },
                    { value: 'mensal', label: 'Mensal (recorrente)' },
                  ]} />
                  <div className="grid grid-cols-2 gap-3">
                    {data.cobranca === 'entrada' &&
                      <Input label="Valor da entrada (R$)" value={data.entrada} onChange={set('entrada')} prefix="R$" placeholder="0,00" />}
                    {['entrada', 'parcelado', 'mensal'].includes(data.cobranca) &&
                      <Input label={data.cobranca === 'mensal' ? 'Nº de meses' : 'Nº de parcelas'} type="number" min="1" value={data.parcelas} onChange={set('parcelas')} />}
                    <Input label="1º vencimento" type="date" value={data.primeiroVenc} onChange={set('primeiroVenc')} />
                  </div>

                  {previewDebitos.length > 0 && (
                    <div className="rounded-lg bg-[var(--bg-hover)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)] mb-1.5">Serão criados <b className="text-[var(--text-secondary)]">{previewDebitos.length}</b> lançamento(s) — total {totalPreview.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}:</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {previewDebitos.slice(0, 6).map((d, i) => (
                          <div key={i} className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-muted)]">{new Date(d.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span className="text-[var(--text-secondary)] font-mono">{d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        ))}
                        {previewDebitos.length > 6 && <p className="text-[10px] text-[var(--text-muted)]">+ {previewDebitos.length - 6} outros…</p>}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Coluna 3 — Resumo */}
            <div className="space-y-5 md:col-span-2 xl:col-span-1">
              <Card className="p-5 space-y-3 h-full flex flex-col">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Resumo do Caso</h3>
                <Textarea value={data.summary} onChange={set('summary')} rows={14} className="flex-1"
                  placeholder="Descreva os principais fatos, pretensões e estratégia do processo..." />
              </Card>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={loading}>{isEdit ? 'Salvar' : 'Criar Processo'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
