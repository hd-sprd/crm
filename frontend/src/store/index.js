import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // Deals view mode
  dealViewMode: 'kanban', // 'kanban' | 'list'
  setDealViewMode: (mode) => set({ dealViewMode: mode }),

  // Global loading
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Notification badge counts
  overdueTaskCount: 0,
  setOverdueTaskCount: (count) => set({ overdueTaskCount: count }),

  // Accounts cache — loaded once at app start so every page has them
  // immediately without a per-page fetch. AccountSelect uses this list
  // as the initial suggestion set and falls back to API search for
  // datasets too large to load upfront (> 200 entries).
  accounts: [],
  accountsLoaded: false,
  loadAccounts: async () => {
    if (get().accountsLoaded) return
    try {
      const { accountsApi } = await import('../api/accounts')
      const data = await accountsApi.list({ limit: 200 })
      set({ accounts: data, accountsLoaded: true })
    } catch {
      // silently ignore — AccountSelect will fall back to API search
    }
  },
  // Called after creating/editing an account so the cache stays fresh
  invalidateAccounts: () => set({ accountsLoaded: false }),
}))
