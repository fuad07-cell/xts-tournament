import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'

// Shared join-transaction logic — used by both CategoryPage and
// MatchRulesPage so there's exactly one place that knows how to charge a
// wallet and create an entry. Handles the deposit/winning balance split,
// and enforces one-slot-per-account via a deterministic entry ID.
export function useJoinMatch() {
  const { user, refreshProfile } = useAuth()
  const { showToast } = useToast()

  async function joinMatch(t, { mode, ign, teammateIgn, totalCost }) {
    if (!user) return { ok: false, needsAuth: true }

    const userRef = doc(db, 'users', user.uid)
    const tRef = doc(db, 'tournaments', t.id)
    // Deterministic ID (tournamentId_userId) instead of an auto-generated one:
    // guarantees one Firebase account can hold at most one entry per tournament.
    const entryRef = doc(db, 'entries', `${t.id}_${user.uid}`)

    try {
      await runTransaction(db, async (tx) => {
        const [userSnap, tSnap, entrySnap] = await Promise.all([
          tx.get(userRef),
          tx.get(tRef),
          tx.get(entryRef),
        ])

        if (entrySnap.exists()) {
          throw new Error('আপনি ইতিমধ্যে এই ম্যাচে জয়েন করেছেন — একই আইডি থেকে একটি ম্যাচে একবারই স্লট কেনা যায়')
        }

        const userData = userSnap.data()
        const deposit = userData.depositBalance || 0
        const winning = userData.winningBalance || 0
        const totalBalance = deposit + winning
        const filled = tSnap.data().filled || 0
        const slots = tSnap.data().slots || 0

        if (filled >= slots) throw new Error('এই ম্যাচের স্লট পূর্ণ হয়ে গেছে')
        if (totalBalance < totalCost) throw new Error('Balance যথেষ্ট নয়। আগে Add Money করুন')

        // Winning balance আগে কাটো, তারপর deposit থেকে
        let remainingFee = totalCost
        let newWinning = winning
        let newDeposit = deposit

        if (newWinning >= remainingFee) {
          newWinning -= remainingFee
          remainingFee = 0
        } else {
          remainingFee -= newWinning
          newWinning = 0
          newDeposit -= remainingFee
        }

        tx.update(userRef, {
          depositBalance: newDeposit,
          winningBalance: newWinning,
          walletBalance: newDeposit + newWinning,
          matchesPlayed: (userData.matchesPlayed || 0) + 1,
        })
        tx.update(tRef, { filled: filled + 1 })

        tx.set(entryRef, {
          userId: user.uid,
          tournamentId: t.id,
          title: t.title,
          category: t.category,
          entryFee: t.entryFee,
          amountPaid: totalCost,
          mode,
          ign,
          teammateIgn: teammateIgn || null,
          status: 'joined',
          joinedAt: serverTimestamp(),
        })
      })
      await refreshProfile()
      showToast('success', 'ম্যাচে Register করা হয়েছে! "My Matches" থেকে দেখুন।')
      return { ok: true }
    } catch (err) {
      showToast('error', err.message || 'Register করা যায়নি, আবার চেষ্টা করুন')
      return { ok: false }
    }
  }

  return { joinMatch }
}
