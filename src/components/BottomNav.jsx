import { NavLink } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  )
}

function MatchesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  )
}

function LeaderboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a2 2 0 0 0 2 4h1" />
      <path d="M17 6h3a2 2 0 0 1-2 4h-1" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  )
}

export default function BottomNav() {
  const { t } = useLanguage()
  const items = [
    { to: '/', Icon: HomeIcon, label: t('home'), end: true },
    { to: '/matches', Icon: MatchesIcon, label: t('myMatches') },
    { to: '/leaderboard', Icon: LeaderboardIcon, label: t('leaderboard') },
    { to: '/profile', Icon: ProfileIcon, label: t('profile') },
  ]

  return (
    <div className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="nav-icon-box">
            <item.Icon />
          </span>
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}
