import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import api from '../../lib/api'
import { IconScale, IconBuilding, IconUsers, IconSettings, IconLogOut, IconPlus } from '../../components/ui'

const EMPTY_FORM = { name: '', plan: 'professional', cnpj: '', adminName: '', adminLogin: '', adminPassword: '' }

export default function MasterPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('dark')
    loadCompanies()
  }, [])

  async function loadCompanies() {
    try {
      const data = await api.master.companies()
      setCompanies(Array.isArray(data) ? data : (data?.data ?? []))
    } catch {
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const setF = (k) => (e) => setForm(d => ({ ...d, [k]: e.target.value }))

  const createCompany = async () => {
    if (!form.name.trim() || !form.adminLogin.trim() || !form.adminPassword.trim()) return
    setSaving(true)
    try {
      await api.master.createCompany(form)
      setShowNew(false); setForm(EMPTY_FORM)
      loadCompanies()
    } catch {} finally { setSaving(false) }
  }

  const toggleActive = async (c) => {
    await api.master.updateCompany(c.id, { isActive: !c.isActive }).catch(() => {})
    loadCompanies()
  }
  const deleteCompany = async (c) => {
    if (!window.confirm(`Excluir a empresa "${c.name}" e todos os seus acessos?`)) return
    await api.master.deleteCompany(c.id).catch(() => {})
    loadCompanies()
  }

  const totalClientes = companies.reduce((s, c) => s + (c.clientsCount ?? 0), 0)
  const totalProcessos = companies.reduce((s, c) => s + (c.processesCount ?? 0), 0)
  const totalUsuarios = companies.reduce((s, c) => s + (c.usersCount ?? 0), 0)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const planLabel = { master: 'Master', professional: 'Profissional', starter: 'Starter', enterprise: 'Enterprise' }
  const planColor = { master: 'text-accent-400 bg-orange-950/60 border-orange-800/30', professional: 'text-blue-400 bg-blue-950/60 border-blue-800/30', starter: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/30', enterprise: 'text-purple-400 bg-purple-950/60 border-purple-800/30' }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-sidebar)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-orange">
            <IconScale size={13} className="text-white" />
          </div>
          <div>
            <span className="text-[13px] font-bold text-white">Perspecta</span>
            <span className="text-[9px] text-brand-500 font-semibold tracking-[0.2em] uppercase ml-1">Juris</span>
          </div>
          <div className="ml-3 px-2.5 py-0.5 rounded-full bg-orange-950/60 border border-orange-800/30">
            <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-wider">Master</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-sm text-[var(--text-secondary)]">{user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <IconLogOut size={14} />
            Sair
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Empresas cadastradas</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Gerencie os acessos de cada escritório</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <IconPlus size={15} />
            Nova Empresa
          </button>
        </div>

        {/* Totais do sistema */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            ['Empresas', companies.length],
            ['Clientes (total)', totalClientes],
            ['Processos (total)', totalProcessos],
            ['Usuários (total)', totalUsuarios],
          ].map(([label, val]) => (
            <div key={label} className="card p-4">
              <p className="text-2xl font-bold text-white leading-none">{val}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">{label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="card p-12 text-center">
            <IconBuilding size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)]">Nenhuma empresa cadastrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(c => (
              <div key={c.id} className="card p-5 flex flex-col gap-4 hover:border-[var(--border-strong)] transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{c.slug}</p>
                    </div>
                  </div>
                  <span className={`badge border text-[10px] ${planColor[c.plan] ?? planColor.starter}`}>
                    {planLabel[c.plan] ?? c.plan}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex gap-4">
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{c.usersCount ?? 0}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Usuários</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{c.clientsCount ?? 0}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Clientes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{c.processesCount ?? 0}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Processos</p>
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                  <button onClick={() => toggleActive(c)} className={`badge border text-[10px] cursor-pointer ${c.isActive ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30' : 'badge-red'}`} title="Clique para ativar/desativar">
                    {c.isActive ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => deleteCompany(c)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40 transition-colors">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: nova empresa */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={() => setShowNew(false)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <p className="text-sm font-semibold text-white">Nova empresa</p>
              <button onClick={() => setShowNew(false)} className="text-[var(--text-muted)] hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Nome da empresa *</label>
                <input value={form.name} onChange={setF('name')} placeholder="Ex: Silva Advogados" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Plano</label>
                  <select value={form.plan} onChange={setF('plan')} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none">
                    <option value="starter">Starter</option>
                    <option value="professional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">CNPJ</label>
                  <input value={form.cnpj} onChange={setF('cnpj')} placeholder="00.000.000/0001-00" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Acesso do administrador da empresa</p>
                <div className="space-y-3">
                  <input value={form.adminName} onChange={setF('adminName')} placeholder="Nome do administrador" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.adminLogin} onChange={setF('adminLogin')} placeholder="Login *" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                    <input value={form.adminPassword} onChange={setF('adminPassword')} placeholder="Senha *" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">A empresa entrará com: <b>{form.name || 'Nome da empresa'}</b> + login + senha.</p>
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white">Cancelar</button>
              <button onClick={createCompany} disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? 'Criando…' : 'Criar empresa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
