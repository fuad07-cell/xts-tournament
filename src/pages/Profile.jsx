import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore'
import { updateProfile as updateAuthProfile } from 'firebase/auth'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { UserAvatar, AvatarEditorModal, ensureDefaultAvatar } from '../components/AvatarSystem'

const DIAL_CODES = { bKash: '*247#', Nagad: '*167#', Rocket: '*322#' }

// ---------------------------------------------------------------------------
// Fixed App-Developer profile image. This is intentionally NOT part of the
// UserAvatar system — it's a single static asset for the "App Developer"
// modal, not per-user data. Drop the real photo at the path below (inside
// the project's /public folder) and it appears automatically, no code
// change needed. Until then a neutral placeholder (same size/border/glow)
// keeps the modal layout intact.
// ---------------------------------------------------------------------------
const DEVELOPER_IMAGE_PATH = '/developer-profile.png'
const DEVELOPER_TELEGRAM_LINK = 'https://t.me/Obit0_uchiha_8'

function DeveloperModal({ onClose }) {
  const { t } = useLanguage()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="dev-modal-overlay" onClick={onClose}>
      <div className="dev-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="dev-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="dev-modal-title">{t('appDeveloper')}</h2>
        <p className="dev-modal-message">{t('devInfo')}</p>

        <DeveloperProfileImage />

        <div className="dev-modal-role">{t('developerLabel') || 'DEVELOPER'}</div>
        <div className="dev-modal-name">Obito uchiha</div>

        <a
          className="dev-modal-telegram-btn"
          href={DEVELOPER_TELEGRAM_LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M21.5 3.5 2.7 10.9c-.9.36-.9 1.63.02 1.97l4.4 1.6 1.7 5.4c.24.76 1.23.97 1.77.37l2.5-2.75 4.6 3.4c.7.52 1.7.15 1.9-.7l3.6-16.1c.2-.9-.7-1.6-1.62-1.24Z" fill="#fff" />
          </svg>
          {t('devTelegramCta') || 'Send message on Telegram'}
        </a>
        <div className="dev-modal-handle">@Obit0_uchiha_8</div>

        <div className="sheet-row-static" style={{ marginTop: 20 }}><span>{t('appVersion')}</span><span>1.0.0</span></div>
       
      </div>

      <style>{`
        .dev-modal-overlay{
          position: fixed; inset: 0; z-index: 80;
          background: rgba(4,4,8,0.78);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: devOverlayFade .22s ease both;
        }
        .dev-modal-card{
          position: relative;
          width: 100%; max-width: 380px;
          background: linear-gradient(165deg, #0B0B10 0%, #120D1C 60%, #0B0B10 100%);
          border: 1px solid rgba(139,92,246,0.28);
          border-radius: 26px;
          padding: 30px 22px 24px;
          text-align: center;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 24px 60px -12px rgba(0,0,0,0.65),
            0 0 42px -10px rgba(139,92,246,0.4);
          animation: devCardIn .32s cubic-bezier(.2,.8,.2,1) both;
        }
        .dev-modal-close{
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: #C6CBD8; font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s, transform .15s;
        }
        .dev-modal-close:hover{ background: rgba(255,255,255,0.12); }
        .dev-modal-close:active{ transform: scale(0.92); }
        .dev-modal-title{
          font-family: 'Rajdhani', sans-serif;
          font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;
        }
        .dev-modal-message{
          font-size: 13px; line-height: 1.55; color: #9AA3B5;
          max-width: 300px; margin: 0 auto 18px;
        }
        .dev-modal-role{
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: #8892A6; margin-top: 16px; margin-bottom: 4px;
        }
        .dev-modal-name{
          font-size: clamp(16px, 5.5vw, 20px); font-weight: 800; color: #fff;
          margin-bottom: 20px; overflow-wrap: anywhere;
        }
        .dev-modal-telegram-btn{
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 14px 0; border-radius: 14px;
          background: linear-gradient(135deg, #1EA1E8, #229ED9);
          color: #fff; font-size: 14.5px; font-weight: 700;
          text-decoration: none;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08) inset,
            0 10px 26px -8px rgba(34,158,217,0.6),
            0 0 30px -8px rgba(255,255,255,0.25);
          transition: transform .15s ease, box-shadow .2s ease;
        }
        .dev-modal-telegram-btn:hover{
          transform: translateY(-1px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.12) inset,
            0 12px 30px -8px rgba(34,158,217,0.75),
            0 0 38px -6px rgba(255,255,255,0.35);
        }
        .dev-modal-telegram-btn:active{ transform: scale(0.97); }
        .dev-modal-handle{
          margin-top: 12px; font-size: 13px; font-weight: 600; color: #4FC3F7;
        }
        @keyframes devOverlayFade{ from{ opacity: 0; } to{ opacity: 1; } }
        @keyframes devCardIn{
          from{ opacity: 0; transform: scale(0.94) translateY(6px); }
          to{ opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

function DeveloperProfileImage() {
  const [failed, setFailed] = useState(false)
  return (
    <div className="dev-profile-img-wrap">
      {!failed ? (
        <img
          className="dev-profile-img"
          src={DEVELOPER_IMAGE_PATH}
          alt="App Developer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="dev-profile-img dev-profile-img-placeholder" role="img" aria-label="App Developer">
          <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <style>{`
        .dev-profile-img-wrap{
          width: 128px; height: 128px; max-width: 40vw; max-height: 40vw;
          margin: 16px auto 14px; border-radius: 22px; padding: 3px;
          background: linear-gradient(135deg, #4F46E5, #A855F7);
          animation: devImgGlow 2.6s ease-in-out infinite;
        }
        .dev-profile-img{
          width: 100%; height: 100%; display: block;
          border-radius: 19px; object-fit: cover; background: #14101f;
        }
        .dev-profile-img-placeholder{
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.32);
        }
        @keyframes devImgGlow{
          0%, 100% { box-shadow: 0 0 16px -2px rgba(139,92,246,0.55), 0 0 30px -8px rgba(79,70,229,0.4); }
          50%      { box-shadow: 0 0 24px 0px rgba(168,85,247,0.8), 0 0 42px -4px rgba(79,70,229,0.6); }
        }
      `}</style>
    </div>
  )
}

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
  avatarEditor: { g1: '#3B1768', g2: '#22D3EE', glow: 'rgba(34,211,238,0.5)', accent: '#DFFBFF' }, // violet-to-cyan avatar editor
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
  avatarEditor: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.1 0 1.85-.85 1.85-1.85 0-.5-.2-.9-.5-1.25-.3-.35-.5-.75-.5-1.25 0-1 .85-1.85 1.85-1.85h1.9a3.9 3.9 0 0 0 3.9-3.9c0-3.9-4.05-7.1-8.5-7.1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8.1" cy="10.3" r="1.15" fill="currentColor" />
      <circle cx="11.6" cy="7.6" r="1.15" fill="currentColor" />
      <circle cx="15.4" cy="9.2" r="1.15" fill="currentColor" />
      <circle cx="8.6" cy="14.6" r="1.15" fill="currentColor" />
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
  const { t } = useLanguage()

  // Every user must have an avatar. If this profile doesn't have one yet
  // (e.g. a pre-existing account from before this feature), silently assign
  // the default one — no photo fallback exists anymore.
  useEffect(() => {
    if (user && profile && !profile?.avatar?.customization) {
      ensureDefaultAvatar(user.uid, profile).then(refreshProfile)
    }
  }, [user, profile])

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
    { key: 'history', icon: '🕓', color: 'blue', title: t('transactionHistory'), sub: t('transactionHistorySub'), action: () => navigate('/transactions') },
    { key: 'edit', icon: '✎', color: 'purple', title: t('editProfile'), sub: t('editProfileSub'), action: () => setModal('edit') },
    { key: 'avatarEditor', icon: '🎮', color: 'purple', title: t('editAvatar') || 'Edit Avatar', sub: t('editAvatarSub') || 'Customize your gaming avatar', action: () => setModal('avatarEditor') },
    { key: 'invite', icon: '👥', color: 'green', title: t('inviteFriends'), sub: t('inviteFriendsSub'), action: () => navigate('/invite') },
    { key: 'leaderboard', icon: '🏆', color: 'orange', title: t('leaderboardMenu'), sub: t('leaderboardMenuSub'), action: () => navigate('/leaderboard') },
    { key: 'payment', icon: '💳', color: 'blue', title: t('paymentSettings'), sub: t('paymentSettingsSub'), action: () => setModal('payment'), adminOnly: true },
    { key: 'admin', icon: '🛠️', color: 'purple', title: t('adminPanel'), sub: t('adminPanelSub'), action: () => navigate('/admin'), adminOnly: true },
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
          ⚠️ {t('emailNotVerified')}
        </div>
      )}

      <div className="profile-head-v2">
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <UserAvatar
            user={profile}
            size="large"
            badge={
              <button
                className="avatar-badge"
                onClick={() => setModal('avatarEditor')}
                style={{ position: 'absolute', bottom: -2, right: -2, border: 'none', cursor: 'pointer' }}
                aria-label="Edit avatar"
              >
                ✎
              </button>
            }
          />
        </div>
        <div className="profile-name-v2">{profile?.username || t('user')}</div>
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
          <span className="amex-label">{t('wallet')}</span>
          <span className="amex-wifi">📶</span>
        </div>
        <div className="amex-chip">▤</div>
        <div className="amex-balance-label">{t('totalBalance')}</div>
        <div className="amex-balance">৳ {profile?.walletBalance ?? 0}</div>

        <div className="amex-mini-stats">
          <div className="amex-mini">
            <span className="amex-mini-icon">🏦</span>
            <div>
              <div className="amex-mini-label">{t('deposit')}</div>
              <div className="amex-mini-value">৳{profile?.depositBalance ?? 0}</div>
            </div>
          </div>
          <div className="amex-mini">
            <span className="amex-mini-icon">🏅</span>
            <div>
              <div className="amex-mini-label">{t('winning')}</div>
              <div className="amex-mini-value">৳{profile?.winningBalance ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="amex-bottom">
          <div>
            <div className="amex-holder-label">{t('cardHolder')}</div>
            <div className="amex-holder-name">{(profile?.username || t('user')).toUpperCase()}</div>
          </div>
          <span className="amex-chevron">›</span>
        </div>
      </div>
      </div>

      <div className="balance-actions">
        <button className="balance-btn-v2 add" onClick={() => setModal('add')}>
          <span className="balance-btn-icon">+</span>
          <span>{t('addMoney')}</span>
        </button>
        <button className="balance-btn-v2 withdraw" onClick={() => setModal('withdraw')}>
          <span className="balance-btn-icon">−</span>
          <span>{t('withdraw')}</span>
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
            <span className="menu-title">{t('theme')}</span>
            <span className="menu-sub">{t('themeSub')}</span>
          </span>
          <label className="switch">
            <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} />
            <span className="slider" />
          </label>
        </div>

        <button className="menu-item-v2" onClick={() => setModal('dev')}>
          <PremiumIcon variant="dev" />
          <span className="menu-text">
            <span className="menu-title">{t('appDeveloper')}</span>
            <span className="menu-sub">{t('appDeveloperSub')}</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2" onClick={() => setModal('language')}>
          <PremiumIcon variant="language" />
          <span className="menu-text">
            <span className="menu-title">{t('language')}</span>
            <span className="menu-sub">{t('languageSub')}</span>
          </span>
          <span className="chev">›</span>
        </button>

        <button className="menu-item-v2 danger" onClick={logout}>
          <PremiumIcon variant="logout" />
          <span className="menu-text">
            <span className="menu-title">{t('logout')}</span>
            <span className="menu-sub">{t('logoutSub')}</span>
          </span>
          <span className="chev">›</span>
        </button>
      </div>

      <div className="note">
        {t('walletNote')}
      </div>

      {modal === 'add' && <RequestModal type="add" onClose={() => setModal(null)} userId={user.uid} />}
      {modal === 'withdraw' && (
        <RequestModal type="withdraw" onClose={() => setModal(null)} userId={user.uid} maxAmount={profile?.winningBalance ?? 0} />
      )}
      {modal === 'dev' && <DeveloperModal onClose={() => setModal(null)} />}
      {modal === 'payment' && <PaymentSettingsModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditProfileModal onClose={() => setModal(null)} user={user} profile={profile} refreshProfile={refreshProfile} />}
      {modal === 'avatarEditor' && (
        <AvatarEditorModal onClose={() => setModal(null)} user={user} profile={profile} refreshProfile={refreshProfile} />
      )}
      {modal === 'language' && <LanguageModal onClose={() => setModal(null)} />}
    </div>
  )
}

function EditProfileModal({ onClose, user, profile, refreshProfile }) {
  const { showToast } = useToast()
  const { t } = useLanguage()
  const [username, setUsername] = useState(profile?.username || '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '')
  const [freeFireUID, setFreeFireUID] = useState(profile?.freeFireUID || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!username.trim()) return showToast('warning', t('nameRequired'))
    setBusy(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        freeFireUID: freeFireUID.trim(),
      })
      await updateAuthProfile(user, { displayName: username.trim() })
      await refreshProfile()
      showToast('success', t('profileUpdated'))
      onClose()
    } catch (err) {
      showToast('error', t('saveFailed'))
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
        <h2 style={{ margin: 0, fontSize: 20, color: '#fff' }}>{t('editProfileTitle')}</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <UserAvatar user={profile} size="large" />
      </div>

      <FieldLabel icon="👤" text={t('username')} />
      <DarkInput value={username} onChange={setUsername} placeholder={t('usernamePlaceholder')} />

      <FieldLabel icon="📞" text={t('phoneNumber')} />
      <DarkInput
        value={phoneNumber}
        onChange={(v) => setPhoneNumber(v.replace(/\D/g, '').slice(0, 11))}
        placeholder="01XXXXXXXXX"
        maxLength={11}
      />

      <FieldLabel icon="🎮" text={t('freeFireUid')} />
      <DarkInput value={freeFireUID} onChange={setFreeFireUID} placeholder="Your game UID" />

      <FieldLabel text={t('emailCannotChange')} />
      <DarkInput value={user?.email || ''} readOnly disabled />

      <button
        className="join-btn"
        onClick={save}
        disabled={busy}
        style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        💾 {busy ? t('saving') : t('saveChanges')}
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
  const { lang, switchLang, t } = useLanguage()

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>{t('language')}</h2>
        <div className="mode-toggle">
          <button type="button" className={'mode-btn' + (lang === 'bn' ? ' active' : '')} onClick={() => switchLang('bn')}>বাংলা</button>
          <button type="button" className={'mode-btn' + (lang === 'en' ? ' active' : '')} onClick={() => switchLang('en')}>English</button>
        </div>
      </div>
    </div>
  )
}

function RequestModal({ type, onClose, userId, maxAmount }) {
  const { user, resendVerificationEmail } = useAuth()
  const { showToast } = useToast()
  const { t } = useLanguage()
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
      return showToast('warning', t('withdrawEmailWarning'))
    }
    if (!amount || Number(amount) <= 0) return showToast('warning', t('amountLabel'))
    if (isWithdraw && Number(amount) < 110) return showToast('warning', t('minimumWithdrawWarning'))
    if (isWithdraw && Number(amount) > maxAmount) return showToast('error', t('insufficientBalance'))
    if (isWithdraw && !account) return showToast('warning', t('giveTransactionId', { method }))
    if (!isWithdraw && !receiveNumber) return showToast('warning', t('noNumberSet'))
    if (!isWithdraw && !txnId) return showToast('warning', t('needTransactionId'))

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
      showToast('success', t('requestSubmitted'))
      onClose()
    } catch (err) {
      showToast('error', t('somethingWentWrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>{isWithdraw ? t('withdrawTitle') : t('addMoneyTitle')}</h2>
        <div className="meta">
          {isWithdraw ? t('withdrawDesc') : t('addMoneyDesc')}
        </div>

        {isWithdraw && user && !user.emailVerified && (
          <div
            style={{
              background: 'rgba(251, 191, 36, 0.12)', border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: '#fbbf24',
            }}
          >
            ⚠️ {t('emailVerifyWarning')}
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
              {resent ? '✅ ' + t('resent') : t('resendVerificationEmail')}
            </button>
          </div>
        )}

        <div className="field">
          <label>{t('method')}</label>
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
              <p>{t('dialOrOpen', { code: DIAL_CODES[method], method })}</p>
              <p>{t('tapSendMoney')}</p>
              <p>{t('enterReceiverNumber')}</p>
              <div className="pay-number-row">
                <span>{receiveNumber}</span>
                <button type="button" onClick={copyNumber}>{copied ? t('copied') : '⧉ Copy'}</button>
              </div>
              <p>{t('confirmPayment')}</p>
              <p>{t('enterTxnAndAmount')}</p>
            </div>
          ) : (
            <div className="note">{t('noNumberForMethod', { method })}</div>
          )
        )}

        <div className="field">
          <label>{t('amount')}</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isWithdraw ? t('minimumWithdraw') : '৳'} />
        </div>

        {isWithdraw && (
          <div className="field">
            <label>{t('accountNumber', { method })}</label>
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
            <label>{t('transactionId')}</label>
            <input type="text" value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="TXN..." />
          </div>
        )}

        <button className="join-btn" onClick={submit} disabled={busy}>
          {busy ? '...' : isWithdraw ? t('submitWithdrawal') : t('submitPayment')}
        </button>
      </div>
    </div>
  )
}

function PaymentSettingsModal({ onClose }) {
  const { showToast } = useToast()
  const { t } = useLanguage()
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
      showToast('error', t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="sheet sheet-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>{t('paymentSettingsTitle')}</h2>
        <div className="meta">{t('paymentSettingsDesc')}</div>

        {loading ? (
          <div className="meta">{t('loading')}</div>
        ) : (
          <>
            <div className="field">
              <label>{t('bkashNumber')}</label>
              <input type="text" placeholder="01XXXXXXXXX" value={bkash} onChange={(e) => setBkash(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('nagadNumber')}</label>
              <input type="text" placeholder="01XXXXXXXXX" value={nagad} onChange={(e) => setNagad(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('rocketNumber')}</label>
              <input type="text" placeholder="01XXXXXXXXX" value={rocket} onChange={(e) => setRocket(e.target.value)} />
            </div>
            <button className="join-btn" onClick={save} disabled={saving}>
              {saving ? '...' : saved ? t('saved') : t('save')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
