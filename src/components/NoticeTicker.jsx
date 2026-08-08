import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import './NoticeTicker.css'

// ---------------------------------------------------------------------------
// NoticeTicker — premium glass notice bar shown below the header on Home.
// Continuous TV-news-style ticker: all notices scroll right-to-left in an
// infinite seamless loop. Pauses on hover, resumes smoothly.
// ---------------------------------------------------------------------------

// Target scroll speed in px/s (40–60 range for comfortable reading).
// This is NOT a JS animation loop — it only calculates a CSS duration once.
const TICKER_PX_PER_SEC = 50

export default function NoticeTicker() {
  const { t } = useLanguage()
  const [paused, setPaused] = useState(false)
  const trackRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const navigate = useNavigate()

  const NOTICES = [
    { text: t('tickerNotice1'), link: '/transactions' },
    { text: t('tickerNotice2'), link: '/matches' },
    { text: t('tickerNotice3'), link: '/matches' },
    { text: t('tickerNotice4'), link: '/leaderboard' },
  ]

  // Measure the first-half width (original notices) and derive animation
  // duration so the CSS keyframe scrolls at ~TICKER_PX_PER_SEC.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const halfWidth = el.scrollWidth / 2
    setDuration(halfWidth / TICKER_PX_PER_SEC)
  }, [])

  function handleActivate() {
    if (NOTICES[0]?.link) navigate(NOTICES[0].link)
  }

  return (
    <div
      className="notice-ticker-v2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      aria-label={NOTICES.map((n) => n.text).join(' · ')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleActivate()
        }
      }}
    >
      <span className="nt-border" aria-hidden="true" />
      <span className="nt-shine" aria-hidden="true" />

      <div className="nt-left">
        <span className="nt-bell" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
        </span>
        <span className="nt-live">
          <span className="nt-live-dot" aria-hidden="true" />
          LIVE
        </span>
      </div>

      <div className="nt-center">
        <div
          ref={trackRef}
          className={'nt-track' + (duration ? ' nt-scrolling' : '') + (paused ? ' nt-paused' : '')}
          style={duration ? { animationDuration: `${duration}s` } : undefined}
        >
          {NOTICES.map((n, i) => (
            <span key={i} className="nt-text">{n.text}</span>
          ))}
          {/* Duplicate for seamless infinite loop */}
          {NOTICES.map((n, i) => (
            <span key={`d-${i}`} className="nt-text" aria-hidden="true">{n.text}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
