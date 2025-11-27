import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { AccessibilityPage } from './pages/AccessibilityPage'
import { AppShell } from './layout/AppShell'
import { AccessibilityAnnouncer } from './components/AccessibilityAnnouncer'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AccessibilityAnnouncer />
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
