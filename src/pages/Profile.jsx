import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore'
import { updateProfile as updateAuthProfile } from 'firebase/auth'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'

const DIAL_CODES = { bKash: '*247#', Nagad: '*167#', Rocket: '*322#' }

export default function Profile() {
  const { user, profile, logout, refreshProfile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('xts-theme') || 'dark')
  const [copied, setCopied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  const referralCode = user ? 'XTS-' + user.uid.slice(0, 6).toUpperCase() : ''

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('xts-theme', next)
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function copyEmail() {
    navigator.clipboard.writeText(user?.email || '')
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 1500)
  }

  const menuItems = [
    { key: 'history', icon: '🕓', color: 'blue', title: 'Transaction History', sub: 'View your wallet credits and debits.', action: () => navigate('/transactions') },
    { key: 'edit', icon: '✎', color: 'purple', title: 'Edit Profile', sub: 'Keep your account accurate and verified.', action: () => setModal('edit') },
    { key: 'invite', icon: '👥', color: 'green', title: 'Invite Friends', sub: 'Earn ৳5 for each invite.', action: () => setModal('invite') },
    { key: 'leaderboard', icon: '🏆', color: 'orange', title: 'Leaderboard', sub: 'Track your progress for each goals.', action: () => navigate('/leaderboard') },
    { key: 'payment', icon: '💳', color: 'blue', title: 'Payment Settings', sub: 'bKash/Nagad/Rocket receiving number.', action: () => setModal('payment'), adminOnly: true },
    { key: 'admin', icon: '🛠️', color: 'purple', title: 'Admin Panel', sub: 'Manage wallet, matches & results.', action: () => navigate('/admin'), adminOnly: true },
  ]

  return (
    <div className="screen page-fade-in">
      {user && !user.emailVerified && user.providerData?.[0]?.providerId === 'password' && (
        <div
          style={{
            background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.35)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#fbbf24',
          }}
        >
          ⚠️ আপনার Email এখনো verify করা হয়নি — Withdraw করার আগে ইনবক্স চেক করে verify করে নিন।
        </div>
      )}

      <div className="profile-head-v2">
        <div className="avatar-ring">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="profile-avatar-v2"
              style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
            />
          ) : (
            <div className="profile-avatar-v2">{(profile?.username || 'X')[0].toUpperCase()}</div>
          )}
          <div className="avatar-badge">📷</div>
        </div>
        <div className="profile-name-v2">{profile?.username || 'ব্যবহারকারী'}</div>
        <div className="profile-email-row" onClick={copyEmail}>
          <span>✉️ {user?.email}</span>
          <span className="copy-mini">{emailCopied ? '✓' : '⧉'}</span>
        </div>
      </div>

      <div className="amex-card">
        <div className="amex-top">
          <span className="amex-label">WALLET</span>
          <span className="amex-wifi">📶</span>
        </div>
        <div className="amex-chip">▤</div>
        <div className="amex-balance-label">TOTAL BALANCE</div>
        <div className="amex-balance">৳ {profile?.walletBalance ?? 0}</div>

        <div className="amex-mini-stats">
          <div className="amex-mini">
            <span className="amex-mini-icon">🏦</span>
            <div>
              <div className="amex-mini-label">DEPOSIT</div>
              <div className="amex-mini-value">৳{profile?.depositBalance ?? 0}</div>
            </div>
          </div>
          <div className="amex-mini">
            <span className="amex-mini-icon">🏅</span>
            <div>
              <div className="amex-mini-label">WINNING</div>
              <div className="amex-mini-value">৳{profile?.winningBalance ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="amex-bottom">
          <div>
            <div className="amex-holder-label">CARD HOLDER</div>
            <div className="amex-holder-name">{(profile?.username || 'ব্যবহারকারী').toUpperCase()}</div>
          </div>
          <span className="amex-chevron">›</span>
        </div>
      </div>

      <div className="balance-actions">
        <button className="balance-btn-v2 add" onClick={() => setModal('add')}>
          <span className="balance-btn-icon">+</span>
          <span>Add Money</span>
        </button>
        <button className="balance-btn-v2 withdraw" onClick={() => setModal('withdraw')}>
          <span className="balance-btn-icon">−</span>
          <span>Withdraw</span>
        </button>
      </div>

      <div className="menu-list-v2">
        {menuItems.filter((m) => !m.adminOnly || isAdmin).map((m) => (
          <button key={m.key} className="menu-item-v2" onClick={m.action}>
            <span className={'menu-icon-box ' + m.color}>{m.icon}</span>
            <span className="menu-text">
              <span className="menu-title">{m.title}</span>
              <span className="menu-sub">{m.sub}</span>
            </span>
            <span className="chev">›</span>
          </button>
        ))}

        <div className="menu-item-v2" style={{ cursor: 'default' }}>
          <span className="menu-icon-box blue">🌓</span>
          <span className="menu-text">
            <span className="menu-title">Theme</span>
            <span className="menu-sub">Switch Light/Dark</span>
          </span>
          <label className="switch">
            <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} />
            <span className="slider" />
          </label>
        </div>

        <button className="menu-item-v2" onClick={() => setModal('dev')}>
          <span className="menu-icon-box purple">{'</>'}</span>
          <span className="menu-text">
            <span className="menu-title">App Developer</span>
            <span className="menu-sub">View developer info</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2" onClick={() => setModal('language')}>
          <span className="menu-icon-box green">🌐</span>
          <span className="menu-text">
            <span className="menu-title">Language</span>
            <span className="menu-sub">English / বাংলা</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2 danger" onClick={logout}>
          <span className="menu-icon-box red">⏻</span>
          <span className="menu-text">
            <span className="menu-title">Logout</span>
            <span className="menu-sub">Sign out of your account.</span>
          </span>
          <span className="chev">›</span>
        </button>
      </div>

      <div className="note">
        নিরাপত্তার জন্য Add Money ও Withdraw এখানে সরাসরি টাকা transfer করে না — এটা একটা request জমা দেয়, যেটা admin manually যাচাই করে balance আপডেট করবে। Withdraw শুধু Winning Balance থেকেই করা যাবে।
      </div>

      {modal === 'add' && <RequestModal type="add" onClose={() => setModal(null)} userId={user.uid} />}
      {modal === 'withdraw' && (
        <RequestModal type="withdraw" onClose={() => setModal(null)} userId={user.uid} maxAmount={profile?.winningBalance ?? 0} />
      )}
      {modal === 'invite' && (
        <div className="overlay overlay-center" onClick={() => setModal(null)}>
          <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setModal(null)}>✕</button>
            <h2>বন্ধুদের ইনভাইট করুন</h2>
            <div className="meta">প্রতিটা invite এ ৳5 আয় করুন (প্রথম বুকিং সম্পন্ন হলে)</div>
            <div className="field">
              <label>আপনার রেফারেল কোড</label>
              <input type="text" value={referralCode} readOnly />
            </div>
            <button className="join-btn" onClick={copyReferral}>{copied ? 'কপি হয়েছে ✓' : 'কোড কপি করুন'}</button>
            <div className="note" style={{ marginTop: 14 }}>
              এই মুহূর্তে কোড শেয়ার করা যায়, কিন্তু automatic reward crediting এখনো backend এ যুক্ত করা হয়নি।
            </div>
          </div>
        </div>
      )}
      {modal === 'dev' && (
        <div className="overlay overlay-center" onClick={() => setModal(null)}>
          <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setModal(null)}>✕</button>
            <h2>App Developer</h2>
            <div className="meta">XTS Tournament ডেভেলপ করা হয়েছে স্বাধীনভাবে।</div>
            <div className="sheet-row-static"><span>App Version</span><span>1.0.0</span></div>
            <div className="sheet-row-static"><span>Contact</span><span>crisleo692@gmail.com</span></div>
          </div>
        </div>
      )}
      {modal === 'payment' && <PaymentSettingsModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditProfileModal onClose={() => setModal(null)} user={user} profile={profile} refreshProfile={refreshProfile} />}
      {modal === 'language' && <LanguageModal onClose={() => setModal(null)} />}
    </div>
  )
}

