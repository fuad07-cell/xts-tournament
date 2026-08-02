import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth, MAIN_ADMIN_UID } from '../context/AuthContext'
import { CATEGORIES } from '../constants/categories'
import { logTransaction } from '../utils/transactions'
import { useToast } from '../components/ToastContext'
import { useConfirm } from '../components/ConfirmContext'

export default function Admin() {
  const { user, isAdmin, isMainAdmin } = useAuth()
  const { showToast } = useToast()
  const confirmAction = useConfirm()
  const [section, setSection] = useState('wallet') // 'wallet' | 'tournaments' | 'results' | 'users'
  const [requests, setRequests] = useState([])
  const [userCache, setUserCache] = useState({})
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    if (!isAdmin || section !== 'wallet') return
    const q = query(
      collection(db, 'walletRequests'),
      where('status', '==', tab)
    )
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0))
        setRequests(list)

        // যেই userId গুলোর তথ্য এখনো cache এ নেই, সেগুলো fetch করা
        const missing = [...new Set(list.map((r) => r.userId))].filter((uid) => !userCache[uid])
        if (missing.length) {
          const entries = await Promise.all(
            missing.map(async (uid) => {
              const snap = await getDoc(doc(db, 'users', uid))
              return [uid, snap.exists() ? snap.data() : { username: 'অজানা', email: '-' }]
            })
          )
          setUserCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
        }
      },
      (err) => console.error('walletRequests fetch error:', err)
    )
    return unsub
  }, [isAdmin, tab, section])

  async function approve(r) {
    if (!(await confirmAction(`৳${r.amount} ${r.type === 'add' ? 'যোগ' : 'বিয়োগ'} করে Approve করবেন?`))) return
    const userRef = doc(db, 'users', r.userId)
    const reqRef = doc(db, 'walletRequests', r.id)

    try {
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const u = userSnap.data()
        const currentBalance = u.walletBalance || 0
        const deposit = u.depositBalance || 0
        const winning = u.winningBalance || 0

        let update
        let referrerRef = null
        let referrerSnap = null

        if (r.type === 'add') {
          // Add Money সবসময় Deposit-এ যোগ হয়
          update = {
            walletBalance: currentBalance + r.amount,
            depositBalance: deposit + r.amount,
          }

          // Referral বোনাস — শুধু এই user-এর *প্রথম* approved deposit-এই একবার দেওয়া হবে
          if (u.referredBy && !u.firstDepositBonusGiven) {
            referrerRef = doc(db, 'users', u.referredBy)
            referrerSnap = await tx.get(referrerRef) // transaction-এ সব read আগে, write পরে করতে হয়
            update.firstDepositBonusGiven = true
          }
        } else {
          // Withdraw শুধু Winning balance থেকেই কাটা যায়
          if (winning < r.amount) throw new Error('User এর Winning Balance এর চেয়ে বেশি amount, Approve করা যাবে না')
          update = {
            walletBalance: currentBalance - r.amount,
            winningBalance: winning - r.amount,
          }
        }

        tx.update(userRef, update)
        tx.update(reqRef, { status: 'approved', approvedAt: serverTimestamp() })

        if (referrerRef && referrerSnap && referrerSnap.exists()) {
          const rd = referrerSnap.data()
          tx.update(referrerRef, {
            walletBalance: (rd.walletBalance || 0) + 5,
            winningBalance: (rd.winningBalance || 0) + 5,
            referralEarnings: (rd.referralEarnings || 0) + 5,
          })
        }
      })

      // Log it into the unified transaction history — best-effort, shouldn't
      // report a failure to the admin if only the *logging* step breaks;
      // the balance update above already succeeded at this point.
      try {
        await logTransaction(r.userId, {
          type: r.type === 'add' ? 'deposit' : 'withdraw',
          amount: r.amount,
          title: (r.type === 'add' ? 'Add Money' : 'Withdraw') + (r.method ? ` • ${r.method}` : ''),
          subtitle: 'Verified by admin',
        })
      } catch (logErr) {
        console.warn('transaction log failed (non-blocking):', logErr)
      }

      showToast('success', 'Approve করা হয়েছে')
    } catch (err) {
      showToast('error', err.message || 'সমস্যা হয়েছে')
    }
  }

  async function reject(r) {
    if (!(await confirmAction('এই request Reject করবেন?'))) return
    try {
      const reqRef = doc(db, 'walletRequests', r.id)
      await runTransaction(db, async (tx) => {
        tx.update(reqRef, { status: 'rejected', rejectedAt: serverTimestamp() })
      })
      showToast('success', 'Reject করা হয়েছে')
    } catch (err) {
      showToast('error', 'সমস্যা হয়েছে')
    }
  }

  if (!user) return <div className="loading-screen">লোড হচ্ছে...</div>
  if (!isAdmin) {
    return (
      <div className="empty" style={{ marginTop: 80 }}>
        <div className="glyph">✕</div>
        <h3>এই পেজে আপনার অ্যাক্সেস নেই</h3>
        <p>এটা শুধু Admin-এর জন্য।</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="section-title">
        <h2>Admin Panel</h2>
      </div>

      <div className="tabs">
        <div className={'tab' + (section === 'wallet' ? ' active' : '')} onClick={() => setSection('wallet')}>Wallet</div>
        <div className={'tab' + (section === 'tournaments' ? ' active' : '')} onClick={() => setSection('tournaments')}>Tournaments</div>
        <div className={'tab' + (section === 'results' ? ' active' : '')} onClick={() => setSection('results')}>Results</div>
        <div className={'tab' + (section === 'users' ? ' active' : '')} onClick={() => setSection('users')}>Users</div>
      </div>

      {section === 'tournaments' ? (
        <TournamentsPanel />
      ) : section === 'results' ? (
        <ResultsPanel />
      ) : section === 'users' ? (
        <UsersPanel isMainAdmin={isMainAdmin} />
      ) : (
        <>
          <div className="section-title">
            <h3 style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15 }}>Wallet Requests</h3>
            <span>{requests.length}টি</span>
          </div>

          <div className="tabs">
            <div className={'tab' + (tab === 'pending' ? ' active' : '')} onClick={() => setTab('pending')}>Pending</div>
            <div className={'tab' + (tab === 'approved' ? ' active' : '')} onClick={() => setTab('approved')}>Approved</div>
            <div className={'tab' + (tab === 'rejected' ? ' active' : '')} onClick={() => setTab('rejected')}>Rejected</div>
          </div>

          {requests.length === 0 && (
            <div className="empty">
              <div className="glyph">◇</div>
              <h3>কোনো request নেই</h3>
            </div>
          )}

          {requests.map((r) => {
            const u = userCache[r.userId]
            return (
              <div key={r.id} className="admin-card">
                <div className="admin-card-top">
                  <div>
                    <div className="admin-user">{u ? u.username : 'লোড হচ্ছে...'}</div>
                    <div className="admin-email">{u ? u.email : ''}</div>
                  </div>
                  <div className={'admin-type ' + r.type}>{r.type === 'add' ? '+ Add Money' : '− Withdraw'}</div>
                </div>

                <div className="admin-row"><span>Amount</span><span>৳{r.amount}</span></div>
                <div className="admin-row"><span>Method</span><span>{r.method}</span></div>
                {r.type === 'add' && <div className="admin-row"><span>Transaction ID</span><span>{r.txnId}</span></div>}
                {r.type === 'withdraw' && <div className="admin-row"><span>User-এর {r.method} নম্বর</span><span>{r.account}</span></div>}

                {tab === 'pending' && (
                  <div className="admin-actions">
                    <button className="admin-approve" onClick={() => approve(r)}>Approve</button>
                    <button className="admin-reject" onClick={() => reject(r)}>Reject</button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function ResultsPanel() {
  const { showToast } = useToast()
  const confirmAction = useConfirm()
  const [results, setResults] = useState([])
  const [userCache, setUserCache] = useState({})
  const [drafts, setDrafts] = useState({}) // resultId -> { finalKills, isWinner, prizeAmount }

  useEffect(() => {
    const q = query(collection(db, 'matchResults'), where('status', '==', 'pending'))
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0))
        setResults(list)

        const missing = [...new Set(list.map((r) => r.userId))].filter((uid) => !userCache[uid])
        if (missing.length) {
          const entries = await Promise.all(
            missing.map(async (uid) => {
              const snap = await getDoc(doc(db, 'users', uid))
              return [uid, snap.exists() ? snap.data() : { username: 'অজানা', email: '-' }]
            })
          )
          setUserCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
        }
      },
      (err) => console.error('results fetch error:', err)
    )
    return unsub
  }, [])

  function draftFor(r) {
    return drafts[r.id] || { finalKills: r.claimedKills, isWinner: false, prizeAmount: '' }
  }
  function setDraft(r, patch) {
    setDrafts((prev) => ({ ...prev, [r.id]: { ...draftFor(r), ...patch } }))
  }

  async function approve(r) {
    const d = draftFor(r)
    const finalKills = Number(d.finalKills) || 0
    const prizeAmount = Number(d.prizeAmount) || 0

    if (!(await confirmAction(`Kills: ${finalKills}, ${d.isWinner ? 'জয়ী' : 'পরাজিত'}${d.isWinner && prizeAmount ? `, Prize ৳${prizeAmount}` : ''} — Approve করবেন?`))) return

    try {
      const resultRef = doc(db, 'matchResults', r.id)
      const entryRef = doc(db, 'entries', r.entryId)
      const userRef = doc(db, 'users', r.userId)

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const u = userSnap.data()

        tx.update(resultRef, {
          status: 'approved',
          finalKills,
          isWinner: d.isWinner,
          prizeAmount: d.isWinner ? prizeAmount : 0,
          reviewedAt: serverTimestamp(),
        })
        tx.update(entryRef, { status: 'completed' })
        tx.update(userRef, {
          kills: (u.kills || 0) + finalKills,
          wins: (u.wins || 0) + (d.isWinner ? 1 : 0),
          walletBalance: (u.walletBalance || 0) + (d.isWinner ? prizeAmount : 0),
          winningBalance: (u.winningBalance || 0) + (d.isWinner ? prizeAmount : 0),
        })
      })

      if (d.isWinner && prizeAmount > 0) {
        try {
          await logTransaction(r.userId, {
            type: 'prize',
            amount: prizeAmount,
            title: 'Match Prize',
            subtitle: `${finalKills} kills • Result approved`,
          })
        } catch (logErr) {
          console.warn('transaction log failed (non-blocking):', logErr)
        }
      }
      showToast('success', 'Result Approve করা হয়েছে')
    } catch (err) {
      showToast('error', 'সমস্যা হয়েছে: ' + err.message)
    }
  }

  async function reject(r) {
    if (!(await confirmAction('এই Result Reject করবেন?'))) return
    try {
      await runTransaction(db, async (tx) => {
        tx.update(doc(db, 'matchResults', r.id), { status: 'rejected', reviewedAt: serverTimestamp() })
      })
      showToast('success', 'Reject করা হয়েছে')
    } catch (err) {
      showToast('error', 'সমস্যা হয়েছে')
    }
  }

  return (
    <div>
      {results.length === 0 && (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>Review করার মতো কোনো Result নেই</h3>
        </div>
      )}

      {results.map((r) => {
        const u = userCache[r.userId]
        const d = draftFor(r)
        return (
          <div key={r.id} className="admin-card">
            <div className="admin-card-top">
              <div>
                <div className="admin-user">{u ? u.username : 'লোড হচ্ছে...'}</div>
                <div className="admin-email">{u ? u.email : ''}</div>
              </div>
              <div className="admin-type add">{r.title}</div>
            </div>

            <img src={r.screenshotURL} alt="result screenshot" className="result-screenshot" onClick={() => window.open(r.screenshotURL, '_blank')} />

            <div className="admin-row"><span>User-এর দাবি করা Kills</span><span>{r.claimedKills}</span></div>

            <div className="field" style={{ flex: 1 }}>
              <label>Final Kills (verify করে বসান)</label>
              <input type="number" value={d.finalKills} onChange={(e) => setDraft(r, { finalKills: e.target.value })} />
            </div>

            <div className="toggle-row">
              <div className={'toggle-btn' + (!d.isWinner ? ' active' : '')} onClick={() => setDraft(r, { isWinner: false })}>হেরেছে</div>
              <div className={'toggle-btn' + (d.isWinner ? ' active' : '')} onClick={() => setDraft(r, { isWinner: true })}>জিতেছে 🏆</div>
            </div>

            {d.isWinner && (
              <div className="field" style={{ flex: 1 }}>
                <label>Prize Amount (৳)</label>
                <input type="number" value={d.prizeAmount} onChange={(e) => setDraft(r, { prizeAmount: e.target.value })} placeholder="0" />
              </div>
            )}

            <div className="admin-actions">
              <button className="admin-approve" onClick={() => approve(r)}>Approve</button>
              <button className="admin-reject" onClick={() => reject(r)}>Reject</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UsersPanel({ isMainAdmin }) {
  const { showToast } = useToast()
  const confirmAction = useConfirm()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [refundFor, setRefundFor] = useState(null) // uid currently showing the refund form
  const [refundAmount, setRefundAmount] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [busyUid, setBusyUid] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.username || '').localeCompare(b.username || ''))
        setUsers(list)
        setLoading(false)
      },
      (err) => { console.error('users fetch error:', err); setLoading(false) }
    )
    return unsub
  }, [])

  const filtered = users.filter((u) => {
    const s = search.trim().toLowerCase()
    if (!s) return true
    return (u.username || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s)
  })

  async function toggleAdmin(u) {
    if (!isMainAdmin) return // extra safety — the button is already hidden for non-main-admins
    if (u.id === MAIN_ADMIN_UID) return // main admin can never be demoted through the app

    const granting = !u.isAdmin
    const msg = granting
      ? `${u.username || u.email} কে Admin বানাবেন? সে তখন Wallet, Tournaments, Results ও Users — সব admin ফিচার ব্যবহার করতে পারবে (শুধু অন্য কাউকে admin বানানো/সরানো ছাড়া)।`
      : `${u.username || u.email} এর Admin এক্সেস তুলে দিবেন?`
    if (!(await confirmAction(msg))) return

    setBusyUid(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), { isAdmin: granting })
      showToast('success', 'আপডেট হয়েছে')
    } catch (err) {
      showToast('error', 'আপডেট করা যায়নি')
    } finally {
      setBusyUid(null)
    }
  }

  async function toggleSuspend(u) {
    if (u.id === MAIN_ADMIN_UID) return // main admin's account can never be suspended through the app
    const suspending = !u.suspended
    const msg = suspending
      ? `${u.username || u.email} কে suspend করবেন? এই ইউজার তখনই app থেকে log out হয়ে যাবে এবং আর login করতে পারবে না।`
      : `${u.username || u.email} এর suspension তুলে দিবেন? ইউজার আবার login করতে পারবে।`
    if (!(await confirmAction(msg, { danger: suspending }))) return

    setBusyUid(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), {
        suspended: suspending,
        suspendedAt: suspending ? serverTimestamp() : null,
      })
      showToast('success', 'আপডেট হয়েছে')
    } catch (err) {
      showToast('error', 'আপডেট করা যায়নি')
    } finally {
      setBusyUid(null)
    }
  }

  async function zeroBalance(u) {
    if (u.id === MAIN_ADMIN_UID) return
    const total = (u.walletBalance || 0)
    if (!(await confirmAction(`${u.username || u.email} এর পুরো balance (৳${total}) শূন্য করে দিবেন? এটা undo করা যাবে না।`, { danger: true }))) return

    setBusyUid(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), {
        walletBalance: 0,
        depositBalance: 0,
        winningBalance: 0,
      })
      if (total > 0) {
        try {
          await logTransaction(u.id, {
            type: 'adjustment',
            amount: total,
            title: 'Balance Reset by Admin',
            subtitle: 'সম্পূর্ণ balance শূন্য করা হয়েছে',
          })
        } catch (logErr) {
          console.warn('transaction log failed (non-blocking):', logErr)
        }
      }
      showToast('success', 'Balance শূন্য করা হয়েছে')
    } catch (err) {
      showToast('error', 'আপডেট করা যায়নি')
    } finally {
      setBusyUid(null)
    }
  }

  async function submitRefund(u) {
    const amount = Number(refundAmount)
    if (!amount || amount <= 0) return showToast('warning', 'সঠিক Amount দিন')
    if (!(await confirmAction(`${u.username || u.email} কে ৳${amount} refund করবেন?`))) return

    setBusyUid(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), {
        walletBalance: (u.walletBalance || 0) + amount,
        depositBalance: (u.depositBalance || 0) + amount,
      })

      // History log করা ব্যর্থ হলেও এই catch এ যেন না ধরে — কারণ ততক্ষণে
      // balance আপডেট আগেই সফল হয়ে গেছে, ভুলভাবে "Refund করা যায়নি" দেখানো ঠিক না
      try {
        await logTransaction(u.id, {
          type: 'refund',
          amount,
          title: 'Refund',
          subtitle: refundNote.trim() || 'Admin কর্তৃক refund করা হয়েছে',
        })
      } catch (logErr) {
        console.warn('transaction log failed (non-blocking):', logErr)
      }

      showToast('success', `৳${amount} Refund সফল হয়েছে`)
      setRefundFor(null)
      setRefundAmount('')
      setRefundNote('')
    } catch (err) {
      showToast('error', 'Refund করা যায়নি')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div>
      <div className="field" style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম বা ইমেইল দিয়ে খুঁজুন..."
        />
      </div>

      {loading && <div className="meta">লোড হচ্ছে...</div>}
      {!loading && filtered.length === 0 && (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>কোনো ইউজার পাওয়া যায়নি</h3>
        </div>
      )}

      {filtered.map((u) => (
        <div key={u.id} className="admin-card">
          <div className="admin-card-top">
            <div>
              <div className="admin-user">
                {u.username || 'অজানা'}
                {u.id === MAIN_ADMIN_UID && (
                  <span style={{ marginLeft: 8, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 700, letterSpacing: 0.4 }}>
                    MAIN ADMIN
                  </span>
                )}
                {u.id !== MAIN_ADMIN_UID && u.isAdmin && (
                  <span style={{ marginLeft: 8, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 700, letterSpacing: 0.4 }}>
                    ADMIN
                  </span>
                )}
                {u.suspended && (
                  <span style={{ marginLeft: 8, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'rgba(248,113,113,0.15)', color: '#f87171', fontWeight: 700, letterSpacing: 0.4 }}>
                    SUSPENDED
                  </span>
                )}
              </div>
              <div className="admin-email">{u.email}</div>
            </div>
            <div className={'admin-type ' + (u.suspended ? 'withdraw' : 'add')}>৳{u.walletBalance || 0}</div>
          </div>

          <div className="admin-row"><span>Deposit Balance</span><span>৳{u.depositBalance || 0}</span></div>
          <div className="admin-row"><span>Winning Balance</span><span>৳{u.winningBalance || 0}</span></div>

          {u.id === MAIN_ADMIN_UID ? (
            <div className="note" style={{ marginTop: 10 }}>
              এই অ্যাকাউন্টটা main admin — suspend, balance reset বা admin access পরিবর্তন এখান থেকে করা যাবে না।
            </div>
          ) : refundFor === u.id ? (
            <>
              <div className="field-row" style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Refund Amount (৳)</label>
                  <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="৳" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Note (ঐচ্ছিক)</label>
                  <input type="text" value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="কারণ লিখুন" />
                </div>
              </div>
              <div className="admin-actions">
                <button className="admin-approve" onClick={() => submitRefund(u)} disabled={busyUid === u.id}>
                  {busyUid === u.id ? '...' : 'Refund নিশ্চিত করুন'}
                </button>
                <button className="admin-reject" onClick={() => { setRefundFor(null); setRefundAmount(''); setRefundNote('') }}>
                  বাতিল
                </button>
              </div>
            </>
          ) : (
            <div className="admin-actions">
              <button className="admin-approve" onClick={() => setRefundFor(u.id)} disabled={busyUid === u.id}>
                ↩️ Refund
              </button>
              <button className="admin-reject" onClick={() => zeroBalance(u)} disabled={busyUid === u.id}>
                {busyUid === u.id ? '...' : '০ Balance শূন্য করুন'}
              </button>
              <button
                className={u.suspended ? 'admin-approve' : 'admin-reject'}
                onClick={() => toggleSuspend(u)}
                disabled={busyUid === u.id}
              >
                {busyUid === u.id ? '...' : u.suspended ? '✓ Unsuspend' : '⛔ Suspend'}
              </button>
              {isMainAdmin && (
                <button
                  className={u.isAdmin ? 'admin-reject' : 'admin-approve'}
                  onClick={() => toggleAdmin(u)}
                  disabled={busyUid === u.id}
                >
                  {busyUid === u.id ? '...' : u.isAdmin ? '🛠️ Admin সরান' : '🛠️ Admin বানান'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TournamentsPanel() {
  const { showToast } = useToast()
  const [tournaments, setTournaments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'br',
    map: 'BERMUDA',
    mode: 'CLASSIC SOLO',
    teamMode: 'solo',
    date: '',
    time: '',
    entryFee: '',
    prizePool: '',
    perKill: '',
    slots: '',
    winner: '',
    second: '',
    third: '',
    fourth: '',
    fifth: '',
  })
  const [busy, setBusy] = useState(false)
  const [roomDrafts, setRoomDrafts] = useState({}) // tournamentId -> { roomId, roomPassword }

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  async function createTournament() {
    if (!form.title || !form.entryFee || !form.prizePool || !form.slots) {
      return showToast('warning', 'সব ঘর পূরণ করুন')
    }
    setBusy(true)
    try {
      await addDoc(collection(db, 'tournaments'), {
        title: form.title,
        category: form.category,
        map: form.map,
        mode: form.mode,
        teamMode: form.teamMode,
        date: form.date || null,
        time: form.time || null,
        entryFee: Number(form.entryFee),
        prizePool: Number(form.prizePool),
        perKill: Number(form.perKill) || 0,
        slots: Number(form.slots),
        filled: 0,
        status: 'open',
        prizeBreakdown: {
          winner: Number(form.winner) || 0,
          second: Number(form.second) || 0,
          third: Number(form.third) || 0,
          fourth: Number(form.fourth) || 0,
          fifth: Number(form.fifth) || 0,
        },
        roomId: '',
        roomPassword: '',
        createdAt: serverTimestamp(),
      })
      setForm({
        title: '',
        category: 'br',
        map: 'BERMUDA',
        mode: 'CLASSIC SOLO',
        teamMode: 'solo',
        date: '',
        time: '',
        entryFee: '',
        prizePool: '',
        perKill: '',
        slots: '',
        winner: '',
        second: '',
        third: '',
        fourth: '',
        fifth: '',
      })
      setShowForm(false)
      showToast('success', 'নতুন ম্যাচ তৈরি হয়েছে')
    } catch (err) {
      showToast('error', 'তৈরি করা যায়নি')
    } finally {
      setBusy(false)
    }
  }

  function roomDraftFor(t) {
    return roomDrafts[t.id] || { roomId: t.roomId || '', roomPassword: t.roomPassword || '' }
  }
  function setRoomDraft(t, patch) {
    setRoomDrafts((prev) => ({ ...prev, [t.id]: { ...roomDraftFor(t), ...patch } }))
  }
  async function saveRoomInfo(t) {
    const d = roomDraftFor(t)
    try {
      await updateDoc(doc(db, 'tournaments', t.id), {
        roomId: d.roomId,
        roomPassword: d.roomPassword,
      })
      showToast('success', 'Room ID / Password সেভ হয়েছে')
    } catch (err) {
      showToast('error', 'সেভ করা যায়নি')
    }
  }

  async function toggleStatus(t) {
    try {
      await updateDoc(doc(db, 'tournaments', t.id), {
        status: t.status === 'open' ? 'closed' : 'open',
      })
      showToast('success', 'আপডেট হয়েছে')
    } catch (err) {
      showToast('error', 'আপডেট করা যায়নি')
    }
  }

  return (
    <div>
      <button className="join-btn" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>
        + নতুন ম্যাচ তৈরি করুন
      </button>

      {tournaments.length === 0 && (
        <div className="empty">
          <div className="glyph">◇</div>
          <h3>এখনো কোনো ম্যাচ নেই</h3>
        </div>
      )}

      {tournaments.map((t) => {
        const rd = roomDraftFor(t)
        return (
          <div key={t.id} className="admin-card">
            <div className="admin-card-top">
              <div>
                <div className="admin-user">{t.title}</div>
                <div className="admin-email">
                  {CATEGORIES.find((c) => c.key === t.category)?.label || t.category}
                  {t.date ? ` • ${t.date} ${t.time || ''}` : ''}
                </div>
              </div>
              <div className={'admin-type ' + (t.status === 'open' ? 'add' : 'withdraw')}>{t.status}</div>
            </div>
            <div className="admin-row"><span>Map / Mode</span><span>{t.map || '—'} / {t.mode || '—'}</span></div>
            <div className="admin-row"><span>Team Mode</span><span>{t.teamMode === 'duo' ? '👥 DUO' : '🧍 SOLO'}</span></div>
            <div className="admin-row"><span>Entry Fee</span><span>৳{t.entryFee}</span></div>
            <div className="admin-row"><span>Total Prize Pool</span><span>৳{t.prizePool}</span></div>
            <div className="admin-row"><span>Per Kill</span><span>৳{t.perKill || 0}</span></div>
            <div className="admin-row"><span>Slots</span><span>{t.filled || 0}/{t.slots}</span></div>

            <div className="field" style={{ flex: 1 }}>
              <label>Room ID</label>
              <input
                type="text"
                value={rd.roomId}
                onChange={(e) => setRoomDraft(t, { roomId: e.target.value })}
                placeholder="ম্যাচ শুরুর আগে বসান"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Room Password</label>
              <input
                type="text"
                value={rd.roomPassword}
                onChange={(e) => setRoomDraft(t, { roomPassword: e.target.value })}
                placeholder="পাসওয়ার্ড"
              />
            </div>

            <div className="admin-actions">
              <button className="admin-approve" onClick={() => saveRoomInfo(t)}>Room Info সেভ করুন</button>
              <button className="admin-reject" onClick={() => toggleStatus(t)}>
                {t.status === 'open' ? 'Close করুন' : 'আবার Open করুন'}
              </button>
            </div>
          </div>
        )
      })}

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            <h2>নতুন ম্যাচ</h2>

            <div className="field" style={{ flex: 1 }}>
              <label>Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Free Fire BR Squad #1" />
            </div>

            <div className="field" style={{ flex: 1 }}>
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, color: 'var(--text)' }}
              >
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>

            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Map</label>
                <input type="text" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} placeholder="BERMUDA" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Mode</label>
                <input type="text" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} placeholder="CLASSIC SOLO" />
              </div>
            </div>

            <div className="field">
              <label>Team Mode</label>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={'mode-btn' + (form.teamMode === 'solo' ? ' active' : '')}
                  onClick={() => setForm({ ...form, teamMode: 'solo' })}
                >
                  🧍 SOLO
                </button>
                <button
                  type="button"
                  className={'mode-btn' + (form.teamMode === 'duo' ? ' active' : '')}
                  onClick={() => setForm({ ...form, teamMode: 'duo' })}
                >
                  👥 DUO
                </button>
              </div>
            </div>

            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Match Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Match Time</label>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Entry Fee (৳)</label>
                <input type="number" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Per Kill (৳)</label>
                <input type="number" value={form.perKill} onChange={(e) => setForm({ ...form, perKill: e.target.value })} />
              </div>
            </div>

            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Total Prize Pool (৳)</label>
                <input type="number" value={form.prizePool} onChange={(e) => setForm({ ...form, prizePool: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Total Slots</label>
                <input type="number" value={form.slots} onChange={(e) => setForm({ ...form, slots: e.target.value })} />
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 8 }}>
              <h3 style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14 }}>Prize Breakdown (ঐচ্ছিক)</h3>
            </div>

            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>🥇 Winner (৳)</label>
                <input type="number" value={form.winner} onChange={(e) => setForm({ ...form, winner: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>🥈 2nd Position (৳)</label>
                <input type="number" value={form.second} onChange={(e) => setForm({ ...form, second: e.target.value })} />
              </div>
            </div>
            <div className="field-row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>🥉 3rd Position (৳)</label>
                <input type="number" value={form.third} onChange={(e) => setForm({ ...form, third: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>🎖️ 4th Position (৳)</label>
                <input type="number" value={form.fourth} onChange={(e) => setForm({ ...form, fourth: e.target.value })} />
              </div>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>🎖️ 5th Position (৳)</label>
              <input type="number" value={form.fifth} onChange={(e) => setForm({ ...form, fifth: e.target.value })} />
            </div>

            <button className="join-btn" onClick={createTournament} disabled={busy}>
              {busy ? '...' : 'তৈরি করুন'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
