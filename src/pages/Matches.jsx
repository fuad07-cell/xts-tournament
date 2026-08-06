import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getCategoryByKey } from '../constants/categories'

// ============================================================
// Match Status Determination (based on current time)
// ============================================================
function determineStatus(entry, result) {
  // If result submitted → completed
  if (result) return 'completed'

  const now = Date.now()

  // Parse match start time
  const matchDateStr = entry.date       // "2025-01-15" format from Firestore
  const matchTimeStr = entry.time       // "20:30" format from Firestore
  if (!matchDateStr || !matchTimeStr) return 'expired'

  const [year, month, day] = matchDateStr.split('-').map(Number)
  const [hours, minutes] = matchTimeStr.split(':').map(Number)
  const matchStart = new Date(year, month - 1, day, hours, minutes).getTime()

  // Submission deadline: default 1 hour after start
  const deadlineStr = entry.submissionDeadline || '01:00'
  const [dh, dm] = deadlineStr.split(':').map(Number)
  const submissionEnd = matchStart + (dh * 60 + dm) * 60 * 1000

  if (now < matchStart) return 'upcoming'
  if (now >= matchStart && now < submissionEnd) return 'live'
  return 'expired'
}

// ============================================================
// Time remaining calculator
// ============================================================
function getTimeRemaining(targetMs) {
  const now = Date.now()
  const diff = targetMs - now
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

// ============================================================
// Countdown Timer Component
// ============================================================
function CountdownTimer({ targetMs }) {
  const [time, setTime] = useState(getTimeRemaining(targetMs))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(targetMs))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetMs])

  const parts = []
  if (time.days > 0) parts.push(`${time.days}d`)
  parts.push(`${String(time.hours).padStart(2, '0')}h`)
  parts.push(`${String(time.minutes).padStart(2, '0')}m`)
  parts.push(`${String(time.seconds).padStart(2, '0')}s`)

  return <span>{parts.join(' ')}</span>
}

