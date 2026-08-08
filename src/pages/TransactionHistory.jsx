import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { TRANSACTION_TYPES, HISTORY_FILTERS } from '../utils/transactions'

// Old wallet requests (Add Money / Withdraw) are stored in `walletRequests`
// with a pending/approved/rejected lifecycle. Everything else (entry fee,
// prize, refund, check-in bonus, admin adjustments) is written straight
// into `transactions` as a completed row — see utils/transactions.js.
// This page merges both sources into one unified, sorted timeline.
function mapWalletRequest(r, t, dateLocale) {
  return {
    id: 'wr-' + r.id,
    type: r.type === 'add' ? 'deposit' : 'withdraw',
    amount: r.amount,
    title: (r.type === 'add' ? t('txDeposit') : t('txWithdraw')) + (r.method ? ` • ${r.method}` : ''),
    subtitle: r.status === 'pending' ? t('verificationPending') : r.status === 'rejected' ? t('requestRejected') : t('verifiedByAdmin'),
    status: r.status,
    createdAtMs: r.requestedAt?.toMillis?.() || 0,
    createdAtLabel: formatDate(r.requestedAt, dateLocale),
  }
}

function mapTransaction(t2, t, dateLocale) {
  const def = TRANSACTION_TYPES[t2.type] || {}
  return {
    id: 'tx-' + t2.id,
    type: t2.type,
    amount: t2.amount,
    title: t2.title || (def.labelKey ? t(def.labelKey) : def.label) || t2.type,
    subtitle: t2.subtitle || null,
    status: 'approved',
    createdAtMs: t2.createdAt?.toMillis?.() || 0,
    createdAtLabel: formatDate(t2.createdAt, dateLocale),
  }
}

function formatDate(ts, dateLocale) {
  const d = ts?.toDate?.()
  if (!d) return ''
  const locale = dateLocale || 'en-GB'
  return d.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TransactionHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t, dateLocale } = useLanguage()
  const [walletRequests, setWalletRequests] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!user) return
    let loadedWallet = false
    let loadedTx = false
    const finishLoading = () => { if (loadedWallet && loadedTx) setLoading(false) }

    const unsub1 = onSnapshot(
      query(collection(db, 'walletRequests'), where('userId', '==', user.uid)),
      (snap) => {
        setWalletRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        loadedWallet = true
        finishLoading()
      },
      () => { loadedWallet = true; finishLoading() }
    )
    const unsub2 = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', user.uid)),
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        loadedTx = true
        finishLoading()
      },
      () => { loadedTx = true; finishLoading() }
    )
    return () => { unsub1(); unsub2() }
  }, [user])

  const allItems = useMemo(() => {
    const merged = [...walletRequests.map((r) => mapWalletRequest(r, t, dateLocale)), ...transactions.map((tx) => mapTransaction(tx, t, dateLocale))]
    merged.sort((a, b) => b.createdAtMs - a.createdAtMs)
    return merged
  }, [walletRequests, transactions, t, dateLocale])

  const filteredItems = useMemo(
    () => (filter ? allItems.filter((i) => i.type === filter) : allItems),
    [allItems, filter]
  )

  const { totalIn, totalOut } = useMemo(() => {
    let inSum = 0
    let outSum = 0
    for (const item of allItems) {
      if (item.status === 'pending' || item.status === 'rejected') continue
      const def = TRANSACTION_TYPES[item.type]
      if (def?.direction === 'in') inSum += item.amount
      else outSum += item.amount
    }
    return { totalIn: inSum, totalOut: outSum }
  }, [allItems])

  return (
    <div className="screen page-fade-in" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 18,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fff' }}>{t('transactionHistoryTitle')}</h2>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, background: 'rgba(16,60,45,0.35)', border: '1px solid rgba(52,224,161,0.25)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#34e0a1', marginBottom: 6 }}>{t('totalIn')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#34e0a1' }}>৳{totalIn}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(60,20,20,0.35)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#f87171', marginBottom: 6 }}>{t('totalOut')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>৳{totalOut}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 18, WebkitOverflowScrolling: 'touch' }}>
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0, padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              letterSpacing: 0.3, cursor: 'pointer', whiteSpace: 'nowrap',
              background: filter === f.key ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.05)',
              border: filter === f.key ? '1.5px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
              color: filter === f.key ? '#60a5fa' : '#9aa2b1',
            }}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading && <div className="meta">{t('loading')}</div>}

      {!loading && filteredItems.length === 0 && (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>{t('noTransactions')}</h3>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredItems.map((item) => {
          const def = TRANSACTION_TYPES[item.type] || {}
          const isIn = def.direction === 'in'
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: '14px 16px',
              }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(52,224,161,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}
              >
                {def.icon || '💠'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{item.title}</div>
                {item.subtitle && <div style={{ fontSize: 12.5, color: '#9aa2b1', marginTop: 2 }}>{item.subtitle}</div>}
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.createdAtLabel}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: isIn ? '#34e0a1' : '#f87171' }}>
                  {isIn ? '+' : '−'}৳{item.amount}
                </div>
                <div style={{ fontSize: 10.5, letterSpacing: 0.5, color: item.status === 'pending' ? '#fbbf24' : item.status === 'rejected' ? '#f87171' : '#6b7280', marginTop: 2 }}>
                  {item.status === 'pending' ? t('pending') : item.status === 'rejected' ? t('rejected') : 'TOTAL'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
