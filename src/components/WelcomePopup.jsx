import { useEffect, useState } from 'react'
import { TELEGRAM_SUPPORT_LINK } from '../constants/links'
import { useLanguage } from '../context/LanguageContext'

// Shows once per calendar day when the user lands on Home.
const SEEN_KEY = 'xts_welcome_seen_date'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function WelcomePopup() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  const RULE_KEYS = ['noticeItem1', 'noticeItem2', 'noticeItem3', 'noticeItem4', 'noticeItem5', 'noticeItem6']

  useEffect(() => {
    const lastSeen = localStorage.getItem(SEEN_KEY)
    if (lastSeen !== todayKey()) {
      setOpen(true)
      localStorage.setItem(SEEN_KEY, todayKey())
    }
  }, [])

  if (!open) return null

  return (
    <div
      className="overlay"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="sheet welcome-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', margin: 0, textAlign: 'left' }}
      >
        <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
        <h2 style={{ textAlign: 'center' }}>{t('welcomeTitle')}</h2>

        <div className="prize-list" style={{ marginTop: 14, marginBottom: 18 }}>
          {RULE_KEYS.map((key, i) => (
            <div className="prize-row" key={i} style={{ alignItems: 'flex-start' }}>
              <span className="prize-label">{t(key)}</span>
            </div>
          ))}
        </div>

        <a
          href={TELEGRAM_SUPPORT_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="join-btn welcome-cta"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
        >
          {t('joinTelegram')}
        </a>
        <button className="welcome-dismiss" onClick={() => setOpen(false)} style={{ marginTop: 10 }}>
          {t('understood')}
        </button>
      </div>
    </div>
  )
}
