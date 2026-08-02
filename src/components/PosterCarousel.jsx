import { useEffect, useRef, useState } from 'react'
import { POSTERS } from '../constants/posters'

const AUTO_SLIDE_MS = 5000

// Renders 1..N clickable poster banners. With 2+ posters it auto-slides and
// shows dot indicators (swipeable on touch); with exactly 1 it's just a
// static clickable banner, and with 0 it renders nothing at all.
export default function PosterCarousel() {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)

  const count = POSTERS.length

  useEffect(() => {
    if (count < 2) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, AUTO_SLIDE_MS)
    return () => clearInterval(timer)
  }, [count])

  if (count === 0) return null

  function goTo(i) {
    setIndex((i + count) % count)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 40) {
      goTo(index + (delta < 0 ? 1 : -1))
    }
    touchStartX.current = null
  }

  return (
    <div className="poster-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="poster-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {POSTERS.map((p) => {
          const img = (
            <img
              src={p.image}
              alt={p.alt || ''}
              className="poster-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                console.warn('পোস্টার ছবি লোড হয়নি:', p.image)
              }}
            />
          )
          return p.link ? (
            <a key={p.id} href={p.link} target="_blank" rel="noopener noreferrer" className="poster-slide">
              {img}
            </a>
          ) : (
            <div key={p.id} className="poster-slide">
              {img}
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <div className="poster-dots">
          {POSTERS.map((p, i) => (
            <button
              key={p.id}
              className={'poster-dot' + (i === index ? ' active' : '')}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
