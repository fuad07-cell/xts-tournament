import { useEffect, useMemo, useState } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, getCountFromServer, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { ensureFreshPeriodStats } from '../leaderboardStats'
import { useLanguage } from '../context/LanguageContext'
import { UserAvatar } from '../components/AvatarSystem'

// Maps each ranking category to its weekly / monthly / all-time Firestore field.
// All values live directly on the user doc (kept in sync by Cloud Functions),
// so the client never computes totals itself.
const FIELD_MAP = {
  wins: { weekly: 'weeklyWins', monthly: 'monthlyWins', allTime: 'allTimeWins' },
  kills: { weekly: 'weeklyKills', monthly: 'monthlyKills', allTime: 'allTimeKills' },
  matches: { weekly: 'weeklyMatches', monthly: 'monthlyMatches', allTime: 'allTimeMatches' },
  earnings: { weekly: 'weeklyEarnings', monthly: 'monthlyEarnings', allTime: 'allTimeEarnings' },
}

const CATEGORIES = [
  { key: 'wins', icon: '🏆', accent: 'gold' },
  { key: 'kills', icon: '☠️', accent: 'red' },
  { key: 'matches', icon: '🎮', accent: 'blue' },
  { key: 'earnings', icon: '💰', accent: 'mint' },
]

const PERIODS = [
  { key: 'weekly' },
  { key: 'monthly' },
  { key: 'allTime' },
]

const LIST_SIZE = 50

function fmt(n) {
  return (n || 0).toLocaleString('en-US')
}

function formatValue(category, value) {
  if (category === 'earnings') return `৳${fmt(value)}`
  return fmt(value)
}

// Countdown days to the next automatic reset, purely informational.
function nextResetDays(period) {
  if (period === 'allTime') return null
  const now = new Date()
  let target
  if (period === 'weekly') {
    target = new Date(now)
    const day = target.getDay() // 0 Sun .. 6 Sat
    const daysUntilMonday = (8 - day) % 7 || 7
    target.setDate(target.getDate() + daysUntilMonday)
    target.setHours(0, 0, 0, 0)
  } else {
    target = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  }
  const ms = target - now
  const days = Math.max(1, Math.ceil(ms / 86400000))
  return days
}

export default function Leaderboard() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const uid = user?.uid || profile?.id || profile?.uid || null

  const [category, setCategory] = useState('wins')
  const [period, setPeriod] = useState('allTime')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pinned, setPinned] = useState(null) // { rank, ...data } when current user isn't on screen

  const field = FIELD_MAP[category][period]
  const rankKey = `${category}_${period}`

  // Free, no-Cloud-Function way to keep periods fresh: silently reset the
  // viewer's own weekly/monthly numbers if a new week/month has started.
  useEffect(() => {
    if (uid) ensureFreshPeriodStats(uid)
  }, [uid])

  // Live leaderboard for the selected category + period. Instant reload on tab change
  // because it's a fresh query keyed by `field`.
  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'users'), orderBy(field, 'desc'), limit(LIST_SIZE))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [field])

  // If the signed-in player isn't inside the visible list, look up their real rank
  // via a server-side count (no need to download the whole collection).
  useEffect(() => {
    let cancelled = false
    async function locateUser() {
      if (!uid) { setPinned(null); return }
      const inList = players.some((p) => p.id === uid)
      if (inList) { setPinned(null); return }
      try {
        const meSnap = await getDoc(doc(db, 'users', uid))
        if (!meSnap.exists()) { setPinned(null); return }
        const me = { id: meSnap.id, ...meSnap.data() }
        const myValue = me[field] || 0
        const higherQ = query(collection(db, 'users'), where(field, '>', myValue))
        const countSnap = await getCountFromServer(higherQ)
        const rank = countSnap.data().count + 1
        if (!cancelled) setPinned({ ...me, rank })
      } catch {
        if (!cancelled) setPinned(null)
      }
    }
    locateUser()
    return () => { cancelled = true }
  }, [uid, players, field])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)
  const resetDays = useMemo(() => nextResetDays(period), [period])

  return (
    <div className="screen lb-screen">
      <div className="section-title">
        <h2>{t('leaderboard')}</h2>
        <span>{t('topPlayersRanked')}</span>
      </div>

      <div className="lb-period-tabs">
        {PERIODS.map((p) => (
          <div
            key={p.key}
            className={'lb-period-tab' + (period === p.key ? ' active' : '')}
            onClick={() => setPeriod(p.key)}
          >
            {t(p.key)}
          </div>
        ))}
      </div>
      {resetDays && <div className="lb-reset-note">{t('resetsIn')} {resetDays}{t('days')}</div>}

      <div className="lb-cat-tabs">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className={'lb-cat-tab lb-accent-' + c.accent + (category === c.key ? ' active' : '')}
            onClick={() => setCategory(c.key)}
          >
            <span className="lb-cat-icon">{c.icon}</span>{t(c.key)}
          </div>
        ))}
      </div>

      {loading && (
        <div className="lb-skeleton-block">
          <div className="skeleton" style={{ height: 150, marginBottom: 12, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 62, marginBottom: 10, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 62, marginBottom: 10, borderRadius: 14 }} />
        </div>
      )}

      {!loading && players.length === 0 && (
        <div className="empty">
          <div className="glyph">◆</div>
          <h3>{t('noRankings')}</h3>
          <p>{t('noRankingsDesc')}</p>
        </div>
      )}

      {!loading && top3.length > 0 && (
        <div className="lb-podium">
          <PodiumCard rank={2} p={top3[1]} category={category} rankKey={rankKey} pos="left" />
          <PodiumCard rank={1} p={top3[0]} category={category} rankKey={rankKey} pos="center" />
          <PodiumCard rank={3} p={top3[2]} category={category} rankKey={rankKey} pos="right" />
        </div>
      )}

      {!loading && rest.length > 0 && (
        <div className="lb-list">
          {rest.map((p, i) => (
            <PlayerRow
              key={p.id}
              rank={i + 4}
              p={p}
              category={category}
              rankKey={rankKey}
              isMe={p.id === uid}
            />
          ))}
        </div>
      )}

      {pinned && (
        <div className="lb-pinned-wrap">
          <PlayerRow rank={pinned.rank} p={pinned} category={category} rankKey={rankKey} isMe pinned />
        </div>
      )}
    </div>
  )
}

