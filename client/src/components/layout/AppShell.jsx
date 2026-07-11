import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import AiAssistant from './AiAssistant'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'

import { sincronizarDiario } from '../../lib/diarioAuto'
import { parametrosDesatualizados, paramsInfo } from '../../lib/legalCalc'

// tarefas em aberto (para o badge lateral) — tolerante a falhas
const apiTasksList = () => api.tasks.list().then(d => Array.isArray(d) ? d : (d?.data ?? [])).catch(() => [])
const lsGet = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fb } catch { return fb } }
import {
  IconGrid, IconUsers, IconBriefcase, IconDollar, IconCalendar,
  IconClipboard, IconFolder, IconBarChart, IconSettings, IconLogOut,
  IconScale, IconMenu, IconX, IconExternalLink,
  IconAlertCircle, IconCheck, IconBuilding, IconBookOpen, IconZap,
  IconSun, IconMoon, IconCalculator, IconFileText, IconActivity,
} from '../ui'

const NAV = [
  { to: '/app',             label: 'Dashboard',   icon: <IconGrid size={18} />,      exact: true },
  { to: '/app/clients',     label: 'Clientes',    icon: <IconUsers size={18} /> },
  { to: '/app/processes',   label: 'Processos',   icon: <IconBriefcase size={18} /> },
  { to: '/app/movimentacoes', label: 'Movimentações', icon: <IconActivity size={18} /> },
  { to: '/app/deadlines',   label: 'Prazos',      icon: <IconCalendar size={18} /> },
  { to: '/app/tasks',       label: 'Tarefas',     icon: <IconClipboard size={18} /> },
  { to: '/app/financial',   label: 'Financeiro',  icon: <IconDollar size={18} /> },
  { to: '/app/documents',   label: 'Documentos',  icon: <IconFolder size={18} /> },
  { to: '/app/modelos',     label: 'Modelos',     icon: <IconFileText size={18} /> },
  { to: '/app/calculator',  label: 'Calculadora', icon: <IconCalculator size={18} /> },
  { to: '/app/theses',      label: 'Teses',       icon: <IconBookOpen size={18} /> },
  { to: '/app/automations', label: 'Automações',  icon: <IconZap size={18} /> },
  { to: '/app/reports',     label: 'Relatórios',  icon: <IconBarChart size={18} /> },
  { to: '/app/registros',   label: 'Registros',   icon: <IconClipboard size={18} /> },
]

const NAV_MASTER = [
  { to: '/master/companies', label: 'Empresas', icon: <IconBuilding size={18} /> },
  { to: '/app',              label: 'Meu Painel', icon: <IconGrid size={18} />, exact: true },
]

