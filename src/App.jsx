import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import SupportButton from './components/SupportButton'
import StartupSequence from './components/StartupSequence'
import Auth from './pages/Auth'
import Home from './pages/Home'
import CategoryPage from './pages/CategoryPage'
import MatchRulesPage from './pages/MatchRulesPage'
import Matches from './pages/Matches'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import TransactionHistory from './pages/TransactionHistory'
import Notifications from './pages/Notifications'
import { useEffect, useState } from 'react'
import Admin from './pages/Admin'
import { ToastProvider } from './components/ToastContext'
import { ConfirmProvider } from './components/ConfirmContext'

// লিংক এডিট করতে হলে src/constants/links.js এ যান

function AppShell({ children }) {
  return (
    <div className="device">
      <TopBar />
      {children}
      <SupportButton />
      <BottomNav />
    </div>
  )
}

export default function App() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('xts-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return (
    <ConfirmProvider>
    <ToastProvider>
    {!booted && <StartupSequence onDone={() => setBooted(true)} />}
    {booted && (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <Home />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/category/:slug"
        element={
          <ProtectedRoute>
            <AppShell>
              <CategoryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:tid/rules"
        element={
          <ProtectedRoute>
            <AppShell>
              <MatchRulesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <AppShell>
              <Matches />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <Leaderboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppShell>
              <Profile />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <AppShell>
              <TransactionHistory />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppShell>
              <Notifications />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AppShell>
              <Admin />
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
    )}
    </ToastProvider>
    </ConfirmProvider>
  )
}
