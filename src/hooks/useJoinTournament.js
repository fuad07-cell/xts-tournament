import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'
import { useLanguage } from '../context/LanguageContext'

// Same Firebase transaction logic that used to live inside Home.jsx's
// joinTournament(), extracted so CategoryPage/Matches can reuse it without
// duplicating the wallet/slot/entry logic.
//
// `details` comes from JoinModal's onConfirm: { mode, ign, teammateIgn, totalCost }.
// totalCost already accounts for SOLO (x1) vs DUO (x2) entry fee, so the
// wallet is charged exactly what the modal showed the user. If joinTournament
// is ever called without details (shouldn't happen once JoinModal is wired
// in everywhere), it falls back to solo pricing so nothing breaks.
//
// IMPORTANT: the entry document ID is deterministic —
// `${tournamentId}_${userId}` instead of an auto-generated ID. This means a
// single Firebase account (user.uid) can never hold two entries for the
// same tournament: the transaction reads that exact doc and refuses to
// proceed if it already exists, so "one slot per ID" is enforced atomically
// by Firestore itself, not just by disabling a button in the UI.
export function useJoinTournament() {
  const { user, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const { t } = useLanguage()

  async function joinTournament(tournament, details = null) {
    if (!user) {
      showToast('error', t('fillAllFields'))
      return false
    }

    const mode = details?.mode || 'solo'
    const ign = details?.ign || null
    const teammateIgn = details?.teammateIgn || null
    const totalCost = details?.totalCost ?? tournament.entryFee

    const userRef = doc(db, 'users', user.uid)
    const tRef = doc(db, 'tournaments', tournament.id)
    const entryRef = doc(db, 'entries', `${tournament.id}_${user.uid}`)

    try {
      await runTransaction(db, async (tx) => {
        const [userSnap, tSnap, entrySnap] = await Promise.all([
          tx.get(userRef),
          tx.get(tRef),
          tx.get(entryRef),
        ])

        if (entrySnap.exists()) {
          throw new Error(t('alreadyJoinedError'))
        }

        const userData = userSnap.data()
        const deposit = userData.depositBalance || 0
        const winning = userData.winningBalance || 0
        const totalBalance = deposit + winning
        const filled = tSnap.data().filled || 0
        const slots = tSnap.data().slots || 0

        if (filled >= slots) throw new Error(t('slotsFullError'))
        if (totalBalance < totalCost) throw new Error(t('insufficientBalanceError'))

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
          tournamentId: tournament.id,
          title: tournament.title,
          category: tournament.category,
          entryFee: totalCost,
          mode,
          ign,
          teammateIgn,
          status: 'joined',
          joinedAt: serverTimestamp(),
        })
      })
      await refreshProfile()
      showToast('success', t('joinSuccess'))
      return true
    } catch (err) {
      showToast('error', err.message || t('joinFailed'))
      return false
    }
  }

  return { joinTournament }
}
