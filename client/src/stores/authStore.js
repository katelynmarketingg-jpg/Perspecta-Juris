import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api, { setTokens, clearTokens } from '../lib/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:   null,
      tenant: null,
      loading: false,
      error:  null,
      impersonating: false,   // master "entrou" em um escritório

      login: async (empresa, nome, senha) => {
        set({ loading: true, error: null })
        try {
          const data = await api.auth.login(empresa, nome, senha)
          setTokens({ access: data.accessToken, refresh: data.refreshToken })
          set({ user: data.user, tenant: data.tenant, loading: false })
          return data
        } catch (err) {
          set({ error: err.message, loading: false })
          throw err
        }
      },

      logout: async () => {
        try { await api.auth.logout() } catch {}
        clearTokens()
        localStorage.removeItem('pj_master_backup')
        set({ user: null, tenant: null, impersonating: false })
      },

      // Master "entra" em um escritório (sem deslogar). Guarda a sessão
      // master para poder voltar depois com exitToMaster().
      enterCompany: async (id) => {
        const backup = {
          access:  localStorage.getItem('pj_access_token'),
          refresh: localStorage.getItem('pj_refresh_token'),
          user:    get().user,
          tenant:  get().tenant,
        }
        const data = await api.master.enterCompany(id)
        localStorage.setItem('pj_master_backup', JSON.stringify(backup))
        setTokens({ access: data.accessToken, refresh: data.refreshToken })
        set({ user: data.user, tenant: data.tenant, impersonating: true })
        return data
      },

      // Volta para a sessão master guardada.
      exitToMaster: () => {
        const raw = localStorage.getItem('pj_master_backup')
        if (!raw) return false
        try {
          const b = JSON.parse(raw)
          if (b.access) setTokens({ access: b.access, refresh: b.refresh })
          localStorage.removeItem('pj_master_backup')
          set({ user: b.user, tenant: b.tenant, impersonating: false })
          return true
        } catch { return false }
      },

      loadMe: async () => {
        try {
          const data = await api.auth.me()
          set({ user: data.user, tenant: data.tenant })
        } catch {
          clearTokens()
          set({ user: null, tenant: null })
        }
      },

      updateUser: (updates) => set(s => ({ user: { ...s.user, ...updates } })),
    }),
    {
      name: 'pj_auth',
      partialize: s => ({ user: s.user, tenant: s.tenant, impersonating: s.impersonating }),
    }
  )
)
