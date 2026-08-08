import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore'
import { updateProfile as updateAuthProfile } from 'firebase/auth'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'

const DIAL_CODES = { bKash: '*247#', Nagad: '*167#', Rocket: '*322#' }

// ---------------------------------------------------------------------------
// Premium menu icon system — original, hand-drawn line icons (no icon
// library, no emoji), each with its own gradient theme, glass layer, inner
// highlight, breathing glow, floating motion and a hover shine sweep.
// ---------------------------------------------------------------------------

const ICON_THEME = {
  history:     { g1: '#123A57', g2: '#19A7E0', glow: 'rgba(25,167,224,0.5)',  accent: '#CFF3FF' }, // luxury fintech blue
  edit:        { g1: '#3B1768', g2: '#A855F7', glow: 'rgba(168,85,247,0.5)', accent: '#F1E4FF' }, // elegant violet
  invite:      { g1: '#054C3E', g2: '#22C08C', glow: 'rgba(34,192,140,0.5)', accent: '#D6FBEC' }, // friendly emerald
  leaderboard: { g1: '#6B2A05', g2: '#F5A524', glow: 'rgba(245,165,36,0.55)',accent: '#FFEBC2' }, // premium gold trophy
  payment:     { g1: '#0B3B4C', g2: '#22B8CF', glow: 'rgba(34,184,207,0.5)', accent: '#D2F6FC' }, // cyan settings
  admin:       { g1: '#241B5E', g2: '#6C63FF', glow: 'rgba(108,99,255,0.5)',accent: '#E1DFFF' }, // deep indigo shield
  theme:       { g1: '#161244', g2: '#7C89F2', glow: 'rgba(124,137,242,0.5)',accent: '#E5E8FF' }, // midnight moon
  dev:         { g1: '#4A0F63', g2: '#E64FD9', glow: 'rgba(230,79,217,0.5)',accent: '#FBDCFA' }, // futuristic magenta
  language:    { g1: '#0B3D3A', g2: '#2CD9C5', glow: 'rgba(44,217,197,0.5)',accent: '#CFFBF5' }, // elegant globe teal
  logout:      { g1: '#5B0F17', g2: '#F4405C', glow: 'rgba(244,64,92,0.55)',accent: '#FFD9DF' }, // premium power red
}

const ICON_SVG = {
  history: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10.2h4.2l1.6-3.1 2.1 6.3 1.6-3.2h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.6" cy="14.6" r="1.35" fill="currentColor" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2.8" y="5" width="13.6" height="10.4" rx="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.3" cy="9.2" r="1.45" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.1 12.7c.5-1.5 1.65-2.15 2.2-2.15s1.7.65 2.2 2.15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.7 8.8h1.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M17.6 12.1l3.05-3.05a1.28 1.28 0 0 1 1.8 1.8l-3.05 3.05-2.1.65.3-2.45z" fill="currentColor" />
    </svg>
  ),
  invite: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="8.6" cy="8.6" r="2.55" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.6 18c.6-3 2.55-4.35 5-4.35s4.4 1.35 5 4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.1" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.35" opacity="0.85" />
      <path d="M18.6 4.2l.62 1.3 1.3.6-1.3.6-.62 1.3-.6-1.3-1.3-.6 1.3-.6.6-1.3z" fill="currentColor" />
    </svg>
  ),
  leaderboard: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13.2" width="4.4" height="6.8" rx="1" stroke="currentColor" strokeWidth="1.55" />
      <rect x="9.8" y="8.4" width="4.4" height="11.6" rx="1" stroke="currentColor" strokeWidth="1.55" />
      <rect x="16.6" y="10.9" width="4.4" height="9.1" rx="1" stroke="currentColor" strokeWidth="1.55" />
      <path d="M12 3.2l.95 1.95 2.15.3-1.55 1.55.37 2.15-1.92-1.02-1.92 1.02.37-2.15-1.55-1.55 2.15-.3.95-1.95z" fill="currentColor" />
    </svg>
  ),
  payment: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2.4" y="6.1" width="13.6" height="9.8" rx="2.2" stroke="currentColor" strokeWidth="1.55" />
      <path d="M2.4 9.5h13.6" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="18.1" cy="16.1" r="3.1" stroke="currentColor" strokeWidth="1.45" />
      <path d="M18.1 14.2v.5M18.1 17.6v.5M16.2 16.1h.5M19.6 16.1h.5M16.85 14.85l.35.35M19.1 17.1l.35.35M19.35 14.85l-.35.35M17.2 17.1l-.35.35" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.3l6.8 2.45v5.05c0 4.5-2.9 7.7-6.8 9.1-3.9-1.4-6.8-4.6-6.8-9.1V5.75L12 3.3z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M8.9 12l2 2 4.1-4.5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  theme: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M16.6 13.7A6.75 6.75 0 1 1 10.3 4.4a5.35 5.35 0 0 0 6.3 9.3z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M18.55 5.1l.55 1.15 1.15.55-1.15.55-.55 1.15-.55-1.15-1.15-.55 1.15-.55.55-1.15z" fill="currentColor" />
    </svg>
  ),
  dev: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M8.6 6.6L3.9 12l4.7 5.4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.4 6.6l4.7 5.4-4.7 5.4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    </svg>
  ),
  language: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7.9" stroke="currentColor" strokeWidth="1.55" />
      <path d="M4.1 12h15.8M12 4.1c2.35 2.2 3.55 5 3.55 7.9s-1.2 5.7-3.55 7.9c-2.35-2.2-3.55-5-3.55-7.9S9.65 6.3 12 4.1z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 4.2v6.9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.55 6.35a6.85 6.85 0 1 0 8.9 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
}

