// Single source of truth for tournament categories.
// `key` = value stored in Firestore `tournaments.category` field.
// `slug` = URL segment used at /category/:slug
import { withBase } from '../utils/assetPath'

export const CATEGORIES = [
  { key: 'br', slug: 'br-match', label: 'BR Match', badge: 'SOLO', image: withBase('/images/br-match.png') },
  { key: 'clash_squad', slug: 'clash-squad', label: 'Clash Squad', badge: '4v4', image: withBase('/images/clash-squad.png') },
  { key: 'lone_wolf', slug: 'lone-wolf', label: 'Lone Wolf', badge: '1v1', image: withBase('/images/lone-wolf.png') },
  { key: 'lost_to_win', slug: 'loss-to-win', label: 'Loss to Win', badge: 'SOLO', image: withBase('/images/lost-to-win.png') },
  { key: 'cs_arena', slug: 'cs-1v1-2v2', label: 'CS 1v1 / 2v2', badge: '1v1・2v2', image: withBase('/images/cs-arena.png') },
  { key: 'free_match', slug: 'free-match', label: 'Free Match', badge: 'FREE', image: withBase('/images/free-match.png') },
]

export const getCategoryBySlug = (slug) => CATEGORIES.find((c) => c.slug === slug)
export const getCategoryByKey = (key) => CATEGORIES.find((c) => c.key === key)
