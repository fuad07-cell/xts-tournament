import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
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
import { UserAvatar } from '../components/AvatarSystem'

import { RESULTS_VISIBLE_MS } from '../utils/resultVisibility'

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

// Public "Results" feed for a category: admin-published matchResults docs
// in this category whose expiresAt (== publishedAt + 24h, set once in
// Admin.jsx at the moment of publishing — see utils/resultVisibility.js)
// hasn't passed yet. Not scoped to the viewer's own entries — anyone can
// see it, joined the match or not.
//
// Two layers of "hide when expired", per spec:
//  1. Server-side: `where('expiresAt', '>', ...)` so an already-long-expired
//     result is never even fetched.
//  2. Client-side tick: the boundary above is a fixed value captured when
//     the listener was created, so Firestore won't re-push a result the
//     instant it crosses expiresAt while the screen stays open (listeners
//     only re-fire on document writes, not on the clock moving). A 30s
//     re-render tick re-filters the already-fetched list against the real
//     current time, so a result disappears on its own even if the tab was
//     left open straight through the expiry moment — no logout needed.
function useResultsFeed(categoryKey) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!categoryKey) {
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'matchResults'),
      where('category', '==', categoryKey),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt', 'desc')
      // expiresAt = publishedAt + a fixed 24h for every doc, so sorting by
      // expiresAt desc is equivalent to sorting by publishedAt desc (newest
      // published first) — and it lets this query satisfy Firestore's rule
      // that the first orderBy must match the inequality field, without an
      // extra composite index just for a secondary publishedAt sort.
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setResults(snap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, ...data, expiresAtMs: data.expiresAt?.toMillis?.() ?? null }
        }))
        setLoading(false)
      },
      (err) => { console.error('results feed fetch error:', err); setLoading(false) }
    )
    return unsub
  }, [categoryKey])

  // Layer 2 above: re-checked every render this hook participates in,
  // including the 30s tick — never displays anything whose real expiresAt
  // has already passed, regardless of when the snapshot was captured.
  const visibleResults = useMemo(
    () => results.filter((r) => r.expiresAtMs == null || r.expiresAtMs > now),
    [results, now]
  )

  return { results: visibleResults, loading }
}

function timeAgo(ms, t) {
  const diffMin = Math.floor((Date.now() - ms) / 60000)
  if (diffMin < 1) return t('timeAgoJustNow')
  if (diffMin < 60) return t('timeAgoMinutes').replace('__n__', diffMin)
  const diffHr = Math.floor(diffMin / 60)
  return t('timeAgoHours').replace('__n__', diffHr)
}

