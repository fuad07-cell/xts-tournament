import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Central place that describes every transaction "type" that can show up
// in a user's Transaction History. Keeping this in one file means the
// Admin panel and the Transaction History page always agree on labels,
// icons, colors and in/out direction.
export const TRANSACTION_TYPES = {
  deposit: { label: 'Add Money', icon: '🏦', color: 'mint', direction: 'in' },
  withdraw: { label: 'Withdraw', icon: '💸', color: 'red', direction: 'out' },
  entry_fee: { label: 'Entry Fee', icon: '🎮', color: 'red', direction: 'out' },
  refund: { label: 'Refund', icon: '↩️', color: 'mint', direction: 'in' },
  prize: { label: 'Prize', icon: '🏆', color: 'mint', direction: 'in' },
  checkin: { label: 'Check-in Bonus', icon: '✨', color: 'mint', direction: 'in' },
  adjustment: { label: 'Admin Adjustment', icon: '⚙️', color: 'red', direction: 'out' },
}

// Filter chips shown on the Transaction History page, in order.
// key: '' means "ALL".
export const HISTORY_FILTERS = [
  { key: '', label: 'ALL' },
  { key: 'deposit', label: 'DEPOSIT' },
  { key: 'withdraw', label: 'WITHDRAW' },
  { key: 'entry_fee', label: 'ENTRY FEE' },
  { key: 'refund', label: 'REFUND' },
  { key: 'prize', label: 'PRIZE' },
  { key: 'checkin', label: 'CHECK-IN' },
]

/**
 * Writes one row into the `transactions` collection. Call this any time
 * money actually moves for a user — deposit/withdraw approval, entry fee
 * charged on joining a match, prize payout, admin refund, admin balance
 * adjustment, daily check-in bonus, etc. — so the Transaction History page
 * has a single, real-time source of truth to read from.
 *
 * @param {string} userId
 * @param {{type: keyof TRANSACTION_TYPES, amount: number, title?: string, subtitle?: string, meta?: object}} data
 */
export async function logTransaction(userId, { type, amount, title, subtitle, meta }) {
  const def = TRANSACTION_TYPES[type]
  if (!def) throw new Error('Unknown transaction type: ' + type)

  await addDoc(collection(db, 'transactions'), {
    userId,
    type,
    direction: def.direction,
    amount: Number(amount) || 0,
    title: title || def.label,
    subtitle: subtitle || null,
    meta: meta || null,
    createdAt: serverTimestamp(),
  })
}
