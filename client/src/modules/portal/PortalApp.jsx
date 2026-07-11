import { Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom'
import { usePortalAuthStore } from '../../stores/portalAuthStore'
import { IconScale, IconHome, IconBriefcase, IconFolder, IconMessageCircle, IconLogOut } from '../../components/ui'
import { useEffect } from 'react'

const NAV = [
  { to: '/portal',        label: 'Início',      icon: <IconHome size={16} />,          exact: true },
  { to: '/portal/processes', label: 'Processos', icon: <IconBriefcase size={16} /> },
  { to: '/portal/documents', label: 'Documentos', icon: <IconFolder size={16} /> },
  { to: '/portal/messages',  label: 'Mensagens',  icon: <IconMessageCircle size={16} /> },
]

export function RequirePortalAuth({ children }) {
  const client = usePortalAuthStore(s => s.client)
  if (!client) return <Navigate to="/portal/login" replace />
  return children
}

export default function PortalApp() {
  const { client, logout } = usePortalAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/portal/login')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-sidebar)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-orange">
              <IconScale size={13} className="text-white" />
            </div>
            <div className="leading-none">
              <div className="text-[12px] font-bold text-white tracking-tight">Perspecta Juris</div>
              <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Portal do Cliente</div>
            </div>
          </div>

          {/* Nav links — desktop */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-500/20 text-accent-400'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-white leading-none">{client?.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{client?.cpf}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[11px] font-bold text-white">
              {client?.name?.charAt(0)}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sair"
            >
              <IconLogOut size={15} />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-[var(--border)]">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent-400' : 'text-[var(--text-muted)]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6 page-enter">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-3">
        <p className="text-center text-[11px] text-[var(--text-muted)]">
          Perspecta Juris — Acesso restrito ao cliente
        </p>
      </footer>
    </div>
  )
}
