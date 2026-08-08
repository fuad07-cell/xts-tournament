import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import TournamentCard from '../components/TournamentCard'
import CardSkeleton from '../components/CardSkeleton'
import PrizeModal from '../components/PrizeModal'
import JoinModal from '../components/JoinModal'
import RoomIdModal from '../components/RoomIdModal'
import { getCategoryBySlug } from '../constants/categories'
import { getMatchTime, isExpired } from '../utils/matchTime'
import { useJoinMatch } from '../hooks/useJoinMatch'

const SORT_OPTIONS = [
  { key: 'earliest', labelKey: 'earliestFirst' },
  { key: 'latest', labelKey: 'latestFirst' },
  { key: 'prize_high', labelKey: 'highestPrize' },
  { key: 'fee_low', labelKey: 'lowestEntryFee' },
]

const FILTERS = [
  { key: 'all', labelKey: 'all' },
  { key: 'upcoming', labelKey: 'upcoming' },
  { key: 'expired', labelKey: 'expired' },
]

export default function CategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useLanguage()

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
    let list = tournaments.filter((tr) => tr.title?.toLowerCase().includes(search.toLowerCase()))

    if (filter === 'upcoming') list = list.filter((tr) => !isExpired(tr))
    if (filter === 'expired') list = list.filter((tr) => isExpired(tr))

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
          <h3>{t('categoryNotFound')}</h3>
          <Link to="/" className="join-btn" style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>{t('goHome')}</Link>
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
        <div className="cat-hero-count">{tournaments.length} {t('tournaments')}</div>
      </div>

      <div className="cat-toolbar">
        <div className="cat-search">
          🔍
          <input
            type="text"
            placeholder={t('searchMatchesShort')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="cat-filters">
          {FILTERS.map((f) => (
            <div key={f.key} className={'chip' + (filter === f.key ? ' active' : '')} onClick={() => setFilter(f.key)}>
              {t(f.labelKey)}
            </div>
          ))}
        </div>

        <select className="cat-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{t(s.labelKey)}</option>)}
        </select>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>{t('noMatchesFound')}</h3>
          <p>{t('tryDifferentFilter')}</p>
        </div>
      ) : (
        <div className="tour-grid">
          {visible.map((tr) => (
            <TournamentCard
              key={tr.id}
              tournament={tr}
              image={meta.image}
              onRegisterClick={(m) => setJoinTarget(m)}
              onPrizeClick={(m) => setPrizeTarget(m)}
              onRoomClick={(m) => setRoomTarget(m)}
              onRulesClick={(m) => navigate(`/match/${m.id}/rules`)}
              joined={joinedTournamentIds.has(tr.id)}
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
