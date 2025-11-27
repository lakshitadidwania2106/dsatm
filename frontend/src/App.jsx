import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CarpoolPage } from './pages/CarpoolPage'
import { DriverPage } from './pages/DriverPage'
import { AccessibilityPage } from './pages/AccessibilityPage'
import { AppShell } from './layout/AppShell'
import { AccessibilityAnnouncer } from './components/AccessibilityAnnouncer'
import { useAppStore } from './store/useAppStore'
import './App.css'

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn)
  const userRole = useAppStore((state) => state.userRole)

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return children
}

const DriverRoute = ({ children }) => {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn)
  const userRole = useAppStore((state) => state.userRole)

  if (!isLoggedIn || userRole !== 'driver') {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <AccessibilityAnnouncer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/driver"
          element={
            <DriverRoute>
              <DriverPage />
            </DriverRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/carpool"
          element={
            <ProtectedRoute>
              <AppShell>
                <CarpoolPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accessibility"
          element={
            <ProtectedRoute>
              <AppShell>
                <AccessibilityPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