function EditProfileModal({ onClose, user, profile, refreshProfile }) {
  const { showToast } = useToast()
  const [username, setUsername] = useState(profile?.username || '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '')
  const [freeFireUID, setFreeFireUID] = useState(profile?.freeFireUID || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!data.success) throw new Error()
      setAvatarUrl(data.data.url)
    } catch (err) {
      showToast('error', 'ছবি আপলোড করা যায়নি, আবার চেষ্টা করুন')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function save() {
    if (!username.trim()) return showToast('warning', 'নাম খালি রাখা যাবে না')
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        freeFireUID: freeFireUID.trim(),
        avatarUrl: avatarUrl || null,
      })
      await updateAuthProfile(user, { displayName: username.trim(), photoURL: avatarUrl || null })
      await refreshProfile()
      showToast('success', 'প্রোফাইল আপডেট হয়েছে')
      onClose()
    } catch (err) {
      showToast('error', 'সেভ করা যায়নি')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: '#0b0e14',
        overflowY: 'auto', padding: '18px 18px 40px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button
          onClick={onClose}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 18,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fff' }}>Edit Profile</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 96, height: 96, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 800, color: '#fff',
              }}
            >
              {(username || 'X')[0].toUpperCase()}
            </div>
          )}
          <label
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%',
              background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '3px solid #0b0e14', fontSize: 14,
            }}
          >
            {uploadingPhoto ? '…' : '📷'}
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      <FieldLabel icon="👤" text="USERNAME" />
      <DarkInput value={username} onChange={setUsername} placeholder="আপনার নাম" />

      <FieldLabel icon="📞" text="PHONE NUMBER" />
      <DarkInput
        value={phoneNumber}
        onChange={(v) => setPhoneNumber(v.replace(/\D/g, '').slice(0, 11))}
        placeholder="01XXXXXXXXX"
        maxLength={11}
      />

      <FieldLabel icon="🎮" text="FREE FIRE UID" />
      <DarkInput value={freeFireUID} onChange={setFreeFireUID} placeholder="Your game UID" />

      <FieldLabel text="EMAIL (CANNOT CHANGE)" />
      <DarkInput value={user?.email || ''} readOnly disabled />

      <button
        className="join-btn"
        onClick={save}
        disabled={busy}
        style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        💾 {busy ? 'সেভ হচ্ছে...' : 'SAVE CHANGES'}
      </button>
    </div>
  )
}

