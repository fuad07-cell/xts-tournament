import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'
import { saveDeviceToken } from '../utils/pushTokens'
import { loginMedianOneSignal, isMedianApp } from '../utils/medianBridge'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// One hook, mounted once near the root (inside the Router so it can
// navigate). Handles BOTH platforms:
//  - Web browser  -> real FCM token, registered against its own
//    firebase-messaging-sw.js service worker.
//  - Median (Android APK) -> OneSignal external_id login, since Median
//    wraps OneSignal's native SDK rather than exposing raw FCM (see the
//    earlier conversation on why Median can't do this directly).
// Both paths converge on the same users/{uid}/fcmTokens/{tokenId} shape.
export function usePushNotifications() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const registeredForUid = useRef(null)

  // Register the right token(s) for the logged-in user. Runs once per
  // login (guarded by registeredForUid) — not on every render.
  useEffect(() => {
    if (!user || registeredForUid.current === user.uid) return
    registeredForUid.current = user.uid

    let cancelled = false

    async function registerWeb() {
      try {
        const messaging = await getMessagingInstance()
        if (!messaging || cancelled) return
        if (typeof Notification === 'undefined') return

        // Ask at a reasonable moment: only if the user hasn't already
        // answered, and only once they're logged in (not on the auth
        // screen). Never re-prompts if previously denied.
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission()
          if (perm !== 'granted') return
        }
        if (Notification.permission !== 'granted') return

        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
        if (!token || cancelled) return

        await saveDeviceToken(user.uid, token, {
          platform: 'web',
          extra: { userAgent: navigator.userAgent },
        })
      } catch (err) {
        console.warn('Web push registration failed (non-blocking):', err)
      }
    }

    async function registerAndroid() {
      try {
        const median = await isMedianApp()
        if (!median || cancelled) return
        const result = await loginMedianOneSignal(user.uid)
        if (result.subscribed && result.oneSignalUserId) {
          await saveDeviceToken(user.uid, result.oneSignalUserId, {
            platform: 'android',
            extra: { provider: 'onesignal' },
          })
        }
      } catch (err) {
        console.warn('Android push registration failed (non-blocking):', err)
      }
    }

    registerWeb()
    registerAndroid()

    return () => {
      cancelled = true
    }
  }, [user])

  // Foreground push (web tab open + focused): show it as an in-app toast
  // using the existing Toast system instead of a native OS notification,
  // and let tapping it navigate — mirrors what the background SW does for
  // notificationclick, kept in sync via the same `route` field.
  useEffect(() => {
    let unsub = null
    let cancelled = false

    ;(async () => {
      const messaging = await getMessagingInstance()
      if (!messaging || cancelled) return
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'বিজ্ঞপ্তি'
        const body = payload.notification?.body || payload.data?.body || ''
        const route = payload.data?.route
        showToast('info', body, {
          title,
          duration: 6000,
          onClick: route ? () => navigate(route) : undefined,
        })
      })
    })()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [showToast, navigate])

  // Tapping a BACKGROUND notification posts a message from
  // firebase-messaging-sw.js's notificationclick handler — pick it up
  // here and navigate inside the already-open (or newly focused) app.
  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === 'PUSH_NOTIFICATION_CLICK' && event.data.route) {
        // route arrives as e.g. "/#/transactions" (matches SW's openWindow
        // format) or "/transactions" — normalize to a router path.
        const path = event.data.route.replace(/^#/, '').replace(/^\/#/, '')
        navigate(path || '/notifications')
      }
    }
    navigator.serviceWorker?.addEventListener?.('message', handleMessage)
    return () => navigator.serviceWorker?.removeEventListener?.('message', handleMessage)
  }, [navigate])
}
