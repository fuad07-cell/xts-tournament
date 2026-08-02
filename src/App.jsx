import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import Auth from './pages/Auth'
import Home from './pages/Home'
import CategoryPage from './pages/CategoryPage'
import MatchRulesPage from './pages/MatchRulesPage'
import Matches from './pages/Matches'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import TransactionHistory from './pages/TransactionHistory'
import { useState, useRef, useEffect } from 'react'
import Admin from './pages/Admin'
import { WHATSAPP_LINK, TELEGRAM_SUPPORT_LINK } from './constants/links'
import { ToastProvider } from './components/ToastContext'
import { ConfirmProvider } from './components/ConfirmContext'

// লিংক এডিট করতে হলে src/constants/links.js এ যান — App.jsx আর Home.jsx দুটোই ওখান থেকে পড়ে

const FAB_POS_KEY = 'xts-support-fab-pos'
const FAB_SIZE = 48 // must match the .support-fab button's width/height in index.css
const FAB_MARGIN = 8

function clampFabPos(x, y) {
  const maxX = window.innerWidth - FAB_SIZE - FAB_MARGIN
  const maxY = window.innerHeight - FAB_SIZE - FAB_MARGIN
  return {
    x: Math.min(Math.max(FAB_MARGIN, x), Math.max(FAB_MARGIN, maxX)),
    y: Math.min(Math.max(FAB_MARGIN, y), Math.max(FAB_MARGIN, maxY)),
  }
}

function SupportButton() {
  const [open, setOpen] = useState(false)
  // null = not moved yet, use the default CSS corner position (bottom/right)
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(FAB_POS_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const btnRef = useRef(null)
  const drag = useRef({ dragging: false, moved: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 })

  useEffect(() => {
    function onResize() {
      setPos((p) => (p ? clampFabPos(p.x, p.y) : p))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function onPointerDown(e) {
    const rect = btnRef.current.getBoundingClientRect()
    drag.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    btnRef.current.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d.dragging) return
    if (!d.moved && (Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4)) {
      d.moved = true
    }
    if (!d.moved) return
    setPos(clampFabPos(e.clientX - d.offsetX, e.clientY - d.offsetY))
  }

  function endDrag() {
    const d = drag.current
    if (d.dragging && d.moved) {
      setPos((p) => {
        if (p) {
          try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(p)) } catch {}
        }
        return p
      })
    }
    drag.current.dragging = false
  }

  function handleClick() {
    if (drag.current.moved) {
      // this click was really the end of a drag — don't open the sheet
      drag.current.moved = false
      return
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        className="support-fab"
        style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', position: 'fixed', touchAction: 'none' } : { touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
        title="Support — ধরে টেনে যেকোনো জায়গায় সরাতে পারবেন"
      >
        💬
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
            <h2>Contact Support</h2>

            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="support-option whatsapp">
              <span className="support-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M17.6 6.3A8 8 0 0 0 4.2 15.8L3 21l5.3-1.4A8 8 0 1 0 17.6 6.3ZM12 19.3a6.6 6.6 0 0 1-3.4-.9l-.2-.1-2.5.7.7-2.4-.2-.3a6.6 6.6 0 1 1 5.6 3Zm3.6-4.9c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1s-.6.7-.7.8-.3.2-.5.1a5.4 5.4 0 0 1-1.6-1 6 6 0 0 1-1.1-1.4c-.1-.2 0-.3.1-.4l.3-.4.2-.3a.4.4 0 0 0 0-.4c-.1-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.4a.9.9 0 0 0-.6.3 2.6 2.6 0 0 0-.8 1.9 4.5 4.5 0 0 0 1 2.4 10.3 10.3 0 0 0 4 3.5c.5.2 1 .4 1.3.5a3.2 3.2 0 0 0 1.5.1c.4-.1 1.2-.5 1.4-1s.2-.9.1-1c0-.1-.2-.2-.4-.3Z"/>
                </svg>
              </span>
              <div>
                <div className="support-title">WhatsApp Support</div>
                <div className="support-sub">Chat on WhatsApp</div>
              </div>
            </a>

            <a href={TELEGRAM_SUPPORT_LINK} target="_blank" rel="noopener noreferrer" className="support-option telegram">
              <span className="support-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M21.9 4.3 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.5-.2L6.6 12.7 2 11.3c-1-.3-1-1 .2-1.5L20.6 3c.8-.3 1.6.2 1.3 1.3Z"/>
                </svg>
              </span>
              <div>
                <div className="support-title">Telegram Support</div>
                <div className="support-sub">Chat on Telegram</div>
              </div>
            </a>
          </div>
        </div>
      )}
    </>
  )
}

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
  useEffect(() => {
    const saved = localStorage.getItem('xts-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return (
    <ConfirmProvider>
    <ToastProvider>
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
    </ToastProvider>
    </ConfirmProvider>
  )
}
