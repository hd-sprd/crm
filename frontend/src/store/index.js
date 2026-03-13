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
}))
