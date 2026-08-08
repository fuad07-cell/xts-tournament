import { useState, useEffect } from 'react'
import { TELEGRAM_SUPPORT_LINK } from '../constants/links'
import './NoticeBoard.css'

const SKIP_TODAY_KEY = 'xts-notice-skip-date'
const CLOSE_ANIM_MS = 240

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export default function NoticeBoard() {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [skipToday, setSkipToday] = useState(false)

  const NOTICE_ITEMS = [
    '🆔 ম্যাচে জয়েন করার সময় আপনার Game ID-এর নাম ব্যবহার করুন।',
    '🎥 Replay Record ON রাখা বাধ্যতামূলক। অভিযোগ এলে Admin কে Replay Video জমা দিতে হবে Telegram সাপোর্টে।',
    '📖 ম্যাচে জয়েনের আগে Rules ভালোভাবে পড়ুন। Rules ভঙ্গ করলে Balance ০০ করা বা BAN করা হতে পারে।',
    '⏳ Withdraw সর্বোচ্চ ১২ ঘণ্টা ভিতরে পেয়ে যাবেন।',
    '💳 প্রতিদিন ১ বার Withdraw দিতে পারবেন।',
    '⚠️ যেকোনো সমস্যায় অবশ্যই Telegram সাপোর্টে মেসেজ দিবেন, নিচে ক্লিক করুন 👇',
  ]

  useEffect(() => {
    try {
      // "Skip for today" wins — survives refresh & browser restart.
      if (localStorage.getItem(SKIP_TODAY_KEY) === todayStr()) return
    } catch {}
    // No skip active → show every time the component mounts.
    setOpen(true)
  }, [])

  // Prevent background scrolling while open; always restore it.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  function requestClose() {
    setClosing(true)
    setTimeout(() => {
      if (skipToday) {
        try { localStorage.setItem(SKIP_TODAY_KEY, todayStr()) } catch {}
      }
      setOpen(false)
      setClosing(false)
    }, CLOSE_ANIM_MS)
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skipToday])

  if (!open) return null

  return (
    <div
      className={'overlay overlay-center notice-board-overlay' + (closing ? ' overlay-closing' : '')}
      onClick={requestClose}
    >
      <div
        className={'notice-board' + (closing ? ' notice-board-closing' : ' notice-board-opening')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notice-board-header">
          <span className="notice-board-header-icon">ℹ️</span>
          <span className="notice-board-header-title">নোটিশ</span>
          <button className="notice-board-close" onClick={requestClose}>✕</button>
        </div>

        <div className="notice-board-body">
          <h2 className="notice-board-heading">
            XTS TOUR BD – গুরুত্বপূর্ণ নিয়মাবলী 👇
          </h2>

          <ul className="notice-board-list">
            {NOTICE_ITEMS.map((text, i) => (
              <li key={i} className="notice-board-item">{text}</li>
            ))}
          </ul>

          <a
            href={TELEGRAM_SUPPORT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-board-cta"
          >
            Telegram চ্যানেলে জয়েন করুন
          </a>

          <label className="notice-board-skip">
            <input
              type="checkbox"
              checked={skipToday}
              onChange={(e) => setSkipToday(e.target.checked)}
            />
            <span>আজকের জন্য স্কিপ করুন</span>
          </label>
        </div>
      </div>
    </div>
  )
}