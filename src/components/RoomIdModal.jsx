// Room ID / Password popup. Only shows the real data to a user who has
// actually joined this tournament — everyone else sees a locked message
// with a shortcut straight into JoinModal.
export default function RoomIdModal({ tournament: t, joined, joining, onJoin, onClose }) {
  if (!t) return null

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>🔑 ROOM INFORMATION</h2>

        {joined ? (
          t.roomId ? (
            <div className="prize-list">
              <div className="prize-row">
                <span className="prize-icon">🆔</span>
                <span className="prize-label">Room ID: {t.roomId}</span>
              </div>
              <div className="prize-row">
                <span className="prize-icon">🔒</span>
                <span className="prize-label">Password: {t.roomPassword || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="meta" style={{ textAlign: 'center', padding: '20px 0' }}>
              ⏳ ম্যাচ শুরুর কিছুক্ষণ আগে এখানে Room ID দেয়া হবে।
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
            <p>আপনি এই ম্যাচে জয়েন করেননি</p>
            <p className="meta" style={{ marginBottom: 16 }}>Room ID দেখতে হলে আগে ম্যাচে জয়েন করুন</p>
            <button className="join-btn" onClick={onJoin} disabled={joining}>
              {joining ? 'জয়েন হচ্ছে…' : '⚔️ জয়েন করুন'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
