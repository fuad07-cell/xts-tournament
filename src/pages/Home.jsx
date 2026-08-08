import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { CATEGORIES } from '../constants/categories'
import { isExpired } from '../utils/matchTime'
import { useLanguage } from '../context/LanguageContext'
import NoticeBoard from '../components/NoticeBoard'
import InfoBanners from '../components/InfoBanners'
import NoticeTicker from '../components/NoticeTicker'
import PosterCarousel from '../components/PosterCarousel'
import HeroBanner from '../components/HeroBanner'
import './Home.css'

// প্রতিটি category-র নিজস্ব থিম রঙ — glow-active হলে এই নামের CSS class যোগ হবে
// (rules: .glow-green / .glow-blue / .glow-red / .glow-orange / .glow-purple / .glow-gold — Home.css এ)
const CATEGORY_GLOW = {
  br: 'green',
  clash_squad: 'blue',
  lone_wolf: 'red',
  lost_to_win: 'orange',
  cs_arena: 'purple',
  free_match: 'gold',
}

export default function Home() {
  const [tournaments, setTournaments] = useState([])
  const navigate = useNavigate()
  const { t } = useLanguage()

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), where('status', '==', 'open'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // ম্যাচের সময় শুধু ঘড়ির কাঁটায় পার হয়ে গেলেও (কোনো Firestore write ছাড়াই)
  // count/glow যেন live আপডেট হয় — তাই প্রতি ৩০ সেকেন্ডে একবার re-render trigger করি।
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const countFor = (key) => tournaments.filter((t) => t.category === key && !isExpired(t)).length

  return (
    <div className="screen">
      <NoticeBoard />
      <InfoBanners />
      <NoticeTicker />
      <PosterCarousel />

      <HeroBanner />

      <div className="section-title">
        <h2>{t('matchCategories')}</h2>
        <span>{CATEGORIES.length} {t('modes')}</span>
      </div>

      <div className="grid">
        {CATEGORIES.map((c, i) => {
          const count = countFor(c.key)
          const hasUpcoming = count > 0
          const glowClass = hasUpcoming ? ` glow-active glow-${CATEGORY_GLOW[c.key] || 'blue'}` : ''
          return (
            <div
              className={'match-card card-reveal' + glowClass}
              key={c.key}
              style={{ '--i': i }}
              onClick={() => navigate(`/category/${c.slug}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(`/category/${c.slug}`)
              }}
            >
              <div className="thumb">
                <img
                  src={c.image}
                  alt={c.label}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    console.warn('ছবি লোড হয়নি:', c.image)
                  }}
                />
                <span className="vs">{c.badge}</span>
              </div>
              <div className="info">
                <h3>{c.label}</h3>
                <div className={'count' + (count === 0 ? ' zero' : '')}>
                  {count === 0 ? t('noMatch') : `${count} ${t('matchesFound')}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
