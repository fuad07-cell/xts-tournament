import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

function spawnRipple(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const span = document.createElement('span')
  span.className = 'ripple-span'
  span.style.width = span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`
  el.appendChild(span)
  window.setTimeout(() => span.remove(), 550)
}

export default function TopBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="topbar">
      <div className="topbar-brand" onClick={() => navigate('/')}>
        <span className="topbar-wordmark-main">XTS</span>
        <span className="topbar-divider" aria-hidden="true" />
        <span className="topbar-wordmark-sub">TOURNAMENT</span>
      </div>

      <div className="topbar-actions">
        <div className="topbar-icon-btn topbar-icon-bell">
          <NotificationBell />
        </div>

        <button
          type="button"
          className="topbar-icon-btn topbar-icon-trophy ripple-btn"
          onClick={(e) => { spawnRipple(e); navigate('/leaderboard') }}
          aria-label="Leaderboard"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 4H16V10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M8 5H5C5 7 6 9 8 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 5H19C19 7 18 9 16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 14V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 20H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M12 17V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div
          className="topbar-wallet ripple-btn"
          onClick={(e) => { spawnRipple(e); navigate('/profile') }}
        >
          <span className="topbar-wallet-icon-chip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.9"/>
              <path d="M3 10H21" stroke="currentColor" strokeWidth="1.9"/>
              <circle cx="16.5" cy="14.5" r="1.4" fill="currentColor"/>
            </svg>
          </span>
          <span className="topbar-wallet-text">
            <span className="topbar-wallet-label">Wallet Balance</span>
            <span className="topbar-wallet-amount">৳ {profile?.walletBalance ?? 0}</span>
          </span>
          <svg className="topbar-wallet-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
