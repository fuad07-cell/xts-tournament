import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { RULES_BY_CATEGORY, DEFAULT_RULES } from '../constants/rules'
import { useLanguage } from '../context/LanguageContext'
import { UserAvatar } from './AvatarSystem'

// Combined "RULES / PLAYERS" popup opened from a tournament card — two
// pill tabs at the top like the reference design. Rules come from the
// per-category list; Players is a live list of everyone who has joined
// this specific tournament (fetched from `entries`).
export default function MatchInfoModal({ tournament: t, categoryKey, onClose }) {
  const [tab, setTab] = useState('rules')
  const [players, setPlayers] = useState([])
  const { t: tr } = useLanguage()

  useEffect(() => {
    if (!t) return
    const q = query(collection(db, 'entries'), where('tournamentId', '==', t.id))
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [t])

  if (!t) return null

  const rules = RULES_BY_CATEGORY[categoryKey] || DEFAULT_RULES

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: 14, gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14, background: 'none',
              border: 'none', color: '#9aa0ad', fontSize: 16, cursor: 'pointer', zIndex: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
          <button
            onClick={() => setTab('rules')}
            style={{
              flex: 1, padding: '12px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              background: tab === 'rules' ? '#2563eb' : 'rgba(255,255,255,0.06)',
              color: tab === 'rules' ? '#fff' : '#b8bcc8',
            }}
          >
            📋 {tr('matchRules')}
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
            👥 {tr('players')} ({players.length})
          </button>
        </div>

        <div style={{ padding: '0 16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {tab === 'rules' ? (
            <>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>📋 {tr('matchRules')}</h2>
              <div className="prize-list">
                {rules.map((rule, i) => (
                  <div className="prize-row" key={i} style={{ alignItems: 'flex-start' }}>
                    <span className="prize-icon">{i + 1}.</span>
                    <span className="prize-label">{rule}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>👥 {tr('joinedPlayers')}</h2>
              {players.length === 0 ? (
                <p className="meta">{tr('noOneJoined')}</p>
              ) : (
                <div className="prize-list">
                  {players.map((p, i) => (
                    <div className="prize-row" key={p.id} style={{ alignItems: 'center', gap: 10 }}>
                      <span className="prize-icon">{i + 1}.</span>
                      <UserAvatar userId={p.userId} size={32} />
                      <span className="prize-label">
                        🎮 {p.ign || tr('unknown')}
                        {p.teammateIgn ? ` + ${p.teammateIgn}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}