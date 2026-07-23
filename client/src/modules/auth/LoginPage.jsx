import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Button, Input, IconScale } from '../../components/ui'
import BrandLogo from '../../components/BrandLogo'

// Guarda o último acesso deste aparelho: empresa + nome (nunca a senha).
const REMEMBER_KEY = 'pj_last_login'
function loadRemembered() {
  try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null') } catch { return null }
}

export default function LoginPage() {
  const remembered = loadRemembered()
  const [empresa, setEmpresa] = useState(remembered?.empresa || '')
  const [nome, setNome]       = useState(remembered?.nome || '')
  const [senha, setSenha]     = useState('')
  const [error, setError]     = useState('')
  // Modo "bem-vindo de volta": só pede a senha quando já há acesso salvo.
  const [quick, setQuick]     = useState(Boolean(remembered))
  const { login, loading, user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.add('dark')
    if (user) navigate(user.role === 'master' ? '/master/companies' : '/app', { replace: true })
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = await login(empresa.trim(), nome.trim(), senha)
      // Salva empresa + nome para o próximo acesso (sem a senha).
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ empresa: empresa.trim(), nome: nome.trim() }))
      navigate(data.user.role === 'master' ? '/master/companies' : '/app', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciais inválidas.')
    }
  }

  const trocarConta = () => {
    localStorage.removeItem(REMEMBER_KEY)
    setEmpresa(''); setNome(''); setSenha(''); setError(''); setQuick(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-orange mb-5">
            <BrandLogo size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Perspecta Juris</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Sistema de Gestão Jurídica</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-5 uppercase tracking-wider">
            {quick ? 'Confirme a sua senha' : 'Entrar na sua conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {quick ? (
              /* Já sabemos empresa e nome: mostra quem está entrando e pede só a senha. */
              <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-500 text-white font-bold shrink-0">
                  {(nome || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{nome}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{empresa}</p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">Empresa</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Nome do escritório"
                    value={empresa}
                    onChange={e => setEmpresa(e.target.value)}
                    autoComplete="organization"
                    required
                  />
                </div>
                <div>
                  <label className="label">Nome</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Seu nome de acesso"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">Senha</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="current-password"
                autoFocus={quick}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-950/60 border border-red-800/50 px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            {quick && (
              <button
                type="button"
                onClick={trocarConta}
                className="w-full text-center text-xs text-[var(--text-muted)] hover:text-white transition-colors mt-1"
              >
                Entrar com outra conta
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Perspecta Juris © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
