import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUiStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',        // 'light' | 'dark'
      sidebarCollapsed: false,
      notifications: [],
      toast: null,

      _applyThemeClasses: (theme) => {
        const el = document.documentElement
        el.classList.toggle('dark',  theme === 'dark')
        el.classList.toggle('light', theme === 'light')
      },

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light'
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