function MoveIndicator({ p, rankKey, rank }) {
  const prev = p[`prevRank_${rankKey}`]
  if (!prev) return <span className="lb-move same">—</span>
  if (prev > rank) return <span className="lb-move up">↑ {prev - rank}</span>
  if (prev < rank) return <span className="lb-move down">↓ {rank - prev}</span>
  return <span className="lb-move same">—</span>
}

function StatsLine({ p }) {
  return (
    <div className="lb-stats-line">
      <span>🏆 {fmt(p.allTimeWins)}</span>
      <span>☠️ {fmt(p.allTimeKills)}</span>
      <span>🎮 {fmt(p.allTimeMatches)}</span>
      <span>৳{fmt(p.allTimeEarnings)}</span>
    </div>
  )
}

function PodiumCard({ rank, p, category, rankKey, pos }) {
  const { t } = useLanguage()
  const cls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'
  if (!p) return <div className={'lb-podium-card ' + cls + ' ' + pos + ' empty-slot'} />
  const value = p[FIELD_MAP[category][rankKey.split('_')[1]]] ?? p[category]
  return (
    <div className={'lb-podium-card ' + cls + ' ' + pos}>
      {rank === 1 && <div className="lb-crown">👑</div>}
      <div className="lb-podium-rank-badge">#{rank}</div>
      <div style={{ marginBottom: 8 }}>
        <UserAvatar user={p} size={rank === 1 ? 68 : 56} />
      </div>
      <div className="lb-podium-name">{p.username || t('player')}</div>
      <div className="lb-podium-value">{formatValue(category, value)}</div>
      <StatsLine p={p} />
    </div>
  )
}

function PlayerRow({ rank, p, category, rankKey, isMe, pinned }) {
  const { t } = useLanguage()
  const value = p[FIELD_MAP[category][rankKey.split('_')[1]]] ?? p[category]
  return (
    <div className={'lb-row' + (isMe ? ' me' : '') + (pinned ? ' pinned' : '')}>
      <div className="lb-row-left">
        <div className="lb-row-rank">#{rank}</div>
        <UserAvatar user={p} size={36} />
        <div className="lb-row-id">
          <div className="lb-row-name">
            {p.username || t('player')}
            {isMe && <span className="lb-you-badge">{t('you')}</span>}
          </div>
          <StatsLine p={p} />
        </div>
      </div>
      <div className="lb-row-right">
        <div className="lb-row-value">{formatValue(category, value)}</div>
        <MoveIndicator p={p} rankKey={rankKey} rank={rank} />
      </div>
    </div>
  )
}
