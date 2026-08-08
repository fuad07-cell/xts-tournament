import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getCategoryByKey } from '../constants/categories'

// ============================================================
// Match Status Determination (based on current time)
// ============================================================
function determineStatus(entry, result) {
  // If result submitted → completed
  if (result) return 'completed'

  const now = Date.now()

  // entry তে না থাকলে tournamentData থেকে নাও (পুরনো entries এর জন্য)
  const matchDateStr = entry.date || entry.tournamentData?.date
  const matchTimeStr = entry.time || entry.tournamentData?.time
  if (!matchDateStr || !matchTimeStr) return 'upcoming'

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
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
        fontSize: 9.5, letterSpacing: '0.08em', fontWeight: 800,
        padding: '4px 10px', borderRadius: 999,
        background: bg, border: `1px solid ${border}`, color,
        fontFamily: "'Rajdhani', sans-serif",
        animation: glow ? 'badgeGlow 1.8s ease-in-out infinite' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
        {glow && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: dot, animation: 'liveRing 1.4s ease-out infinite' }} />}
        <span style={{
          display: 'block', width: 6, height: 6, borderRadius: '50%', background: dot, position: 'relative', zIndex: 1,
          animation: glow ? 'dotBlink 1.8s ease-in-out infinite' : 'none',
        }} />
      </span>
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
// Accepts a months array (from t('months')) for localized month names
// ============================================================
function formatDateDisplay(dateStr, months) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const monthNames = months || ['জানু', 'ফেব', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ', 'অক্টো', 'নভে', 'ডিসে']
  return `${d.getDate()} ${monthNames[d.getMonth()]}`
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
function MatchCard({ match, index, onSubmitResult, months }) {
  const { t } = useLanguage()
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

  const statusBorder = {
    live: 'rgba(255,92,92,0.3)',
    upcoming: 'rgba(245,166,35,0.2)',
    completed: 'rgba(61,220,132,0.2)',
    expired: 'rgba(255,255,255,0.06)',
  }[status] || 'rgba(255,255,255,0.06)'

  const statusTopLine = {
    live: 'linear-gradient(90deg, #FF5C5C, transparent)',
    upcoming: 'linear-gradient(90deg, #F5A623, transparent)',
    completed: 'linear-gradient(90deg, #3DDC84, transparent)',
    expired: 'linear-gradient(90deg, #4A5270, transparent)',
  }[status] || 'none'

  return (
    <div
      className="match-card"
      style={{
        marginBottom: 14,
        borderRadius: 20,
        overflow: 'hidden',
        background: 'rgba(13,18,32,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${statusBorder}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        animationDelay: `${index * 0.07}s`,
        animationFillMode: 'both',
        position: 'relative',
      }}
    >
      {/* Top accent line */}
      <div style={{ height: 2, background: statusTopLine, width: '100%' }} />

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
        {/* Banner */}
        <div style={{ width: 130, flexShrink: 0, margin: '12px 0 12px 12px', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
          {bannerImage ? (
            <img
              src={bannerImage}
              alt={match.title || visual.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 110 }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', minHeight: 110,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              🎮
            </div>
          )}
          {/* Category label overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '14px 6px 5px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.8)',
            textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            {visual.label}
          </div>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '12px 14px 12px 10px', gap: 8 }}>
          {/* Title + badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontSize: 14, fontWeight: 800, color: '#fff',
                letterSpacing: '0.01em', lineHeight: 1.25,
                fontFamily: "'Rajdhani', sans-serif",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {match.title || match.tournamentName || t('matchDefaultName')}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, color: '#4A5270', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {match.map ? `${match.map}` : ''}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
            <div>
              <p style={{ margin: 0, fontSize: 9.5, color: '#3D4560', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('entryFeeLabel')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 800, color: '#F5A623', fontFamily: "'Rajdhani', sans-serif" }}>৳{match.entryFee}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9.5, color: '#3D4560', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('prizePoolLabel')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 800, color: '#3DDC84', fontFamily: "'Rajdhani', sans-serif" }}>৳{(match.prizePool || 0).toLocaleString()}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9.5, color: '#3D4560', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('date')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#C8D0E0' }}>{formatDateDisplay(match.date || match.tournamentData?.date, months)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9.5, color: '#3D4560', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('startTime')}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#C8D0E0' }}>{match.time || match.tournamentData?.time || '—'}</p>
            </div>
          </div>

          {/* Room ID row */}
          {(status === 'live' || status === 'upcoming') && match.roomId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '7px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: 10.5, color: '#4A5270', fontWeight: 600 }}>
                {t('roomLabel')}: <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{match.roomId}</span>
              </span>
              {match.roomPassword && (
                <span style={{ fontSize: 10.5, color: '#4A5270', fontWeight: 600 }}>
                  {t('passLabel')}: <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{match.roomPassword}</span>
                </span>
              )}
              <button
                onClick={() => copyToClipboard(`${match.roomId}${match.roomPassword ? ' / ' + match.roomPassword : ''}`, 'room')}
                className="copy-btn"
                style={{ marginLeft: 'auto', fontSize: 14, color: '#F5A623', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {copiedField === 'room' ? '✓' : '📋'}
              </button>
            </div>
          )}

          {/* Action row */}
          <div style={{ marginTop: 'auto' }}>
            {status === 'live' && !match.result && (
              <button
                onClick={() => onSubmitResult(match)}
                className="submit-live-btn"
                style={{
                  width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 800,
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #F5C518, #FF8C00)',
                  color: '#0A0E17', fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: '0.04em',
                }}
              >
                ⚡ {t('submitResult')}
              </button>
            )}

            {status === 'live' && match.result && match.result.status !== 'rejected' && (
              <div style={{ width: '100%', textAlign: 'center', padding: '10px 0', fontSize: 12.5, fontWeight: 800, borderRadius: 12, background: 'rgba(61,220,132,0.1)', color: '#3DDC84', border: '1px solid rgba(61,220,132,0.25)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
                ✓ {t('resultSubmittedBadge')}
              </div>
            )}

            {status === 'live' && match.result && match.result.status === 'rejected' && (
              <div style={{ width: '100%', textAlign: 'center', padding: '10px 0', fontSize: 12.5, fontWeight: 800, borderRadius: 12, background: 'rgba(255,92,92,0.1)', color: '#FF5C5C', border: '1px solid rgba(255,92,92,0.25)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
                ✕ {t('notApprovedBadge')}
              </div>
            )}

            {status === 'upcoming' && matchStartMs > 0 && (
              <div style={{
                textAlign: 'center', padding: '9px 0', borderRadius: 12,
                background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)',
                fontSize: 12.5, fontWeight: 700, color: '#F5A623',
                fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.03em',
              }}>
                ⏱ {t('startsInTime')} <CountdownTimer targetMs={matchStartMs} />
              </div>
            )}

            {status === 'completed' && (
              <div style={{ width: '100%', textAlign: 'center', padding: '10px 0', fontSize: 12.5, fontWeight: 800, borderRadius: 12, background: 'rgba(61,220,132,0.1)', color: '#3DDC84', border: '1px solid rgba(61,220,132,0.25)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
                🏆 {t('completedBadge')}{match.result?.status === 'approved' && isBr && match.result.finalPosition ? ` · #${match.result.finalPosition}` : ''}
              </div>
            )}

            {status === 'expired' && (
              <div style={{ width: '100%', textAlign: 'center', padding: '10px 0', fontSize: 12.5, fontWeight: 700, borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: '#3D4560', border: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}>
                {t('submissionClosedBadge')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Submit Result Modal (your existing logic preserved + new UI)
// ============================================================
function SubmitResultModal({ entry, userId, onClose, months }) {
  const { t } = useLanguage()
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
    if (kills === '' || Number(kills) < 0) return alert(t('enterKillCount'))
    if (isBr && (position === '' || Number(position) < 1)) return alert(t('enterPosition'))
    if (!file) return alert(t('uploadScreenshot'))

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
      alert(t('screenshotUploadError') + err.message)
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
      alert(t('resultSubmittedMsg'))
      onClose()
    } catch (err) {
      console.error('Firestore save error:', err)
      alert(t('somethingWentWrong') + ' — ' + (err.code || '') + ': ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 448, width: '100%', borderRadius: '16px 16px 0 0', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>📤 {t('submitResultTitle')}</h2>
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
          <p style={{ fontSize: 12, color: '#8892A8', margin: '4px 0 0' }}>{entry.gameMode || entry.category} • {entry.map || ''} • {formatDateDisplay(entry.date, months)}</p>
        </div>

        {/* Kills */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8892A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('howManyKills')}
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
              {t('whichPosition')}
            </label>
            <input
              type="number"
              min="1"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="1 = Winner"
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
            {t('resultScreenshot')}
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
                <p style={{ fontSize: 14, color: '#8892A8', margin: 0 }}>{t('clickToUpload')}</p>
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
          {busy ? t('uploading') : t('submitResult')}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Section Header (for "all" view grouping)
// ============================================================
function SectionHeader({ status, count, onViewAll }) {
  const { t } = useLanguage()
  const configs = {
    live:      { label: t('liveMatchSection'),      color: '#FF5C5C', bg: 'rgba(255,92,92,0.12)', dot: '#FF3B3B' },
    upcoming:  { label: t('upcomingMatchSection'),  color: '#F5A623', bg: 'rgba(245,166,35,0.1)', dot: '#F5A623' },
    completed: { label: t('completedMatchSection'), color: '#3DDC84', bg: 'rgba(61,220,132,0.1)', dot: '#3DDC84' },
    expired:   { label: t('expiredMatchSection'),   color: '#4A5270', bg: 'rgba(255,255,255,0.05)', dot: '#4A5270' },
  }
  const c = configs[status]
  if (!c) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Colored rule */}
        <div style={{ width: 3, height: 16, borderRadius: 999, background: c.dot, boxShadow: `0 0 8px ${c.dot}` }} />
        <span style={{
          fontSize: 11, fontWeight: 800, color: c.color, letterSpacing: '0.1em',
          fontFamily: "'Rajdhani', sans-serif",
        }}>
          {c.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: c.bg, color: c.color, border: `1px solid ${c.dot}30`,
        }}>
          {count}
        </span>
      </div>
      <button
        onClick={onViewAll}
        className="view-all-btn"
        style={{ fontSize: 11.5, fontWeight: 700, color: '#4A5270', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.04em' }}
      >
        {t('viewAll')}
      </button>
    </div>
  )
}

// ============================================================
// MAIN EXPORT — Matches Component
// ============================================================
export default function Matches() {
  const { user } = useAuth()
  const { t, dateLocale } = useLanguage()
  const { enriched, loading } = useEnrichedEntries(user)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [resultModalFor, setResultModalFor] = useState(null)
  const [, setTick] = useState(0)

  // Localized months array
  const months = t('months')

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
    { key: 'all', label: t('all') },
    { key: 'live', label: '🟢 ' + t('live') },
    { key: 'upcoming', label: '🟡 ' + t('upcoming') },
    { key: 'completed', label: '🔵 ' + t('completed') },
    { key: 'expired', label: '🔴 ' + t('expired') },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080C18 0%, #0D1220 40%, #080C18 100%)', fontFamily: "'Rajdhani', 'Inter', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes shimmerMove {
          0%   { background-position: -400% 0; }
          100% { background-position: 400% 0; }
        }
        @keyframes dotBlink {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #FF3B3B; }
          50%      { opacity: 0.5; transform: scale(0.8); box-shadow: 0 0 2px #FF3B3B; }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
          50%      { box-shadow: 0 0 14px rgba(239,68,68,0.5), 0 0 30px rgba(239,68,68,0.15); }
        }
        @keyframes submitPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(245,197,24,0.5), 0 6px 20px rgba(245,166,35,0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(245,197,24,0), 0 6px 28px rgba(245,166,35,0.55);
            transform: scale(1.015);
          }
        }
        @keyframes liveRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes countdownPop {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .match-card {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .match-card:hover {
          transform: translateY(-3px) scale(1.005);
          box-shadow: 0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,166,35,0.2) !important;
        }
        .match-card:active {
          transform: translateY(-1px) scale(1.002);
        }
        .filter-tab {
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
          white-space: nowrap;
        }
        .filter-tab:hover {
          transform: translateY(-2px);
        }
        .filter-tab:active {
          transform: translateY(0);
        }
        .submit-live-btn {
          animation: submitPulse 2s ease-in-out infinite;
          transition: filter 0.2s ease, transform 0.15s ease;
        }
        .submit-live-btn:hover {
          filter: brightness(1.1);
          animation-play-state: paused;
        }
        .submit-live-btn:active {
          transform: scale(0.97) !important;
        }
        .copy-btn {
          transition: all 0.2s ease;
        }
        .copy-btn:hover { opacity: 0.75; transform: scale(1.1); }
        .view-all-btn {
          transition: all 0.2s ease;
          position: relative;
        }
        .view-all-btn:hover { color: #FFD166 !important; }
        .search-input::placeholder { color: #3D4560; }
        .search-input:focus {
          border-color: rgba(245,166,35,0.5) !important;
          box-shadow: 0 0 0 3px rgba(245,166,35,0.1), 0 2px 20px rgba(0,0,0,0.3) !important;
          outline: none;
        }
        .shimmer-skeleton {
          background: linear-gradient(90deg, #131929 25%, #1A2240 50%, #131929 75%);
          background-size: 400% 100%;
          animation: shimmerMove 1.8s ease-in-out infinite;
        }
        .live-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: #FF3B3B;
          animation: liveRing 1.4s ease-out infinite;
        }
      `}</style>

      {/* ── HEADER ── */}
      <div
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(8,12,24,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 20px 16px',
        }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>🎮</span>
                <h1 style={{
                  fontSize: 28, fontWeight: 800, color: '#fff', margin: 0,
                  letterSpacing: '0.02em', lineHeight: 1.1,
                  fontFamily: "'Rajdhani', sans-serif",
                  background: 'linear-gradient(135deg, #fff 60%, rgba(245,166,35,0.8))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {t('myMatchesTitle')}
                </h1>
              </div>
              <p style={{ fontSize: 12, color: '#4A5270', margin: 0, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('tournamentMatchTrackerSub')}
              </p>
            </div>

            {/* Live match count pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ position: 'relative', width: 8, height: 8 }}>
                <div className="live-ring" />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E676', position: 'relative', zIndex: 1 }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Rajdhani', sans-serif" }}>
                {counts.all}
              </span>
              <span style={{ fontSize: 11, color: '#4A5270', fontWeight: 500 }}>{t('matchesCount')}</span>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: '#3D4560', pointerEvents: 'none', zIndex: 1,
            }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchMatches')}
              className="search-input"
              style={{
                width: '100%', padding: '12px 16px 12px 42px',
                borderRadius: 14, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 13.5, fontWeight: 500,
                boxSizing: 'border-box', transition: 'all 0.25s ease',
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
          marginBottom: 20, WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {FILTERS.map(f => {
            const isActive = activeFilter === f.key
            const tabColors = {
              all:      { active: '#F5A623', glow: 'rgba(245,166,35,0.2)' },
              live:     { active: '#FF5C5C', glow: 'rgba(255,92,92,0.2)' },
              upcoming: { active: '#F5A623', glow: 'rgba(245,166,35,0.2)' },
              completed:{ active: '#3DDC84', glow: 'rgba(61,220,132,0.2)' },
              expired:  { active: '#8892A8', glow: 'rgba(136,146,168,0.2)' },
            }
            const tc = tabColors[f.key] || tabColors.all
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className="filter-tab"
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 999, fontSize: 12,
                  fontWeight: 700, letterSpacing: '0.05em',
                  fontFamily: "'Rajdhani', sans-serif",
                  background: isActive ? tc.glow : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? tc.active : 'rgba(255,255,255,0.07)'}`,
                  color: isActive ? tc.active : '#4A5270',
                  cursor: 'pointer',
                  boxShadow: isActive ? `0 4px 20px ${tc.glow}` : 'none',
                }}
              >
                {f.label}
                {counts[f.key] > 0 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                    background: isActive ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.06)',
                    color: isActive ? tc.active : '#4A5270',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                  }}>
                    {counts[f.key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ marginTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                borderRadius: 20, overflow: 'hidden', marginBottom: 16,
                display: 'flex', flexDirection: 'row',
                background: 'rgba(19,25,41,0.8)', border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}>
                <div className="shimmer-skeleton" style={{ width: 130, height: 120, flexShrink: 0, margin: 12, borderRadius: 14 }} />
                <div style={{ flex: 1, padding: '14px 14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="shimmer-skeleton" style={{ height: 15, borderRadius: 6, width: '70%' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[1,2,3,4].map(j => <div key={j} className="shimmer-skeleton" style={{ height: 11, borderRadius: 4 }} />)}
                  </div>
                  <div className="shimmer-skeleton" style={{ height: 34, borderRadius: 12, marginTop: 'auto' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
              background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}>🎮</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 10px', fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.02em' }}>
              {t('noMatchFoundTitle')}
            </h3>
            <p style={{ fontSize: 13.5, color: '#4A5270', maxWidth: 260, margin: '0 auto', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
              {searchQuery
                ? t('noSearchResult')
                : t('joinFromHomeMsg')}
            </p>
          </div>
        )}

        {/* Match Cards */}
        {!loading && filtered.map((match, index) => (
          <div key={match.id}>
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
              months={months}
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
          months={months}
        />
      )}
    </div>
  )
}
