// Wraps the Median JavaScript Bridge (median-js-bridge npm package).
// Median.onReady() only ever fires when this code is actually running
// inside a Median-wrapped Android/iOS app — on a normal web browser it
// simply never calls back, which is exactly the behavior we want here
// (this file is a no-op on the web).
//
// docs: https://docs.median.co/docs/onesignal

import Median from 'median-js-bridge'

const READY_TIMEOUT_MS = 4000

function onMedianReady() {
  return new Promise((resolve) => {
    let settled = false
    Median.onReady(() => {
      if (settled) return
      settled = true
      resolve(true)
    })
    // Not inside Median (plain web) — Median.onReady never fires, so
    // don't hang forever.
    setTimeout(() => {
      if (settled) return
      settled = true
      resolve(false)
    }, READY_TIMEOUT_MS)
  })
}

// Associates this device's OneSignal subscription with the given Firebase
// UID (via OneSignal's user-centric `external_id`). After this call the
// backend can target the user directly with include_aliases.external_id —
// no token needs to be stored client-side for this to work, though we
// still record the OneSignal subscription id in Firestore for visibility
// (see usePushNotifications.js).
//
// Resolves to `{ subscribed: false }` immediately when not running inside
// the Median app. Never throws.
export async function loginMedianOneSignal(uid) {
  try {
    const isMedian = await onMedianReady()
    if (!isMedian) return { subscribed: false }

    const loginResult = await Median.onesignal.login(uid)
    if (!loginResult?.success) return { subscribed: false }

    const info = await Median.onesignal.info()
    return {
      subscribed: !!info?.isSubscribed,
      oneSignalUserId: info?.oneSignalUserId || null,
    }
  } catch (err) {
    console.warn('Median OneSignal login failed (non-blocking):', err)
    return { subscribed: false }
  }
}

// Call on logout so a shared/borrowed device stops being associated with
// the previous user's external_id.
export async function logoutMedianOneSignal() {
  try {
    const isMedian = await onMedianReady()
    if (!isMedian) return
    await Median.onesignal.logout()
  } catch (err) {
    console.warn('Median OneSignal logout failed (non-blocking):', err)
  }
}

export async function isMedianApp() {
  return onMedianReady()
}
