import { doc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'

// ---------------------------------------------------------------------
// FREE alternative to Cloud Functions: everything runs from the client,
// so no Blaze plan / billing card is required.
//
// Trade-off (be aware of this): a player's weekly/monthly numbers only
// reset the next time THEIR OWN device touches their doc (they open the
// app, or finish a match). There's no server ticking in the background.
// In practice this self-heals within moments of each player using the
// app after a reset boundary, which is good enough for a leaderboard.
// ---------------------------------------------------------------------

function weekAnchor(date) {
  // ISO week string, e.g. "2026-W32". Week starts Monday.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function monthAnchor(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Call this whenever a user's doc is about to be read/shown (e.g. on app
// load, or when opening the leaderboard) to silently reset stale weekly/
// monthly numbers for THAT user. Safe to call often — it's a no-op if
// nothing is stale.
export async function ensureFreshPeriodStats(uid) {
  if (!uid) return
  const ref = doc(db, 'users', uid)
  const now = new Date()
  const curWeek = weekAnchor(now)
  const curMonth = monthAnchor(now)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const data = snap.data()
    const update = {}
    if (data.weeklyAnchor !== curWeek) {
      update.weeklyAnchor = curWeek
      update.weeklyWins = 0
      update.weeklyKills = 0
      update.weeklyMatches = 0
      update.weeklyEarnings = 0
    }
    if (data.monthlyAnchor !== curMonth) {
      update.monthlyAnchor = curMonth
      update.monthlyWins = 0
      update.monthlyKills = 0
      update.monthlyMatches = 0
      update.monthlyEarnings = 0
    }
    if (Object.keys(update).length > 0) tx.update(ref, update)
  })
}

// Call this once per player right when a match finishes, instead of a
// Cloud Function trigger. Example:
//   await recordMatchResult(playerUid, { won: true, kills: 7, earnings: 150 })
export async function recordMatchResult(uid, { won = false, kills = 0, earnings = 0 } = {}) {
  if (!uid) return
  await ensureFreshPeriodStats(uid) // reset first if a new week/month just started
  const ref = doc(db, 'users', uid)
  const winInc = won ? 1 : 0

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const d = snap.data()
    tx.update(ref, {
      weeklyWins: (d.weeklyWins || 0) + winInc,
      monthlyWins: (d.monthlyWins || 0) + winInc,
      allTimeWins: (d.allTimeWins || 0) + winInc,
      weeklyKills: (d.weeklyKills || 0) + kills,
      monthlyKills: (d.monthlyKills || 0) + kills,
      allTimeKills: (d.allTimeKills || 0) + kills,
      weeklyMatches: (d.weeklyMatches || 0) + 1,
      monthlyMatches: (d.monthlyMatches || 0) + 1,
      allTimeMatches: (d.allTimeMatches || 0) + 1,
      weeklyEarnings: (d.weeklyEarnings || 0) + earnings,
      monthlyEarnings: (d.monthlyEarnings || 0) + earnings,
      allTimeEarnings: (d.allTimeEarnings || 0) + earnings,
    })
  })
}
