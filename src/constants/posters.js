// Poster banners shown on Home, right below the Notice ticker.
//
// HOW TO ADD YOUR OWN POSTER — two options:
//
// OPTION A (easiest — no project files needed):
//   Upload your poster image to any image host (imgbb.com, imgur.com, or
//   your Firebase Storage bucket since you already use Firebase) and copy
//   its direct image URL (starts with https:// and usually ends in
//   .jpg/.png/.webp). Paste that straight into `image:` below.
//
// OPTION B (if you do have access to the project's public/ folder):
//   Put the file inside public/images/posters/ and reference it as
//   `/images/posters/your-file.jpg`.
//
// Either way, set `link` to wherever tapping the poster should go
// (Telegram, YouTube, an announcement post, etc), or `link: null` if it
// shouldn't be clickable.
//
// One entry = a static banner. Two or more entries = an auto-sliding
// carousel with dot indicators, exactly like the reference video.
import { TELEGRAM_SUPPORT_LINK, YOUTUBE_HOWTO_LINK } from './links'
import { withBase } from '../utils/assetPath'

export const POSTERS = [
  {
    id: 'support',
    image: withBase('/images/support.png'),
    link: TELEGRAM_SUPPORT_LINK,
    alt: 'RX TOUR BD Support',
  },
  {
    id: 'howtojoin',
    image: withBase('/images/howtojoin.png'),
    link: YOUTUBE_HOWTO_LINK,
    alt: 'How to Join — YouTube',
  },
]

// The single poster that replaces the "সিজন ০৩ • লাইভ..." hero text block
// on Home. Same rules as POSTERS above — local path in public/images/ or
// a full https:// URL both work. Set `link: null` to make it non-clickable.
export const HERO_POSTER = {
  image: withBase('/images/hero-poster.png'), // TODO: আপনার হিরো পোস্টারের পাথ/লিংক বসান
  link: null,
  alt: 'XTS Tournament',
}