function FieldLabel({ icon, text }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#8b93a3', marginBottom: 6, marginTop: 18 }}>
      {icon ? `${icon} ` : ''}{text}
    </div>
  )
}

function DarkInput({ value, onChange, placeholder, readOnly, disabled, maxLength }) {
  return (
    <input
      type="text"
      inputMode={maxLength ? 'numeric' : undefined}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      maxLength={maxLength}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, padding: '13px 14px', color: disabled ? '#7c8291' : '#e6e9f0', fontSize: 14,
        boxSizing: 'border-box',
      }}
    />
  )
}

function LanguageModal({ onClose }) {
  const [lang, setLang] = useState(() => localStorage.getItem('xts-lang') || 'bn')

  function choose(l) {
    setLang(l)
    localStorage.setItem('xts-lang', l)
  }

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>Language</h2>
        <div className="mode-toggle">
          <button type="button" className={'mode-btn' + (lang === 'bn' ? ' active' : '')} onClick={() => choose('bn')}>বাংলা</button>
          <button type="button" className={'mode-btn' + (lang === 'en' ? ' active' : '')} onClick={() => choose('en')}>English</button>
        </div>
        <div className="note" style={{ marginTop: 14 }}>
          এই মুহূর্তে পুরো app-এর টেক্সট translate করা এখনো বাকি — শুধু preference সেভ হচ্ছে, পরে পুরোপুরি language switch যুক্ত করা যাবে।
        </div>
      </div>
    </div>
  )
}

