import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import api from '../../lib/api'
import { applyBranding, applyBrandColor } from '../../lib/brandingClient'
import { IconScale, IconBuilding, IconUsers, IconSettings, IconLogOut, IconPlus } from '../../components/ui'

const EMPTY_FORM = { name: '', plan: 'professional', cnpj: '', adminName: '', adminLogin: '', adminPassword: '' }

export default function MasterPage() {
  const { user, logout, enterCompany } = useAuthStore()
  const navigate = useNavigate()
  const [entering, setEntering] = useState(null) // id da empresa sendo aberta
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('empresas')       // 'empresas' | 'planos'
  const [plans, setPlans] = useState([])
  const [savingPlans, setSavingPlans] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('dark')
    loadCompanies()
    loadPlans()
    loadBranding()
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

  async function loadPlans() {
    try {
      const data = await api.master.plans()
      setPlans(Array.isArray(data) ? data : [])
    } catch { setPlans([]) }
  }

  // ── edição de planos ──
  const setPlanField = (i, field, value) =>
    setPlans(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  const addPlan = () => setPlans(ps => [...ps, { key: '', name: '', maxUsers: '' }])
  const removePlan = (i) => setPlans(ps => ps.filter((_, idx) => idx !== i))
  const salvarPlanos = async () => {
    setSavingPlans(true)
    try {
      const saved = await api.master.savePlans(plans)
      setPlans(Array.isArray(saved) ? saved : plans)
      loadCompanies()
      alert('Planos salvos com sucesso!')
    } catch (e) {
      alert('Não foi possível salvar os planos. ' + (e?.message ?? ''))
    } finally { setSavingPlans(false) }
  }
  const planName = (key) => plans.find(p => p.key === key)?.name ?? key

  // ── marca do sistema (logo, favicon, cor) ──
  const [branding, setBranding] = useState({ logoDataUrl: '', faviconDataUrl: '', brandColor: '#c2410c' })
  const [savingBrand, setSavingBrand] = useState(false)
  async function loadBranding() {
    try { const b = await api.master.branding(); if (b && typeof b === 'object') setBranding(d => ({ ...d, ...b })) } catch { /* ignora */ }
  }
  const pickImage = (field) => (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 1_500_000) { alert('Imagem muito grande (máx. 1,5 MB).'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => setBranding(d => ({ ...d, [field]: reader.result }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const salvarMarca = async () => {
    setSavingBrand(true)
    try {
      const saved = await api.master.saveBranding(branding)
      applyBranding(saved && typeof saved === 'object' ? saved : branding)
      alert('Marca salva! O sistema já está com a nova identidade.')
    } catch (e) {
      alert('Não foi possível salvar a marca. ' + (e?.message ?? ''))
    } finally { setSavingBrand(false) }
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
  const entrar = async (c) => {
    if (!c.isActive) return
    setEntering(c.id)
    try {
      await enterCompany(c.id)
      navigate('/app')
    } catch (e) {
      alert('Não foi possível entrar neste escritório. ' + (e?.message ?? ''))
      setEntering(null)
    }
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Painel Master</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Gerencie escritórios e planos</p>
          </div>
          {tab === 'empresas' && (
            <button onClick={() => { setForm({ ...EMPTY_FORM, plan: plans[0]?.key ?? 'starter' }); setShowNew(true) }} className="btn-primary flex items-center gap-2">
              <IconPlus size={15} />
              Nova Empresa
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--border)]">
          {[['empresas', 'Empresas'], ['planos', 'Planos'], ['marca', 'Marca']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? 'border-brand-500 text-white' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'planos' && (
          <div className="max-w-2xl">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">Planos e limites de acesso</p>
                <button onClick={addPlan} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <IconPlus size={13} /> Adicionar plano
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mb-4">Defina o nome de cada plano e quantos acessos (usuários) ele permite. Deixe o limite em branco para <b>ilimitado</b>.</p>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_130px_32px] gap-2 px-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  <span>Nome do plano</span><span>Limite de acessos</span><span></span>
                </div>
                {plans.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhum plano. Clique em "Adicionar plano".</p>
                )}
                {plans.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_130px_32px] gap-2 items-center">
                    <input
                      value={p.name ?? ''} onChange={e => setPlanField(i, 'name', e.target.value)}
                      placeholder="Ex: Escritório"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                    <input
                      type="number" min="1"
                      value={p.maxUsers ?? ''} onChange={e => setPlanField(i, 'maxUsers', e.target.value)}
                      placeholder="ilimitado"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                    <button onClick={() => removePlan(i)} title="Remover plano"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-950/40">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-5 pt-4 border-t border-[var(--border)]">
                <button onClick={salvarPlanos} disabled={savingPlans} className="btn-primary text-sm disabled:opacity-60">
                  {savingPlans ? 'Salvando…' : 'Salvar planos'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'marca' && (
          <div className="max-w-2xl">
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-white">Identidade visual do sistema</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Vale para <b>todos</b> os escritórios. A pré-visualização é imediata.</p>
              </div>

              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {branding.logoDataUrl
                    ? <img src={branding.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
                    : <IconScale size={22} className="text-[var(--text-muted)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Logo do sistema</p>
                  <div className="flex gap-2 flex-wrap">
                    <label className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer">
                      Escolher imagem
                      <input type="file" accept="image/*" onChange={pickImage('logoDataUrl')} className="hidden" />
                    </label>
                    {branding.logoDataUrl && (
                      <button onClick={() => setBranding(d => ({ ...d, logoDataUrl: '' }))} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400">Remover</button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">PNG/SVG com fundo transparente. Máx. 1,5 MB.</p>
                </div>
              </div>

              {/* Favicon */}
              <div className="flex items-center gap-4 pt-3 border-t border-[var(--border)]">
                <div className="w-16 h-16 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {branding.faviconDataUrl
                    ? <img src={branding.faviconDataUrl} alt="favicon" className="w-8 h-8 object-contain" />
                    : <span className="text-[10px] text-[var(--text-muted)]">aba</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Ícone da aba do navegador (favicon)</p>
                  <div className="flex gap-2 flex-wrap">
                    <label className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer">
                      Escolher imagem
                      <input type="file" accept="image/*" onChange={pickImage('faviconDataUrl')} className="hidden" />
                    </label>
                    {branding.faviconDataUrl && (
                      <button onClick={() => setBranding(d => ({ ...d, faviconDataUrl: '' }))} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400">Remover</button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">É aquele "loguinho" que aparece na abinha do navegador. Quadrado (64×64 ou maior).</p>
                </div>
              </div>

              {/* Cor */}
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Cor principal do sistema</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="color" value={branding.brandColor || '#c2410c'}
                    onChange={e => { const v = e.target.value; setBranding(d => ({ ...d, brandColor: v })); applyBrandColor(v) }}
                    className="w-12 h-10 rounded-lg bg-transparent border border-[var(--border)] cursor-pointer" />
                  <input value={branding.brandColor || ''} placeholder="#c2410c"
                    onChange={e => { const v = e.target.value; setBranding(d => ({ ...d, brandColor: v })); if (/^#[0-9a-f]{6}$/i.test(v)) applyBrandColor(v) }}
                    className="w-32 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                  <div className="flex gap-1.5">
                    {['#c2410c', '#1d4ed8', '#047857', '#7c3aed', '#be123c', '#0f766e'].map(c => (
                      <button key={c} title={c} onClick={() => { setBranding(d => ({ ...d, brandColor: c })); applyBrandColor(c) }}
                        className="w-7 h-7 rounded-lg border border-white/10" style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">Os tons claros e escuros são gerados automaticamente a partir dessa cor.</p>
              </div>

              <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                <button onClick={salvarMarca} disabled={savingBrand} className="btn-primary text-sm disabled:opacity-60">
                  {savingBrand ? 'Salvando…' : 'Salvar marca'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'empresas' && (<>
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
                    <p className={`text-lg font-bold leading-none ${c.maxUsers != null && (c.usersCount ?? 0) >= c.maxUsers ? 'text-red-400' : 'text-white'}`}>
                      {c.usersCount ?? 0}{c.maxUsers != null && <span className="text-[var(--text-muted)] text-sm font-normal"> / {c.maxUsers}</span>}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Acessos</p>
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

                {/* Entrar no escritório */}
                <button
                  onClick={() => entrar(c)}
                  disabled={!c.isActive || entering === c.id}
                  className="btn-primary w-full text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={c.isActive ? 'Abrir este escritório como master' : 'Ative a empresa para poder entrar'}
                >
                  {entering === c.id ? 'Entrando…' : 'Entrar no escritório'}
                </button>

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
        </>)}
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
                    {plans.length === 0 && <option value="">—</option>}
                    {plans.map(p => (
                      <option key={p.key} value={p.key}>
                        {p.name}{p.maxUsers != null ? ` (${p.maxUsers} acessos)` : ' (ilimitado)'}
                      </option>
                    ))}
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
