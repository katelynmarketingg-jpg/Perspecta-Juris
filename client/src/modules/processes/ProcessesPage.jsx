import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatDate, truncate } from '../../lib/format'
import { LEGAL_AREAS } from '../../lib/constants'
import { useUiStore } from '../../stores/uiStore'
import { Button, Card, Table, Badge, EmptyState, Spinner, IconPlus, IconSearch, IconBriefcase, CustomSelect } from '../../components/ui'

const STATUS_COLORS = { active: 'blue', won: 'green', lost: 'red', settled: 'purple', archived: 'gray' }
const STATUS_LABELS = { active: 'Ativo', won: 'Ganho', lost: 'Perdido', settled: 'Acordo', archived: 'Arquivado' }

export default function ProcessesPage() {
  const navigate = useNavigate()
  const { showToast } = useUiStore()
  const [processes, setProcesses] = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [area, setArea]           = useState('')
  const [status, setStatus]       = useState('active')
  const [page, setPage]           = useState(1)

  async function load() {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (search) params.search = search
      if (area)   params.area   = area
      if (status) params.status = status
      const res = await api.processes.list(params)
      const rows = Array.isArray(res) ? res : (res.data ?? [])
      setProcesses(rows)
      setTotal(Array.isArray(res) ? rows.length : (res.total ?? rows.length))
    } catch {
      showToast('Erro ao carregar processos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, area, status, page])

  // Merge custom areas (from Settings) with defaults
  const customAreas = (() => { try { return JSON.parse(localStorage.getItem('pj_local_areas') ?? '[]') } catch { return [] } })()
  const baseAreas   = customAreas.length > 0 ? customAreas.map(a => ({ value: a.id, label: a.name, color: a.color })) : LEGAL_AREAS
  const areaOptions = [{ value: '', label: 'Todas as áreas' }, ...baseAreas]
  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'active', label: 'Ativos' },
    { value: 'won', label: 'Ganhos' },
    { value: 'lost', label: 'Perdidos' },
    { value: 'settled', label: 'Acordo' },
    { value: 'archived', label: 'Arquivados' },
  ]

  const columns = [
    {
      key: 'internalNumber',
      label: 'Nº',
      className: 'w-20 font-mono text-xs',
    },
    {
      key: 'title',
      label: 'Processo',
      render: (v, row) => (
        <div>
          <p className="font-medium text-[var(--text-primary)]">{v}</p>
          {row.judicialNumber && <p className="text-xs text-[var(--text-muted)] font-mono">{row.judicialNumber}</p>}
        </div>
      ),
    },
    {
      key: 'area',
      label: 'Área',
      render: v => LEGAL_AREAS.find(a => a.value === v)?.label ?? v,
    },
    {
      key: 'status',
      label: 'Status',
      render: v => <Badge color={STATUS_COLORS[v] ?? 'gray'}>{STATUS_LABELS[v] ?? v}</Badge>,
    },
    {
      key: 'priority',
      label: 'Prioridade',
      render: v => {
        const map = { urgent: ['red', 'Urgente'], high: ['yellow', 'Alta'], normal: ['blue', 'Normal'], low: ['gray', 'Baixa'] }
        const [color, label] = map[v] ?? ['gray', v]
        return <Badge color={color}>{label}</Badge>
      },
    },
    { key: 'startedAt', label: 'Abertura', render: v => formatDate(v) },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Processos</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{total} processo{total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/app/processes/new')}>
          <IconPlus size={16} /> Novo Processo
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por título, número..."
            className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
        <CustomSelect
          value={area}
          onChange={v => { setArea(v); setPage(1) }}
          options={areaOptions}
          placeholder="Todas as áreas"
          className="w-40"
        />
        <CustomSelect
          value={status}
          onChange={v => { setStatus(v); setPage(1) }}
          options={statusOptions}
          placeholder="Todos os status"
          className="w-40"
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size={32} className="text-brand-500" /></div>
        ) : processes.length === 0 ? (
          <EmptyState icon={<IconBriefcase size={40} />} title="Nenhum processo encontrado"
            description={search ? 'Tente outros termos.' : 'Cadastre o primeiro processo.'}
            action={!search && <Button variant="primary" onClick={() => navigate('/app/processes/new')}><IconPlus size={16} /> Novo Processo</Button>}
          />
        ) : (
          <Table columns={columns} data={processes} onRowClick={r => navigate(`/app/processes/${r.id}`)} />
        )}
      </Card>
    </div>
  )
}
