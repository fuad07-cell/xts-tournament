// Helpers for the category page: expiry detection, date/time filters and sorting.
//
// SCHEMA ASSUMPTION: a tournament doc may have either
//   - `startAt`: a Firestore Timestamp, OR
//   - `date` (e.g. "2026-07-25") + `time` (e.g. "18:00") strings
// If your actual field names differ, adjust getMatchDateTime() below —
// every other function in this file builds on top of it.

export function getMatchDateTime(t) {
  if (!t) return null

  if (t.startAt) {
    if (typeof t.startAt.toDate === 'function') return t.startAt.toDate()
    if (typeof t.startAt.seconds === 'number') return new Date(t.startAt.seconds * 1000)
  }

  if (t.date) {
    const timeStr = t.time || '00:00'
    const d = new Date(`${t.date}T${timeStr}`)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

export function isExpired(t, now = new Date()) {
  const d = getMatchDateTime(t)
  if (!d) return false // unknown time -> treat as not expired
  return d.getTime() <= now.getTime()
}

export function formatDate(d) {
  if (!d) return 'তারিখ শীঘ্রই জানানো হবে'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(d) {
  if (!d) return '—'
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// FILTER_OPTIONS drives both the UI pills and matchesFilter() below.
export const FILTER_OPTIONS = [
  { key: 'all', label: 'সব' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This Week' },
]

export function matchesFilter(t, filterKey, now = new Date()) {
  const d = getMatchDateTime(t)
  if (filterKey === 'all') return true
  if (!d) return false // can't place an unknown-time match into a specific bucket

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const startOfDayAfterTomorrow = new Date(startOfTomorrow)
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1)
  const endOfWeek = new Date(startOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  switch (filterKey) {
    case 'upcoming':
      return d.getTime() > now.getTime()
    case 'today':
      return d >= startOfToday && d < startOfTomorrow
    case 'tomorrow':
      return d >= startOfTomorrow && d < startOfDayAfterTomorrow
    case 'thisWeek':
      return d >= startOfToday && d < endOfWeek
    default:
      return true
  }
}

export const SORT_OPTIONS = [
  { key: 'earliest', label: 'Earliest First' },
  { key: 'latest', label: 'Latest First' },
  { key: 'highestPrize', label: 'Highest Prize' },
  { key: 'lowestFee', label: 'Lowest Entry Fee' },
]

// Always keeps expired matches below non-expired ones (requirement #5),
// then orders each group by the chosen sort key (requirement #8).
export function sortTournaments(list, sortKey, now = new Date()) {
  const withMeta = list.map((t) => {
    const date = getMatchDateTime(t)
    return { t, date, expired: isExpired(t, now) }
  })

  const upcoming = withMeta.filter((x) => !x.expired)
  const expired = withMeta.filter((x) => x.expired)

  const cmp = (a, b) => {
    switch (sortKey) {
      case 'latest':
        return (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity)
      case 'highestPrize':
        return (b.t.prizePool || 0) - (a.t.prizePool || 0)
      case 'lowestFee':
        return (a.t.entryFee || 0) - (b.t.entryFee || 0)
      case 'earliest':
      default:
        return (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity)
    }
  }

  upcoming.sort(cmp)
  expired.sort(cmp)

  return [...upcoming, ...expired].map((x) => ({ ...x.t, __date: x.date, __expired: x.expired }))
}
