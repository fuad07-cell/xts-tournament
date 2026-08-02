import { useEffect, useState } from 'react'
import { TELEGRAM_SUPPORT_LINK } from '../constants/links'

// Shows once per calendar day when the user lands on Home.
// Edit the RULES array below to change the notice text — one array item
// per bullet line, shown in order.
const RULES = [
  '🆔 ম্যাচে জয়েন করার সময় আপনার Game ID-এর নাম ব্যবহার করুন।',
  '🎥 Replay Record ON রাখা বাধ্যতামূলক। অভিযোগ এলে Admin কে Replay Video জমা দিতে হবে Telegram সাপোর্টে।',
  '📖 ম্যাচে জয়েনের আগে Rules ভালোভাবে পড়ুন। Rules ভঙ্গ করলে Balance ০০ করা বা BAN করা হতে পারে।',
  '⏳ Withdraw সর্বোচ্চ ১২ ঘণ্টা ভিতরে পেয়ে যাবেন।',
  '💳 প্রতিদিন ১ বার Withdraw দিতে পারবেন।',
  '⚠️ যেকোনো সমস্যায় অবশ্যই Telegram সাপোর্টে মেসেজ দিবেন, নিচে ক্লিক করুন 🫵',
]

const SEEN_KEY = 'xts_welcome_seen_date'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function WelcomePopup() {
  const [open, setOpen] = useState(false)

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
        <h2 style={{ textAlign: 'center' }}>📜 XTS TOUR BD – গুরুত্বপূর্ণ নিয়মাবলী 👇</h2>

        <div className="prize-list" style={{ marginTop: 14, marginBottom: 18 }}>
          {RULES.map((rule, i) => (
            <div className="prize-row" key={i} style={{ alignItems: 'flex-start' }}>
              <span className="prize-label">{rule}</span>
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
          📢 Telegram চ্যানেলে জয়েন করুন
        </a>
        <button className="welcome-dismiss" onClick={() => setOpen(false)} style={{ marginTop: 10 }}>
          বুঝেছি
        </button>
      </div>
    </div>
  )
}
