import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { useConfirm } from '../components/ConfirmContext'

const TYPE_ICON = {
  room_ready: '🎮',
  refund: '💰',
  match_result: '🏆',
  match_cancelled: '❌',
  match_reminder: '⏰',
  announcement: '📢',
}

function formatTime(ts) {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(notifications) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const groups = { Today: [], Yesterday: [], Earlier: [] }
  notifications.forEach((n) => {
    const d = n.createdAt?.toDate?.()
    if (!d) { groups.Earlier.push(n); return }
    const day = new Date(d); day.setHours(0, 0, 0, 0)
    if (day.getTime() === today.getTime()) groups.Today.push(n)
    else if (day.getTime() === yesterday.getTime()) groups.Yesterday.push(n)
    else groups.Earlier.push(n)
  })
  return groups
}

const GROUP_LABEL = { Today: 'আজ', Yesterday: 'গতকাল', Earlier: 'আগের' }

export default function Notifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications()
  const confirmAction = useConfirm()
  const navigate = useNavigate()

  const groups = useMemo(() => groupByDay(notifications), [notifications])

  async function handleClearAll() {
    if (!(await confirmAction('সব notification মুছে ফেলবেন? এটা undo করা যাবে না।', { danger: true }))) return
    clearAll()
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    await removeNotification(id)
  }

  function handleOpen(n) {
    if (!n.read) markAsRead(n.id)
    if (n.type === 'match_result' || n.type === 'room_ready' || n.type === 'match_cancelled' || n.type === 'match_reminder') {
      navigate('/transactions') // best-effort — matches app's existing "My Matches" style destination
    }
  }

  return (
    <div className="screen page-fade-in">
      <div className="section-title">
        <h2>Notifications</h2>
        <span>{unreadCount > 0 ? `${unreadCount}টি অপঠিত` : 'সব পঠিত'}</span>
      </div>

      {notifications.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {unreadCount > 0 && (
            <button className="tab" onClick={markAllAsRead} style={{ cursor: 'pointer' }}>
              ✓ Mark all as read
            </button>
          )}
          <button className="tab" onClick={handleClearAll} style={{ cursor: 'pointer', color: '#f87171' }}>
            🗑️ Clear all
          </button>
        </div>
      )}

      {loading && <div className="meta">লোড হচ্ছে...</div>}

      {!loading && notifications.length === 0 && (
        <div className="empty">
          <div className="glyph">🔔</div>
          <h3>কোনো Notification নেই</h3>
          <p>নতুন Room ID, Refund, Result বা Announcement এলে এখানে দেখতে পাবেন।</p>
        </div>
      )}

      {['Today', 'Yesterday', 'Earlier'].map((key) =>
        groups[key].length > 0 ? (
          <div key={key} style={{ marginBottom: 20 }}>
            <div className="meta" style={{ marginBottom: 8, fontWeight: 700 }}>{GROUP_LABEL[key]}</div>
            <div className="bracket-list">
              {groups[key].map((n) => (
                <div
                  key={n.id}
                  className="bracket-row"
                  onClick={() => handleOpen(n)}
                  style={{
                    cursor: 'pointer',
                    alignItems: 'flex-start',
                    background: n.read ? undefined : 'rgba(37,99,235,0.08)',
                  }}
                >
                  <div className="row-left" style={{ alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 20, marginRight: 4 }}>{TYPE_ICON[n.type] || '🔔'}</span>
                    <div>
                      <div className="row-name">{n.title}</div>
                      <div className="row-sub">{n.body}</div>
                      <div className="row-sub" style={{ opacity: 0.6, marginTop: 4 }}>{formatTime(n.createdAt)}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 15, padding: 6 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}