// ============================================================
// Status → label + Tailwind color classes
// ============================================================
function getStatusMeta(status) {
  switch (status) {
    case 'live':
      return { label: 'LIVE', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)', color: '#FF5C5C', dot: '#FF3B3B', glow: true }
    case 'upcoming':
      return { label: 'UPCOMING', bg: 'rgba(245,166,35,0.15)', border: 'rgba(245,166,35,0.5)', color: '#F5A623', dot: '#F5A623', glow: false }
    case 'completed':
      return { label: 'COMPLETED', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.5)', color: '#3DDC84', dot: '#3DDC84', glow: false }
    case 'expired':
      return { label: 'EXPIRED', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', color: '#94A3B8', dot: '#94A3B8', glow: false }
    default:
      return { label: status, bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', color: '#94A3B8', dot: '#94A3B8', glow: false }
  }
}

// ============================================================
// Status Badge
// ============================================================
function StatusBadge({ status }) {
  const { label, bg, border, color, dot, glow } = getStatusMeta(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap"
      style={{
        fontSize: 10,
        letterSpacing: '0.06em',
        padding: '4px 9px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        animation: glow ? 'badgeGlow 1.8s ease-in-out infinite' : 'none',
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%', background: dot,
          animation: glow ? 'dotBlink 1.8s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </span>
  )
}

// ============================================================
// Mode Banner Mapping — each category key auto-resolves to its
// real banner image (from categories.js, the single source of
// truth) plus a short label to overlay on the card banner.
// ============================================================
const BANNER_LABELS = {
  br: 'BR',
  clash_squad: 'Clash Squad',
  lone_wolf: 'Lone Wolf',
  lost_to_win: 'Loss to Win',
  cs_arena: 'CS 1v1 / 2v2',
  free_match: 'Free Match',
}

function getCategoryVisual(categoryKey) {
  const cat = getCategoryByKey(categoryKey)
  if (cat) {
    return {
      image: cat.image,
      label: BANNER_LABELS[categoryKey] || cat.label,
      badge: cat.badge,
    }
  }
  // Unknown/legacy category — no image available, card falls back to a plain panel
  return { image: null, label: categoryKey || 'Match', badge: '' }
}

// ============================================================
// Format Date for Display
// ============================================================
function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const months = ['জানু', 'ফেব', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ', 'অক্টো', 'নভে', 'ডিসে']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

// ============================================================
// Tournament Data Enricher (fetches tournament doc for each entry)
// ============================================================
function useEnrichedEntries(user) {
  const [entries, setEntries] = useState([])
  const [results, setResults] = useState({}) // entryId → result doc
  const [enriched, setEnriched] = useState([]) // entries merged with tournament data
  const [loading, setLoading] = useState(true)

  // Fetch user's entries
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'entries'), where('userId', '==', user.uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.joinedAt?.toMillis?.() || 0) - (a.joinedAt?.toMillis?.() || 0))
        setEntries(list)
      },
      (err) => console.error('entries fetch error:', err)
    )
    return unsub
  }, [user])

  // Fetch user's match results
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'matchResults'), where('userId', '==', user.uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = {}
        snap.docs.forEach((d) => { map[d.data().entryId] = { id: d.id, ...d.data() } })
        setResults(map)
      },
      (err) => console.error('matchResults fetch error:', err)
    )
    return unsub
  }, [user])

  // Enrich entries with tournament data
  useEffect(() => {
    if (entries.length === 0) { setEnriched([]); setLoading(false); return }

    const tournamentCache = {}
    let cancelled = false

    async function enrich() {
      // Collect unique tournamentIds
      const tIds = [...new Set(entries.map(e => e.tournamentId).filter(Boolean))]

      // Fetch tournament docs we haven't cached
      const toFetch = tIds.filter(id => !tournamentCache[id])
      await Promise.all(toFetch.map(async (tId) => {
        try {
          const snap = await getDoc(doc(db, 'tournaments', tId))
          if (snap.exists()) tournamentCache[tId] = snap.data()
        } catch (err) {
          console.error('tournament fetch error:', err)
        }
      }))

      if (cancelled) return

      // Merge entry + tournament data
      const merged = entries.map((entry) => {
        const t = tournamentCache[entry.tournamentId] || {}
        const result = results[entry.id] || null
        const status = determineStatus(entry, result)

        // Parse match start time for sorting
        let matchStartMs = 0
        if (entry.date && entry.time) {
          const [y, m, d] = entry.date.split('-').map(Number)
          const [h, min] = entry.time.split(':').map(Number)
          matchStartMs = new Date(y, m - 1, d, h, min).getTime()
        }

        return {
          ...entry,
          tournamentData: t,
          gameMode: t.mode || entry.category || '',
          map: t.map || '',
          prizePool: t.prizePool || entry.prizePool || 0,
          perKill: t.perKill || 0,
          slots: t.slots || 50,
          filled: t.filled || 0,
          roomId: t.roomId || '',
          roomPassword: t.roomPassword || '',
          submissionDeadline: t.submissionDeadline || '01:00',
          computedStatus: status,
          result,
          matchStartMs,
        }
      })

      setEnriched(merged)
      setLoading(false)
    }

    enrich()
    return () => { cancelled = true }
  }, [entries, results])

  return { enriched, loading }
}

