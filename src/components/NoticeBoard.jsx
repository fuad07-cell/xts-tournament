import { useState, useEffect } from 'react'
import { TELEGRAM_SUPPORT_LINK } from '../constants/links'

// এখানে আপনার নিজের নোটিশ/নিয়মগুলো লিখুন। যত খুশি item যোগ/বাদ দিতে পারেন —
// প্রতিটা লাইন আলাদা করে quote ('...') এর ভেতরে, আর শেষে কমা (,) দিয়ে।
const NOTICES = [
  '🆔 ম্যাচে জয়েন করার সময় আপনার Game ID-এর নাম ব্যবহার করুন।',
  '🎥 Replay Record ON রাখা বাধ্যতামূলক। অভিযোগ এলে Admin কে Replay Video জমা দিতে হবে Telegram সাপোর্টে।',
  '📖 ম্যাচে জয়েনের আগে Rules ভালোভাবে পড়ুন। Rules ভঙ্গ করলে Balance ০০ করা বা BAN করা হতে পারে।',
  '⏳ Withdraw সর্বোচ্চ ১২ ঘণ্টা ভিতরে পেয়ে যাবেন।',
  '💳 প্রতিদিন ১ বার Withdraw দিতে পারবেন।',
  '⚠️ যেকোনো সমস্যায় অবশ্যই Telegram সাপোর্টে মেসেজ দিবেন, নিচে ক্লিক করুন 👇',
]

export default function NoticeBoard() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // প্রতি সেশনে একবার দেখাবে (চাইলে localStorage দিয়ে "একবারই দেখাও" লজিক যোগ করা যায়)
    setOpen(true)
  }, [])

  if (!open) return null

  return (
    <div className="overlay overlay-center" onClick={() => setOpen(false)}>
      <div className="notice-board" onClick={(e) => e.stopPropagation()}>
        <div className="notice-board-header">
          <span className="notice-board-header-icon">ℹ️</span>
          <span className="notice-board-header-title">NOTICE</span>
          <button className="notice-board-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="notice-board-body">
          <h2 className="notice-board-heading">
            📜 XTS TOUR BD – গুরুত্বপূর্ণ নিয়মাবলী 👇
          </h2>

          <ul className="notice-board-list">
            {NOTICES.map((n, i) => (
              <li key={i} className="notice-board-item">{n}</li>
            ))}
          </ul>

          <a
            href={TELEGRAM_SUPPORT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-board-cta"
          >
            📣 JOIN TELEGRAM CHANNEL
          </a>
        </div>
      </div>
    </div>
  )
}
