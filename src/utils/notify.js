import { collection, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { triggerPush } from './pushTrigger'

// Single place that knows the `notifications` doc shape. Every admin
// action that should notify a user goes through this — keeps the schema
// consistent instead of writing the shape inline in three places.
//
// type: 'room_ready' | 'refund' | 'match_result' | 'match_cancelled' | 'match_reminder' | 'announcement'
export async function createNotification(userId, { type, title, body, data = {} }) {
  if (!userId) return
  try {
    const ref = await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    })
    triggerPush(ref.id) // fire-and-forget — see pushTrigger.js
  } catch (err) {
    // Best-effort — a notification failing to write must never block or
    // fail the admin action that triggered it (balance/result already
    // committed by that point).
    console.warn('notification create failed (non-blocking):', err)
  }
}

// Fan-out version — e.g. Room Ready needs to notify every joined player
// on a tournament at once. Uses a single batched write instead of N
// separate addDoc calls (fewer round-trips, all-or-nothing).
export async function createNotificationsBatch(userIds, { type, title, body, data = {} }) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return
  const batch = writeBatch(db)
  const notificationIds = []
  ids.forEach((userId) => {
    const ref = doc(collection(db, 'notifications'))
    notificationIds.push(ref.id)
    batch.set(ref, {
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: serverTimestamp(),
    })
  })
  try {
    await batch.commit()
    triggerPush(notificationIds) // fire-and-forget — see pushTrigger.js
  } catch (err) {
    console.warn('notification batch create failed (non-blocking):', err)
  }
}
