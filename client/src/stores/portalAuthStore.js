import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePortalAuthStore = create(persist(
  (set) => ({
    client: null,
    login: (client) => set({ client }),
    logout: () => set({ client: null }),
  }),
  { name: 'pj_portal_auth' }
))
