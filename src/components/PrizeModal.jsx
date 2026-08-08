import { useLanguage } from '../context/LanguageContext'

export default function PrizeModal({ tournament: t, onClose }) {
  const { t: tr } = useLanguage()

  if (!t) return null

  const b = t.prizeBreakdown || {}
  const positions = [
    { icon: '👑', label: tr('winner'), amount: b.winner },
    { icon: '🥈', label: tr('secondPosition'), amount: b.second },
    { icon: '🥉', label: tr('thirdPosition'), amount: b.third },
    { icon: '🎖️', label: tr('fourthPosition'), amount: b.fourth },
    { icon: '🎖️', label: tr('fifthPosition'), amount: b.fifth },
  ].filter((p) => p.amount)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>🏆 {tr('prizePoolTitle')}</h2>

        <div className="prize-list">
          {positions.map((p, i) => (
            <div className="prize-row" key={i}>
              <span className="prize-icon">{p.icon}</span>
              <span className="prize-label">{p.label} — {p.amount} {tr('taka')}</span>
            </div>
          ))}

          {positions.length === 0 && (
            <div className="meta">{tr('prizeNotSet')}</div>
          )}

          {t.perKill ? (
            <>
              <div className="prize-divider" />
              <div className="prize-row">
                <span className="prize-icon">🔥</span>
                <span className="prize-label">{tr('perKill')} : {t.perKill} {tr('taka')}</span>
              </div>
            </>
          ) : null}

          <div className="prize-row total">
            <span className="prize-icon">🏆</span>
            <span className="prize-label">{tr('totalPrizePool')}: {t.prizePool} {tr('taka')}</span>
          </div>
        </div>

        <button className="join-btn" onClick={onClose} style={{ marginTop: 16 }}>{tr('close')}</button>
      </div>
    </div>
  )
}