function ResultCard({ r, t }) {
  const isBr = r.category === 'br'
  return (
    <div className="result-card">
      <div className="result-card-top">
        <div className="result-card-title">{r.title}</div>
        <div className="result-card-time">{r.publishedAt?.toMillis ? timeAgo(r.publishedAt.toMillis(), t) : (r.expiresAtMs ? timeAgo(r.expiresAtMs - RESULTS_VISIBLE_MS, t) : '')}</div>
      </div>
      <div className="result-card-player">
        <UserAvatar userId={r.userId} size={28} fallbackLetter={r.ign} />
        <span className="result-card-ign">{r.ign || t('unknown')}</span>
        {isBr ? (
          r.finalPosition === 1 ? <span className="result-pill gold">🏆 #1</span> : <span className="result-pill">#{r.finalPosition}</span>
        ) : (
          <span className={'result-pill' + (r.isWinner ? ' gold' : '')}>{r.isWinner ? `🏆 ${t('wonLabel')}` : t('lostLabel')}</span>
        )}
      </div>
      <div className="result-card-stats">
        <div className="result-stat"><span className="result-stat-label">{t('killsLabel')}</span><span className="result-stat-value">{r.finalKills}</span></div>
        {r.prizeAmount > 0 && (
          <div className="result-stat"><span className="result-stat-label">{t('prizeWonLabel')}</span><span className="result-stat-value gold">৳{r.prizeAmount}</span></div>
        )}
      </div>
    </div>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useLanguage()

  const meta = getCategoryBySlug(slug)
  const [tab, setTab] = useState('match') // 'match' | 'results'
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('earliest')
  const [prizeTarget, setPrizeTarget] = useState(null)
  const [joinTarget, setJoinTarget] = useState(null)
  const [roomTarget, setRoomTarget] = useState(null)
  const [myEntries, setMyEntries] = useState([]) // this user's own entries, to know what they've joined

  const { results, loading: resultsLoading } = useResultsFeed(meta?.key)

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
      <style>{`
        .cat-mode-tabs{ display:flex; gap:10px; margin-bottom:18px; }
        .cat-mode-tab{
          flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
          padding:13px 10px; border-radius:12px; font-size:13px; font-weight:800;
          letter-spacing:0.4px; cursor:pointer; user-select:none;
          background:var(--surface); border:1px solid var(--line); color:var(--muted);
          transition:background .15s ease, border-color .15s ease, color .15s ease;
        }
        .cat-mode-tab.active{
          background:var(--neon-blue-dim); border-color:var(--neon-blue); color:var(--neon-blue);
          box-shadow:0 0 18px -6px var(--neon-blue);
        }

        .results-note{
          font-size:11.5px; color:var(--muted); text-align:center; margin-bottom:16px; line-height:1.5;
        }
        .result-card{
          background:var(--surface); border:1px solid var(--line); border-radius:14px;
          padding:14px 16px; margin-bottom:10px;
        }
        .result-card-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .result-card-title{ font-size:13.5px; font-weight:800; }
        .result-card-time{ font-size:11px; color:var(--muted); flex-shrink:0; }
        .result-card-player{ display:flex; align-items:center; gap:9px; margin-bottom:12px; }
        .result-card-avatar{
          width:28px; height:28px; border-radius:50%; flex-shrink:0;
          background:linear-gradient(135deg,#2E9BFF,#7A5CFF);
          display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:12px; color:#fff;
        }
        .result-card-ign{ font-size:13px; font-weight:700; flex:1; }
        .result-pill{
          font-size:11px; font-weight:800; padding:4px 9px; border-radius:100px;
          background:var(--surface-2); color:var(--muted); white-space:nowrap;
        }
        .result-pill.gold{ background:rgba(255,194,75,0.14); color:var(--gold); }
        .result-card-stats{ display:flex; gap:18px; }
        .result-stat{ display:flex; flex-direction:column; gap:2px; }
        .result-stat-label{ font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.6px; }
        .result-stat-value{ font-size:14px; font-weight:800; }
        .result-stat-value.gold{ color:var(--gold); }
      `}</style>

      <div className="cat-hero">
        <img src={meta.image} alt={meta.label} />
        <Link to="/" className="cat-hero-back">←</Link>
        <div className="cat-hero-title">{meta.label}</div>
        <div className="cat-hero-count">{tournaments.length} {t('tournaments')}</div>
      </div>

      <div className="cat-mode-tabs">
        <div className={'cat-mode-tab' + (tab === 'match' ? ' active' : '')} onClick={() => setTab('match')}>
          🎮 {t('matchTab').toUpperCase()} ({tournaments.length})
        </div>
        <div className={'cat-mode-tab' + (tab === 'results' ? ' active' : '')} onClick={() => setTab('results')}>
          🏅 {t('resultsTab').toUpperCase()} ({results.length})
        </div>
      </div>

      {tab === 'match' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="results-note">{t('resultsWillAppear')}</div>
          {resultsLoading ? (
            <div className="empty"><p>{t('resultsLoading')}</p></div>
          ) : results.length === 0 ? (
            <div className="empty">
              <div className="glyph">🏅</div>
              <h3>{t('noResultsFound')}</h3>
            </div>
          ) : (
            <div>
              {results.map((r) => <ResultCard key={r.id} r={r} t={t} />)}
            </div>
          )}
        </>
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
