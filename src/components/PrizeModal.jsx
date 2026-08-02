export default function PrizeModal({ tournament: t, onClose }) {
  if (!t) return null

  const b = t.prizeBreakdown || {}
  const positions = [
    { icon: '👑', label: 'Winner', amount: b.winner },
    { icon: '🥈', label: '2nd Position', amount: b.second },
    { icon: '🥉', label: '3rd Position', amount: b.third },
    { icon: '🎖️', label: '4th Position', amount: b.fourth },
    { icon: '🎖️', label: '5th Position', amount: b.fifth },
  ].filter((p) => p.amount)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>🏆 PRIZE POOL</h2>

        <div className="prize-list">
          {positions.map((p, i) => (
            <div className="prize-row" key={i}>
              <span className="prize-icon">{p.icon}</span>
              <span className="prize-label">{p.label} — {p.amount} Taka</span>
            </div>
          ))}

          {positions.length === 0 && (
            <div className="meta">এই ম্যাচের জন্য position-ভিত্তিক prize এখনো সেট করা হয়নি।</div>
          )}

          {t.perKill ? (
            <>
              <div className="prize-divider" />
              <div className="prize-row">
                <span className="prize-icon">🔥</span>
                <span className="prize-label">Per Kill : {t.perKill} Taka</span>
              </div>
            </>
          ) : null}

          <div className="prize-row total">
            <span className="prize-icon">🏆</span>
            <span className="prize-label">Total Prize Pool: {t.prizePool} Taka</span>
          </div>
        </div>

        <button className="join-btn" onClick={onClose} style={{ marginTop: 16 }}>CLOSE</button>
      </div>
    </div>
  )
}
