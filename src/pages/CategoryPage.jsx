import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import TournamentCard from '../components/TournamentCard'
import CardSkeleton from '../components/CardSkeleton'
import PrizeModal from '../components/PrizeModal'
import JoinModal from '../components/JoinModal'
import RoomIdModal from '../components/RoomIdModal'
import { getCategoryBySlug } from '../constants/categories'
import { getMatchTime } from '../utils/matchTime'
import { useJoinMatch } from '../hooks/useJoinMatch'

const SORT_OPTIONS = [
  { key: 'earliest', label: 'তারিখ — Earliest First' },
  { key: 'latest', label: 'তারিখ — Latest First' },
  { key: 'prize_high', label: 'Highest Prize' },
  { key: 'fee_low', label: 'Lowest Entry Fee' },
]

const FILTERS = [
  { key: 'all', label: 'সব' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'expired', label: 'Expired' },
]

function isExpired(t) {
  if (t.status === 'closed') return true
  const matchTime = getMatchTime(t)
  if (!matchTime) return false
  return matchTime < Date.now()
}

export default function CategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()

  const meta = getCategoryBySlug(slug)
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('earliest')
  const [prizeTarget, setPrizeTarget] = useState(null)
  const [joinTarget, setJoinTarget] = useState(null)
  const [roomTarget, setRoomTarget] = useState(null)
  const [myEntries, setMyEntries] = useState([]) // this user's own entries, to know what they've joined

  useEffect(() => {
    if (!meta) {
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'tournaments'), where('category', '==', meta.key))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { console.error('tournaments fetch error:', err); setLoading(false) }
    )
    return unsub
  }, [meta])

  useEffect(() => {
    if (!user) {
      setMyEntries([])
      return
    }
    const q = query(collection(db, 'entries'), where('userId', '==', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      setMyEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user])

  const joinedTournamentIds = useMemo(
    () => new Set(myEntries.map((e) => e.tournamentId)),
    [myEntries]
  )

  const visible = useMemo(() => {
    let list = tournaments.filter((t) => t.title?.toLowerCase().includes(search.toLowerCase()))

    if (filter === 'upcoming') list = list.filter((t) => !isExpired(t))
    if (filter === 'expired') list = list.filter((t) => isExpired(t))

    list.sort((a, b) => {
      const aExp = isExpired(a), bExp = isExpired(b)
      if (aExp !== bExp) return aExp ? 1 : -1 // expired সবসময় নিচে

      const aTime = getMatchTime(a) ?? Infinity
      const bTime = getMatchTime(b) ?? Infinity

      if (sort === 'earliest') return aTime - bTime
      if (sort === 'latest') return bTime - aTime
      if (sort === 'prize_high') return (b.prizePool || 0) - (a.prizePool || 0)
      if (sort === 'fee_low') return (a.entryFee || 0) - (b.entryFee || 0)
      return 0
    })

    return list
  }, [tournaments, search, filter, sort])

  const { joinMatch } = useJoinMatch()

  async function handleConfirmJoin(details) {
    if (!user) return navigate('/auth')
    const result = await joinMatch(joinTarget, details)
    if (result.ok) setJoinTarget(null)
  }

  if (!meta) {
    return (
      <div className="screen">
        <div className="empty">
          <div className="glyph">✕</div>
          <h3>এই ক্যাটাগরি পাওয়া যায়নি</h3>
          <Link to="/" className="join-btn" style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>Home এ ফিরুন</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="screen page-fade-in">
      <div className="cat-hero">
        <img src={meta.image} alt={meta.label} />
        <Link to="/" className="cat-hero-back">←</Link>
        <div className="cat-hero-title">{meta.label}</div>
        <div className="cat-hero-count">{tournaments.length}টি টুর্নামেন্ট</div>
      </div>

      <div className="cat-toolbar">
        <div className="cat-search">
          🔍
          <input
            type="text"
            placeholder="ম্যাচ খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="cat-filters">
          {FILTERS.map((f) => (
            <div key={f.key} className={'chip' + (filter === f.key ? ' active' : '')} onClick={() => setFilter(f.key)}>
              {f.label}
            </div>
          ))}
        </div>

        <select className="cat-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>কোনো ম্যাচ পাওয়া যায়নি</h3>
          <p>ফিল্টার বদলে আবার চেষ্টা করুন, অথবা নতুন ম্যাচের জন্য অপেক্ষা করুন।</p>
        </div>
      ) : (
        <div className="tour-grid">
          {visible.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              image={meta.image}
              onRegisterClick={(t) => setJoinTarget(t)}
              onPrizeClick={(t) => setPrizeTarget(t)}
              onRoomClick={(t) => setRoomTarget(t)}
              onRulesClick={(t) => navigate(`/match/${t.id}/rules`)}
              joined={joinedTournamentIds.has(t.id)}
            />
          ))}
        </div>
      )}

      <PrizeModal tournament={prizeTarget} onClose={() => setPrizeTarget(null)} />
      <JoinModal tournament={joinTarget} onClose={() => setJoinTarget(null)} onConfirm={handleConfirmJoin} />

      {roomTarget && (
        <RoomIdModal
          tournament={roomTarget}
          joined={joinedTournamentIds.has(roomTarget.id)}
          joining={false}
          onJoin={() => {
            setRoomTarget(null)
            setJoinTarget(roomTarget)
          }}
          onClose={() => setRoomTarget(null)}
        />
      )}
    </div>
  )
}
