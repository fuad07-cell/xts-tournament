import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getCategoryByKey } from '../constants/categories'
import { getMatchTime } from '../utils/matchTime'
import { RULES_BY_CATEGORY, DEFAULT_RULES } from '../constants/rules'
import { useJoinMatch } from '../hooks/useJoinMatch'
import JoinModal from '../components/JoinModal'
import '../pages/CategoryPage.css'

// Dedicated full page for a match's Rules + Players, reached via the
// "📋 Rules" button on a TournamentCard. Shows the same match-summary
// header as the card (image, title, stats, Join button) so the page is
// self-contained, then RULES / PLAYERS tabs below it.
export default function MatchRulesPage() {
  const { tid } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { joinMatch } = useJoinMatch()

  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [tab, setTab] = useState('rules')
  const [joinOpen, setJoinOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'tournaments', tid),
      (snap) => {
        setTournament(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [tid])

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('tournamentId', '==', tid))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [tid])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const joined = useMemo(
    () => !!user && players.some((p) => p.userId === user.uid),
    [players, user]
  )

  async function handleConfirmJoin(details) {
    if (!user) return navigate('/auth')
    setJoining(true)
    const result = await joinMatch(tournament, details)
    setJoining(false)
    if (result.ok) setJoinOpen(false)
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="cp-loading">লোড হচ্ছে…</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="screen">
        <div className="empty">
          <div className="glyph">✕</div>
          <h3>ম্যাচটি পাওয়া যায়নি</h3>
        </div>
        <BackButton onClick={() => navigate(-1)} />
      </div>
    )
  }

  const category = getCategoryByKey(tournament.category)
  const matchTime = getMatchTime(tournament)
  const expired = tournament.status === 'closed' || (matchTime && matchTime < now.getTime())
  const slotsFull = (tournament.filled || 0) >= tournament.slots
  const disabled = expired || slotsFull || joined
  const spotsLeft = Math.max((tournament.slots || 0) - (tournament.filled || 0), 0)
  const fillPct = tournament.slots ? Math.min(((tournament.filled || 0) / tournament.slots) * 100, 100) : 0
  const rules = RULES_BY_CATEGORY[tournament.category] || DEFAULT_RULES

  return (
    <div className="screen">
      <BackButton onClick={() => navigate(-1)} />

      {/* ---- Match summary card ---- */}
      <div className="cp-tournament-card" style={{ marginBottom: 20 }}>
        <div className="cp-t-top">
          {category && <img className="cp-t-avatar" src={category.image} alt="" />}
          <div className="cp-t-top-text">
            <h3 className="cp-t-title">{tournament.title}</h3>
            <span className="cp-t-rules">নিয়ম অবশ্যই পড়ে নিন ✅</span>
          </div>
          <span className={'cp-status-badge' + (expired ? ' expired' : '')}>
            {expired ? 'Expired' : 'UPCOMING'}
          </span>
        </div>

        <div className="cp-t-datetime">
          <span className="cp-t-date">{matchTime ? new Date(matchTime).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) : 'তারিখ শীঘ্রই জানানো হবে'}</span>
          <span className="cp-t-time-badge">⏰ {matchTime ? new Date(matchTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        </div>

        <div className="cp-t-highlight-row">
          <div className="cp-t-highlight-box prize">
            <span className="cp-t-label">🏆 Win Prize</span>
            <span className="cp-t-highlight-value">৳{tournament.prizePool}</span>
          </div>
          {!!tournament.perKill && (
            <div className="cp-t-highlight-box kill">
              <span className="cp-t-label">🔥 Per Kill</span>
              <span className="cp-t-highlight-value">৳{tournament.perKill}</span>
            </div>
          )}
          <div className="cp-t-highlight-box fee">
            <span className="cp-t-label">💰 Entry Fee</span>
            <span className="cp-t-highlight-value">৳{tournament.entryFee}</span>
          </div>
        </div>

        <div className="cp-t-tags">
          {tournament.mode && <span>🎮 {tournament.mode}</span>}
          {tournament.map && <span>📍 {tournament.map}</span>}
          <span>👥 {tournament.filled || 0}/{tournament.slots}</span>
        </div>

        <div className="cp-t-progress">
          <div className="cp-t-progress-bar">
            <div className="cp-t-progress-fill" style={{ width: `${fillPct}%` }} />
          </div>
          <span>Only <strong>{spotsLeft}</strong> spots left</span>
        </div>

        <button
          className={'join-btn cp-join-now' + (disabled ? '' : ' blink')}
          disabled={disabled}
          onClick={() => setJoinOpen(true)}
        >
          {expired ? 'Expired' : joined ? '✅ Joined' : slotsFull ? 'স্লট পূর্ণ' : `⚡ JOIN NOW — ৳${tournament.entryFee}`}
        </button>
      </div>

      {/* ---- Rules / Players tabs ---- */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setTab('rules')}
          style={{
            flex: 1, padding: '12px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: tab === 'rules' ? '#2563eb' : 'rgba(255,255,255,0.06)',
            color: tab === 'rules' ? '#fff' : '#b8bcc8',
          }}
        >
          📋 RULES
        </button>
        <button
          onClick={() => setTab('players')}
          style={{
            flex: 1, padding: '12px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: tab === 'players' ? '#2563eb' : 'rgba(255,255,255,0.06)',
            color: tab === 'players' ? '#fff' : '#b8bcc8',
          }}
        >
          👥 PLAYERS ({players.length})
        </button>
      </div>

      {tab === 'rules' ? (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>📋 MATCH RULES</h3>
          <div className="rules-list">
            {rules.map((rule, i) => (
              <div className="rule-row" key={i}>
                {rule}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>👥 যারা জয়েন করেছেন</h3>
          {players.length === 0 ? (
            <div className="empty">
              <div className="glyph">◇</div>
              <h3>এখনো কেউ জয়েন করেননি</h3>
              <p>প্রথম হয়ে যান!</p>
            </div>
          ) : (
            <div className="prize-list">
              {players.map((p, i) => (
                <div className="prize-row" key={p.id}>
                  <span className="prize-icon">{i + 1}.</span>
                  <span className="prize-label">
                    🎮 {p.ign || 'অজানা'}
                    {p.teammateIgn ? ` + ${p.teammateIgn}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {joinOpen && (
        <JoinModal
          tournament={tournament}
          onClose={() => setJoinOpen(false)}
          onConfirm={handleConfirmJoin}
        />
      )}
    </div>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#e6e9f0', padding: '8px 14px', borderRadius: 999, fontSize: 14,
        cursor: 'pointer', marginBottom: 14,
      }}
    >
      ← ফিরে যান
    </button>
  )
}
