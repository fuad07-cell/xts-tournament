/* eslint-disable no-undef */
// FCM background handler. This is a SEPARATE service worker from the
// app's existing public/sw.js (PWA/offline caching) — it is registered
// explicitly by src/hooks/usePushNotifications.js with its own
// ServiceWorkerRegistration, which is passed into getToken()/onBackgroundMessage().
// This means it does NOT replace or interfere with the existing sw.js.
//
// NOTE: Service workers cannot read import.meta.env, so the Firebase config
// below must be filled in with the SAME (non-secret) values already in your
// .env — apiKey/appId/etc. are safe to ship to the client, that's expected
// for Firebase Web apps.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'REPLACE_WITH_VITE_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_VITE_FIREBASE_APP_ID',
})

const messaging = firebase.messaging()

// Background messages (tab not focused / app not open, but browser is
// running). This does NOT fire for foreground messages — those are handled
// in usePushNotifications.js via onMessage(), so we never double-show them.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'বিজ্ঞপ্তি'
  const body = payload.notification?.body || payload.data?.body || ''
  const notificationId = payload.data?.notificationId || ''
  const route = payload.data?.route || '/#/notifications'

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png', // adjust to your existing PWA icon path if different
    badge: '/icons/icon-192.png',
    data: { route, notificationId },
    tag: notificationId || undefined, // collapses duplicate re-sends of the same notification
  })
})

// Tap on a background notification -> focus an existing tab if one is
// open, otherwise open a new one, and navigate to the deep-linked route
// (HashRouter, e.g. "/#/transactions").
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = event.notification.data?.route || '/#/notifications'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', route })
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(route)
      }
    })
  )
})