function PremiumIcon({ variant }) {
  const t = ICON_THEME[variant] || ICON_THEME.history
  return (
    <span
      className={'picon picon-' + variant}
      style={{ '--g1': t.g1, '--g2': t.g2, '--glow': t.glow, '--accent': t.accent }}
    >
      <span className="picon-float">
        <span className="picon-glass" aria-hidden="true" />
        <span className="picon-shine" aria-hidden="true" />
        <span className="picon-svg">{ICON_SVG[variant] || ICON_SVG.history}</span>
      </span>
    </span>
  )
}

function PremiumIconStyles() {
  return (
    <style>{`
      .picon {
        position: relative;
        width: 46px;
        height: 46px;
        min-width: 46px;
        border-radius: 15px;
        flex-shrink: 0;
        overflow: hidden;
        background: linear-gradient(150deg, var(--g1) 0%, var(--g2) 100%);
        box-shadow:
          0 8px 16px -6px var(--glow),
          0 2px 5px rgba(0,0,0,0.28),
          inset 0 1px 1px rgba(255,255,255,0.4),
          inset 0 -8px 12px rgba(0,0,0,0.22);
        animation: picon-breathe 3.4s ease-in-out infinite;
        transition: transform .4s cubic-bezier(.22,.9,.32,1.2), box-shadow .4s ease;
      }
      .menu-item-v2:hover .picon,
      .picon:hover {
        transform: scale(1.09) translateY(-2px);
        box-shadow:
          0 12px 22px -6px var(--glow),
          0 3px 7px rgba(0,0,0,0.3),
          inset 0 1px 1px rgba(255,255,255,0.48),
          inset 0 -8px 12px rgba(0,0,0,0.2);
      }
      .picon-float {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: picon-drift 4.6s ease-in-out infinite;
      }
      .picon-glass {
        position: absolute;
        inset: 0;
        background: linear-gradient(165deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.06) 38%, rgba(255,255,255,0) 60%);
        mix-blend-mode: overlay;
        pointer-events: none;
      }
      .picon-glass::after {
        content: '';
        position: absolute;
        top: 3px; left: 4px; right: 4px;
        height: 45%;
        border-radius: 999px 999px 60% 60% / 100% 100% 30% 30%;
        background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0));
        opacity: 0.55;
      }
      .picon-shine {
        position: absolute;
        top: -60%;
        left: -70%;
        width: 45%;
        height: 220%;
        background: linear-gradient(115deg, transparent, rgba(255,255,255,0.65), transparent);
        transform: rotate(18deg) translateX(-140%);
        pointer-events: none;
      }
      .menu-item-v2:hover .picon-shine,
      .picon:hover .picon-shine {
        animation: picon-sweep 1.1s ease forwards;
      }
      .picon-svg {
        position: relative;
        z-index: 2;
        width: 22px;
        height: 22px;
        color: var(--accent, #fff);
        filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.4));
      }
      .picon-svg svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      @keyframes picon-drift {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2.5px); }
      }
      @keyframes picon-breathe {
        0%, 100% { filter: brightness(1) saturate(1); }
        50% { filter: brightness(1.14) saturate(1.08); }
      }
      @keyframes picon-sweep {
        from { transform: rotate(18deg) translateX(-140%); }
        to   { transform: rotate(18deg) translateX(260%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .picon, .picon-float { animation: none; }
      }
    `}</style>
  )
}

