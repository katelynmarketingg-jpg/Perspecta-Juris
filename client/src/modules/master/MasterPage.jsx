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
  const [erroForm, setErroForm] = useState('')      // recusa do servidor ao criar
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
  const addPlan = () => setPlans(ps => [...ps, { key: '', name: '', maxUsers: '', price: '' }])
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

  const setF = (k) => (e) => { setErroForm(''); setForm(d => ({ ...d, [k]: e.target.value })) }

  // Compara ignorando maiúsculas, acentos e espaços sobrando — é assim que o
  // servidor compara, e é assim que a pessoa lê.
  const achatar = (s) => (s ?? '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

  // O nome já em uso é detectado enquanto se digita: o login identifica a
  // empresa PELO NOME, então dois iguais tornariam a entrada ambígua. Melhor
  // avisar agora, com o campo na frente, do que recusar depois de preencher
  // tudo.
  const nomeEmUso = form.name.trim()
    ? companies.find(c => achatar(c.name) === achatar(form.name))
    : null

  const createCompany = async () => {
    if (!form.name.trim() || !form.adminLogin.trim() || !form.adminPassword.trim()) {
      setErroForm('Preencha nome da empresa, login e senha do administrador.')
      return
    }
    if (nomeEmUso) return   // o aviso já está na tela; o botão está desabilitado
    setSaving(true)
    setErroForm('')
    try {
      await api.master.createCompany(form)
      setShowNew(false); setForm(EMPTY_FORM)
      loadCompanies()
    } catch (e) {
      // Antes isto era `catch {}`: o servidor recusava e a tela não dizia nada.
      // A pessoa clicava de novo achando que tinha travado.
      setErroForm(e?.message ?? 'Não foi possível criar a empresa.')
      if (e?.status === 409) loadCompanies()   // a lista estava velha
    } finally { setSaving(false) }
  }

  // Desativar um escritório derruba TODOS os acessos dele — pede confirmação,
  // porque o selo parece só um rótulo de status e era desativado com 1 clique.
  const toggleActive = async (c) => {
    if (c.isActive) {
      const ok = window.confirm(
        `Desativar "${c.name}"?\n\n` +
        `⚠️ TODOS os logins deste escritório param de funcionar imediatamente — ` +
        `ninguém consegue entrar até você reativar.`
      )
      if (!ok) return
    }
    try {
      await api.master.updateCompany(c.id, { isActive: !c.isActive })
      alert(c.isActive
        ? `"${c.name}" foi desativado. Os acessos estão bloqueados.`
        : `"${c.name}" foi reativado. Os acessos voltaram a funcionar.`)
    } catch (e) {
      alert('Não foi possível alterar a situação da empresa. ' + (e?.message ?? ''))
    }
    loadCompanies()
  }
  const deleteCompany = async (c) => {
    if (!window.confirm(`Excluir a empresa "${c.name}" e todos os seus acessos?`)) return
    // Engolia a falha e recarregava a lista: a empresa reaparecia e ninguém
    // sabia se tinha sido recusada ou se era problema de conexão.
    try { await api.master.deleteCompany(c.id) }
    catch (err) { alert('A empresa NÃO foi excluída. ' + (err?.message ?? 'Falha de conexão.')) }
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

  // ── Quem paga, quem está testando ──────────────────────────────────────
  // O sistema nunca soube disso. Escritório sem classificação fica em "a
  // definir" — inventar que alguém é pagante seria pior do que não contar.
  const pagantes  = companies.filter(c => c.cobranca?.situacao === 'pagante')
  const emTeste   = companies.filter(c => c.cobranca?.situacao === 'teste')
  const cortesias = companies.filter(c => c.cobranca?.situacao === 'cortesia')
  const aDefinir  = companies.filter(c => !c.cobranca?.situacao)
  const receitaPrevista = pagantes.reduce((s, c) => s + (c.valorMensal ?? 0), 0)
  const pagantesSemValor = pagantes.filter(c => c.valorMensal == null).length
  const moeda = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Acessos de cada escritório ─────────────────────────────────────────
  const [acessos, setAcessos] = useState({})        // { tenantId: [users] }
  const [abertos, setAbertos] = useState(() => new Set())
  const [carregandoAcessos, setCarregandoAcessos] = useState(null)

  const verAcessos = async (c) => {
    setAbertos(prev => {
      const n = new Set(prev)
      n.has(c.id) ? n.delete(c.id) : n.add(c.id)
      return n
    })
    if (acessos[c.id]) return
    setCarregandoAcessos(c.id)
    try {
      const rows = await api.master.companyUsers(c.id)
      setAcessos(prev => ({ ...prev, [c.id]: Array.isArray(rows) ? rows : [] }))
    } catch (e) {
      alert('Não foi possível carregar os acessos. ' + (e?.message ?? ''))
    } finally { setCarregandoAcessos(null) }
  }

  const recarregarAcessos = async (tenantId) => {
    try {
      const rows = await api.master.companyUsers(tenantId)
      setAcessos(prev => ({ ...prev, [tenantId]: Array.isArray(rows) ? rows : [] }))
    } catch { /* a tela segue com o que tem */ }
  }

  // Suspender vale na hora: o servidor derruba as sessões abertas da pessoa.
  const alternarAcesso = async (c, u) => {
    const bloquear = u.isActive
    if (bloquear && !window.confirm(
      `Interromper o acesso de "${u.name}" (${u.loginName})?\n\n` +
      `Ela é desconectada na hora e não consegue mais entrar até você liberar de novo.`
    )) return
    try {
      await api.master.updateUser(u.id, { isActive: !u.isActive })
      await recarregarAcessos(c.id)
    } catch (e) {
      alert('Não foi possível alterar este acesso. ' + (e?.message ?? ''))
    }
  }

  const [resetAlvo, setResetAlvo] = useState(null)   // { empresa, usuario }
  const [minhaConta, setMinhaConta] = useState(false)

  // Classificar o escritório (pagante / teste / cortesia) e o valor dele.
  const salvarCobranca = async (c, patch) => {
    const antes = companies
    setCompanies(prev => prev.map(x => x.id === c.id
      ? { ...x, cobranca: { ...(x.cobranca ?? {}), ...patch },
          valorMensal: patch.valorMensal !== undefined ? patch.valorMensal : x.valorMensal }
      : x))
    try { await api.master.setCobranca(c.id, patch) }
    catch (e) {
      setCompanies(antes)
      alert('Não foi possível salvar. ' + (e?.message ?? ''))
    }
  }

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
          {/* O menu que não existia aqui: do painel só dava para sair ou entrar
              num escritório — para chegar nas Configurações era preciso saber
              digitar /app no endereço. */}
          <nav className="hidden sm:flex items-center gap-1 mr-1">
            <button onClick={() => navigate('/app')}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
              title="Abrir a área de trabalho (clientes, processos, prazos, financeiro)">
              Abrir o sistema
            </button>
            <button onClick={() => setMinhaConta(true)}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
              title="Trocar a minha senha">
              Minha conta
            </button>
          </nav>
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
            <button onClick={() => { setForm({ ...EMPTY_FORM, plan: plans[0]?.key ?? 'starter' }); setShowNew(true); setErroForm('') }} className="btn-primary flex items-center gap-2">
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
              <p className="text-[11px] text-[var(--text-muted)] mb-4">Defina o nome de cada plano, quantos acessos (usuários) ele permite e quanto custa por mês. Deixe o limite em branco para <b>ilimitado</b>; o preço em branco significa <b>a definir</b> — e aí o plano não entra na conta do previsto.</p>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_110px_110px_32px] gap-2 px-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  <span>Nome do plano</span><span>Acessos</span><span>R$/mês</span><span></span>
                </div>
                {plans.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] py-4 text-center">Nenhum plano. Clique em "Adicionar plano".</p>
                )}
                {plans.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
                    <input
                      value={p.name ?? ''} onChange={e => setPlanField(i, 'name', e.target.value)}
                      placeholder="Ex: Escritório"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                    <input
                      type="number" min="1"
                      value={p.maxUsers ?? ''} onChange={e => setPlanField(i, 'maxUsers', e.target.value)}
                      placeholder="ilimitado"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                    <input
                      type="number" min="0" step="0.01"
                      value={p.price ?? ''} onChange={e => setPlanField(i, 'price', e.target.value)}
                      placeholder="a definir"
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
        {/* Dinheiro primeiro: é a pergunta que se faz ao abrir este painel. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="card p-4 border-emerald-800/40">
            <p className="text-2xl font-bold text-emerald-400 leading-none">{pagantes.length}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Pagantes</p>
          </div>
          <div className="card p-4 border-amber-800/40">
            <p className="text-2xl font-bold text-amber-400 leading-none">{emTeste.length}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Em teste grátis</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-white leading-none">{cortesias.length}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Cortesia</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-white leading-none">{moeda(receitaPrevista)}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Previsto por mês</p>
          </div>
        </div>

        {/* O painel diz o que ele NÃO sabe, em vez de contar errado. */}
        {(aDefinir.length > 0 || pagantesSemValor > 0) && (
          <div className="mb-6 px-4 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10">
            <p className="text-xs text-amber-300">
              {aDefinir.length > 0 && <>
                <b>{aDefinir.length} escritório(s) sem classificação.</b> O sistema nunca
                guardou quem paga e quem está testando — marque em cada cartão abaixo
                (Pagante · Teste · Cortesia) para estes números ficarem certos.
              </>}
              {aDefinir.length > 0 && pagantesSemValor > 0 && ' '}
              {pagantesSemValor > 0 && <>
                <b>{pagantesSemValor} pagante(s) sem valor definido</b> — não entram no
                previsto do mês. Defina o valor no cartão, ou o preço do plano na aba Planos.
              </>}
            </p>
          </div>
        )}

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

                {/* Situação comercial deste escritório */}
                <div className="rounded-lg border border-[var(--border)] p-2.5 space-y-2">
                  <div className="flex items-center gap-1">
                    {[['pagante', 'Pagante'], ['teste', 'Teste'], ['cortesia', 'Cortesia']].map(([v, rotulo]) => (
                      <button key={v}
                        onClick={() => salvarCobranca(c, { situacao: c.cobranca?.situacao === v ? null : v })}
                        className={`flex-1 text-[10px] py-1 rounded-md border transition-colors ${
                          c.cobranca?.situacao === v
                            ? (v === 'pagante' ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                               : v === 'teste' ? 'border-amber-600 bg-amber-950/50 text-amber-300'
                               : 'border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-secondary)]')
                            : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                        {rotulo}
                      </button>
                    ))}
                  </div>
                  {!c.cobranca?.situacao && (
                    <p className="text-[10px] text-amber-400">Sem classificação — não entra na conta.</p>
                  )}
                  {c.cobranca?.situacao === 'teste' && (
                    <label className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      Teste até
                      <input type="date" value={c.cobranca?.trialAte ?? ''}
                        onChange={e => salvarCobranca(c, { trialAte: e.target.value })}
                        className="flex-1 px-2 py-1 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[11px] text-white focus:border-brand-500 focus:outline-none" />
                    </label>
                  )}
                  {c.cobranca?.situacao === 'pagante' && (
                    <label className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      R$/mês
                      <input type="number" min="0" step="0.01"
                        value={c.cobranca?.valorMensal ?? ''}
                        placeholder={c.precoDoPlano != null ? String(c.precoDoPlano) : 'a definir'}
                        onChange={e => salvarCobranca(c, { valorMensal: e.target.value === '' ? null : Number(e.target.value) })}
                        className="flex-1 px-2 py-1 rounded-md bg-[var(--bg-input)] border border-[var(--border)] text-[11px] text-white focus:border-brand-500 focus:outline-none" />
                    </label>
                  )}
                </div>

                {/* Acessos deste escritório */}
                <div>
                  <button onClick={() => verAcessos(c)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-brand-500/40 transition-colors">
                    <span>👤 Acessos ({c.usersCount ?? 0})</span>
                    <span className="text-[var(--text-muted)]">{abertos.has(c.id) ? '▴' : '▾'}</span>
                  </button>

                  {abertos.has(c.id) && (
                    <div className="mt-2 space-y-2">
                      {carregandoAcessos === c.id && !acessos[c.id] ? (
                        <p className="text-[11px] text-[var(--text-muted)] text-center py-2">Carregando…</p>
                      ) : !(acessos[c.id] ?? []).length ? (
                        <p className="text-[11px] text-[var(--text-muted)] text-center py-2">Nenhum acesso cadastrado.</p>
                      ) : acessos[c.id].map(u => (
                        <div key={u.id} className="rounded-lg border border-[var(--border)] p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {u.loginName} · {u.role}
                                {u.lastLoginAt
                                  ? ` · entrou ${new Date(u.lastLoginAt).toLocaleDateString('pt-BR')}`
                                  : ' · nunca entrou'}
                              </p>
                            </div>
                            <span className={`badge border text-[9px] flex-shrink-0 ${u.isActive ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30' : 'badge-red'}`}>
                              {u.isActive ? 'Ativo' : 'Bloqueado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <button onClick={() => setResetAlvo({ empresa: c, usuario: u })}
                              className="text-[10px] px-2 py-1 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                              🔑 Nova senha
                            </button>
                            <button onClick={() => alternarAcesso(c, u)}
                              className={`text-[10px] px-2 py-1 rounded-md ml-auto ${u.isActive
                                ? 'text-[var(--text-muted)] hover:text-red-400'
                                : 'text-emerald-400 hover:text-emerald-300'}`}>
                              {u.isActive ? 'Interromper acesso' : 'Liberar acesso'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Modal: redefinir a senha de um acesso */}
      {resetAlvo && (
        <ModalNovaSenha
          empresa={resetAlvo.empresa}
          usuario={resetAlvo.usuario}
          onClose={() => setResetAlvo(null)}
          onPronto={() => { recarregarAcessos(resetAlvo.empresa.id); setResetAlvo(null) }}
        />
      )}

      {/* Modal: minha conta */}
      {minhaConta && <ModalMinhaConta onClose={() => setMinhaConta(false)} />}

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
                <input value={form.name} onChange={setF('name')} placeholder="Ex: Silva Advogados"
                  className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border text-sm text-white focus:outline-none ${nomeEmUso ? 'border-amber-500 focus:border-amber-400' : 'border-[var(--border)] focus:border-brand-500'}`} />
                {nomeEmUso && (
                  <p className="mt-1.5 text-xs text-amber-400">
                    Já existe uma empresa chamada <b>{nomeEmUso.name}</b>. Como o login usa o
                    nome da empresa, dois iguais deixariam a entrada ambígua — escolha outro
                    nome (ex.: <b>{form.name.trim()} — Matriz</b>).
                  </p>
                )}
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
            {erroForm && (
              <div className="mx-5 mb-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40">
                <p className="text-xs text-red-300">{erroForm}</p>
              </div>
            )}
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button onClick={() => { setShowNew(false); setErroForm('') }} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white">Cancelar</button>
              <button onClick={createCompany} disabled={saving || !!nomeEmUso} className="btn-primary text-sm disabled:opacity-60">{saving ? 'Criando…' : 'Criar empresa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Nova senha de um acesso ───────────────────────────────────────────────
//
// Antes só dava para trocar a senha de alguém entrando no escritório como se
// fosse a própria pessoa — e para isso era preciso saber a senha dela. Quando
// alguém da equipe esquecia, não havia saída dentro do sistema.
function ModalNovaSenha({ empresa, usuario, onClose, onPronto }) {
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pronta, setPronta] = useState(false)

  // Sem caracteres ambíguos: esta senha vai ser ditada ou copiada para alguém.
  const gerar = () => {
    const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    const n = 4
    const grupo = () => Array.from({ length: 4 }, () => AB[Math.floor(Math.random() * AB.length)]).join('')
    setSenha(Array.from({ length: n }, grupo).join('-'))
    setErro('')
  }

  const salvar = async () => {
    if (senha.trim().length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    setSalvando(true); setErro('')
    try {
      await api.master.updateUser(usuario.id, { password: senha })
      setPronta(true)
    } catch (e) {
      setErro(e?.message ?? 'Não foi possível trocar a senha.')
    } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-white">Nova senha de acesso</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">✕</button>
        </div>

        {pronta ? (
          <div className="p-5 space-y-3">
            <div className="px-3 py-2.5 rounded-lg border border-emerald-600/40 bg-emerald-950/30">
              <p className="text-xs text-emerald-300">Senha trocada. As sessões abertas dessa pessoa foram encerradas.</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Passe esta senha para <b>{usuario.name}</b>:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white font-mono">{senha}</code>
                <button onClick={() => navigator.clipboard?.writeText(senha)}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Copiar</button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-2">
                Peça para ela entrar e trocar em Configurações → Usuários. Esta janela é o
                único lugar onde a senha aparece — depois de fechar, nem você nem o sistema
                conseguem lê-la de novo.
              </p>
            </div>
            <button onClick={onPronto} className="btn-primary w-full text-sm">Fechar</button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                Acesso de <b className="text-white">{usuario.name}</b> ({usuario.loginName}) —
                escritório <b className="text-white">{empresa.name}</b>.
              </p>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Senha nova (mín. 8 caracteres)</label>
                <div className="flex items-center gap-2">
                  <input value={senha} onChange={e => { setSenha(e.target.value); setErro('') }} autoFocus
                    placeholder="digite ou gere uma"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none" />
                  <button onClick={gerar} className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)] whitespace-nowrap">Gerar</button>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Ao salvar, as sessões abertas dessa pessoa são encerradas — ela precisa
                entrar de novo com a senha nova.
              </p>
            </div>
            {erro && (
              <div className="mx-5 mb-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40">
                <p className="text-xs text-red-300">{erro}</p>
              </div>
            )}
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn-primary text-sm disabled:opacity-60">{salvando ? 'Salvando…' : 'Trocar senha'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Minha conta: a dona troca a própria senha ─────────────────────────────
//
// Antes não havia caminho nenhum: o Painel Master não tinha esta opção, e para
// chegar em Configurações era preciso digitar /app no endereço do navegador.
function ModalMinhaConta({ onClose }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pronta, setPronta] = useState(false)

  const salvar = async () => {
    if (nova.length < 8) { setErro('A senha nova precisa ter pelo menos 8 caracteres.'); return }
    if (nova !== confirma) { setErro('A confirmação não bate com a senha nova.'); return }
    setSalvando(true); setErro('')
    try {
      await api.master.changeMyPassword({ senhaAtual: atual, novaSenha: nova })
      setPronta(true)
    } catch (e) {
      setErro(e?.message ?? 'Não foi possível trocar a senha.')
    } finally { setSalvando(false) }
  }

  const campo = 'w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-white focus:border-brand-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-white">Minha conta</p>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">✕</button>
        </div>

        {pronta ? (
          <div className="p-5 space-y-3">
            <div className="px-3 py-2.5 rounded-lg border border-emerald-600/40 bg-emerald-950/30">
              <p className="text-xs text-emerald-300">
                Senha trocada. As outras sessões suas foram encerradas — se você estiver
                logada em outro computador, vai precisar entrar de novo.
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full text-sm">Fechar</button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Senha atual</label>
                <input type="password" value={atual} onChange={e => { setAtual(e.target.value); setErro('') }} autoFocus className={campo} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Senha nova (mín. 8 caracteres)</label>
                <input type="password" value={nova} onChange={e => { setNova(e.target.value); setErro('') }} className={campo} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Repita a senha nova</label>
                <input type="password" value={confirma} onChange={e => { setConfirma(e.target.value); setErro('') }} className={campo} />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Pedimos a senha atual de propósito: um painel deixado aberto não pode virar
                a chave da casa na mão de quem passar pelo computador.
              </p>
            </div>
            {erro && (
              <div className="mx-5 mb-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/40">
                <p className="text-xs text-red-300">{erro}</p>
              </div>
            )}
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn-primary text-sm disabled:opacity-60">{salvando ? 'Salvando…' : 'Trocar senha'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
