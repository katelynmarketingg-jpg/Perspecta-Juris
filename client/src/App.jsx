import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { usePortalAuthStore } from './stores/portalAuthStore'
import AppShell from './components/layout/AppShell'
import { lazy, Suspense, useEffect } from 'react'
import { Spinner } from './components/ui'
import { syncAllProcesses, shouldAutoSync } from './lib/datajudSync'
import { useUiStore } from './stores/uiStore'

const LoginPage       = lazy(() => import('./modules/auth/LoginPage'))
const MasterPage      = lazy(() => import('./modules/master/MasterPage'))
const DashboardPage   = lazy(() => import('./modules/dashboard/DashboardPage'))
const ClientsPage     = lazy(() => import('./modules/clients/ClientsPage'))
const ClientDetail    = lazy(() => import('./modules/clients/ClientDetail'))
const ClientForm      = lazy(() => import('./modules/clients/ClientForm'))
const ClientPage      = lazy(() => import('./modules/clients/ClientPage'))
const ProcessesPage   = lazy(() => import('./modules/processes/ProcessesPage'))
const ProcessDetail   = lazy(() => import('./modules/processes/ProcessDetail'))
const ProcessForm     = lazy(() => import('./modules/processes/ProcessForm'))
const DeadlinesPage   = lazy(() => import('./modules/deadlines/DeadlinesPage'))
const MovimentacoesPage = lazy(() => import('./modules/movimentacoes/MovimentacoesPage'))
const TasksPage       = lazy(() => import('./modules/tasks/TasksPage'))
const FinancialPage   = lazy(() => import('./modules/financial/FinancialPage'))
const DocumentsPage   = lazy(() => import('./modules/documents/DocumentsPage'))
const CalculatorPage  = lazy(() => import('./modules/calculator/CalculatorPage'))
const ModelosPage     = lazy(() => import('./modules/modelos/ModelosPage'))
const ThesesPage      = lazy(() => import('./modules/theses/ThesesPage'))
const AutomationsPage = lazy(() => import('./modules/automations/AutomationsPage'))
const ReportsPage     = lazy(() => import('./modules/reports/ReportsPage'))
const SettingsPage    = lazy(() => import('./modules/settings/SettingsPage'))
const SuportePage     = lazy(() => import('./modules/suporte/SuportePage'))
const RegistrosPage   = lazy(() => import('./modules/registros/RegistrosPage'))

const SignPage         = lazy(() => import('./modules/sign/SignPage'))
const PortalLogin      = lazy(() => import('./modules/portal/PortalLogin'))
const PortalApp        = lazy(() => import('./modules/portal/PortalApp').then(m => ({ default: m.default })))
const PortalDashboard  = lazy(() => import('./modules/portal/PortalDashboard'))
const PortalProcesses  = lazy(() => import('./modules/portal/PortalProcesses'))
const PortalDocuments  = lazy(() => import('./modules/portal/PortalDocuments'))
const PortalMessages   = lazy(() => import('./modules/portal/PortalMessages'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-full py-24">
      <Spinner size={28} className="text-brand-500" />
    </div>
  )
}

function RequireAuth({ children }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireMaster({ children }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'master') return <Navigate to="/app" replace />
  return children
}

function RequirePortalAuth({ children }) {
  const client = usePortalAuthStore(s => s.client)
  if (!client) return <Navigate to="/portal/login" replace />
  return children
}

const W = ({ Page }) => <Suspense fallback={<Loading />}><Page /></Suspense>

const router = createBrowserRouter([
  {
    path: '/login',
    element: <W Page={LoginPage} />,
  },
  {
    path: '/master/companies',
    element: (
      <RequireMaster>
        <W Page={MasterPage} />
      </RequireMaster>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true,                element: <W Page={DashboardPage} /> },
      { path: 'clients',            element: <W Page={ClientsPage} /> },
      { path: 'clients/new',        element: <W Page={ClientPage} /> },
      { path: 'clients/:id',        element: <W Page={ClientPage} /> },
      { path: 'clients/:id/edit',   element: <W Page={ClientForm} /> },
      { path: 'processes',          element: <W Page={ProcessesPage} /> },
      { path: 'processes/new',      element: <W Page={ProcessForm} /> },
      { path: 'processes/:id',      element: <W Page={ProcessDetail} /> },
      { path: 'processes/:id/edit', element: <W Page={ProcessForm} /> },
      { path: 'movimentacoes',      element: <W Page={MovimentacoesPage} /> },
      { path: 'deadlines',          element: <W Page={DeadlinesPage} /> },
      { path: 'tasks',              element: <W Page={TasksPage} /> },
      { path: 'financial',          element: <W Page={FinancialPage} /> },
      { path: 'documents',          element: <W Page={DocumentsPage} /> },
      { path: 'modelos',            element: <W Page={ModelosPage} /> },
      { path: 'calculator',         element: <W Page={CalculatorPage} /> },
      { path: 'theses',             element: <W Page={ThesesPage} /> },
      { path: 'automations',        element: <W Page={AutomationsPage} /> },
      { path: 'reports',            element: <W Page={ReportsPage} /> },
      { path: 'registros',          element: <W Page={RegistrosPage} /> },
      { path: 'settings',           element: <W Page={SettingsPage} /> },
      { path: 'suporte',            element: <W Page={SuportePage} /> },
    ],
  },
  {
    path: '/assinar/:id',
    element: <W Page={SignPage} />,
  },
  {
    path: '/portal/login',
    element: <W Page={PortalLogin} />,
  },
  {
    path: '/portal',
    element: <W Page={PortalApp} />,
    children: [
      { index: true,                    element: <W Page={PortalDashboard} /> },
      { path: 'processes',              element: <W Page={PortalProcesses} /> },
      { path: 'documents',              element: <W Page={PortalDocuments} /> },
      { path: 'messages',               element: <W Page={PortalMessages} /> },
    ],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '*', element: <Navigate to="/app" replace /> },
])

function AutoSync() {
  const { showToast } = useUiStore()
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    if (!user) return
    if (!shouldAutoSync()) return

    // Aguarda 5s após login para não atrasar o carregamento inicial
    const t = setTimeout(async () => {
      const { newMovements, synced } = await syncAllProcesses().catch(() => ({ newMovements: 0, synced: 0 }))
      if (newMovements > 0) {
        showToast(`⚖️ DataJud: ${newMovements} nova${newMovements !== 1 ? 's' : ''} movimentaç${newMovements !== 1 ? 'ões' : 'ão'} importada${newMovements !== 1 ? 's' : ''}.`, 'success', 6000)
      }
    }, 5000)

    // Re-sync a cada hora
    const interval = setInterval(async () => {
      const { newMovements } = await syncAllProcesses().catch(() => ({ newMovements: 0 }))
      if (newMovements > 0) {
        showToast(`⚖️ DataJud: ${newMovements} nova${newMovements !== 1 ? 's' : ''} movimentaç${newMovements !== 1 ? 'ões' : 'ão'}.`, 'success', 6000)
      }
    }, 60 * 60 * 1000)

    return () => { clearTimeout(t); clearInterval(interval) }
  }, [user])

  return null
}

export default function App() {
  return (
    <>
      <AutoSync />
      <RouterProvider router={router} />
    </>
  )
}
