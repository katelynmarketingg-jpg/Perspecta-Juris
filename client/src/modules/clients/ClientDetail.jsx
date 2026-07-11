import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '../../lib/api'
import { formatCpfCnpj, formatPhone, formatDate, formatCurrency, initials } from '../../lib/format'
import { LEGAL_AREAS, PROCESS_STATUS } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import {
  Button, Card, Badge, Tabs, Table, EmptyState, Spinner,
  IconEdit, IconPlus, IconBriefcase, IconDollar, IconFolder, IconUser,
} from '../../components/ui'

const TABS = [
  { value: 'overview',   label: 'Dados' },
  { value: 'processes',  label: 'Processos' },
  { value: 'financial',  label: 'Financeiro' },
  { value: 'documents',  label: 'Documentos' },
]

function ProcessStatusBadge({ status }) {
  const map = { active: 'blue', won: 'green', lost: 'red', settled: 'purple', archived: 'gray' }
  const labels = { active: 'Ativo', won: 'Ganho', lost: 'Perdido', settled: 'Acordo', archived: 'Arquivado' }
  return <Badge color={map[status] ?? 'gray'}>{labels[status] ?? status}</Badge>
}

function AreaLabel({ area }) {
  return LEGAL_AREAS.find(a => a.value === area)?.label ?? area
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const [client, setClient]     = useState(null)
  const [processes, setProcesses] = useState([])
  const [financial, setFinancial] = useState([])
  const [tab, setTab]           = useState('overview')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.clients.get(id),
      api.clients.processes(id),
      api.clients.financial(id),
    ]).then(([c, p, f]) => {
      setClient(c)
      setProcesses(p)
      setFinancial(f)
    }).catch(() => {
      showToast('Cliente não encontrado.', 'error')
      navigate('/app/clients')
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center py-24"><Spinner size={32} className="text-brand-500" /></div>
  if (!client) return null

  const pendingFees = financial.filter(f => f.type === 'receivable' && f.status === 'pending')
    .reduce((s, f) => s + (f.amount ?? 0), 0)

  const tabsWithCounts = TABS.map(t => ({
    ...t,
    count: t.value === 'processes' ? processes.length : t.value === 'financial' ? financial.length : undefined,
  }))

  const processColumns = [
    { key: 'internalNumber', label: 'Nº', className: 'w-24 font-mono text-xs' },
    { key: 'title',          label: 'Título', render: (v, r) => (
      <div>
        <p className="font-medium text-[var(--text-primary)]">{v}</p>
        <p className="text-xs text-[var(--text-muted)]"><AreaLabel area={r.area} /></p>
      </div>
    )},
    { key: 'status', label: 'Status', render: v => <ProcessStatusBadge status={v} /> },
    { key: 'createdAt', label: 'Abertura', render: v => formatDate(v) },
  ]

  const financialColumns = [
    { key: 'description', label: 'Descrição' },
    { key: 'type',   label: 'Tipo', render: v => <Badge color={v === 'receivable' ? 'green' : 'red'}>{v === 'receivable' ? 'A Receber' : 'A Pagar'}</Badge> },
    { key: 'amount', label: 'Valor', render: v => formatCurrency(v) },
    { key: 'dueDate', label: 'Vencimento', render: v => formatDate(v) },
    { key: 'status', label: 'Status', render: v => <Badge color={v === 'paid' ? 'green' : v === 'pending' ? 'yellow' : 'red'}>{v === 'paid' ? 'Pago' : v === 'pending' ? 'Pendente' : 'Em atraso'}</Badge> },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link to="/app/clients" className="hover:text-brand-500 transition-colors">Clientes</Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
          {initials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{client.name}</h1>
            <Badge color={client.isActive ? 'green' : 'gray'}>{client.isActive ? 'Ativo' : 'Inativo'}</Badge>
          </div>
          {client.cpfCnpj && <p className="text-sm text-[var(--text-muted)] mt-0.5">{formatCpfCnpj(client.cpfCnpj)}</p>}
          <div className="flex gap-4 mt-1 text-sm text-[var(--text-secondary)] flex-wrap">
            {client.phone   && <span>📞 {formatPhone(client.phone)}</span>}
            {client.email   && <span>✉️ {client.email}</span>}
            {client.source  && <span>📌 {client.source}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/app/documents?tab=templates')}>
            📄 Gerar documento
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/app/clients/${id}/edit`)}>
            <IconEdit size={15} /> Editar
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{processes.length}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Processos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{processes.filter(p => p.status === 'active').length}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Ativos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(pendingFees)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">A Receber</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{formatDate(client.createdAt)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Cadastrado em</p>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

        <div className="p-5">
          {/* Overview */}
          {tab === 'overview' && (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {[
                ['Nome', client.name],
                ['CPF/CNPJ', formatCpfCnpj(client.cpfCnpj)],
                ['RG', client.rg],
                ['Nascimento', formatDate(client.birthDate)],
                ['Estado Civil', client.maritalStatus],
                ['Profissão', client.profession],
                ['Nacionalidade', client.nationality],
                ['E-mail', client.email],
                ['Telefone', formatPhone(client.phone)],
                ['Telefone 2', formatPhone(client.phoneSecondary)],
                ['Endereço', [client.addressStreet, client.addressNumber, client.addressDistrict, client.addressCity, client.addressState].filter(Boolean).join(', ')],
                ['CEP', client.addressZip],
                ['Origem', client.source],
              ].map(([k, v]) => v ? (
                <div key={k}>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">{k}</dt>
                  <dd className="text-[var(--text-primary)]">{v}</dd>
                </div>
              ) : null)}
              {client.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-muted)] mb-1">Observações</dt>
                  <dd className="text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--bg-hover)] rounded-lg p-3 text-xs">{client.notes}</dd>
                </div>
              )}
            </div>
          )}

          {/* Processes */}
          {tab === 'processes' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => navigate(`/app/processes/new?clientId=${id}`)}>
                  <IconPlus size={14} /> Novo Processo
                </Button>
              </div>
              {processes.length === 0 ? (
                <EmptyState icon={<IconBriefcase size={36} />} title="Nenhum processo" description="Este cliente não possui processos cadastrados." action={<Button variant="primary" onClick={() => navigate(`/app/processes/new?clientId=${id}`)}><IconPlus size={14} /> Novo Processo</Button>} />
              ) : (
                <Table columns={processColumns} data={processes} onRowClick={r => navigate(`/app/processes/${r.id}`)} />
              )}
            </div>
          )}

          {/* Financial */}
          {tab === 'financial' && (
            <div className="space-y-3">
              {financial.length === 0 ? (
                <EmptyState icon={<IconDollar size={36} />} title="Sem lançamentos" description="Nenhum lançamento financeiro para este cliente." />
              ) : (
                <Table columns={financialColumns} data={financial} />
              )}
            </div>
          )}

          {/* Documents */}
          {tab === 'documents' && (
            <EmptyState icon={<IconFolder size={36} />} title="Sem documentos" description="Nenhum documento cadastrado para este cliente." action={<Button variant="secondary"><IconPlus size={14} /> Enviar Documento</Button>} />
          )}
        </div>
      </Card>
    </div>
  )
}