export default function AppShell() {
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [toast, setToast] = useState(null)
  const [myTasks, setMyTasks] = useState(0)

  const { theme, toggleTheme, applyTheme, showToast } = useUiStore()
  useEffect(() => { applyTheme() }, [])

  // Lembrete anual (SOMENTE administrador do sistema): parâmetros previdenciários desatualizados
  useEffect(() => {
    if (user?.role !== 'master') return
    if (sessionStorage.getItem('pj_prev_reminder')) return
    if (parametrosDesatualizados()) {
      setTimeout(() => showToast(`Parâmetros previdenciários são de ${paramsInfo().ano} — verifique se há tábua/INPC novos (Calculadora → ⚙️ Parâmetros).`, 'info', 7000), 2500)
      sessionStorage.setItem('pj_prev_reminder', '1')
    }
  }, [user?.id])

  // Conta tarefas em aberto atribuídas ao usuário logado (badge lateral)
  useEffect(() => {
    let alive = true
    apiTasksList().then(list => {
      if (!alive) return
      setMyTasks(list.filter(t => t.assignedTo === user?.id && t.status !== 'done').length)
    })
    return () => { alive = false }
  }, [location.pathname, user?.id])

  // ── Auto-sync do Diário (DJEN) a cada 1 minuto (enquanto o app estiver aberto) ──
  useEffect(() => {
    if (user?.role === 'master') return
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        const r = await sincronizarDiario({ currentUser: user, prazoDias: 15, auto: true })
        if (r?.processadas > 0) apiTasksList().then(list => setMyTasks(list.filter(t => t.assignedTo === user?.id && t.status !== 'done').length))
      } catch {} finally { running = false }
    }
    tick() // roda ao entrar
    const id = setInterval(tick, 60_000) // a cada 1 minuto
    return () => clearInterval(id)
  }, [user?.id])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isMaster = user?.role === 'master'
  const baseNav = isMaster ? NAV_MASTER : NAV

  // ── Preferências de navegação por empresa (ordem + posição) ──
  const navPrefsKey = `pj_navprefs_${tenant?.id ?? 'demo'}`
  const [navPrefs, setNavPrefs] = useState(() => lsGet(navPrefsKey, { position: 'side', order: [] }))
  useEffect(() => { setNavPrefs(lsGet(navPrefsKey, { position: 'side', order: [] })) }, [location.pathname, navPrefsKey])

  const navItems = (() => {
    const order = navPrefs.order ?? []
    const byTo = Object.fromEntries(baseNav.map(i => [i.to, i]))
    const inOrder = order.map(to => byTo[to]).filter(Boolean)
    const rest = baseNav.filter(i => !order.includes(i.to))
    return [...inOrder, ...rest]
  })()
  const topNav = navPrefs.position === 'top' && !isMaster

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)] transition-all duration-200
        lg:relative lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'w-[60px]' : 'w-[220px]'}
        ${topNav ? 'lg:hidden' : ''}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-3 py-4 border-b border-[var(--border)] ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-orange">
            <IconScale size={15} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-[13px] font-bold text-white tracking-tight leading-none">Perspecta</div>
              <div className="text-[9px] text-brand-500 font-semibold tracking-[0.2em] uppercase mt-0.5">Juris</div>
            </div>
          )}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-sidebar)] hover:bg-white/[0.06] transition-colors ml-auto"
          >
            {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
          </button>
        </div>

        {/* Tenant */}
        {!collapsed && tenant && (
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[11px] text-[var(--text-muted)] truncate">{tenant.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-100
                ${isActive
                  ? 'bg-[var(--bg-active)] text-accent-400 border-l-[2px] border-brand-500 pl-[10px] pr-3 py-2.5'
                  : 'text-[var(--text-sidebar-muted)] hover:bg-white/[0.04] hover:text-[var(--text-sidebar)] pl-3 pr-3 py-2.5'}
                ${collapsed ? 'justify-center px-0 pl-0 pr-0' : ''}
              `}
            >
              {item.icon}
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {item.to === '/app/tasks' && myTasks > 0 && (
                <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-[0_0_6px_rgba(249,115,22,0.6)] ${collapsed ? 'absolute top-1 right-1' : ''}`} title={`${myTasks} tarefa(s) em aberto`}>
                  {myTasks}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Perspecta Hub link */}
        {!collapsed && (
          <div className="px-1.5 py-1">
            <a
              href={import.meta.env.VITE_HUB_URL ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04] transition-colors"
            >
              <IconExternalLink size={13} />
              Perspecta Hub
            </a>
          </div>
        )}

        {/* Bottom */}
        <div className="px-1.5 py-2 border-t border-[var(--border)] space-y-0.5">
          <NavLink
            to="/app/settings"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-100
              ${isActive
                ? 'bg-[var(--bg-active)] text-accent-400 border-l-[2px] border-brand-500 pl-[10px] pr-3 py-2.5'
                : 'text-[var(--text-sidebar-muted)] hover:bg-white/[0.04] hover:text-[var(--text-sidebar)] pl-3 pr-3 py-2.5'}
              ${collapsed ? 'justify-center px-0' : ''}
            `}
          >
            <IconSettings size={18} />
            {!collapsed && <span>Configurações</span>}
          </NavLink>

          {/* Suporte (menor) */}
          <NavLink
            to="/app/suporte"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `flex items-center gap-2.5 rounded-lg text-xs transition-all ${isActive ? 'text-accent-400' : 'text-[var(--text-muted)] hover:text-[var(--text-sidebar)] hover:bg-white/[0.04]'} ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-1.5'}`}
          >
            <IconAlertCircle size={14} />
            {!collapsed && <span>Suporte & Manual</span>}
          </NavLink>

          {/* User info */}
          <div className={`flex items-center gap-2.5 px-3 py-2 ${collapsed ? 'justify-center px-0' : ''}`}>
            <div className="w-6 h-6 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-sidebar)] truncate">{user?.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate capitalize">{user?.role}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <IconLogOut size={15} />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-card)] flex-shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          >
            <IconMenu size={18} />
          </button>

          {topNav ? (
            <>
              {/* Logo + nav horizontal (barra em cima) */}
              <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-orange"><IconScale size={13} className="text-white" /></div>
                <span className="text-[13px] font-bold text-[var(--text-primary)]">Perspecta<span className="text-brand-500 text-[9px] font-semibold tracking-widest uppercase ml-1">Juris</span></span>
              </div>
              <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto">
                {navItems.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.exact}
                    className={({ isActive }) => `relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-[var(--bg-active)] text-accent-400' : 'text-[var(--text-sidebar-muted)] hover:text-[var(--text-sidebar)] hover:bg-[var(--bg-hover)]'}`}>
                    {item.icon}
                    <span>{item.label}</span>
                    {item.to === '/app/tasks' && myTasks > 0 && (
                      <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">{myTasks}</span>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                <button onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">{theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}</button>
                <NavLink to="/app/settings" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><IconSettings size={16} /></NavLink>
                <button onClick={handleLogout} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10"><IconLogOut size={16} /></button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <IconMenu size={17} />
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <div className="page-enter h-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <AiAssistant />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-modal animate-slide-up max-w-sm border ${
          toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200' :
          toast.type === 'error'   ? 'bg-red-900/90 border-red-700 text-red-200' :
          'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]'
        }`}>
          {toast.type === 'success' ? <IconCheck size={15} /> : <IconAlertCircle size={15} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">
            <IconX size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
