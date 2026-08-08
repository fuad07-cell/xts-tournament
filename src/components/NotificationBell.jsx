import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useLanguage } from '../context/LanguageContext'

export default function NotificationBell() {
  const { t } = useLanguage()
  const { notifications, unreadCount } = useNotifications()
  const [ring, setRing] = useState(false)
  const prevCount = useRef(unreadCount)
  const seenIds = useRef(null) // null until the first snapshot has been processed
  const navigate = useNavigate()

  // Ask for OS-notification permission once, so background-tab notifications
  // (below) can actually show. Only prompts if the user hasn't already
  // answered — browsers remember 'granted'/'denied' after the first prompt.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // OS-level notification when the tab is in the background (minimized or
  // another tab focused) and a genuinely NEW notification doc arrives.
  // Doesn't fire for the batch of notifications already sitting there when
  // the app first loads — only for ones that show up after that.
  useEffect(() => {
    if (!('Notification' in window)) return
    const currentIds = new Set(notifications.map((n) => n.id))

    if (seenIds.current === null) {
      seenIds.current = currentIds
      return
    }

    const freshOnes = notifications.filter((n) => !seenIds.current.has(n.id))
    seenIds.current = currentIds
    if (!freshOnes.length) return
    if (Notification.permission !== 'granted') return
    if (!document.hidden) return // tab is actually visible/focused — the bell badge already covers this

    try {
      if (freshOnes.length === 1) {
        const n = freshOnes[0]
        const osNotif = new Notification(n.title || t('notifications'), { body: n.body || '', tag: n.id })
        osNotif.onclick = () => { window.focus(); navigate('/notifications'); osNotif.close() }
      } else {
        const osNotif = new Notification(`${freshOnes.length} ${t('newNotificationsCount')}`, {
          body: freshOnes.map((n) => n.title).slice(0, 3).join(' • '),
          tag: 'nbell-batch',
        })
        osNotif.onclick = () => { window.focus(); navigate('/notifications'); osNotif.close() }
      }
    } catch (err) {
      console.warn('OS notification failed (non-blocking):', err)
    }
  }, [notifications, navigate, t])

  // Play the bell-ring animation whenever unread count goes UP (a genuinely
  // new notification arrived) — not on every render, and not when it goes
  // down from marking things read.
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setRing(true)
      const t = setTimeout(() => setRing(false), 900)
      return () => clearTimeout(t)
    }
    prevCount.current = unreadCount
  }, [unreadCount])

  return (
    <div className="nbell-wrap">
      <style>{`
        .nbell-wrap { position: relative; }
        .nbell-btn {
          position: relative;
          width: 38px; height: 38px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          font-size: 17px;
          transition: transform .2s ease, background .2s ease;
        }
        .nbell-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-1px); }
        .nbell-btn.ring { animation: nbell-shake .55s ease; }
        @keyframes nbell-shake {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(-16deg); }
          30% { transform: rotate(13deg); }
          45% { transform: rotate(-9deg); }
          60% { transform: rotate(6deg); }
          75% { transform: rotate(-3deg); }
        }
        .nbell-badge {
          position: absolute; top: -4px; right: -4px;
          min-width: 17px; height: 17px; padding: 0 4px;
          border-radius: 999px;
          background: linear-gradient(135deg, #f43f5e, #fb7185);
          color: #fff; font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 2px var(--bg, #0b0e14), 0 2px 6px rgba(244,63,94,0.6);
          animation: nbell-pulse 2s ease-in-out infinite;
        }
        @keyframes nbell-pulse {
          0%, 100% { box-shadow: 0 0 0 2px var(--bg,#0b0e14), 0 0 0 0 rgba(244,63,94,0.5); }
          50% { box-shadow: 0 0 0 2px var(--bg,#0b0e14), 0 0 0 5px rgba(244,63,94,0); }
        }
      `}</style>

      <div className={'nbell-btn' + (ring ? ' ring' : '')} onClick={() => navigate('/notifications')}>
        🔔
        {unreadCount > 0 && <span className="nbell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </div>
    </div>
  )
}
