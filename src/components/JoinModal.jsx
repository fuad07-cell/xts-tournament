import { useState } from 'react'
import { useToast } from '../components/ToastContext'

export default function JoinModal({ tournament: t, onClose, onConfirm }) {
  const { showToast } = useToast()
  const [ign, setIgn] = useState('')
  const [teammateIgn, setTeammateIgn] = useState('')
  const [busy, setBusy] = useState(false)

  if (!t) return null

  const mode = t.teamMode === 'duo' ? 'duo' : 'solo' // ইউজার বেছে নেয় না, ম্যাচ থেকেই ফিক্সড আসে
  const players = mode === 'duo' ? 2 : 1
  const totalCost = t.entryFee * players

  async function handleSubmit() {
    if (!ign.trim()) return showToast('warning', 'আপনার Free Fire আইডির নাম লিখুন')
    if (mode === 'duo' && !teammateIgn.trim()) return showToast('warning', 'আপনার সাথীর Free Fire আইডির নাম লিখুন')

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
        <h2>⚔️ MATCH এ জয়েন করুন</h2>

        <div className="join-summary">
          <div className="join-summary-title">🎮 {t.title} <span className="ok-badge">✓</span></div>
          <div className="join-summary-sub">
            {(t.mode || 'CLASSIC')} · {(t.map || 'BERMUDA')} · ENTRY: ৳{t.entryFee}
          </div>
        </div>

        <div className="field">
          <label>👥 ম্যাচ টাইপ</label>
          <div className="join-summary-sub">
            {mode === 'duo' ? '👥 DUO — দুইজন মিলে খেলবেন' : '🧍 SOLO — একা খেলবেন'}
          </div>
        </div>

        <div className="field">
          <label>✏️ আপনার Free Fire আইডির নামটি কপি করে দিন</label>
          <input type="text" placeholder="যে নামে গেম খেলবেন" value={ign} onChange={(e) => setIgn(e.target.value)} />
        </div>

        {mode === 'duo' && (
          <div className="field">
            <label>✏️ সাথীর Free Fire আইডির নাম</label>
            <input type="text" placeholder="সাথী যে নামে গেম খেলবেন" value={teammateIgn} onChange={(e) => setTeammateIgn(e.target.value)} />
          </div>
        )}

        <div className="note" style={{ marginTop: 0, marginBottom: 14 }}>
          {mode === 'solo'
            ? 'Solo সিলেক্ট করা আছে — র‍্যান্ডম প্লেয়ার আপনার টিমমেট হবে'
            : 'Duo সিলেক্ট করা আছে — আপনারা দুইজন একই টিমে খেলবেন'}
        </div>

        <div className="join-total-row">
          <span>মোট খরচ ({players} জন)</span>
          <span>৳{totalCost}</span>
        </div>

        <button className="join-btn join-btn-cta" onClick={handleSubmit} disabled={busy}>
          {busy ? '...' : `⚔️ JOIN NOW — ৳${totalCost}`}
        </button>
      </div>
    </div>
  )
}