function RequestModal({ type, onClose, userId, maxAmount }) {
  const { user, resendVerificationEmail } = useAuth()
  const { showToast } = useToast()
  const [method, setMethod] = useState('Rocket')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [txnId, setTxnId] = useState('')
  const [busy, setBusy] = useState(false)
  const [payNumbers, setPayNumbers] = useState(null)
  const [copied, setCopied] = useState(false)
  const [resent, setResent] = useState(false)
  const isWithdraw = type === 'withdraw'

  useEffect(() => {
    if (isWithdraw) return
    getDoc(doc(db, 'settings', 'payment')).then((snap) => {
      const d = snap.exists() ? snap.data() : {}
      setPayNumbers(d)
      if (d.bkash) setMethod('bKash')
      else if (d.nagad) setMethod('Nagad')
      else if (d.rocket) setMethod('Rocket')
    })
  }, [isWithdraw])

  const receiveNumber =
    payNumbers && (method === 'bKash' ? payNumbers.bkash : method === 'Nagad' ? payNumbers.nagad : payNumbers.rocket)

  function copyNumber() {
    navigator.clipboard.writeText(receiveNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submit() {
    if (isWithdraw && user && !user.emailVerified) {
      return showToast('warning', 'Withdraw করার আগে আপনার Email verify করতে হবে — ইনবক্স চেক করুন, অথবা নিচের "ভেরিফিকেশন ইমেইল আবার পাঠান" বাটনে চাপুন')
    }
    if (!amount || Number(amount) <= 0) return showToast('warning', 'সঠিক Amount দিন')
    if (isWithdraw && Number(amount) < 110) return showToast('warning', 'সর্বনিম্ন Withdraw ৳110')
    if (isWithdraw && Number(amount) > maxAmount) return showToast('error', 'আপনার Winning Balance এর চেয়ে বেশি withdraw করা যাবে না')
    if (isWithdraw && !account) return showToast('warning', `${method} Account Number দিন`)
    if (!isWithdraw && !receiveNumber) return showToast('warning', 'এই Method-এ কোনো নম্বর সেট করা নেই, অন্য method বেছে নিন')
    if (!isWithdraw && !txnId) return showToast('warning', 'Payment করার পর Transaction ID দিন')

    setBusy(true)
    try {
      await addDoc(collection(db, 'walletRequests'), {
        userId,
        type,
        method,
        amount: Number(amount),
        account: isWithdraw ? account : receiveNumber,
        txnId: txnId || null,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
      showToast('success', 'Request জমা হয়েছে। Admin verify করার পর balance আপডেট হবে।')
      onClose()
    } catch (err) {
      showToast('error', 'সমস্যা হয়েছে, আবার চেষ্টা করুন')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>{isWithdraw ? 'Withdraw' : 'Add Money'}</h2>
        <div className="meta">
          {isWithdraw ? 'Winning Balance থেকে Withdraw request দিন (fee 10%)' : 'Payment করে Transaction ID দিন, admin verify করবে'}
        </div>

        {isWithdraw && user && !user.emailVerified && (
          <div
            style={{
              background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: '#fbbf24',
            }}
          >
            ⚠️ Withdraw করার আগে Email verify করতে হবে। ইনবক্স (ও Spam ফোল্ডার) চেক করুন।
            <button
              type="button"
              onClick={async () => {
                await resendVerificationEmail()
                setResent(true)
              }}
              style={{
                display: 'block', marginTop: 8, background: 'none', border: 'none',
                color: '#fbbf24', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 13,
              }}
            >
              {resent ? '✅ আবার পাঠানো হয়েছে' : 'ভেরিফিকেশন ইমেইল আবার পাঠান'}
            </button>
          </div>
        )}

        <div className="field">
          <label>Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            style={{ width: '100%', background: 'var(--field)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, color: 'var(--text)' }}
          >
            <option>Rocket</option>
            <option>bKash</option>
            <option>Nagad</option>
          </select>
        </div>

        {!isWithdraw && payNumbers && (
          receiveNumber ? (
            <div className={'pay-instructions ' + method.toLowerCase()}>
              <p>{DIAL_CODES[method]} ডায়াল করুন অথবা {method} অ্যাপ খুলুন।</p>
              <p>"Send Money" অপশনে ট্যাপ করুন।</p>
              <p>নিচের নম্বরটি প্রাপক হিসেবে দিন।</p>
              <div className="pay-number-row">
                <span>{receiveNumber}</span>
                <button type="button" onClick={copyNumber}>{copied ? 'কপি হয়েছে ✓' : '⧉ Copy'}</button>
              </div>
              <p>পেমেন্ট নিশ্চিত করে সম্পন্ন করুন।</p>
              <p>নিচে শুধু Transaction ID লিখে Submit করুন — Amount নিজে লিখে দিন।</p>
            </div>
          ) : (
            <div className="note">এই মুহূর্তে {method}-এর নম্বর সেট করা নেই। অন্য method বেছে নিন, অথবা admin কে Payment Settings-এ নম্বর বসাতে বলুন।</div>
          )
        )}

        <div className="field">
          <label>Amount (৳)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isWithdraw ? 'Minimum ৳110' : '৳'} />
        </div>

        {isWithdraw && (
          <div className="field">
            <label>আপনার {method} নম্বর (যেখানে টাকা পাঠানো হবে)</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              inputMode="numeric"
            />
          </div>
        )}

        {!isWithdraw && (
          <div className="field">
            <label>Transaction ID</label>
            <input type="text" value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="TXN..." />
          </div>
        )}

        <button className="join-btn" onClick={submit} disabled={busy}>
          {busy ? '...' : isWithdraw ? 'SUBMIT WITHDRAWAL REQUEST' : 'SUBMIT PAYMENT'}
        </button>
      </div>
    </div>
  )
}

function PaymentSettingsModal({ onClose }) {
  const { showToast } = useToast()
  const [bkash, setBkash] = useState('')
  const [nagad, setNagad] = useState('')
  const [rocket, setRocket] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'settings', 'payment')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setBkash(d.bkash || '')
        setNagad(d.nagad || '')
        setRocket(d.rocket || '')
      }
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'payment'), { bkash, nagad, rocket })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      showToast('error', 'সেভ করা যায়নি')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>Payment Settings</h2>
        <div className="meta">Add Money screen-এ যেই নম্বর দেখানো হবে, সেগুলো এখানে বসান</div>

        {loading ? (
          <div className="meta">লোড হচ্ছে...</div>
        ) : (
          <>
            <div className="field">
              <label>bKash নম্বর (খালি রাখলে TopUp এ দেখাবে না)</label>
              <input type="text" placeholder="01XXXXXXXXX" value={bkash} onChange={(e) => setBkash(e.target.value)} />
            </div>
            <div className="field">
              <label>Nagad নম্বর</label>
              <input type="text" placeholder="01XXXXXXXXX" value={nagad} onChange={(e) => setNagad(e.target.value)} />
            </div>
            <div className="field">
              <label>Rocket নম্বর</label>
              <input type="text" placeholder="01XXXXXXXXX" value={rocket} onChange={(e) => setRocket(e.target.value)} />
            </div>
            <button className="join-btn" onClick={save} disabled={saving}>
              {saving ? '...' : saved ? 'সেভ হয়েছে ✓' : 'সেভ করুন'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
