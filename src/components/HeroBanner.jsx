import { HERO_POSTER } from '../constants/posters'

// Replaces the old text hero ("সিজন ০৩ • লাইভ..." + heading + paragraph)
// with a single poster image. Edit HERO_POSTER in constants/posters.js to
// change the image or its link.
export default function HeroBanner() {
  if (!HERO_POSTER?.image) return null

  const img = (
    <img
      className="hero-banner-image"
      src={HERO_POSTER.image}
      alt={HERO_POSTER.alt || ''}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
        console.warn('হিরো পোস্টার ছবি লোড হয়নি:', HERO_POSTER.image)
      }}
    />
  )

  return (
    <div className="hero-banner">
      {HERO_POSTER.link ? (
        <a href={HERO_POSTER.link} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  )
}
