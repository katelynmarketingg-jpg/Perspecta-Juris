import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// A ordem aqui é a ordem do botão de girar tema, e também a dos rótulos.
export const TEMAS = ['dark', 'medium', 'light']
export const ROTULO_DO_TEMA = { dark: 'Escuro', medium: 'Médio', light: 'Claro' }

export const useUiStore = create(
  persist(
    (set, get) => ({
      // Três temas, com os nomes dos papéis do manual da marca:
      // 'dark' = ESTRUTURA (preto) · 'medium' = INTELIGÊNCIA (cinza) ·
      // 'light' = RESPIRO (claro).
      theme: 'dark',
      sidebarCollapsed: false,
      notifications: [],
      toast: null,

      _applyThemeClasses: (theme) => {
        const el = document.documentElement
        const valido = TEMAS.includes(theme) ? theme : 'dark'
        for (const t of TEMAS) el.classList.toggle(t, t === valido)
      },

      // Gira entre os três, na ordem escuro → médio → claro → escuro.
      toggleTheme: () => {
        const atual = TEMAS.indexOf(get().theme)
        const next = TEMAS[(atual + 1) % TEMAS.length] ?? 'dark'
        get()._applyThemeClasses(next)
        set({ theme: next })
      },

      setTheme: (theme) => { get()._applyThemeClasses(theme); set({ theme }) },

      applyTheme: () => { get()._applyThemeClasses(get().theme) },

      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      showToast: (message, type = 'success', duration = 3500) => {
        const id = Date.now()
        set({ toast: { id, message, type } })
        setTimeout(() => set(s => s.toast?.id === id ? { toast: null } : {}), duration)
      },

      clearToast: () => set({ toast: null }),

      addNotification: (n) => set(s => ({
        notifications: [{ ...n, id: Date.now(), read: false }, ...s.notifications].slice(0, 50)
      })),

      markAllRead: () => set(s => ({
        notifications: s.notifications.map(n => ({ ...n, read: true }))
      })),
    }),
    {
      name: 'pj_ui',
      partialize: s => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)
