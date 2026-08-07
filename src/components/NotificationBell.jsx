import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'

const TYPE_ICON = {
  room_ready: '🎮',
  refund: '💰',
  match_result: '🏆',
  match_cancelled: '❌',
  match_reminder: '⏰',
  announcement: '📢',
}

function timeAgo(ts) {
  if (!ts?.toMillis) return ''
  const diffMs = Date.now() - ts.toMillis()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'এইমাত্র'
  if (min < 60) return `${min} মিনিট আগে`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ঘণ্টা আগে`
  const day = Math.floor(hr / 24)
  return `${day} দিন আগে`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const prevCount = useRef(unreadCount)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)
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
    if (!document.hidden) return // tab is actually visible/focused — the in-app bell already covers this

    try {
      if (freshOnes.length === 1) {
        const n = freshOnes[0]
        const osNotif = new Notification(n.title || 'Notification', { body: n.body || '', tag: n.id })
        osNotif.onclick = () => { window.focus(); navigate('/notifications'); osNotif.close() }
      } else {
        const osNotif = new Notification(`${freshOnes.length}টি নতুন Notification`, {
          body: freshOnes.map((n) => n.title).slice(0, 3).join(' • '),
          tag: 'nbell-batch',
        })
        osNotif.onclick = () => { window.focus(); navigate('/notifications'); osNotif.close() }
      }
    } catch (err) {
      console.warn('OS notification failed (non-blocking):', err)
    }
  }, [notifications, navigate])

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

  // Outside-click needs to check both the bell button AND the portaled
  // dropdown (they're no longer in the same DOM subtree once the dropdown
  // is rendered into document.body via createPortal).
  useEffect(() => {
    function onOutside(e) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // .topbar has `overflow:hidden` for its glass-card visual effect, which
  // was silently clipping this dropdown to invisible since it's taller
  // than the topbar itself. Rendering it into document.body via a portal
  // (below) escapes that clipping — but it also means the dropdown is no
  // longer positioned relative to the bell via CSS, so we compute its
  // fixed viewport position here whenever it opens.
  function toggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen((o) => !o)
  }

  function handleItemClick(n) {
    if (!n.read) markAsRead(n.id)
    setOpen(false)
    navigate('/notifications')
  }

  const preview = notifications.slice(0, 6)

  return (
    <div className="nbell-wrap" ref={wrapRef}>
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
        .nbell-dropdown {
          position: fixed;
          width: min(340px, 88vw);
          max-height: 420px;
          overflow-y: auto;
          background: rgba(18,20,28,0.98);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          box-shadow: 0 20px 45px -10px rgba(0,0,0,0.55);
          z-index: 9999;
          padding: 6px;
          animation: nbell-drop .18s ease;
        }
        @keyframes nbell-drop {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nbell-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 10px 8px;
        }
        .nbell-head h4 { margin: 0; font-size: 13.5px; color: #fff; }
        .nbell-head button {
          background: none; border: none; color: #60a5fa;
          font-size: 11.5px; cursor: pointer; padding: 4px 6px;
        }
        .nbell-item {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px; border-radius: 12px; cursor: pointer;
          transition: background .15s ease;
        }
        .nbell-item:hover { background: rgba(255,255,255,0.05); }
        .nbell-item.unread { background: rgba(37,99,235,0.08); }
        .nbell-icon {
          width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
          background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        .nbell-item-title { font-size: 12.5px; font-weight: 700; color: #e6e9f0; }
        .nbell-item-body { font-size: 11.5px; color: #9aa0ad; margin-top: 2px; }
        .nbell-item-time { font-size: 10px; color: #6b7280; margin-top: 4px; }
        .nbell-dot { width: 7px; height: 7px; border-radius: 50%; background: #60a5fa; margin-top: 5px; flex-shrink: 0; }
        .nbell-empty { padding: 30px 12px; text-align: center; color: #6b7280; font-size: 12.5px; }
        .nbell-footer { padding: 8px 10px 4px; text-align: center; }
        .nbell-footer a { color: #60a5fa; font-size: 12px; text-decoration: none; cursor: pointer; }
      `}</style>

      <div ref={btnRef} className={'nbell-btn' + (ring ? ' ring' : '')} onClick={toggleOpen}>
        🔔
        {unreadCount > 0 && <span className="nbell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </div>

      {open && createPortal(
        <div ref={dropdownRef} className="nbell-dropdown" style={{ top: dropdownPos.top, right: dropdownPos.right }}>
          <div className="nbell-head">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={() => preview.forEach((n) => !n.read && markAsRead(n.id))}>Mark visible read</button>
            )}
          </div>

          {preview.length === 0 ? (
            <div className="nbell-empty">কোনো notification নেই</div>
          ) : (
            preview.map((n) => (
              <div key={n.id} className={'nbell-item' + (!n.read ? ' unread' : '')} onClick={() => handleItemClick(n)}>
                <div className="nbell-icon">{TYPE_ICON[n.type] || '🔔'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nbell-item-title">{n.title}</div>
                  <div className="nbell-item-body">{n.body}</div>
                  <div className="nbell-item-time">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <div className="nbell-dot" />}
              </div>
            ))
          )}

          <div className="nbell-footer">
            <a onClick={() => { setOpen(false); navigate('/notifications') }}>সব দেখুন →</a>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
