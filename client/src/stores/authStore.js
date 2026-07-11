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
        set({ user: null, tenant: null })
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
      partialize: s => ({ user: s.user, tenant: s.tenant }),
    }
  )
)
