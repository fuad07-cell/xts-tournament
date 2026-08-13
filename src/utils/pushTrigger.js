import { auth } from '../firebase'

// Deliberately minimal: the backend re-reads the notification doc(s) from
// Firestore itself (via the Admin SDK) using only the id(s) we send here —
// it does NOT trust title/body/userId from the client. That keeps a
// malicious/buggy client from forging arbitrary push content or targets;
// the actual authorization already happened when the notification doc was
// allowed to be written (see firestore.rules).
const PUSH_API_URL = import.meta.env.VITE_PUSH_API_URL // e.g. https://your-project.vercel.app

export async function triggerPush(notificationIds) {
  const ids = (Array.isArray(notificationIds) ? notificationIds : [notificationIds]).filter(Boolean)
  if (!ids.length || !PUSH_API_URL || !auth.currentUser) return
  try {
    const idToken = await auth.currentUser.getIdToken()
    // Best-effort, fire-and-forget — a push failing to send must never
    // block or fail the caller (the Firestore notification doc already
    // exists and shows in the in-app bell regardless).
    fetch(`${PUSH_API_URL}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ notificationIds: ids }),
    }).catch((err) => console.warn('push trigger failed (non-blocking):', err))
  } catch (err) {
    console.warn('push trigger failed (non-blocking):', err)
  }
}
