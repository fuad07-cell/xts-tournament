import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const REFERRAL_BONUS_AMOUNT = 5

// Dedicated full page for referrals, reached from Profile → Invite Friends.
// Shows the user's code, a shareable link (works with Auth.jsx's existing
// `?ref=` query param handling), live INVITED/EARNED stats, and a history
// list of everyone who signed up with this code — each one flagged
// "Earned" once they've completed their first booking (see useJoinMatch.js)
// or "Pending" while they haven't yet.
export default function InviteFriends() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t, dateLocale } = useLanguage()
  const [referred, setReferred] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const referralCode = user ? 'XTS-' + user.uid.slice(0, 6).toUpperCase() : ''
  const referralLink = `${window.location.origin}${window.location.pathname}#/auth?ref=${referralCode}`

  useEffect(() => {
    if (!user) {
      setReferred([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'users'), where('referredBy', '==', user.uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // Newest first — client-side sort avoids needing a composite index.
        rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        setReferred(rows)
        setLoading(false)
      },
      (err) => { console.error('referred users fetch error:', err); setLoading(false) }
    )
    return unsub
  }, [user])

  const invitedCount = referred.length
  const earnedAmount = profile?.referralEarnings || 0

  function copyCode() {
    navigator.clipboard.writeText(referralCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 1500)
  }

  function copyLink() {
    navigator.clipboard.writeText(referralLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
  }

  async function shareCode() {
    const shareData = {
      title: 'XTS TOUR BD',
      text: t('inviteShareText').replace('__code__', referralCode),
      url: referralLink,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* user cancelled — ignore */ }
    } else {
      copyLink()
    }
  }

  function formatDate(ts) {
    const ms = ts?.toMillis?.()
    if (!ms) return ''
    return new Date(ms).toLocaleDateString(dateLocale || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="screen page-fade-in">
      <style>{`
        .invite-page-header{
          display:flex; align-items:center; gap:12px; margin-bottom:18px;
        }
        .invite-back-btn{
          width:36px; height:36px; border-radius:12px; border:1px solid var(--line);
          background:var(--surface); color:var(--text); font-size:16px;
          display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
        }
        .invite-page-title{ font-size:19px; font-weight:800; }

        .invite-hero{
          border-radius:18px; padding:26px 20px; text-align:center;
          background:linear-gradient(160deg, rgba(46,155,255,0.10), rgba(46,155,255,0.02)), var(--surface);
          border:1px solid rgba(46,155,255,0.35);
          box-shadow:0 0 32px -8px rgba(46,155,255,0.25);
          margin-bottom:16px;
        }
        .invite-hero-label{
          display:flex; align-items:center; justify-content:center; gap:7px;
          color:var(--muted); font-size:11.5px; font-weight:800; letter-spacing:1.2px;
          text-transform:uppercase; margin-bottom:14px;
        }
        .invite-code-row{
          display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:12px;
        }
        .invite-code{
          font-family:'JetBrains Mono', monospace; font-size:30px; font-weight:800;
          letter-spacing:4px; color:var(--neon-blue);
        }
        .invite-code-copy{
          width:38px; height:38px; border-radius:12px; border:none; cursor:pointer; flex-shrink:0;
          background:rgba(255,255,255,0.08); color:var(--text); font-size:15px;
          display:flex; align-items:center; justify-content:center;
        }
        .invite-hero-sub{ color:var(--muted); font-size:13px; margin-bottom:20px; }
        .invite-hero-actions{ display:flex; gap:10px; }
        .invite-copy-link-btn, .invite-share-btn{
          flex:1; padding:13px 10px; border-radius:12px; font-weight:800; font-size:13px;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;
          letter-spacing:0.4px; border:none;
        }
        .invite-copy-link-btn{ background:#0A0C13; color:var(--text); border:1px solid var(--line); }
        .invite-share-btn{ background:var(--neon-blue); color:#fff; }

        .invite-stats-row{ display:flex; gap:12px; margin-bottom:18px; }
        .invite-stat-card{
          flex:1; background:var(--surface); border:1px solid var(--line); border-radius:14px;
          padding:16px;
        }
        .invite-stat-icon{
          width:34px; height:34px; border-radius:10px; display:flex; align-items:center;
          justify-content:center; font-size:16px; margin-bottom:10px;
        }
        .invite-stat-icon.invited{ background:rgba(34,192,140,0.14); }
        .invite-stat-icon.earned{ background:rgba(255,194,75,0.14); }
        .invite-stat-label{ color:var(--muted); font-size:10.5px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:5px; }
        .invite-stat-value{ font-size:22px; font-weight:800; }

        .invite-history-title{
          font-size:12px; font-weight:800; letter-spacing:1px; text-transform:uppercase;
          color:var(--muted); margin-bottom:10px;
        }
        .invite-history-list{ display:flex; flex-direction:column; gap:8px; }
        .invite-history-row{
          display:flex; align-items:center; gap:12px; background:var(--surface);
          border:1px solid var(--line); border-radius:12px; padding:12px 14px;
        }
        .invite-history-avatar{
          width:36px; height:36px; border-radius:50%; flex-shrink:0;
          background:linear-gradient(135deg,#2E9BFF,#7A5CFF);
          display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:14px; color:#fff;
        }
        .invite-history-name{ font-size:13.5px; font-weight:700; }
        .invite-history-date{ font-size:11px; color:var(--muted); margin-top:2px; }
        .invite-history-status{
          margin-left:auto; font-size:11px; font-weight:800; padding:5px 10px; border-radius:100px;
          white-space:nowrap;
        }
        .invite-history-status.earned{ background:rgba(34,192,140,0.14); color:var(--mint); }
        .invite-history-status.pending{ background:rgba(255,194,75,0.12); color:var(--gold); }
        .invite-empty{ text-align:center; color:var(--muted); font-size:13px; padding:28px 10px; }
      `}</style>

      <div className="invite-page-header">
        <button className="invite-back-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <span className="invite-page-title">{t('inviteFriendsTitle')}</span>
      </div>

      <div className="invite-hero">
        <div className="invite-hero-label"><span aria-hidden="true">🎁</span> {t('yourReferralCode')}</div>
        <div className="invite-code-row">
          <span className="invite-code">{referralCode}</span>
          <button className="invite-code-copy" onClick={copyCode} aria-label={t('copyCode')}>
            {copiedCode ? '✓' : '⧉'}
          </button>
        </div>
        <div className="invite-hero-sub">{t('inviteHeroSub')}</div>
        <div className="invite-hero-actions">
          <button className="invite-copy-link-btn" onClick={copyLink}>
            ⧉ {copiedLink ? t('copied') : t('copyLink')}
          </button>
          <button className="invite-share-btn" onClick={shareCode}>
            ⤴ {t('share')}
          </button>
        </div>
      </div>

      <div className="invite-stats-row">
        <div className="invite-stat-card">
          <div className="invite-stat-icon invited">👥</div>
          <div className="invite-stat-label">{t('invited')}</div>
          <div className="invite-stat-value">{invitedCount}</div>
        </div>
        <div className="invite-stat-card">
          <div className="invite-stat-icon earned">💰</div>
          <div className="invite-stat-label">{t('earned')}</div>
          <div className="invite-stat-value">৳{earnedAmount}</div>
        </div>
      </div>

      <div className="invite-history-title">{t('referralHistory')}</div>
      {loading ? (
        <div className="invite-empty">{t('referralHistoryLoading')}</div>
      ) : referred.length === 0 ? (
        <div className="invite-empty">{t('referralHistoryEmpty')}</div>
      ) : (
        <div className="invite-history-list">
          {referred.map((r) => (
            <div className="invite-history-row" key={r.id}>
              <div className="invite-history-avatar">{(r.username || '?').slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="invite-history-name">{r.username || t('unknown') || 'Unknown'}</div>
                <div className="invite-history-date">{formatDate(r.createdAt)}</div>
              </div>
              <span className={'invite-history-status ' + (r.referralBonusPaid ? 'earned' : 'pending')}>
                {r.referralBonusPaid ? t('referralBonusEarned') : t('referralBonusPending')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
