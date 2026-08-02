import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function Leaderboard() {
  const [metric, setMetric] = useState('wins') // 'wins' | 'walletBalance'
  const [period, setPeriod] = useState('all') // 'week' | 'month' | 'all'
  const [players, setPlayers] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy(metric, 'desc'), limit(20))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [metric])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  return (
    <div className="screen">
      <div className="section-title">
        <h2>লিডারবোর্ড</h2>
        <span>Top Players</span>
      </div>

      <div className="tabs">
        <div className={'tab' + (period === 'week' ? ' active' : '')} onClick={() => setPeriod('week')}>সাপ্তাহিক</div>
        <div className={'tab' + (period === 'month' ? ' active' : '')} onClick={() => setPeriod('month')}>মাসিক</div>
        <div className={'tab' + (period === 'all' ? ' active' : '')} onClick={() => setPeriod('all')}>সর্বকালের</div>
      </div>

      {period !== 'all' && (
        <div className="note" style={{ marginBottom: 14, marginTop: -4 }}>
          {period === 'week' ? 'সাপ্তাহিক' : 'মাসিক'} র‍্যাংকিং শীঘ্রই আসছে — এখন সব সময়ের (all-time) পরিসংখ্যান দেখানো হচ্ছে, কারণ সময়ভিত্তিক ডেটা এখনো ট্র্যাক করা শুরু হয়নি।
        </div>
      )}


      <div className="toggle-row">
        <div
          className={'toggle-btn' + (metric === 'wins' ? ' active' : '')}
          onClick={() => setMetric('wins')}
        >
          🏆 Wins
        </div>
        <div
          className={'toggle-btn' + (metric === 'walletBalance' ? ' active' : '')}
          onClick={() => setMetric('walletBalance')}
        >
          📈 Earnings
        </div>
      </div>

      {players.length === 0 && (
        <div className="empty">
          <div className="glyph">◆</div>
          <h3>এখনো কোনো র‍্যাংকিং নেই</h3>
          <p>ম্যাচ খেলা শুরু হলে এখানে খেলোয়াড়দের র‍্যাংক দেখা যাবে।</p>
        </div>
      )}

      {top3.length === 3 && (
        <div className="podium">
          <PodiumCard rank={2} p={top3[1]} metric={metric} cls="silver" />
          <PodiumCard rank={1} p={top3[0]} metric={metric} cls="gold" />
          <PodiumCard rank={3} p={top3[2]} metric={metric} cls="bronze" />
        </div>
      )}

      <div className="bracket-list">
        {rest.map((p, i) => (
          <div className="bracket-row" key={p.id}>
            <div className="row-left">
              <div className="rank-badge">{String(i + 4).padStart(2, '0')}</div>
              <div>
                <div className="row-name">{p.username}</div>
                <div className="row-sub">{p.matchesPlayed || 0} ম্যাচ</div>
              </div>
            </div>
            <div className="row-value">
              {metric === 'wins' ? p.wins || 0 : `৳${p.walletBalance || 0}`}
              <span className="unit">{p.wins || 0} জয়</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PodiumCard({ rank, p, metric, cls }) {
  if (!p) return <div className="podium-card" />
  return (
    <div className={'podium-card ' + cls}>
      <div className="podium-rank">{rank}</div>
      <div className="avatar">{(p.username || '?')[0].toUpperCase()}</div>
      <div className="podium-name">{p.username}</div>
      <div className="podium-value">
        {metric === 'wins' ? `${p.wins || 0} জয়` : `৳${p.walletBalance || 0}`}
      </div>
    </div>
  )
}
