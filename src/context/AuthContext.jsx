import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendEmailVerification,
} from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const AuthContext = createContext(null)

// The one "main admin" — hardcoded, not stored in Firestore, so nobody
// (not even the main admin by accident, and not any secondary admin) can
// ever remove this access through the app UI. The main admin is the only
// one who can grant/revoke the `isAdmin` flag on other users' documents
// (see the Users panel in Admin.jsx). Secondary admins get the exact same
// admin panel access, just not the ability to manage other admins or
// touch this account.
export const MAIN_ADMIN_UID = '8mrEPqRJyHSvZMGzgAWgpbKlWP33'

// Same referral code shape already shown on the Profile page
// ('XTS-' + first 6 chars of the uid, uppercased), now also persisted on
// the user's own document at creation time so it can be looked up by code.
function makeReferralCode(uid) {
  return 'XTS-' + uid.slice(0, 6).toUpperCase()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Set whenever an admin has suspended this account — either discovered at
  // login, or live while the person is already using the app. The login /
  // profile screen can read this to show a message, then call
  // clearSuspendedInfo() once it's been shown.
  const [suspendedInfo, setSuspendedInfo] = useState(null)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      // Tear down any previous per-user profile listener first.
      if (unsubProfile) {
        unsubProfile()
        unsubProfile = null
      }

      if (!fbUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      await ensureUserDoc(fbUser)

      // Live-listen to this user's own doc (not just a one-off getDoc) so
      // that if an admin suspends the account *while it's in use*, we catch
      // it on the next snapshot and sign the person out immediately —
      // instead of only checking at login time.
      unsubProfile = onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snap) => {
          if (!snap.exists()) {
            setLoading(false)
            return
          }
          const data = snap.data()
          if (data.suspended) {
            setSuspendedInfo({ reason: data.suspendReason || null })
            setUser(null)
            setProfile(null)
            setLoading(false)
            signOut(auth) // triggers onAuthStateChanged again with fbUser = null
            return
          }
          setUser(fbUser)
          setProfile({ id: snap.id, ...data })
          setLoading(false)
        },
        () => setLoading(false)
      )
    })

    return () => {
      unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  function clearSuspendedInfo() {
    setSuspendedInfo(null)
  }

  // isMainAdmin: the one hardcoded super-admin (see MAIN_ADMIN_UID above).
  // isAdmin: main admin OR anyone the main admin has granted admin access
  // to via the `isAdmin: true` flag on their user document.
  const isMainAdmin = !!user && user.uid === MAIN_ADMIN_UID
  const isAdmin = isMainAdmin || profile?.isAdmin === true

  // Looks up which user owns a given referral code. Returns their uid, or
  // null if the code doesn't match anyone (including an empty/blank code).
  async function findReferrerUid(referralCodeInput) {
    const code = (referralCodeInput || '').trim().toUpperCase()
    if (!code) return null
    const q = query(collection(db, 'users'), where('referralCode', '==', code), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    return snap.docs[0].id
  }

  // Only used for the Google sign-in path — creates the user doc the first
  // time someone signs in with Google. `referralCode` is only meaningful
  // the very first time (i.e. this really is a brand-new account); it's
  // ignored on every later login since the doc already exists.
  async function ensureUserDoc(fbUser, referralCode) {
    const ref = doc(db, 'users', fbUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      const referredBy = await findReferrerUid(referralCode)
      await setDoc(ref, {
        username: fbUser.displayName || fbUser.email.split('@')[0],
        email: fbUser.email,
        walletBalance: 0,
        depositBalance: 0,
        winningBalance: 0,
        wins: 0,
        matchesPlayed: 0,
        referralCode: makeReferralCode(fbUser.uid),
        referredBy,
        referralBonusPaid: false, // flips true once the referrer has been paid their ৳5 — see useJoinMatch.js (fires on this user's first completed booking)
        createdAt: serverTimestamp(),
      })
    }
  }

  async function loadProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) setProfile({ id: snap.id, ...snap.data() })
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.uid)
  }

  async function registerWithEmail(username, email, password, referralCode) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: username })
    await sendEmailVerification(cred.user) // soft requirement — app usable either way, but Withdraw checks this later
    const referredBy = await findReferrerUid(referralCode)
    await setDoc(doc(db, 'users', cred.user.uid), {
      username,
      email,
      walletBalance: 0,
      depositBalance: 0,
      winningBalance: 0,
      wins: 0,
      matchesPlayed: 0,
      referralCode: makeReferralCode(cred.user.uid),
      referredBy,
      referralBonusPaid: false, // see useJoinMatch.js — fires on this user's first completed booking
      createdAt: serverTimestamp(),
    })
    return cred.user
  }

  // Lets the user request another verification email (e.g. from a "resend"
  // link on the reminder banner) without having to log out and back in.
  async function resendVerificationEmail() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser)
  }

  async function loginWithEmail(email, password) {
    setSuspendedInfo(null)
    return signInWithEmailAndPassword(auth, email, password)
  }

  // `referralCode` only matters if this Google sign-in turns out to be a
  // brand-new account (see ensureUserDoc above) — harmless to pass on a
  // normal login.
  async function loginWithGoogle(referralCode) {
    setSuspendedInfo(null)
    const cred = await signInWithPopup(auth, googleProvider)
    await ensureUserDoc(cred.user, referralCode)
    return cred
  }

  async function logout() {
    return signOut(auth)
  }

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    isMainAdmin,
    suspendedInfo,
    clearSuspendedInfo,
    refreshProfile,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    logout,
    resendVerificationEmail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
