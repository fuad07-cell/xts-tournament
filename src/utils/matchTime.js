// Resolves a tournament's scheduled time regardless of which field the
// document happens to use:
//   - `matchAt` — a Firestore Timestamp (older/alternate schema)
//   - `date` + `time` strings — what the current Admin panel actually saves
// Returns milliseconds since epoch, or null if neither field is present.
export function getMatchTime(t) {
  if (!t) return null

  if (t.matchAt) {
    if (typeof t.matchAt.toMillis === 'function') return t.matchAt.toMillis()
    const d = new Date(t.matchAt)
    if (!isNaN(d.getTime())) return d.getTime()
  }

  if (t.date) {
    const d = new Date(`${t.date}T${t.time || '00:00'}`)
    if (!isNaN(d.getTime())) return d.getTime()
  }

  return null
}
