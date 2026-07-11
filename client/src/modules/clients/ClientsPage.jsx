import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatCpfCnpj, formatPhone, formatDate, initials } from '../../lib/format'
import { LEGAL_AREAS } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import {
  Button, Card, Table, Badge, Input, Select, EmptyState,
  IconPlus, IconSearch, IconUsers, Spinner,
} from '../../components/ui'

export default function ClientsPage() {
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const [clients, setClients] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [isActive, setIsActive] = useState('')
  const [page, setPage]       = useState(1)

  async function load() {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (search)   params.search   = search
      if (isActive !== '') params.isActive = isActive
      const res = await api.clients.list(params)
      const rows = Array.isArray(res) ? res : (res.data ?? [])
      setClients(rows)
      setTotal(Array.isArray(res) ? rows.length : (res.total ?? rows.length))
    } catch {
      showToast('Erro ao carregar clientes.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, isActive, page])

  const columns = [
    {
      key: 'name',
      label: 'Cliente',
      render: (name, row) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
            row.type === 'company' ? 'bg-purple-100 text-purple-700' : 'bg-brand-100 text-brand-700'
          }`}>
            {initials(name)}
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">{name}</p>
            {row.email && <p className="text-xs text-[var(--text-muted)]">{row.email}</p>}
          </div>
        </div>
      ),
    },
    { key: 'cpfCnpj', label: 'CPF/CNPJ', render: v => formatCpfCnpj(v) },
    { key: 'phone',   label: 'Telefone',  render: v => formatPhone(v) },
    { key: 'source',  label: 'Origem',    render: v => v ?? '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: v => <Badge color={v ? 'green' : 'gray'}>{v ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'createdAt',
      label: 'Cadastro',
      render: v => formatDate(v),
    },
  ]

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Clientes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/app/clients/new')}>
          <IconPlus size={16} /> Novo Cliente
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por nome, CPF, e-mail..."
              prefix={<IconSearch size={14} />}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select
            value={isActive}
            onChange={e => { setIsActive(e.target.value); setPage(1) }}
            options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]}
            placeholder="Todos os status"
            className="w-40"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={32} className="text-brand-500" />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<IconUsers size={40} />}
            title="Nenhum cliente encontrado"
            description={search ? 'Tente outros termos de busca.' : 'Cadastre seu primeiro cliente para começar.'}
            action={!search && <Button variant="primary" onClick={() => navigate('/app/clients/new')}><IconPlus size={16} /> Novo Cliente</Button>}
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={clients}
              onRowClick={row => navigate(`/app/clients/${row.id}`)}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">Página {page} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button variant="secondary" size="xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
