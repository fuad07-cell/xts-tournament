import { useEffect, useState } from 'react'
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const PAGE_LIMIT = 50 // "keep reads minimal" — one bounded listener, no pagination for now

// The ONE shared listener for a user's notifications. NotificationBell
// and the Notifications page both call this same hook, so there is
// exactly one onSnapshot listener active per logged-in user at a time.
export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_LIMIT)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { console.error('notifications fetch error:', err); setLoading(false) }
    )
    return unsub
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  async function markAsRead(id) {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true })
    } catch (err) {
      console.warn('mark as read failed:', err)
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.read)
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }))
    try {
      await batch.commit()
    } catch (err) {
      console.warn('mark all as read failed:', err)
    }
  }

  async function removeNotification(id) {
    try {
      await deleteDoc(doc(db, 'notifications', id))
    } catch (err) {
      console.warn('delete notification failed:', err)
    }
  }

  async function clearAll() {
    if (!notifications.length) return
    const batch = writeBatch(db)
    notifications.forEach((n) => batch.delete(doc(db, 'notifications', n.id)))
    try {
      await batch.commit()
    } catch (err) {
      console.warn('clear all failed:', err)
    }
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification, clearAll }
}
