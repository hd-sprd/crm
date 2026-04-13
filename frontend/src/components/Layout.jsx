import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '../store'
import AnimatedPage from './AnimatedPage'

export default function Layout() {
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const loadAccounts = useAppStore(s => s.loadAccounts)
  const location = useLocation()

  // Pre-load shared reference data once so all pages have it instantly
  useEffect(() => { loadAccounts() }, []) // eslint-disable-line

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar />
      <div
        className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait" initial={false}>
            <AnimatedPage key={location.pathname}>
              <Outlet />
            </AnimatedPage>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