export default function Profile() {
  const { user, profile, logout, refreshProfile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('xts-theme') || 'dark')
  const [emailCopied, setEmailCopied] = useState(false)

  // Wallet card premium interaction: cursor-reactive spotlight + 3D tilt.
  // Writes CSS custom properties directly via ref (no React re-render on every
  // mousemove), and only ever touches transform/opacity-driven values.
  const amexRef = useRef(null)
  function handleAmexMove(e) {
    const el = amexRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * 100
    const py = ((e.clientY - r.top) / r.height) * 100
    const rotateY = ((px - 50) / 50) * 6
    const rotateX = ((py - 50) / 50) * -6
    el.style.setProperty('--mx', px + '%')
    el.style.setProperty('--my', py + '%')
    el.style.setProperty('--rx', rotateY + 'deg')
    el.style.setProperty('--ry', rotateX + 'deg')
    el.style.setProperty('--spot', '1')
  }
  function handleAmexLeave() {
    const el = amexRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--spot', '0')
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('xts-theme', next)
  }

  function copyEmail() {
    navigator.clipboard.writeText(user?.email || '')
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 1500)
  }

  const menuItems = [
    { key: 'history', icon: '🕓', color: 'blue', title: 'Transaction History', sub: 'View your wallet credits and debits.', action: () => navigate('/transactions') },
    { key: 'edit', icon: '✎', color: 'purple', title: 'Edit Profile', sub: 'Keep your account accurate and verified.', action: () => setModal('edit') },
    { key: 'invite', icon: '👥', color: 'green', title: 'Invite Friends', sub: 'Earn ৳5 for each invite.', action: () => navigate('/invite') },
    { key: 'leaderboard', icon: '🏆', color: 'orange', title: 'Leaderboard', sub: 'Track your progress for each goals.', action: () => navigate('/leaderboard') },
    { key: 'payment', icon: '💳', color: 'blue', title: 'Payment Settings', sub: 'bKash/Nagad/Rocket receiving number.', action: () => setModal('payment'), adminOnly: true },
    { key: 'admin', icon: '🛠️', color: 'purple', title: 'Admin Panel', sub: 'Manage wallet, matches & results.', action: () => navigate('/admin'), adminOnly: true },
  ]

  return (
    <div className="screen page-fade-in">
      <PremiumIconStyles />
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

      <div className="amex-card-float">
      <div
        className="amex-card"
        ref={amexRef}
        onMouseMove={handleAmexMove}
        onMouseLeave={handleAmexLeave}
      >
        <div className="amex-sheen" aria-hidden="true" />
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
            <PremiumIcon variant={m.key} />
            <span className="menu-text">
              <span className="menu-title">{m.title}</span>
              <span className="menu-sub">{m.sub}</span>
            </span>
            <span className="chev">›</span>
          </button>
        ))}

        <div className="menu-item-v2" style={{ cursor: 'default' }}>
          <PremiumIcon variant="theme" />
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
          <PremiumIcon variant="dev" />
          <span className="menu-text">
            <span className="menu-title">App Developer</span>
            <span className="menu-sub">View developer info</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2" onClick={() => setModal('language')}>
          <PremiumIcon variant="language" />
          <span className="menu-text">
            <span className="menu-title">Language</span>
            <span className="menu-sub">English / বাংলা</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2 danger" onClick={logout}>
          <PremiumIcon variant="logout" />
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
