import { doc, setDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// One doc per device/browser under users/{uid}/fcmTokens/{tokenId}.
// tokenId is the token itself (web FCM token, or OneSignal subscription id
// for Android) — using it as the doc id makes re-registration an upsert
// instead of creating duplicates on every app open.
export async function saveDeviceToken(uid, tokenId, { platform, extra = {} }) {
  if (!uid || !tokenId) return
  const ref = doc(db, 'users', uid, 'fcmTokens', tokenId)
  await setDoc(
    ref,
    {
      token: tokenId,
      platform, // 'web' | 'android'
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // merge:true below means this only "wins" on first write
      active: true,
      ...extra,
    },
    { merge: true }
  )
}

export async function removeDeviceToken(uid, tokenId) {
  if (!uid || !tokenId) return
  try {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', tokenId))
  } catch (err) {
    console.warn('removeDeviceToken failed (non-blocking):', err)
  }
}

export async function listDeviceTokens(uid) {
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'fcmTokens'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
