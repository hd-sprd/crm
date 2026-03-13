import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PermissionsProvider, usePermission } from './contexts/PermissionsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Deals from './pages/Deals'
import Accounts from './pages/Accounts'
import Contacts from './pages/Contacts'
import Quotes from './pages/Quotes'
import Tasks from './pages/Tasks'
import Reports from './pages/Reports'
import Admin from './pages/Admin'
import Settings from './pages/Settings'
import DealDetail from './pages/DealDetail'
import AccountDetail from './pages/AccountDetail'
import Help from './pages/Help'
import './i18n'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/" replace />
}

function PermRoute({ perm, children }) {
  const allowed = usePermission(perm)
  return allowed ? children : <Navigate to="/" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<Dashboard />} />
        <Route path="leads"    element={<PermRoute perm="view_leads"><Leads /></PermRoute>} />
        <Route path="deals"    element={<PermRoute perm="view_deals"><Deals /></PermRoute>} />
        <Route path="deals/:id" element={<PermRoute perm="view_deals"><DealDetail /></PermRoute>} />
        <Route path="accounts" element={<PermRoute perm="view_accounts"><Accounts /></PermRoute>} />
        <Route path="accounts/:id" element={<PermRoute perm="view_accounts"><AccountDetail /></PermRoute>} />
        <Route path="contacts" element={<PermRoute perm="view_contacts"><Contacts /></PermRoute>} />
        <Route path="quotes"   element={<PermRoute perm="view_quotes"><Quotes /></PermRoute>} />
        <Route path="tasks"    element={<PermRoute perm="view_tasks"><Tasks /></PermRoute>} />
        <Route path="reports"  element={<PermRoute perm="view_reports"><Reports /></PermRoute>} />
        <Route path="help"     element={<Help />} />
        <Route path="admin"    element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Inner component so it can access useAuth inside AuthProvider
function AppWithPermissions() {
  const { user } = useAuth()
  return (
    <PermissionsProvider user={user}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'dark:bg-gray-800 dark:text-white',
            duration: 3000,
          }}
        />
      </BrowserRouter>
    </PermissionsProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithPermissions />
      </AuthProvider>
    </ThemeProvider>
  )
}
