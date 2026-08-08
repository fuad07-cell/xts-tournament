import { useState } from 'react'
import { useToast } from '../components/ToastContext'
import { useLanguage } from '../context/LanguageContext'

export default function JoinModal({ tournament: t, onClose, onConfirm }) {
  const { showToast } = useToast()
  const { t: tr } = useLanguage()
  const [ign, setIgn] = useState('')
  const [teammateIgn, setTeammateIgn] = useState('')
  const [busy, setBusy] = useState(false)

  if (!t) return null

  const mode = t.teamMode === 'duo' ? 'duo' : 'solo'
  const players = mode === 'duo' ? 2 : 1
  const totalCost = t.entryFee * players

  async function handleSubmit() {
    if (!ign.trim()) return showToast('warning', tr('enterFreeFireId'))
    if (mode === 'duo' && !teammateIgn.trim()) return showToast('warning', tr('enterTeammateFreeFireId'))

    setBusy(true)
    try {
      await onConfirm({ mode, ign: ign.trim(), teammateIgn: teammateIgn.trim() || null, totalCost })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', margin: 0 }}
      >
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>⚔️ {tr('joinMatch')}</h2>

        <div className="join-summary">
          <div className="join-summary-title">🎮 {t.title} <span className="ok-badge">✓</span></div>
          <div className="join-summary-sub">
            {(t.mode || 'CLASSIC')} · {(t.map || 'BERMUDA')} · ENTRY: ৳{t.entryFee}
          </div>
        </div>

        <div className="field">
          <label>👥 {tr('matchType')}</label>
          <div className="join-summary-sub">
            {mode === 'duo' ? `👥 ${tr('duoDesc')}` : `🧍 ${tr('soloDesc')}`}
          </div>
        </div>

        <div className="field">
          <label>✏️ {tr('yourFreeFireId')}</label>
          <input type="text" placeholder={tr('ignPlaceholder')} value={ign} onChange={(e) => setIgn(e.target.value)} />
        </div>

        {mode === 'duo' && (
          <div className="field">
            <label>✏️ {tr('teammateFreeFireId')}</label>
            <input type="text" placeholder={tr('teammateIgnPlaceholder')} value={teammateIgn} onChange={(e) => setTeammateIgn(e.target.value)} />
          </div>
        )}

        <div className="note" style={{ marginTop: 0, marginBottom: 14 }}>
          {mode === 'solo'
            ? tr('soloNote')
            : tr('duoNote')}
        </div>

        <div className="join-total-row">
          <span>{tr('totalCost')} ({players} {tr('persons')})</span>
          <span>৳{totalCost}</span>
        </div>

        <button className="join-btn join-btn-cta" onClick={handleSubmit} disabled={busy}>
          {busy ? '...' : `⚔️ ${tr('joinNow')} — ৳${totalCost}`}
        </button>
      </div>
    </div>
  )
}
