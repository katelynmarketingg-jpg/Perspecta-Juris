import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortalAuthStore } from '../../stores/portalAuthStore'
import { IconScale, IconShield } from '../../components/ui'

const MOCK_CLIENTS = [
  { id: '1', name: 'José da Silva', cpf: '123.456.789-00', email: 'jose@email.com', password: '123456' },
  { id: '2', name: 'Maria Santos', cpf: '987.654.321-00', email: 'maria@email.com', password: '123456' },
]

export default function PortalLogin() {
  const navigate  = useNavigate()
  const login     = usePortalAuthStore(s => s.login)
  const [credential, setCredential] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    const client = MOCK_CLIENTS.find(
      c => (c.cpf === credential || c.email === credential) && c.password === password
    )
    if (client) {
      login(client)
      navigate('/portal')
    } else {
      setError('CPF/e-mail ou senha inválidos.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center shadow-orange mb-3">
            <IconScale size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Perspecta Juris</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Portal do Cliente</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-4">
          <div className="text-center mb-2">
            <h2 className="text-base font-semibold text-white">Acessar sua conta</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Acompanhe seus processos e documentos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">CPF ou E-mail</label>
              <input
                value={credential}
                onChange={e => setCredential(e.target.value)}
                placeholder="000.000.000-00 ou seu@email.com"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:border-brand-500 focus:outline-none placeholder:text-[var(--text-muted)]"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Entrar'}
            </button>
          </form>

          <p className="text-[11px] text-[var(--text-muted)] text-center">
            Demo: CPF <span className="text-[var(--text-secondary)]">123.456.789-00</span> · Senha <span className="text-[var(--text-secondary)]">123456</span>
          </p>
        </div>

        {/* Security notice */}
        <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-[var(--text-muted)]">
          <IconShield size={12} />
          <span>Acesso seguro e criptografado</span>
        </div>

        <div className="text-center mt-4">
          <a href="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            ← Acesso para advogados
          </a>
        </div>
      </div>
    </div>
  )
}
