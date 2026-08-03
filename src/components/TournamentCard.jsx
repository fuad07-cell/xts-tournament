import { useEffect, useRef, useState } from 'react'
import { getMatchTime } from '../utils/matchTime'

function getStatus(t) {
  const now = Date.now()
  const matchTime = getMatchTime(t)
  const isFull = (t.filled || 0) >= t.slots

  if (t.status === 'closed') return 'expired'
  if (matchTime && matchTime < now) return 'expired'
  if (isFull) return 'full'
  if (matchTime && matchTime - now < 30 * 60 * 1000) return 'live' // ম্যাচ শুরুর ৩০ মিনিট আগে থেকে "লাইভ" badge
  return 'upcoming'
}

function useCountdown(t) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const target = getMatchTime(t)
    if (!target) return

    function tick() {
      const diff = target - Date.now()
      if (diff <= 0) {
        setLabel('শুরু হয়ে গেছে')
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [t])

  return label
}

function formatDate(t) {
  const ms = getMatchTime(t)
  if (!ms) return 'তারিখ শীঘ্রই জানানো হবে'
  return new Date(ms).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

function formatTime(t) {
  const ms = getMatchTime(t)
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
}

function ripple(e) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const span = document.createElement('span')
  span.className = 'ripple-span'
  span.style.width = span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`
  btn.appendChild(span)
  setTimeout(() => span.remove(), 550)
}

export default function TournamentCard({ tournament: t, image, onRegisterClick, onPrizeClick, onRoomClick, onRulesClick, joined }) {
  const status = getStatus(t)
  const countdown = useCountdown(t)
  const slotsLeft = Math.max((t.slots || 0) - (t.filled || 0), 0)
  const fillPct = t.slots ? Math.min(((t.filled || 0) / t.slots) * 100, 100) : 0

  const badgeLabel = { live: 'লাইভ শীঘ্রই', upcoming: 'UPCOMING', full: 'পূর্ণ', expired: 'শেষ' }[status]
  const canJoin = status !== 'expired' && status !== 'full' && !joined

  function handleRegister(e) {
    ripple(e)
    onRegisterClick(t)
  }

  // ---- premium card micro-interactions (tilt, cursor glow, click ripple) ----
  const tiltRef = useRef(null)
  const rafRef = useRef(null)

  function handleCardMouseMove(e) {
    const el = tiltRef.current
    if (!el || rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const rotateY = (px - 0.5) * 10
      const rotateX = (0.5 - py) * 10
      el.style.transform = `translateY(-10px) scale(1.03) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
    })
  }

  function handleCardMouseLeave() {
    const el = tiltRef.current
    if (!el) return
    el.style.transform = ''
  }

  function handleCardClick(e) {
    const el = tiltRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.4
    const span = document.createElement('span')
    span.className = 'card-click-ripple'
    span.style.width = span.style.height = `${size}px`
    span.style.left = `${e.clientX - rect.left - size / 2}px`
    span.style.top = `${e.clientY - rect.top - size / 2}px`
    el.appendChild(span)
    setTimeout(() => span.remove(), 600)
  }
  // ---------------------------------------------------------------------------

  return (
    <div className="tour-card-float">
      <div
        ref={tiltRef}
        className="tour-card-tilt"
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardMouseLeave}
        onClick={handleCardClick}
      >
    <div className={'tour-card page-slide-up' + (status === 'expired' ? ' expired' : '')}>
      <div className="tour-body">
        <div className="tour-card-header">
          <img className="tour-thumb" src={image} alt={t.title} loading="lazy" />
          <div className="tour-header-text">
            <div className="tour-title">{t.title}</div>
          </div>
          <span className={'tour-status-badge-inline ' + status}>{badgeLabel}</span>
        </div>

        <div className="tour-date">{formatDate(t)}</div>
        {formatTime(t) && <div className="tour-time">{formatTime(t)}</div>}

        <div className="tour-stats">
          <div className="tour-stat">
            <div className="label">Prize Pool</div>
            <div className="value blue">৳{t.prizePool}</div>
          </div>
          <div className="tour-stat">
            <div className="label">Per Kill</div>
            <div className="value orange">৳{t.perKill || 0}</div>
          </div>
          <div className="tour-stat">
            <div className="label">Entry Fee</div>
            <div className="value pink">৳{t.entryFee}</div>
          </div>
        </div>

        <div className="tour-mode-row">
          {t.mode && <span>🎮 {t.mode}</span>}
          {t.map && <span>📍 {t.map}</span>}
          <span>👥 {t.filled || 0}/{t.slots}</span>
        </div>

        <div className="tour-spots-join-row">
          <div className="tour-spots-row">
            <div className="tour-spots-bar">
              <div className="tour-spots-fill" style={{ width: `${fillPct}%` }} />
            </div>
            <span>Only <strong>{slotsLeft}</strong> spots left</span>
          </div>

          <button
            className={'tour-register-btn ripple-btn' + (canJoin ? ' blink' : '')}
            onClick={handleRegister}
            disabled={!canJoin}
          >
            {joined ? '✅ Joined' : status === 'expired' ? 'শেষ' : status === 'full' ? 'পূর্ণ' : 'JOIN NOW'}
          </button>
        </div>

        <div className="tour-card-actions">
          <button className="tour-secondary-btn" onClick={() => onRoomClick(t)}>🔑 Room ID</button>
          <button className="tour-secondary-btn" onClick={() => onPrizeClick(t)}>🏆 Prize Pool</button>
        </div>
        <button className="tour-secondary-btn tour-rules-btn" onClick={() => onRulesClick(t)}>📋 Rules</button>

        {status !== 'expired' && getMatchTime(t) && (
          <div className="tour-countdown-bar">🕒 STARTS IN <strong>{countdown}</strong></div>
        )}
      </div>
    </div>
      </div>
    </div>
  )
}