// ============================================================
// Match Card Component
// ============================================================
function MatchCard({ match, index, onSubmitResult }) {
  const status = match.computedStatus
  const [copiedField, setCopiedField] = useState(null)

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const matchStartMs = match.matchStartMs || 0
  const isBr = match.category === 'br'

  // Auto-resolve this match's real banner image + label from categories.js
  const visual = getCategoryVisual(match.category)
  const bannerImage = visual.image

  return (
    <div
      className="match-card"
      style={{
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(22,27,46,0.6)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(148,163,184,0.14)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
        animation: 'slideUp 0.4s ease-out',
        animationDelay: `${index * 0.06}s`,
        animationFillMode: 'both',
      }}
    >
      {/* Banner — fixed 140x100, LEFT side only, never full-width, never on top */}
      <div style={{ width: 140, height: 100, flexShrink: 0, margin: 8, borderRadius: 12, overflow: 'hidden' }}>
        {bannerImage ? (
          <img
            src={bannerImage}
            alt={match.title || visual.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            className="bg-slate-800"
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}
          >
            🎮
          </div>
        )}
      </div>

      {/* Right Side — takes remaining width, holds all content */}
      <div className="min-w-0" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px 10px 0', gap: 7 }}>
        {/* Header row: title (left) + status badge (top-right) */}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm truncate" style={{ lineHeight: 1.25, letterSpacing: '0.01em' }}>
              {match.title || match.tournamentName || 'টুর্নামেন্ট'}
            </h3>
            <p className="text-gray-400 truncate" style={{ fontSize: 11, marginTop: 3 }}>
              {visual.label}{match.map ? ` • ${match.map}` : ''}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Entry Fee / Prize Pool / Date / Time — 2x2 grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div>
            <p className="text-gray-500" style={{ fontSize: 10, letterSpacing: '0.03em' }}>Entry Fee</p>
            <p className="text-yellow-400 font-bold" style={{ fontSize: 13 }}>৳{match.entryFee}</p>
          </div>
          <div>
            <p className="text-gray-500" style={{ fontSize: 10, letterSpacing: '0.03em' }}>Prize Pool</p>
            <p className="text-green-400 font-bold" style={{ fontSize: 13 }}>৳{(match.prizePool || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500" style={{ fontSize: 10, letterSpacing: '0.03em' }}>Date</p>
            <p className="text-white" style={{ fontSize: 12, fontWeight: 600 }}>{formatDateDisplay(match.date)}</p>
          </div>
          <div>
            <p className="text-gray-500" style={{ fontSize: 10, letterSpacing: '0.03em' }}>Start Time</p>
            <p className="text-white" style={{ fontSize: 12, fontWeight: 600 }}>{match.time}</p>
          </div>
        </div>

        {/* Room ID / Password — only shown when available */}
        {(status === 'live' || status === 'upcoming') && match.roomId && (
          <div
            className="flex items-center gap-3 flex-wrap"
            style={{
              fontSize: 11, padding: '6px 9px', borderRadius: 10,
              background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(148,163,184,0.14)',
            }}
          >
            <span className="text-gray-400">
              Room ID: <span className="text-white font-mono font-semibold">{match.roomId}</span>
            </span>
            {match.roomPassword && (
              <span className="text-gray-400">
                Pass: <span className="text-white font-mono font-semibold">{match.roomPassword}</span>
              </span>
            )}
            <button
              onClick={() => copyToClipboard(`${match.roomId}${match.roomPassword ? ' / ' + match.roomPassword : ''}`, 'room')}
              className="ml-auto text-yellow-400 copy-btn"
            >
              {copiedField === 'room' ? '✓' : '📋'}
            </button>
          </div>
        )}

        {/* Bottom action — spans the width of the right section only */}
        <div style={{ marginTop: 'auto' }}>
          {/* LIVE + not submitted → soft breathing glow Submit button */}
          {status === 'live' && !match.result && (
            <button
              onClick={() => onSubmitResult(match)}
              className="w-full submit-live-btn"
              style={{
                padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 10,
                background: '#F5C518', color: '#0A0E17', border: 'none', cursor: 'pointer',
              }}
            >
              Submit Result
            </button>
          )}

          {/* LIVE + submitted → simple "Submitted" pill (rejected stays distinct) — no animation once submitted */}
          {status === 'live' && match.result && match.result.status !== 'rejected' && (
            <div className="w-full text-center font-bold" style={{ padding: '8px 0', fontSize: 13, borderRadius: 10, background: 'rgba(34,197,94,0.16)', color: '#3DDC84', border: '1px solid rgba(34,197,94,0.35)' }}>
              ✓ Result Submitted
            </div>
          )}

          {status === 'live' && match.result && match.result.status === 'rejected' && (
            <div className="w-full text-center font-bold" style={{ padding: '8px 0', fontSize: 13, borderRadius: 10, background: 'rgba(239,68,68,0.16)', color: '#FF5C5C', border: '1px solid rgba(239,68,68,0.35)' }}>
              ✕ Not Approved
            </div>
          )}

          {status === 'upcoming' && matchStartMs > 0 && (
            <div
              className="text-center font-semibold"
              style={{ fontSize: 12, padding: '8px 0', borderRadius: 10, background: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.25)' }}
            >
              Starts In: <CountdownTimer targetMs={matchStartMs} />
            </div>
          )}

          {status === 'completed' && (
            <div className="w-full text-center font-bold" style={{ padding: '8px 0', fontSize: 13, borderRadius: 10, background: 'rgba(34,197,94,0.16)', color: '#3DDC84', border: '1px solid rgba(34,197,94,0.35)' }}>
              ✓ Result Submitted
              {match.result && match.result.status === 'approved' && isBr && match.result.finalPosition ? ` · #${match.result.finalPosition}` : ''}
            </div>
          )}

          {status === 'expired' && (
            <div className="w-full text-center font-bold" style={{ padding: '8px 0', fontSize: 13, borderRadius: 10, background: 'rgba(148,163,184,0.12)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.3)' }}>
              Submission Closed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Submit Result Modal (your existing logic preserved + new UI)
// ============================================================
function SubmitResultModal({ entry, userId, onClose }) {
  const [kills, setKills] = useState('')
  const [position, setPosition] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const isBr = entry.category === 'br'
  const fileInputRef = useRef(null)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    if (kills === '' || Number(kills) < 0) return alert('কতগুলো kill করেছেন লিখুন (০ হলেও লিখুন)')
    if (isBr && (position === '' || Number(position) < 1)) return alert('কত নম্বর Position এ শেষ করেছেন লিখুন')
    if (!file) return alert('Result screen-এর screenshot আপলোড করুন')

    const apiKey = import.meta.env.VITE_IMGBB_API_KEY

    if (!apiKey) {
      alert(
        'DEBUG: VITE_IMGBB_API_KEY পাওয়া যায়নি।\n\n' +
        '.env ফাইলে VITE_IMGBB_API_KEY=তোমার_কী যোগ করো, তারপর dev server পুরোপুরি বন্ধ করে আবার চালু করো।'
      )
      return
    }

    setBusy(true)

    // Upload screenshot to ImgBB
    let screenshotURL
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!data.success) throw new Error(data?.error?.message || 'ImgBB upload failed')
      screenshotURL = data.data.url
    } catch (err) {
      console.error('Screenshot upload error:', err)
      alert('Screenshot upload এ সমস্যা — ' + err.message)
      setBusy(false)
      return
    }

    // Save result to Firestore
    try {
      await addDoc(collection(db, 'matchResults'), {
        entryId: entry.id,
        tournamentId: entry.tournamentId,
        userId,
        title: entry.title,
        category: entry.category,
        claimedKills: Number(kills),
        claimedPosition: isBr ? Number(position) : null,
        screenshotURL,
        status: 'pending',
        submittedAt: serverTimestamp(),
      })
      alert('Result জমা হয়েছে। Admin verify করার পর ফলাফল দেখা যাবে।')
      onClose()
    } catch (err) {
      console.error('Firestore save error:', err)
      alert('Firestore-এ সেভ করতে সমস্যা — ' + err.code + ': ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 448, width: '100%', borderRadius: '16px 16px 0 0', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>📤 রেজাল্ট জমা দিন</h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: '#2A3150',
              color: '#8892A8', border: 'none', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Match Info */}
        <div className="rounded-lg" style={{ padding: 12, marginBottom: 20, background: '#0A0E17', border: '1px solid #2A3150' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{entry.title}</p>
          <p style={{ fontSize: 12, color: '#8892A8', margin: '4px 0 0' }}>{entry.gameMode || entry.category} • {entry.map || ''} • {formatDateDisplay(entry.date)}</p>
        </div>

        {/* Kills */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8892A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            কতগুলো Kill করেছেন?
          </label>
          <input
            type="number"
            min="0"
            value={kills}
            onChange={(e) => setKills(e.target.value)}
            placeholder="0"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8, background: '#0A0E17',
              border: '1px solid #2A3150', color: '#fff', fontSize: 18, fontWeight: 600,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Position (BR only) */}
        {isBr && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8892A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              কত নম্বর Position এ শেষ করেছেন?
            </label>
            <input
              type="number"
              min="1"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="১ = Winner"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8, background: '#0A0E17',
                border: '1px solid #2A3150', color: '#fff', fontSize: 18, fontWeight: 600,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Screenshot */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8892A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Result Screen-এর Screenshot
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #2A3150', borderRadius: 8, padding: 24,
              textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            {preview ? (
              <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 192, objectFit: 'contain', borderRadius: 8 }} />
            ) : (
              <div>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                <p style={{ fontSize: 14, color: '#8892A8', margin: 0 }}>ছবি আপলোড করতে ক্লিক করুন</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={submit}
          disabled={busy}
          className="join-btn"
          style={{
            width: '100%', padding: '14px', borderRadius: 8, fontWeight: 700,
            fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em',
            background: busy ? '#666' : 'linear-gradient(135deg, #F5A623, #FF6B35)',
            color: '#0A0E17', border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
            boxShadow: busy ? 'none' : '0 4px 20px rgba(245,166,35,0.25)',
            transition: 'all 0.3s',
          }}
        >
          {busy ? 'আপলোড হচ্ছে...' : 'রেজাল্ট জমা দিন'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Section Header (for "all" view grouping)
// ============================================================
function SectionHeader({ status, count, onViewAll }) {
  const configs = {
    live:      { label: 'LIVE MATCHES',      dot: 'bg-red-500' },
    upcoming:  { label: 'UPCOMING MATCHES',  dot: 'bg-yellow-500' },
    completed: { label: 'COMPLETED MATCHES', dot: 'bg-green-500' },
    expired:   { label: 'EXPIRED MATCHES',   dot: 'bg-slate-500' },
  }
  const c = configs[status]
  if (!c) return null

  return (
    <div className="flex items-center justify-between" style={{ marginTop: 22, marginBottom: 12 }}>
      <div className="flex items-center gap-2.5">
        <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} style={{ boxShadow: '0 0 6px currentColor' }} />
        <span className="uppercase font-bold text-white" style={{ fontSize: 12.5, letterSpacing: '0.06em' }}>
          {c.label}
        </span>
        <span
          className="font-bold"
          style={{
            fontSize: 11, padding: '1px 8px', borderRadius: 999,
            background: 'rgba(148,163,184,0.14)', color: '#8892A8',
          }}
        >
          {count}
        </span>
      </div>
      <button
        onClick={onViewAll}
        className="view-all-btn font-semibold"
        style={{ fontSize: 12, color: '#F5A623', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        View All ›
      </button>
    </div>
  )
}

// ============================================================
// MAIN EXPORT — Matches Component
// ============================================================
export default function Matches() {
  const { user } = useAuth()
  const { enriched, loading } = useEnrichedEntries(user)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [resultModalFor, setResultModalFor] = useState(null)
  const [, setTick] = useState(0)

  // Tick every second for status recalculation
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Re-calculate statuses on each tick
  const withLiveStatus = enriched.map(m => ({
    ...m,
    computedStatus: determineStatus(m, m.result),
  }))

  // Sort: live → upcoming → completed → expired
  const sortOrder = ['live', 'upcoming', 'completed', 'expired']
  const sorted = [...withLiveStatus].sort((a, b) => {
    const oA = sortOrder.indexOf(a.computedStatus)
    const oB = sortOrder.indexOf(b.computedStatus)
    if (oA !== oB) return oA - oB
    return (a.matchStartMs || 0) - (b.matchStartMs || 0)
  })

  // Filter by status
  const statusFiltered = activeFilter === 'all'
    ? sorted
    : sorted.filter(m => m.computedStatus === activeFilter)

  // Filter by search query (title / game mode / map) — client-side only
  const q = searchQuery.trim().toLowerCase()
  const filtered = q
    ? statusFiltered.filter(m => {
        const haystack = `${m.title || ''} ${m.tournamentName || ''} ${m.gameMode || ''} ${m.map || ''}`.toLowerCase()
        return haystack.includes(q)
      })
    : statusFiltered

  // Count per status
  const counts = { all: sorted.length }
  sortOrder.forEach(s => { counts[s] = sorted.filter(m => m.computedStatus === s).length })

  // Filter tabs config
  const FILTERS = [
    { key: 'all', label: 'সব' },
    { key: 'live', label: '🟢 লাইভ' },
    { key: 'upcoming', label: '🟡 আসছে' },
    { key: 'completed', label: '🔵 সম্পন্ন' },
    { key: 'expired', label: '🔴 মেয়াদোত্তীর্ণ' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% 0%, #10162A 0%, #0B0F17 55%)', fontFamily: "'Rajdhani', sans-serif" }}>
      {/* ===== CSS Keyframes & shared classes (injected once) ===== */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        /* Soft breathing glow for LIVE badge dot */
        @keyframes dotBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.85); }
        }
        /* Soft glow pulse around the LIVE status badge */
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
          50%      { box-shadow: 0 0 10px rgba(239,68,68,0.45); }
        }
        /* Premium breathing glow + gentle scale for the Submit Result button (LIVE only) */
        @keyframes submitBreathe {
          0%, 100% {
            box-shadow: 0 0 0 rgba(245,197,24,0.35), 0 4px 14px rgba(0,0,0,0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 22px rgba(245,197,24,0.75), 0 4px 18px rgba(0,0,0,0.3);
            transform: scale(1.03);
          }
        }
        .animate-ping {
          animation: pulseGlow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .submit-live-btn {
          animation: submitBreathe 1.8s ease-in-out infinite;
          transition: filter 0.2s ease, transform 0.2s ease;
        }
        .submit-live-btn:hover {
          filter: brightness(1.08);
        }
        .submit-live-btn:active {
          transform: scale(0.98);
        }
        .match-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .match-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
          border-color: rgba(245,166,35,0.25) !important;
        }
        .filter-tab {
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
        }
        .filter-tab:hover {
          transform: translateY(-1px);
        }
        .copy-btn, .view-all-btn {
          transition: opacity 0.2s ease, transform 0.15s ease;
        }
        .copy-btn:hover, .view-all-btn:hover {
          opacity: 0.75;
        }
        .search-input::placeholder {
          color: #5C6580;
        }
        .search-input:focus {
          border-color: rgba(245,166,35,0.45) !important;
          box-shadow: 0 0 0 3px rgba(245,166,35,0.12);
        }
      `}</style>

      {/* Header */}
      <div
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(11,15,23,0.78)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          padding: '18px 20px 14px',
        }}
      >
        <div className="max-w-2xl mx-auto" style={{ maxWidth: 672 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2, letterSpacing: '0.01em' }}>
                🎮 আমার ম্যাচ
              </h1>
              <p style={{ fontSize: 12.5, color: '#8892A8', margin: '3px 0 0', fontWeight: 500 }}>
                আপনার টুর্নামেন্ট ম্যাচ ট্র্যাক করুন
              </p>
            </div>
            <div
              className="flex items-center gap-2"
              style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(26,32,53,0.7)', border: '1px solid rgba(148,163,184,0.16)' }}
            >
              <div className="animate-ping" style={{ width: 7, height: 7, borderRadius: '50%', background: '#00E676' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8892A8' }}>{counts.all} ম্যাচ</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative" style={{ marginTop: 14 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#5C6580', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ম্যাচ খুঁজুন (নাম, মোড, ম্যাপ)..."
              className="search-input"
              style={{
                width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12,
                background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(148,163,184,0.16)',
                color: '#fff', fontSize: 13, fontWeight: 500, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 672, margin: '0 auto', padding: '18px 20px 32px' }}>
        {/* Filter Tabs */}
        <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: 4, marginBottom: 6, WebkitOverflowScrolling: 'touch' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="filter-tab flex-shrink-0 flex items-center gap-1.5 rounded-full font-semibold uppercase"
              style={{
                padding: '8px 15px', fontSize: 11.5, letterSpacing: '0.04em',
                background: activeFilter === f.key ? 'rgba(245,166,35,0.12)' : 'rgba(17,24,39,0.6)',
                border: `1px solid ${activeFilter === f.key ? 'rgba(245,166,35,0.4)' : 'rgba(148,163,184,0.14)'}`,
                color: activeFilter === f.key ? '#F5A623' : '#8892A8',
                cursor: 'pointer',
              }}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  style={{
                    marginLeft: 2, padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: activeFilter === f.key ? 'rgba(245,166,35,0.2)' : 'rgba(148,163,184,0.14)',
                    color: activeFilter === f.key ? '#F5A623' : '#8892A8',
                  }}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ marginTop: 16 }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  borderRadius: 16, overflow: 'hidden', marginBottom: 14, display: 'flex', flexDirection: 'row',
                  background: 'rgba(22,27,46,0.5)', border: '1px solid rgba(148,163,184,0.12)',
                }}
              >
                <div style={{ width: 140, height: 100, flexShrink: 0, margin: 8, borderRadius: 12, background: '#1E2540' }} />
                <div style={{ flex: 1, padding: '10px 12px 10px 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ height: 14, background: '#1E2540', borderRadius: 4, width: '75%' }} />
                  <div className="grid grid-cols-2 gap-3">
                    <div style={{ height: 10, background: '#1E2540', borderRadius: 4 }} />
                    <div style={{ height: 10, background: '#1E2540', borderRadius: 4 }} />
                    <div style={{ height: 10, background: '#1E2540', borderRadius: 4 }} />
                    <div style={{ height: 10, background: '#1E2540', borderRadius: 4 }} />
                  </div>
                  <div style={{ height: 30, background: '#1E2540', borderRadius: 10, marginTop: 'auto' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>কোনো ম্যাচ নেই</h3>
            <p style={{ fontSize: 14, color: '#8892A8', maxWidth: 280, margin: '0 auto' }}>
              {searchQuery
                ? 'আপনার সার্চের সাথে মিলে এমন কোনো ম্যাচ পাওয়া যায়নি।'
                : 'এই ক্যাটাগরিতে কোনো ম্যাচ পাওয়া যায়নি। Home থেকে একটি টুর্নামেন্টে জয়েন করুন!'}
            </p>
          </div>
        )}

        {/* Match Cards */}
        {!loading && filtered.map((match, index) => (
          <div key={match.id}>
            {/* Section headers for "all" view */}
            {activeFilter === 'all' && (
              (index === 0 || match.computedStatus !== filtered[index - 1]?.computedStatus) && (
                <SectionHeader
                  status={match.computedStatus}
                  count={counts[match.computedStatus]}
                  onViewAll={() => setActiveFilter(match.computedStatus)}
                />
              )
            )}
            <MatchCard
              match={match}
              index={index}
              onSubmitResult={(m) => setResultModalFor(m)}
            />
          </div>
        ))}
      </div>

      {/* Submit Result Modal */}
      {resultModalFor && (
        <SubmitResultModal
          entry={resultModalFor}
          userId={user.uid}
          onClose={() => setResultModalFor(null)}
        />
      )}
    </div>
  )
}
