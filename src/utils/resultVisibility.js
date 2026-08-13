import { Timestamp } from 'firebase/firestore'

// How long a published match result stays visible to everyone in the
// Results tab, counted from the moment admin approves/publishes it —
// NOT from match date, match start/end time, or any user's join time.
// Used by both the publishing side (Admin.jsx) and the reading side
// (CategoryPage.jsx) so the window can never drift out of sync between them.
export const RESULTS_VISIBLE_MS = 24 * 60 * 60 * 1000

// Concrete Timestamp exactly RESULTS_VISIBLE_MS from now. Must be a real
// Timestamp (not the serverTimestamp() sentinel) because Firestore queries
// need an actual value to compare against with `where('expiresAt', '>', ...)`.
export function computeExpiresAt() {
  return Timestamp.fromMillis(Date.now() + RESULTS_VISIBLE_MS)
}
