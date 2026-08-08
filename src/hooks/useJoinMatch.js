import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'
import { logTransaction } from '../utils/transactions'
import { createNotification } from '../utils/notify'

// ৳ paid to a referrer AND to the person they invited, the moment the
// invited person completes their FIRST booking (match join) — "both of you
// get ৳5", matching the Invite Friends page. Guarded by the referred
// user's `referralBonusPaid` flag so it can only ever fire once per
// account, no matter how many times they join matches afterwards.
const REFERRAL_BONUS_AMOUNT = 5

// Shared join-transaction logic — used by both CategoryPage and
// MatchRulesPage so there's exactly one place that knows how to charge a
// wallet and create an entry. Handles the deposit/winning balance split,
// enforces one-slot-per-account via a deterministic entry ID, and — on a
// user's very first successful booking — automatically credits whoever
// referred them.
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

    // Set only when this booking actually triggers a referral payout, so the
    // (best-effort) transaction-log + notification can run after the
    // Firestore transaction below has committed.
    let referralPayout = null

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

        // This is the user's first-ever entry doc iff matchesPlayed is still
        // 0 going into this transaction (it's incremented right below).
        // Firestore transactions require every read before any write, so
        // the referrer doc — if there is one to pay — has to be fetched
        // here, before the tx.update/tx.set calls further down.
        const isFirstBooking = !(userData.matchesPlayed > 0)
        const eligibleForReferralBonus = isFirstBooking && userData.referredBy && !userData.referralBonusPaid
        let referrerRef = null
        let referrerSnap = null
        if (eligibleForReferralBonus) {
          referrerRef = doc(db, 'users', userData.referredBy)
          referrerSnap = await tx.get(referrerRef)
        }

        // "Both of you get ৳5" — the joining user gets their own bonus added
        // straight into this same balance update (on top of the entry fee
        // that was just deducted above), not just the referrer.
        if (eligibleForReferralBonus) {
          newWinning += REFERRAL_BONUS_AMOUNT
        }

        const userUpdate = {
          depositBalance: newDeposit,
          winningBalance: newWinning,
          walletBalance: newDeposit + newWinning,
          matchesPlayed: (userData.matchesPlayed || 0) + 1,
        }
        if (eligibleForReferralBonus) userUpdate.referralBonusPaid = true
        tx.update(userRef, userUpdate)
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
          // Matches.jsx এর determineStatus() এর জন্য দরকার
          date: t.date || null,
          time: t.time || null,
          map: t.map || null,
          prizePool: t.prizePool || 0,
          submissionDeadline: t.submissionDeadline || '01:00',
        })

        if (referrerRef && referrerSnap && referrerSnap.exists()) {
          const rd = referrerSnap.data()
          tx.update(referrerRef, {
            walletBalance: (rd.walletBalance || 0) + REFERRAL_BONUS_AMOUNT,
            winningBalance: (rd.winningBalance || 0) + REFERRAL_BONUS_AMOUNT,
            referralEarnings: (rd.referralEarnings || 0) + REFERRAL_BONUS_AMOUNT,
          })
          referralPayout = {
            referrerUid: userData.referredBy,
            referredUid: user.uid,
            referredUsername: userData.username || null,
          }
        }
      })
      await refreshProfile()
      showToast(
        'success',
        referralPayout
          ? `ম্যাচে Register করা হয়েছে! রেফারেল বোনাস হিসেবে ৳${REFERRAL_BONUS_AMOUNT}ও যোগ হয়েছে।`
          : 'ম্যাচে Register করা হয়েছে! "My Matches" থেকে দেখুন।'
      )

      // Best-effort — a referral payout already committed above; logging
      // and notifying about it should never surface as a failure to the
      // person who just joined the match.
      if (referralPayout) {
        try {
          await logTransaction(referralPayout.referredUid, {
            type: 'referral',
            amount: REFERRAL_BONUS_AMOUNT,
            title: 'Referral Bonus',
            subtitle: 'Referral code ব্যবহার করে প্রথম ম্যাচ জয়েনের বোনাস',
          })
        } catch (logErr) {
          console.warn('referral (self) transaction log failed (non-blocking):', logErr)
        }
        try {
          await logTransaction(referralPayout.referrerUid, {
            type: 'referral',
            amount: REFERRAL_BONUS_AMOUNT,
            title: 'Referral Bonus',
            subtitle: referralPayout.referredUsername
              ? `${referralPayout.referredUsername} প্রথম ম্যাচ খেলেছে`
              : 'আপনার বন্ধু প্রথম ম্যাচ খেলেছে',
          })
        } catch (logErr) {
          console.warn('referral transaction log failed (non-blocking):', logErr)
        }
        try {
          await createNotification(referralPayout.referrerUid, {
            type: 'refund',
            title: `৳${REFERRAL_BONUS_AMOUNT} Referral Bonus পেয়েছেন`,
            body: referralPayout.referredUsername
              ? `আপনার ইনভাইট করা বন্ধু ${referralPayout.referredUsername} প্রথম ম্যাচ খেলেছে — ৳${REFERRAL_BONUS_AMOUNT} আপনার ওয়ালেটে যোগ হয়েছে।`
              : `আপনার ইনভাইট করা একজন বন্ধু প্রথম ম্যাচ খেলেছে — ৳${REFERRAL_BONUS_AMOUNT} আপনার ওয়ালেটে যোগ হয়েছে।`,
          })
        } catch (notifyErr) {
          console.warn('referral notification failed (non-blocking):', notifyErr)
        }
      }

      return { ok: true }
    } catch (err) {
      showToast('error', err.message || 'Register করা যায়নি, আবার চেষ্টা করুন')
      return { ok: false }
    }
  }

  return { joinMatch }
}
