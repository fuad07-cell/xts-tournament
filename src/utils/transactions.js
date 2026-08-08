import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Central place that describes every transaction "type" that can show up
// in a user's Transaction History. Keeping this in one file means the
// Admin panel and the Transaction History page always agree on labels,
// icons, colors and in/out direction.
export const TRANSACTION_TYPES = {
  deposit: { labelKey: 'txDeposit', label: 'Add Money', icon: '🏦', color: 'mint', direction: 'in' },
  withdraw: { labelKey: 'txWithdraw', label: 'Withdraw', icon: '💸', color: 'red', direction: 'out' },
  entry_fee: { labelKey: 'txEntryFee', label: 'Entry Fee', icon: '🎮', color: 'red', direction: 'out' },
  refund: { labelKey: 'txRefund', label: 'Refund', icon: '↩️', color: 'mint', direction: 'in' },
  prize: { labelKey: 'txPrize', label: 'Prize', icon: '🏆', color: 'mint', direction: 'in' },
  checkin: { labelKey: 'txCheckin', label: 'Check-in Bonus', icon: '✨', color: 'mint', direction: 'in' },
  referral: { labelKey: 'txReferral', label: 'Referral Bonus', icon: '🎁', color: 'mint', direction: 'in' },
  adjustment: { labelKey: 'txAdjustment', label: 'Admin Adjustment', icon: '⚙️', color: 'red', direction: 'out' },
}

// Filter chips shown on the Transaction History page, in order.
// key: '' means "ALL". labelKey is looked up via useLanguage()'s t().
export const HISTORY_FILTERS = [
  { key: '', labelKey: 'filterAll' },
  { key: 'deposit', labelKey: 'filterDeposit' },
  { key: 'withdraw', labelKey: 'filterWithdraw' },
  { key: 'entry_fee', labelKey: 'filterEntryFee' },
  { key: 'refund', labelKey: 'filterRefund' },
  { key: 'prize', labelKey: 'filterPrize' },
  { key: 'checkin', labelKey: 'filterCheckin' },
  { key: 'referral', labelKey: 'filterReferral' },
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
