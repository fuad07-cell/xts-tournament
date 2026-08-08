import { useEffect, useState } from 'react'
import { getMatchTime } from '../utils/matchTime'
import { useLanguage } from '../context/LanguageContext'

function getStatus(t) {
  const now = Date.now()
  const matchTime = getMatchTime(t)
  const isFull = (t.filled || 0) >= t.slots

  if (t.status === 'closed') return 'expired'
  if (matchTime && matchTime < now) return 'expired'
  if (isFull) return 'full'
  if (matchTime && matchTime - now < 30 * 60 * 1000) return 'live'
  return 'upcoming'
}

function useCountdown(t, alreadyStartedLabel) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const target = getMatchTime(t)
    if (!target) return

    function tick() {
      const diff = target - Date.now()
      if (diff <= 0) {
        setLabel(alreadyStartedLabel)
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
  }, [t, alreadyStartedLabel])

  return label
}

function formatDate(t, dateLocale, dateTBALabel) {
  const ms = getMatchTime(t)
  if (!ms) return dateTBALabel
  return new Date(ms).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
}

function formatTime(t, dateLocale) {
  const ms = getMatchTime(t)
  if (!ms) return ''
  return new Date(ms).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
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
  const { t: tr, isBn, dateLocale } = useLanguage()
  const status = getStatus(t)
  const countdown = useCountdown(t, tr('alreadyStarted'))
  const slotsLeft = Math.max((t.slots || 0) - (t.filled || 0), 0)
  const fillPct = t.slots ? Math.min(((t.filled || 0) / t.slots) * 100, 100) : 0

  const badgeLabel = {
    live: tr('liveSoonBadge'),
    upcoming: tr('upcoming'),
    full: tr('full'),
    expired: tr('expired'),
  }[status]
  const canJoin = status !== 'expired' && status !== 'full' && !joined

  function handleRegister(e) {
    ripple(e)
    onRegisterClick(t)
  }

  return (
    <div className={'tour-card page-slide-up' + (status === 'expired' ? ' expired' : '')}>
      <div className="tour-body">
        <div className="tour-card-header">
          <img className="tour-thumb" src={image} alt={t.title} loading="lazy" />
          <div className="tour-header-text">
            <div className="tour-title">{t.title}</div>
          </div>
          <span className={'tour-status-badge-inline ' + status}>{badgeLabel}</span>
        </div>

        <div className="tour-date">{formatDate(t, dateLocale, tr('dateTBA'))}</div>
        {formatTime(t, dateLocale) && <div className="tour-time">{formatTime(t, dateLocale)}</div>}

        <div className="tour-stats">
          <div className="tour-stat">
            <div className="label">{tr('prizePool')}</div>
            <div className="value blue">৳{t.prizePool}</div>
          </div>
          <div className="tour-stat">
            <div className="label">{tr('perKill')}</div>
            <div className="value orange">৳{t.perKill || 0}</div>
          </div>
          <div className="tour-stat">
            <div className="label">{tr('entryFee')}</div>
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
            <span>{tr('onlySpotsLeft', { slots: slotsLeft })}</span>
          </div>

          <button
            className={'tour-register-btn ripple-btn' + (canJoin ? ' blink' : '')}
            onClick={handleRegister}
            disabled={!canJoin}
          >
            {joined ? `✅ ${tr('joined')}` : status === 'expired' ? tr('expired') : status === 'full' ? tr('full') : tr('joinNow')}
          </button>
        </div>

        <div className="tour-card-actions">
          <button className="tour-secondary-btn" onClick={() => onRoomClick(t)}>🔑 {tr('roomId')}</button>
          <button className="tour-secondary-btn" onClick={() => onPrizeClick(t)}>🏆 {tr('prizePoolBtn')}</button>
        </div>
        <button className="tour-secondary-btn tour-rules-btn" onClick={() => onRulesClick(t)}>📋 {tr('rules')}</button>

        {status !== 'expired' && getMatchTime(t) && (
          <div className="tour-countdown-bar">🕒 {tr('startsInLabel')} <strong>{countdown}</strong></div>
        )}
      </div>
    </div>
  )
}