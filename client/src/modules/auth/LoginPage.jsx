import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Button, Input, IconScale } from '../../components/ui'

export default function LoginPage() {
  const [empresa, setEmpresa] = useState('')
  const [nome, setNome]       = useState('')
  const [senha, setSenha]     = useState('')
  const [error, setError]     = useState('')
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
      navigate(data.user.role === 'master' ? '/master/companies' : '/app', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciais inválidas.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-orange mb-5">
            <IconScale size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Perspecta Juris</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Sistema de Gestão Jurídica</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-5 uppercase tracking-wider">Entrar na sua conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <label className="label">Senha</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="current-password"
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
          </form>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Perspecta Juris © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
