import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../firebase'
import { useToast } from '../components/ToastContext'

// Median (native APK wrapper) app-e amader website eta userAgent-e "median" add kore diye
// pathay — eta diye bujha jay browser-e naki app-er vitor thakay
const isMedianApp = () =>
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('median') >= 0

// App-er vitor thakle Median-er native Google Sign-In plugin call kori (browser-e na jeye
// full native account-picker dekhay), pawa ID token diye shorasori Firebase-e login kori
function loginWithGoogleNative() {
  return new Promise((resolve, reject) => {
    if (!window.median?.socialLogin?.google?.login) {
      reject(new Error('native-google-unavailable'))
      return
    }
    window.median.socialLogin.google.login({
      callback: async (response) => {
        try {
          if (response?.error) {
            reject(new Error(response.error))
            return
          }
          const credential = GoogleAuthProvider.credential(response.idToken)
          await signInWithCredential(auth, credential)
          resolve()
        } catch (err) {
          reject(err)
        }
      },
    })
  })
}

export default function Auth() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState('register') // 'register' | 'login'
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  const { showToast } = useToast()
  const { registerWithEmail, loginWithEmail, loginWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()

  const isRegister = mode === 'register'

  async function handleGoogle() {
    setBusy(true)
    try {
      if (isMedianApp()) {
        await loginWithGoogleNative()
      } else {
        await loginWithGoogle()
      }
      navigate('/')
    } catch (err) {
      showToast('error', friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (isRegister) {
      if (!username || !email || !password || !confirm) {
        showToast('warning', 'সব ঘর পূরণ করুন')
        return
      }
      if (password !== confirm) {
        showToast('warning', 'Password ও Confirm Password মিলছে না')
        return
      }
      if (password.length < 6) {
        showToast('warning', 'Password কমপক্ষে ৬ ক্যারেক্টার হতে হবে')
        return
      }
    }

    setBusy(true)
    try {
      if (isRegister) {
        await registerWithEmail(username, email, password, referralCode)
      } else {
        await loginWithEmail(email, password)
      }
      navigate('/')
    } catch (err) {
      showToast('error', friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      showToast('warning', 'আগে উপরে Email লিখুন, তারপর Forgot password চাপুন')
      return
    }
    setBusy(true)
    try {
      await resetPassword(email)
      showToast('success', 'Password reset লিংক আপনার ইমেইলে পাঠানো হয়েছে ✓')
    } catch (err) {
      showToast('error', friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div className="auth-topbar-logo">
          <span className="bracket">XTS</span> TOUR BD
        </div>
        <div className="auth-topbar-actions">
          <button
            className={'auth-nav-btn' + (!isRegister ? ' active-mode' : '')}
            onClick={() => setMode('login')}
          >
            LOGIN
          </button>
          <button className="auth-nav-btn pill" onClick={() => setMode('register')}>
            REGISTER
          </button>
        </div>
      </div>

      <div className="auth-wrap">
      <div className="auth-brand">
        <div className="auth-logo">
          <span className="auth-logo-icon">⚔️</span>
          <span><span className="bracket">XTS</span> TOUR BD</span>
        </div>
        <div className="auth-tagline">ENTER THE ARENA</div>
      </div>

      <div className="auth-card">
        <div className="mode-head">
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isRegister
              ? 'Register to join tournaments and track your winnings'
              : 'Login to continue to your dashboard'}
          </p>
        </div>

        <button className="google-btn" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon />
          {isRegister ? 'SIGN UP WITH GOOGLE' : 'CONTINUE WITH GOOGLE'}
        </button>

        <div className="divider">{isRegister ? 'OR REGISTER MANUALLY' : 'OR LOGIN MANUALLY'}</div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                placeholder="GamerTag"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="eye" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? '🙈' : '👁'}
              </span>
            </div>
          </div>

          {isRegister && (
            <div className="field">
              <label>Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {isRegister && (
            <div className="field">
              <label>🎁 Referral / Promo Code <span className="opt">(না দিলেও হবে)</span></label>
              <input
                type="text"
                placeholder="XTS-XXXXXX"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>
          )}

          {!isRegister && (
            <div className="forgot-row">
              <button type="button" className="link-btn-inline" onClick={handleForgotPassword} disabled={busy}>
                Forgot password?
              </button>
            </div>
          )}

          <button className="submit-btn" type="submit" disabled={busy}>
            {busy ? '...' : isRegister ? 'REGISTER' : 'LOGIN'}
          </button>
        </form>

        <div className="switch-line">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')}>Login</button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('register')}>Register</button>
            </>
          )}
        </div>

        <div className="auth-footer">Secured by <span className="bracket">XTS</span> Tournament</div>
      </div>
      </div>
    </div>
  )
}

function friendlyError(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'এই Email দিয়ে আগে থেকেই একটা account আছে'
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Email অথবা Password ভুল'
  if (code.includes('user-not-found')) return 'এই Email দিয়ে কোনো account পাওয়া যায়নি'
  if (code.includes('popup-closed-by-user')) return 'Google login বাতিল করা হয়েছে'
  if (code.includes('invalid-email')) return 'সঠিক Email দিন'
  return 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন'
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 5 29.4 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.6 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 7 29.4 5 24 5c-7.4 0-13.8 4.1-17.7 9.7z" />
      <path fill="#4CAF50" d="M24 43c5.2 0 9.9-1.7 13.6-4.7l-6.3-5.3C29.2 34.7 26.7 35.5 24 35.5c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C10.1 38.8 16.6 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.6 4.8-4.9 6.3l6.3 5.3C39.9 37.6 43 31.4 43 24c0-1.4-.1-2.4-.4-3.5z" />
    </svg>
  )
}
