import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'
import { formatCpf, formatCnpj, formatPhone, formatCep } from '../../lib/format'
import { MARITAL_STATUS, STATES_BR, LEAD_SOURCES } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import { Button, Input, Select, Textarea, Card, Spinner } from '../../components/ui'

const empty = {
  type: 'person', name: '', cpfCnpj: '', rg: '', birthDate: '', nationality: 'Brasileira',
  maritalStatus: '', profession: '', email: '', phone: '', phoneSecondary: '',
  addressStreet: '', addressNumber: '', addressComplement: '', addressDistrict: '',
  addressCity: '', addressState: '', addressZip: '',
  companyName: '', fantasyName: '', representativeName: '', representativeCpf: '', representativePhone: '',
  bankName: '', bankAgency: '', bankAccount: '', bankPixKey: '',
  source: '', notes: '',
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-1">{title}</h2>
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children}
        </div>
      </Card>
    </div>
  )
}

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const [data, setData]           = useState(empty)
  const [loading, setLoading]     = useState(false)
  const [loadingData, setLoadingData] = useState(!!id)
  const [errors, setErrors]       = useState({})

  const isEdit = Boolean(id)

  useEffect(() => {
    if (!id) return
    api.clients.get(id).then(row => {
      setData({ ...empty, ...row })
      setLoadingData(false)
    }).catch(() => navigate('/app/clients'))
  }, [id])

  const set = (field) => (e) => {
    let v = e?.target ? e.target.value : e
    if (field === 'cpfCnpj') {
      const digits = v.replace(/\D/g, '')
      v = digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits)
    }
    if (field === 'phone' || field === 'phoneSecondary' || field === 'representativePhone') v = formatPhone(v)
    if (field === 'addressZip') v = formatCep(v)
    setData(d => ({ ...d, [field]: v }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!data.name.trim())  e.name  = 'Nome obrigatório.'
    if (!data.phone.trim()) e.phone = 'Telefone obrigatório.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = { ...data, cpfCnpj: data.cpfCnpj.replace(/\D/g, '') }
      if (isEdit) {
        await api.clients.update(id, payload)
        showToast('Cliente atualizado com sucesso.', 'success')
        navigate(`/app/clients/${id}`)
      } else {
        const created = await api.clients.create(payload)
        showToast('Cliente cadastrado com sucesso.', 'success')
        navigate(`/app/clients/${created.id}`)
      }
    } catch (err) {
      showToast(err.message || 'Erro ao salvar cliente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) return <div className="flex items-center justify-center py-24"><Spinner size={32} className="text-brand-500" /></div>

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-xs text-[var(--text-muted)] hover:text-brand-500 mb-2 transition-colors">← Voltar</button>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tipo */}
        <Card className="p-4">
          <div className="flex gap-3">
            {['person', 'company'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setData(d => ({ ...d, type: t }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  data.type === t
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-brand-300'
                }`}
              >
                {t === 'person' ? '👤 Pessoa Física' : '🏢 Pessoa Jurídica'}
              </button>
            ))}
          </div>
        </Card>

        {/* Dados Pessoais */}
        <Section title="Dados Pessoais">
          <div className="sm:col-span-2">
            <Input
              label={data.type === 'company' ? 'Razão Social *' : 'Nome completo *'}
              value={data.name}
              onChange={set('name')}
              error={errors.name}
              placeholder={data.type === 'company' ? 'Razão social da empresa' : 'Nome completo do cliente'}
            />
          </div>

          <Input
            label={data.type === 'company' ? 'CNPJ' : 'CPF'}
            value={data.cpfCnpj}
            onChange={set('cpfCnpj')}
            placeholder={data.type === 'company' ? '00.000.000/0001-00' : '000.000.000-00'}
          />

          {data.type === 'person' && (
            <>
              <Input label="RG" value={data.rg} onChange={set('rg')} />
              <Input label="Data de Nascimento" type="date" value={data.birthDate} onChange={set('birthDate')} />
              <Select label="Estado Civil" value={data.maritalStatus} onChange={set('maritalStatus')} options={MARITAL_STATUS} placeholder="Selecionar..." />
              <Input label="Profissão" value={data.profession} onChange={set('profession')} />
              <Input label="Nacionalidade" value={data.nationality} onChange={set('nationality')} />
            </>
          )}

          {data.type === 'company' && (
            <>
              <Input label="Nome Fantasia" value={data.fantasyName} onChange={set('fantasyName')} />
              <Input label="Nome do Representante" value={data.representativeName} onChange={set('representativeName')} />
              <Input label="CPF do Representante" value={data.representativeCpf} onChange={set('representativeCpf')} />
              <Input label="Tel. do Representante" value={data.representativePhone} onChange={set('representativePhone')} />
            </>
          )}

          <Input label="E-mail" type="email" value={data.email} onChange={set('email')} />
          <Input
            label="Telefone / WhatsApp *"
            value={data.phone}
            onChange={set('phone')}
            error={errors.phone}
            placeholder="(00) 00000-0000"
          />
          <Input label="Telefone 2" value={data.phoneSecondary} onChange={set('phoneSecondary')} placeholder="(00) 00000-0000" />

          <div className="sm:col-span-2">
            <Textarea label="Observações" value={data.notes} onChange={set('notes')} rows={3} placeholder="Anotações relevantes sobre o cliente..." />
          </div>
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <Input label="CEP" value={data.addressZip} onChange={set('addressZip')} placeholder="00000-000" />
          <div className="sm:col-span-2">
            <Input label="Logradouro" value={data.addressStreet} onChange={set('addressStreet')} placeholder="Rua, Avenida, etc." />
          </div>
          <Input label="Número" value={data.addressNumber} onChange={set('addressNumber')} />
          <Input label="Complemento" value={data.addressComplement} onChange={set('addressComplement')} placeholder="Apto, Sala..." />
          <Input label="Bairro" value={data.addressDistrict} onChange={set('addressDistrict')} />
          <Input label="Cidade" value={data.addressCity} onChange={set('addressCity')} />
          <Select
            label="Estado"
            value={data.addressState}
            onChange={set('addressState')}
            options={STATES_BR.map(s => ({ value: s, label: s }))}
            placeholder="UF"
          />
        </Section>

        {/* Dados Bancários */}
        <Section title="Dados Bancários">
          <Input label="Banco" value={data.bankName} onChange={set('bankName')} placeholder="Ex: Itaú, Bradesco..." />
          <Input label="Agência" value={data.bankAgency} onChange={set('bankAgency')} placeholder="0000" />
          <Input label="Conta" value={data.bankAccount} onChange={set('bankAccount')} placeholder="00000-0" />
          <div className="sm:col-span-2">
            <Input label="Chave PIX" value={data.bankPixKey} onChange={set('bankPixKey')} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </div>
        </Section>

        {/* Origem */}
        <Section title="Origem / CRM">
          <Select label="Origem do Lead" value={data.source} onChange={set('source')} options={LEAD_SOURCES} placeholder="Como nos encontrou?" />
        </Section>

        {/* Ações */}
        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </Button>
        </div>

      </form>
    </div>
  )
}
