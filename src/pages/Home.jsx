import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { CATEGORIES } from '../constants/categories'
import WelcomePopup from '../components/WelcomePopup'
import InfoBanners from '../components/InfoBanners'
import NoticeTicker from '../components/NoticeTicker'
import PosterCarousel from '../components/PosterCarousel'
import HeroBanner from '../components/HeroBanner'
import './Home.css'

export default function Home() {
  const [tournaments, setTournaments] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), where('status', '==', 'open'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const countFor = (key) => tournaments.filter((t) => t.category === key).length

  return (
    <div className="screen">
      <WelcomePopup />
      <InfoBanners />
      <NoticeTicker />
      <PosterCarousel />

      <HeroBanner />

      <div className="section-title">
        <h2>ম্যাচ ক্যাটাগরি</h2>
        <span>{CATEGORIES.length}টি মোড</span>
      </div>

      <div className="grid">
        {CATEGORIES.map((c, i) => {
          const count = countFor(c.key)
          return (
            <div
              className="match-card card-reveal"
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
                  {count === 0 ? 'ম্যাচ নেই' : `${count}টি ম্যাচ পাওয়া গেছে`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
