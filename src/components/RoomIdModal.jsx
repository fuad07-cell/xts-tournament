// Room ID / Password popup. Only shows the real data to a user who has
// actually joined this tournament — everyone else sees a locked message
// with a shortcut straight into JoinModal.
import { useLanguage } from '../context/LanguageContext'

export default function RoomIdModal({ tournament: t, joined, joining, onJoin, onClose }) {
  const { t: tr } = useLanguage()

  if (!t) return null

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>🔑 {tr('roomInformation')}</h2>

        {joined ? (
          t.roomId ? (
            <div className="prize-list">
              <div className="prize-row">
                <span className="prize-icon">🆔</span>
                <span className="prize-label">{tr('roomId')}: {t.roomId}</span>
              </div>
              <div className="prize-row">
                <span className="prize-icon">🔒</span>
                <span className="prize-label">{tr('password')}: {t.roomPassword || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="meta" style={{ textAlign: 'center', padding: '20px 0' }}>
              ⏳ {tr('roomNotReady')}
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
            <p>{tr('notJoined')}</p>
            <p className="meta" style={{ marginBottom: 16 }}>{tr('joinToSeeRoom')}</p>
            <button className="join-btn" onClick={onJoin} disabled={joining}>
              {joining ? tr('joining') : `⚔️ ${tr('joinMatchBtn')}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
