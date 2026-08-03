import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './NoticeTicker.css'

// ---------------------------------------------------------------------------
// NoticeTicker — premium glass notice bar shown below the header on Home.
// Rotates through NOTICES every 5s (fade transition), auto-scrolls (marquee)
// any notice whose text overflows the available width, pauses on hover, and
// opens the notice's target page on click.
// Edit NOTICES below to add / remove / re-link items.
// ---------------------------------------------------------------------------

const NOTICES = [
  { text: '⏳ Withdraw সর্বোচ্চ ১২ ঘণ্টার ভিতরে পেয়ে যাবেন — নিশ্চিন্তে খেলুন।', link: '/transactions' },
  { text: '🆔 ম্যাচে জয়েন করার সময় আপনার সঠিক Game ID ব্যবহার করুন।', link: '/matches' },
  { text: '🎥 Replay Record ON রাখা বাধ্যতামূলক — অভিযোগ এলে ভিডিও লাগবে।', link: '/matches' },
  { text: '📣 প্রতিদিন নতুন টুর্নামেন্ট যোগ হচ্ছে — এখনই লিডারবোর্ড দেখুন।', link: '/leaderboard' },
]

const ROTATE_MS = 5000

export default function NoticeTicker() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (paused || NOTICES.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % NOTICES.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused])

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || !el.parentElement) return
    setOverflowing(el.scrollWidth > el.parentElement.clientWidth + 2)
  }, [index])

  const notice = NOTICES[index]

  function handleActivate() {
    if (notice?.link) navigate(notice.link)
  }

  return (
    <div
      className="notice-ticker-v2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      aria-label={notice.text}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleActivate()
        }
      }}
    >
      <span className="nt-border" aria-hidden="true" />
      <span className="nt-shine" aria-hidden="true" />

      <div className="nt-left">
        <span className="nt-bell" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
        </span>
        <span className="nt-live">
          <span className="nt-live-dot" aria-hidden="true" />
          LIVE
        </span>
      </div>

      <div className="nt-center">
        <div className="nt-fade" key={index}>
          <div className={'nt-track' + (overflowing ? ' nt-marquee' : '')}>
            <span ref={textRef} className="nt-text">{notice.text}</span>
            {overflowing && <span className="nt-text" aria-hidden="true">{notice.text}</span>}
          </div>
        </div>
      </div>

      <div className="nt-right">
        <span className="nt-new">NEW</span>
        <svg className="nt-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  )
}
