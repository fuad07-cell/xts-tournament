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

  const units = [
    { label: 'D', value: time.days },
    { label: 'H', value: time.hours },
    { label: 'M', value: time.minutes },
    { label: 'S', value: time.seconds },
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="uppercase tracking-wider font-semibold" style={{ fontSize: 9, color: '#5C6584' }}>
        শুরু হতে:
      </span>
      <div className="flex items-center gap-1">
        {units.map((u, i) => (
          <span key={u.label} className="flex items-center gap-1">
            <span
              className="rounded font-bold tabular-nums text-center"
              style={{
                minWidth: 24, padding: '3px 4px', fontSize: 12, lineHeight: 1,
                background: '#0A0E17', border: '1px solid rgba(245,166,35,0.25)', color: '#F5A623',
              }}
            >
              {String(u.value).padStart(2, '0')}
            </span>
            {i < units.length - 1 && <span style={{ color: '#3A4160', fontSize: 11 }}>:</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Status Badge
// ============================================================
function StatusBadge({ status }) {
  const config = {
    live:      { label: 'LIVE',      bg: 'rgba(255,23,68,0.14)',   border: 'rgba(255,23,68,0.4)',   color: '#FF3B5C' },
    upcoming:  { label: 'UPCOMING',  bg: 'rgba(255,214,0,0.14)',   border: 'rgba(255,214,0,0.4)',   color: '#FFD600' },
    completed: { label: 'COMPLETED', bg: 'rgba(0,230,118,0.14)',   border: 'rgba(0,230,118,0.4)',   color: '#00E676' },
    expired:   { label: 'EXPIRED',   bg: 'rgba(136,146,168,0.14)', border: 'rgba(136,146,168,0.35)',color: '#8892A8' },
  }
  const c = config[status]

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border font-bold uppercase whitespace-nowrap"
      style={{ background: c.bg, borderColor: c.border, color: c.color, fontSize: 9.5, padding: '4px 9px', letterSpacing: '0.06em' }}
    >
      {status === 'live' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: c.color }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: c.color }} />
        </span>
      ) : (
        <span className="inline-flex rounded-full h-1.5 w-1.5" style={{ background: c.color }} />
      )}
      {c.label}
    </div>
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

  // Parse match start time for countdown
  const matchStartMs = match.matchStartMs || 0
  const isBr = match.category === 'br'

  // Auto-resolve this match's real banner image + label from categories.js
  const visual = getCategoryVisual(match.category)

  const cardBorder =
    status === 'live' ? 'rgba(255,23,68,0.35)' :
    status === 'upcoming' ? 'rgba(255,214,0,0.22)' :
    status === 'completed' ? 'rgba(0,230,118,0.22)' : '#2A3150'

  return (
    <div
      className="relative flex overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        background: 'linear-gradient(160deg, #131A2B 0%, #0E1320 100%)',
        borderColor: cardBorder,
        marginBottom: 16,
        boxShadow: status === 'live'
          ? '0 10px 28px rgba(255,23,68,0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
        animation: 'slideUp 0.4s ease-out',
        animationDelay: `${index * 0.06}s`,
        animationFillMode: 'both',
      }}
    >
      {/* Shimmer for live */}
      {status === 'live' && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,23,68,0.05) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
          }}
        />
      )}

      {/* ===== Left: Mode Banner Image ===== */}
      <div className="relative flex-shrink-0" style={{ width: 116 }}>
        {visual.image ? (
          <img
            src={visual.image}
            alt={visual.label}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg,#2A3150,#111827)', fontSize: 28 }}
          >
            🎮
          </div>
        )}
        {/* readability gradient */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(10,14,23,0.05) 0%, rgba(10,14,23,0.1) 45%, rgba(10,14,23,0.95) 100%)' }}
        />

        {/* Squad-type badge (SOLO / 4v4 / 1v1 etc.) */}
        {visual.badge && (
          <span
            className="absolute top-2 left-2 font-bold uppercase rounded"
            style={{
              fontSize: 8.5, padding: '2px 6px', letterSpacing: '0.05em',
              background: 'rgba(10,14,23,0.8)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.35)',
            }}
          >
            {visual.badge}
          </span>
        )}

        {/* Mode label on the banner */}
        <div className="absolute bottom-0 left-0 right-0" style={{ padding: '8px 8px' }}>
          <p
            className="font-extrabold uppercase leading-tight text-white"
            style={{ fontSize: 12, textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}
          >
            {visual.label}
          </p>
        </div>
      </div>

      {/* ===== Right: Match Details ===== */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col" style={{ padding: '12px 14px' }}>
        {/* Title + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-white truncate" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
              {match.title || match.tournamentName || 'টুর্নামেন্ট'}
            </h3>
            <p className="truncate" style={{ fontSize: 11, color: '#8892A8', marginTop: 2 }}>
              {visual.label}{match.map ? ` • 🗺️ ${match.map}` : ''}
            </p>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Entry Fee / Prize Pool / Date / Time */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5" style={{ marginTop: 10 }}>
          <div>
            <p className="uppercase tracking-wider font-semibold" style={{ fontSize: 9, color: '#5C6584' }}>Entry Fee</p>
            <p className="font-bold" style={{ fontSize: 13, color: '#F5A623' }}>৳{match.entryFee}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider font-semibold" style={{ fontSize: 9, color: '#5C6584' }}>Prize Pool</p>
            <p className="font-bold" style={{ fontSize: 13, color: '#00E676' }}>🏆 ৳{(match.prizePool || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider font-semibold" style={{ fontSize: 9, color: '#5C6584' }}>Match Date</p>
            <p className="font-semibold" style={{ fontSize: 12.5, color: '#E5E8F0' }}>📅 {formatDateDisplay(match.date)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider font-semibold" style={{ fontSize: 9, color: '#5C6584' }}>Start Time</p>
            <p className="font-semibold" style={{ fontSize: 12.5, color: '#E5E8F0' }}>⏰ {match.time}</p>
          </div>
        </div>

        {/* Room ID / Password — only shown when available */}
        {(status === 'live' || status === 'upcoming') && match.roomId && (
          <div
            className="flex items-center gap-3 rounded-lg flex-wrap"
            style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(10,14,23,0.55)', border: '1px solid #232B45' }}
          >
            <div className="flex items-center gap-1 min-w-0">
              <span style={{ fontSize: 10, color: '#5C6584' }}>ID</span>
              <span className="font-bold truncate" style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>{match.roomId}</span>
            </div>
            {match.roomPassword && (
              <div className="flex items-center gap-1 min-w-0">
                <span style={{ fontSize: 10, color: '#5C6584' }}>PW</span>
                <span className="font-bold truncate" style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>{match.roomPassword}</span>
              </div>
            )}
            <button
              onClick={() => copyToClipboard(`${match.roomId}${match.roomPassword ? ' / ' + match.roomPassword : ''}`, 'room')}
              className="ml-auto flex-shrink-0 rounded transition-colors"
              style={{ fontSize: 9, padding: '3px 7px', background: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.2)' }}
            >
              {copiedField === 'room' ? '✓' : '📋'}
            </button>
          </div>
        )}

        {/* Footer: countdown (upcoming) or status button/pill */}
        <div className="flex items-center flex-wrap gap-2" style={{ marginTop: 'auto', paddingTop: 10 }}>
          {/* UPCOMING → countdown only */}
          {status === 'upcoming' && matchStartMs > 0 && (
            <CountdownTimer targetMs={matchStartMs} />
          )}

          {/* LIVE + not submitted → yellow Submit Result button */}
          {status === 'live' && !match.result && (
            <button
              onClick={() => onSubmitResult(match)}
              className="ml-auto rounded-lg font-bold uppercase tracking-wider active:scale-95 transition-transform"
              style={{
                fontSize: 11.5, padding: '8px 16px',
                background: 'linear-gradient(135deg, #FFD600, #F5A623)',
                color: '#1A1200', border: 'none', boxShadow: '0 4px 14px rgba(255,214,0,0.25)',
              }}
            >
              📤 Submit Result
            </button>
          )}

          {/* LIVE + submitted, pending review */}
          {status === 'live' && match.result && match.result.status === 'pending' && (
            <span className="ml-auto flex items-center gap-1.5 font-bold uppercase" style={{ fontSize: 10.5, color: '#00B0FF' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#00B0FF' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#00B0FF' }} />
              </span>
              রিভিউ হচ্ছে...
            </span>
          )}

          {/* LIVE + result approved */}
          {status === 'live' && match.result && match.result.status === 'approved' && (
            <span
              className="ml-auto rounded-lg font-bold uppercase tracking-wider"
              style={{ fontSize: 11, padding: '8px 14px', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: '#00E676' }}
            >
              ✓ Result Submitted
              {isBr && match.result.finalPosition && ` · #${match.result.finalPosition}`}
            </span>
          )}

          {/* LIVE + result rejected */}
          {status === 'live' && match.result && match.result.status === 'rejected' && (
            <span
              className="ml-auto rounded-lg font-bold uppercase tracking-wider"
              style={{ fontSize: 11, padding: '8px 14px', background: 'rgba(255,23,68,0.12)', border: '1px solid rgba(255,23,68,0.35)', color: '#FF3B5C' }}
            >
              ✕ Not Approved
            </span>
          )}

          {/* COMPLETED → green Result Submitted button */}
          {status === 'completed' && (
            <span
              className="ml-auto rounded-lg font-bold uppercase tracking-wider"
              style={{ fontSize: 11, padding: '8px 14px', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: '#00E676' }}
            >
              ✓ Result Submitted
              {match.result && match.result.status === 'approved' && isBr && match.result.finalPosition && ` · #${match.result.finalPosition}`}
            </span>
          )}

          {/* EXPIRED → red Submission Closed button */}
          {status === 'expired' && (
            <span
              className="ml-auto rounded-lg font-bold uppercase tracking-wider"
              style={{ fontSize: 11, padding: '8px 14px', background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', color: '#FF3B5C' }}
            >
              🔒 Submission Closed
            </span>
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
function SectionHeader({ status, count }) {
  const configs = {
    live:      { emoji: '🟢', label: 'লাইভ ম্যাচ', color: '#00E676', borderColor: 'rgba(0,230,118,0.2)' },
    upcoming:  { emoji: '🟡', label: 'আসন্ন ম্যাচ', color: '#FFD600', borderColor: 'rgba(255,214,0,0.2)' },
    completed: { emoji: '🔵', label: 'সম্পন্ন ম্যাচ', color: '#00B0FF', borderColor: 'rgba(0,176,255,0.2)' },
    expired:   { emoji: '🔴', label: 'মেয়াদোত্তীর্ণ', color: '#FF1744', borderColor: 'rgba(255,23,68,0.2)' },
  }
  const c = configs[status]
  if (!c) return null

  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
      {status === 'live' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: c.color }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: c.color }} />
        </span>
      ) : (
        <span style={{ fontSize: 12 }}>{c.emoji}</span>
      )}
      <span className="uppercase tracking-wider font-bold" style={{ fontSize: 11, color: c.color }}>
        {c.label} ({count})
      </span>
      <div className="flex-1" style={{ height: 1, background: c.borderColor }} />
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

  // Filter
  const filtered = activeFilter === 'all'
    ? sorted
    : sorted.filter(m => m.computedStatus === activeFilter)

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
    <div style={{ minHeight: '100vh', background: '#0A0E17', fontFamily: "'Rajdhani', sans-serif" }}>
      {/* ===== CSS Keyframes (injected once) ===== */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
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
        .animate-ping {
          animation: pulseGlow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Header */}
      <div
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(10,14,23,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #2A3150',
          padding: '16px 20px',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
              🎮 আমার ম্যাচ
            </h1>
            <p style={{ fontSize: 13, color: '#8892A8', margin: '4px 0 0' }}>
              আপনার টুর্নামেন্ট ম্যাচ ট্র্যাক করুন
            </p>
          </div>
          <div
            className="flex items-center gap-2"
            style={{ padding: '6px 12px', borderRadius: 999, background: '#1A2035', border: '1px solid #2A3150' }}
          >
            <div className="animate-ping" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E676' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#8892A8' }}>{counts.all} ম্যাচ</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 672, margin: '0 auto', padding: '16px 20px 32px' }}>
        {/* Filter Tabs */}
        <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: 12, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider transition-all duration-200"
              style={{
                padding: '8px 16px', fontSize: 12,
                background: activeFilter === f.key ? 'rgba(245,166,35,0.1)' : '#111827',
                border: `1px solid ${activeFilter === f.key ? 'rgba(245,166,35,0.3)' : '#2A3150'}`,
                color: activeFilter === f.key ? '#F5A623' : '#8892A8',
                cursor: 'pointer',
              }}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  style={{
                    marginLeft: 4, padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: activeFilter === f.key ? 'rgba(245,166,35,0.2)' : '#2A3150',
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
          <div style={{ spaceBetween: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A3150', background: '#111827', marginBottom: 16 }}>
                <div style={{ height: 112, background: '#2A3150' }} />
                <div style={{ padding: 20 }}>
                  <div style={{ height: 16, background: '#2A3150', borderRadius: 4, width: '75%', marginBottom: 16 }} />
                  <div className="grid grid-cols-2 gap-4">
                    <div style={{ height: 12, background: '#2A3150', borderRadius: 4 }} />
                    <div style={{ height: 12, background: '#2A3150', borderRadius: 4 }} />
                  </div>
                  <div style={{ height: 40, background: '#2A3150', borderRadius: 8, marginTop: 16 }} />
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
              এই ক্যাটাগরিতে কোনো ম্যাচ পাওয়া যায়নি। Home থেকে একটি টুর্নামেন্টে জয়েন করুন!
            </p>
          </div>
        )}

        {/* Match Cards */}
        {!loading && filtered.map((match, index) => (
          <div key={match.id}>
            {/* Section headers for "all" view */}
            {activeFilter === 'all' && (
              (index === 0 || match.computedStatus !== filtered[index - 1]?.computedStatus) && (
                <SectionHeader status={match.computedStatus} count={counts[match.computedStatus]} />
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
