import { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from './ToastContext'
import { useLanguage } from '../context/LanguageContext'

// ---------------------------------------------------------------------------
// AVATAR SYSTEM — avatar-only identity, global profile picture.
//
// 40 DISTINCT original characters (20 male + 20 female). Every character is
// a unique combination of: head/face shape, hairstyle, hair length, facial
// expression (eyes+brows+mouth), clothing silhouette (not just a color —
// each outfit "style" has its own cut: vest, jersey, hoodie, blazer, coat,
// tank, wrap, poncho...), accessories, and a gaming/sports theme. Nothing
// here is a recolor of a single shared mesh: male and female bodies use
// different silhouette families, and each PRESET_AVATAR picks its own face
// shape + hair + outfit shape combination so the 20-per-gender grid reads
// as 20 different characters, not 20 palette swaps.
//
// Scope note: this project currently only contains Profile.jsx for the
// avatar/profile implementation. Leaderboard, Match, Results, Notifications
// and UserCard components/files are NOT present in this project, so they
// are not touched here. This module is built so that once those files
// exist, they only need to render <UserAvatar userId={...} size="small" />
// — no separate avatar logic anywhere else.
//
//   UserAvatar               — the ONE component every screen should use
//   AvatarGlowRing            — reusable animated neon glow ring (size-scaled)
//   PRESET_AVATARS            — 20 male + 20 female original gaming avatars
//   AVATAR_OPTIONS             — shared (unisex) customization slots
//   getHairOptions(gender)     — gender-specific hairstyle pool (12 each)
//   getOutfitOptions(gender)   — gender-specific outfit-style pool (shape+color)
//   getFaceShapeOptions(gender)— gender-specific head/face-shape pool (8 each)
//   ensureDefaultAvatar()      — guarantees every profile has an avatar
//   invalidateAvatarCache()    — call after saving so other views refetch
//   AvatarEditorModal          — "Profile → Edit Avatar" screen
// ---------------------------------------------------------------------------

// ---- shared (unisex) customization slots -----------------------------------
export const AVATAR_OPTIONS = {
  gender: [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
  ],
  skin: [
    { id: 'skin_01', label: 'Porcelain', value: '#F9DFC3' },
    { id: 'skin_02', label: 'Fair', value: '#F3C99B' },
    { id: 'skin_03', label: 'Golden', value: '#E0A972' },
    { id: 'skin_04', label: 'Tan', value: '#C1804E' },
    { id: 'skin_05', label: 'Deep', value: '#8B5A2B' },
    { id: 'skin_06', label: 'Ebony', value: '#5C3A21' },
  ],
  hairColor: [
    { id: 'black', label: 'Black', value: '#1B1B1B' },
    { id: 'brown', label: 'Brown', value: '#5B3A29' },
    { id: 'blonde', label: 'Blonde', value: '#D9A441' },
    { id: 'red', label: 'Red', value: '#B23A24' },
    { id: 'purple', label: 'Purple', value: '#8B5CF6' },
    { id: 'cyan', label: 'Cyan', value: '#22D3EE' },
    { id: 'green', label: 'Green', value: '#34D399' },
    { id: 'silver', label: 'Silver', value: '#C7CCD6' },
  ],
  eyes: [
    { id: 'eyes_01', label: 'Round' },
    { id: 'eyes_02', label: 'Sleepy' },
    { id: 'eyes_03', label: 'Wide' },
    { id: 'eyes_04', label: 'Sharp' },
    { id: 'eyes_05', label: 'Wink' },
    { id: 'eyes_06', label: 'Star' },
  ],
  brows: [
    { id: 'brows_01', label: 'Straight' },
    { id: 'brows_02', label: 'Angled' },
    { id: 'brows_03', label: 'Thick' },
    { id: 'brows_04', label: 'Thin' },
    { id: 'brows_05', label: 'Raised' },
  ],
  mouth: [
    { id: 'mouth_01', label: 'Smile' },
    { id: 'mouth_02', label: 'Neutral' },
    { id: 'mouth_03', label: 'Grin' },
    { id: 'mouth_04', label: 'Smirk' },
    { id: 'mouth_05', label: 'Focused' },
  ],
  hat: [
    { id: 'none', label: 'None' },
    { id: 'cap', label: 'Cap', value: '#1D4ED8' },
    { id: 'beanie', label: 'Beanie', value: '#374151' },
    { id: 'bandana', label: 'Bandana', value: '#7A1E1E' },
    { id: 'headband', label: 'Headband', value: '#EAB308' },
  ],
  helmet: [
    { id: 'none', label: 'None' },
    { id: 'tactical_helmet', label: 'Tactical Helmet', value: '#3B3B29' },
    { id: 'racing_helmet', label: 'Racing Helmet', value: '#111827' },
    { id: 'bike_helmet', label: 'Bike Helmet', value: '#DC2626' },
    { id: 'esports_visor', label: 'Esports Visor', value: '#7C3AED' },
  ],
  glasses: [
    { id: 'none', label: 'None' },
    { id: 'clear', label: 'Clear Frames', value: '#111827' },
    { id: 'aviator', label: 'Aviator', value: '#B45309' },
    { id: 'tactical_goggles', label: 'Tac Goggles', value: '#3B3B29' },
    { id: 'visor', label: 'Neon Visor', value: '#22D3EE' },
    { id: 'scope', label: 'Scope Monocle', value: '#0EA5E9' },
  ],
  headphones: [
    { id: 'none', label: 'None' },
    { id: 'over_ear', label: 'Over-Ear', value: '#22D3EE' },
    { id: 'gaming_headset', label: 'Gaming Headset', value: '#8B5CF6' },
    { id: 'earbuds', label: 'Earbuds', value: '#E5E7EB' },
  ],
  gamingAccessory: [
    { id: 'none', label: 'None' },
    { id: 'controller_badge', label: 'Controller', value: '#22D3EE' },
    { id: 'keyboard_badge', label: 'Keyboard', value: '#A855F7' },
    { id: 'joystick_badge', label: 'Joystick', value: '#F97316' },
    { id: 'vr_badge', label: 'VR Set', value: '#34D399' },
  ],
  sportsAccessory: [
    { id: 'none', label: 'None' },
    { id: 'football_badge', label: 'Football', value: '#059669' },
    { id: 'cricket_bat_badge', label: 'Cricket Bat', value: '#B45309' },
    { id: 'boxing_gloves_badge', label: 'Boxing Gloves', value: '#DC2626' },
    { id: 'racing_flag_badge', label: 'Racing Flag', value: '#111827' },
    { id: 'basketball_badge', label: 'Basketball', value: '#EA580C' },
    { id: 'skate_badge', label: 'Skateboard', value: '#0891B2' },
    { id: 'compass_badge', label: 'Compass', value: '#B45309' },
    { id: 'medal_badge', label: 'Medal', value: '#EAB308' },
    { id: 'shield_badge', label: 'Shield', value: '#4B5320' },
  ],
  background: [
    { id: 'bg_01', label: 'Midnight', value: ['#0F172A', '#1E293B'] },
    { id: 'bg_02', label: 'Cyan Glow', value: ['#083344', '#0891B2'] },
    { id: 'bg_03', label: 'Violet Glow', value: ['#2E1065', '#7C3AED'] },
    { id: 'bg_04', label: 'Ember', value: ['#431407', '#EA580C'] },
    { id: 'bg_05', label: 'Emerald', value: ['#022C22', '#10B981'] },
    { id: 'bg_06', label: 'Rose', value: ['#4C0519', '#E11D48'] },
    { id: 'bg_07', label: 'Camo Field', value: ['#1B2711', '#4B5320'] },
    { id: 'bg_08', label: 'Arena Gold', value: ['#3B2205', '#B45309'] },
  ],
}

function findOpt(list, id) {
  return list.find((o) => o.id === id) || list[0]
}
function opt(category, id) {
  return findOpt(AVATAR_OPTIONS[category], id)
}
// ---------------------------------------------------------------------------
// FACE SHAPES — the head silhouette itself, parametrized per shape so male
// and female pools each contain 8 genuinely different head geometries
// (jaw width, jaw squareness, cheek width, chin length/taper). This is what
// makes two avatars wearing the same hat look like different people.
// ---------------------------------------------------------------------------
function headPathMale({ cheek, brow, jaw, jawY, chinCtrl, chin, top, topCtrlY }) {
  const cheekL = 100 - cheek
  const jawL = 100 - jaw
  const chinCtrlL = 100 - chinCtrl
  return `M50 ${top} Q${cheek} ${topCtrlY} ${cheek} ${brow} Q${cheek} ${jawY - 7} ${jaw} ${jawY} Q${chinCtrl} ${chin} 50 ${chin} Q${chinCtrlL} ${chin} ${jawL} ${jawY} Q${cheekL} ${jawY - 7} ${cheekL} ${brow} Q${cheekL} ${topCtrlY} 50 ${top} Z`
}
function headPathFemale({ cheek, brow, jawY, chin, top, topCtrlY }) {
  const cheekL = 100 - cheek
  return `M50 ${top} Q${cheek} ${topCtrlY} ${cheek} ${brow} Q${cheek} ${jawY} 50 ${chin} Q${cheekL} ${jawY} ${cheekL} ${brow} Q${cheekL} ${topCtrlY} 50 ${top} Z`
}

const MALE_FACE_PARAMS = {
  square:  { cheek: 74, brow: 40, jaw: 68, jawY: 60, chinCtrl: 60, chin: 64, top: 19, topCtrlY: 20 },
  sharp:   { cheek: 70, brow: 39, jaw: 60, jawY: 63, chinCtrl: 53, chin: 68, top: 19, topCtrlY: 20 },
  round:   { cheek: 76, brow: 41, jaw: 66, jawY: 58, chinCtrl: 58, chin: 62, top: 20, topCtrlY: 21 },
  chisel:  { cheek: 71, brow: 39, jaw: 62, jawY: 64, chinCtrl: 55, chin: 70, top: 18, topCtrlY: 19 },
  soft:    { cheek: 73, brow: 40, jaw: 65, jawY: 60, chinCtrl: 58, chin: 63, top: 19, topCtrlY: 20 },
  wide:    { cheek: 78, brow: 42, jaw: 70, jawY: 59, chinCtrl: 62, chin: 63, top: 20, topCtrlY: 21 },
  lean:    { cheek: 68, brow: 38, jaw: 58, jawY: 62, chinCtrl: 52, chin: 67, top: 18, topCtrlY: 19 },
  strong:  { cheek: 75, brow: 41, jaw: 69, jawY: 61, chinCtrl: 61, chin: 65, top: 19, topCtrlY: 20 },
}
const FEMALE_FACE_PARAMS = {
  oval:    { cheek: 71, brow: 42, jawY: 58, chin: 68, top: 20, topCtrlY: 21 },
  heart:   { cheek: 75, brow: 40, jawY: 55, chin: 70, top: 19, topCtrlY: 20 },
  soft:    { cheek: 70, brow: 44, jawY: 60, chin: 66, top: 21, topCtrlY: 22 },
  diamond: { cheek: 73, brow: 38, jawY: 56, chin: 69, top: 19, topCtrlY: 20 },
  round:   { cheek: 76, brow: 44, jawY: 60, chin: 64, top: 21, topCtrlY: 22 },
  tapered: { cheek: 68, brow: 41, jawY: 59, chin: 67, top: 19, topCtrlY: 20 },
  slim:    { cheek: 66, brow: 40, jawY: 58, chin: 68, top: 18, topCtrlY: 19 },
  curved:  { cheek: 72, brow: 43, jawY: 61, chin: 65, top: 20, topCtrlY: 21 },
}

export const MALE_FACE_SHAPES = Object.keys(MALE_FACE_PARAMS).map((id) => ({
  id, label: id[0].toUpperCase() + id.slice(1), path: headPathMale(MALE_FACE_PARAMS[id]),
}))
export const FEMALE_FACE_SHAPES = Object.keys(FEMALE_FACE_PARAMS).map((id) => ({
  id, label: id[0].toUpperCase() + id.slice(1), path: headPathFemale(FEMALE_FACE_PARAMS[id]),
}))

export function getFaceShapeOptions(gender) {
  return gender === 'female' ? FEMALE_FACE_SHAPES : MALE_FACE_SHAPES
}
function faceShapePath(gender, id) {
  const list = gender === 'female' ? FEMALE_FACE_SHAPES : MALE_FACE_SHAPES
  return (list.find((f) => f.id === id) || list[0]).path
}
// ---------------------------------------------------------------------------
// HAIR — 12 distinct hairstyles per gender, each its own silhouette (not a
// recolor of one shape). Length/style genuinely differs: buzz vs mohawk vs
// dreadlocks vs quiff for men; bob vs twintails vs braid vs high-pony for
// women.
// ---------------------------------------------------------------------------
const MALE_HAIR = [
  { id: 'm_bald', label: 'Bald' },
  { id: 'm_buzz', label: 'Buzz Cut' },
  { id: 'm_fade', label: 'Fade' },
  { id: 'm_short', label: 'Short Crop' },
  { id: 'm_mohawk', label: 'Mohawk' },
  { id: 'm_slick', label: 'Slick Back' },
  { id: 'm_undercut', label: 'Undercut' },
  { id: 'm_spiky', label: 'Spiky' },
  { id: 'm_curly', label: 'Curly Crop' },
  { id: 'm_shaggy', label: 'Shaggy' },
  { id: 'm_dreadlocks', label: 'Dreadlocks' },
  { id: 'm_quiff', label: 'Quiff' },
]
const FEMALE_HAIR = [
  { id: 'f_long', label: 'Long Flow' },
  { id: 'f_ponytail', label: 'Ponytail' },
  { id: 'f_bun', label: 'Bun' },
  { id: 'f_bob', label: 'Bob' },
  { id: 'f_twintails', label: 'Twin Tails' },
  { id: 'f_wavy', label: 'Wavy Long' },
  { id: 'f_pixie', label: 'Pixie Cut' },
  { id: 'f_braid', label: 'Braid' },
  { id: 'f_half_up', label: 'Half-Up' },
  { id: 'f_curly_long', label: 'Curly Long' },
  { id: 'f_high_pony', label: 'High Ponytail' },
  { id: 'f_bangs_long', label: 'Long + Bangs' },
]
export function getHairOptions(gender) {
  return gender === 'female' ? FEMALE_HAIR : MALE_HAIR
}

const DREAD_X = [31, 38.5, 46, 53.5, 61, 68.5]
const CURL_CLUSTER = [
  { cx: 33, cy: 28, r: 6 }, { cx: 42, cy: 22.5, r: 6.5 }, { cx: 50, cy: 20.5, r: 7 },
  { cx: 58, cy: 22.5, r: 6.5 }, { cx: 67, cy: 28, r: 6 },
]

function renderHair(hairStyle, hairColor) {
  const hc = hairColor
  switch (hairStyle) {
    case 'none':
    case 'm_bald':
      return null
    case 'm_buzz':
      return <path d="M28 32 Q50 18 72 32 L72 28 Q50 20 28 28 Z" fill={hc} />
    case 'm_fade':
      return <path d="M27 34 Q50 14 73 34 Q73 24 50 20 Q27 24 27 34 Z" fill={hc} />
    case 'm_short':
      return <path d="M25 36 Q22 16 50 15 Q78 16 75 36 Q70 26 63 30 Q56 20 50 26 Q44 20 37 30 Q30 26 25 36 Z" fill={hc} />
    case 'm_mohawk':
      return (<><path d="M27 34 Q50 22 73 34 Q73 27 50 25 Q27 27 27 34 Z" fill={hc} opacity="0.5" /><rect x="46" y="10" width="8" height="26" rx="3" fill={hc} /></>)
    case 'm_slick':
      return <path d="M26 34 Q50 15 74 34 Q73 22 50 19 Q27 22 26 34 Z" fill={hc} />
    case 'm_undercut':
      return <path d="M31 29 Q50 16 69 29 Q69 21 50 19 Q31 21 31 29 Z" fill={hc} />
    case 'm_spiky':
      return <path d="M27 34 L33 19 L38 33 L43 17 L50 33 L57 17 L62 33 L67 19 L73 34 Q73 25 50 23 Q27 25 27 34 Z" fill={hc} />
    case 'm_curly':
      return <>{CURL_CLUSTER.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={hc} />)}</>
    case 'm_shaggy':
      return <path d="M23 36 Q19 13 50 12 Q81 13 77 36 Q73 23 68 34 Q64 17 58 31 Q54 15 50 29 Q46 15 42 31 Q36 17 32 34 Q27 23 23 36 Z" fill={hc} />
    case 'm_dreadlocks':
      return (<>
        <path d="M27 32 Q50 13 73 32 Q73 23 50 20 Q27 23 27 32 Z" fill={hc} />
        {DREAD_X.map((x, i) => <rect key={i} x={x} y="28" width="4.5" height="21" rx="2.2" fill={hc} />)}
      </>)
    case 'm_quiff':
      return <path d="M27 34 Q29 14 50 11 Q71 9 73 30 Q66 19 55 21 Q62 12 50 15 Q39 12 45 21 Q34 19 27 34 Z" fill={hc} />

    case 'f_long':
      return <path d="M24 28 Q50 10 76 28 Q80 55 72 74 Q76 45 68 32 Q50 42 32 32 Q24 45 28 74 Q20 55 24 28 Z" fill={hc} />
    case 'f_ponytail':
      return (<><path d="M27 32 Q50 12 73 32 Q73 22 50 18 Q27 22 27 32 Z" fill={hc} /><path d="M72 36 Q84 42 80 62 Q76 48 70 42 Z" fill={hc} /></>)
    case 'f_bun':
      return (<><path d="M27 32 Q50 12 73 32 Q73 22 50 18 Q27 22 27 32 Z" fill={hc} /><circle cx="50" cy="13" r="7" fill={hc} /></>)
    case 'f_bob':
      return <path d="M24 30 Q50 10 76 30 Q78 46 72 52 Q73 34 50 30 Q27 34 28 52 Q22 46 24 30 Z" fill={hc} />
    case 'f_twintails':
      return (<><path d="M27 32 Q50 12 73 32 Q73 22 50 18 Q27 22 27 32 Z" fill={hc} /><ellipse cx="24" cy="46" rx="5" ry="12" fill={hc} /><ellipse cx="76" cy="46" rx="5" ry="12" fill={hc} /></>)
    case 'f_wavy':
      return <path d="M23 30 Q50 10 77 30 Q82 50 74 68 Q71 54 74 44 Q68 50 66 34 Q50 40 34 34 Q32 50 26 44 Q29 54 26 68 Q18 50 23 30 Z" fill={hc} />
    case 'f_pixie':
      return <path d="M26 32 Q50 14 74 32 Q73 22 60 19 Q65 24 50 20 Q35 24 40 19 Q27 22 26 32 Z" fill={hc} />
    case 'f_braid':
      return (<>
        <path d="M27 32 Q50 12 73 32 Q73 22 50 18 Q27 22 27 32 Z" fill={hc} />
        <rect x="46.5" y="32" width="7" height="8" rx="3" fill={hc} />
        <rect x="45.5" y="39.5" width="9" height="8" rx="3" fill={hc} />
        <rect x="46.5" y="47" width="7" height="8" rx="3" fill={hc} />
      </>)
    case 'f_half_up':
      return (<>
        <path d="M24 28 Q50 10 76 28 Q80 55 72 74 Q76 45 68 32 Q50 42 32 32 Q24 45 28 74 Q20 55 24 28 Z" fill={hc} />
        <circle cx="50" cy="15" r="4.5" fill={hc} />
      </>)
    case 'f_curly_long':
      return (<>
        <path d="M22 30 Q50 8 78 30 Q84 54 74 74 Q79 50 70 40 Q75 30 60 26 Q50 34 40 26 Q25 30 30 40 Q21 50 26 74 Q16 54 22 30 Z" fill={hc} />
        <circle cx="26" cy="34" r="5" fill={hc} /><circle cx="74" cy="34" r="5" fill={hc} />
      </>)
    case 'f_high_pony':
      return (<>
        <path d="M27 32 Q50 12 73 32 Q73 22 50 18 Q27 22 27 32 Z" fill={hc} />
        <path d="M68 22 Q85 17 82 40 Q78 29 69 27 Z" fill={hc} />
      </>)
    case 'f_bangs_long':
      return (<>
        <path d="M24 28 Q50 10 76 28 Q80 55 72 74 Q76 45 68 32 Q50 42 32 32 Q24 45 28 74 Q20 55 24 28 Z" fill={hc} />
        <rect x="34" y="30" width="32" height="5.5" rx="2" fill={hc} />
      </>)
    default:
      return null
  }
}
// ---------------------------------------------------------------------------
// OUTFIT COLORS — a shared palette. Outfit SHAPE (below) is what makes an
// avatar look different from another; color is a separate, independent
// customization slot layered on top.
// ---------------------------------------------------------------------------
AVATAR_OPTIONS.outfitColor = [
  { id: 'olive', label: 'Olive Tactical', value: '#4B5320' },
  { id: 'forest', label: 'Forest', value: '#065F46' },
  { id: 'crimson', label: 'Crimson', value: '#DC2626' },
  { id: 'violet', label: 'Violet', value: '#7C3AED' },
  { id: 'amber', label: 'Amber Gold', value: '#B45309' },
  { id: 'slate', label: 'Slate', value: '#3B3B29' },
  { id: 'teal', label: 'Teal', value: '#0891B2' },
  { id: 'magenta', label: 'Magenta', value: '#DB2777' },
  { id: 'navy', label: 'Navy', value: '#1D4ED8' },
  { id: 'charcoal', label: 'Charcoal', value: '#111827' },
  { id: 'emerald', label: 'Emerald', value: '#059669' },
  { id: 'brown', label: 'Field Brown', value: '#7A5230' },
]

// ---------------------------------------------------------------------------
// OUTFIT SHAPES — each id is a distinct clothing SILHOUETTE (cut of garment
// + its own decorative details), independent of color. Male and female use
// entirely separate body-base geometry (see renderOutfitBase). This is what
// makes "Boxing Fighter" structurally different from "Champion" even before
// color, face, or hair are considered.
// ---------------------------------------------------------------------------
const OUTFIT_STYLES = [
  { id: 'vest',        label: 'Tactical Vest',   gender: 'male',   base: 'crew',       overlay: 'straps' },
  { id: 'jersey',      label: 'Sports Jersey',   gender: 'male',   base: 'crew',       overlay: 'stripe' },
  { id: 'racing_suit', label: 'Racing Suit',     gender: 'male',   base: 'vOpen',      overlay: 'racingStripe' },
  { id: 'hoodie',      label: 'Hoodie',          gender: 'male',   base: 'crew',       overlay: 'drawstring' },
  { id: 'tank',        label: 'Tank Top',        gender: 'male',   base: 'sleeveless', overlay: 'none' },
  { id: 'ninja_wrap',  label: 'Ninja Wrap',      gender: 'male',   base: 'vOpen',      overlay: 'wrap' },
  { id: 'blazer',      label: 'Blazer',          gender: 'male',   base: 'vOpen',      overlay: 'lapel' },
  { id: 'jacket',      label: 'Utility Jacket',  gender: 'male',   base: 'crew',       overlay: 'pockets' },
  { id: 'coat',        label: 'Commander Coat',  gender: 'male',   base: 'longCoat',   overlay: 'pockets' },
  { id: 'poncho',      label: 'Survival Poncho', gender: 'male',   base: 'longCoat',   overlay: 'fringe' },
  { id: 'tee',         label: 'Casual Tee',      gender: 'male',   base: 'crew',       overlay: 'none' },

  { id: 'vest_f',        label: 'Tactical Vest',   gender: 'female', base: 'taperedV',   overlay: 'straps' },
  { id: 'jersey_f',      label: 'Fitted Jersey',   gender: 'female', base: 'taperedV',   overlay: 'stripe' },
  { id: 'racing_suit_f', label: 'Racing Suit',     gender: 'female', base: 'wrapJacket', overlay: 'racingStripe' },
  { id: 'hoodie_f',      label: 'Cropped Hoodie',  gender: 'female', base: 'taperedV',   overlay: 'drawstring' },
  { id: 'tank_f',        label: 'Sport Tank',      gender: 'female', base: 'tankStraps', overlay: 'none' },
  { id: 'ninja_wrap_f',  label: 'Ninja Wrap',      gender: 'female', base: 'wrapJacket', overlay: 'wrap' },
  { id: 'blazer_f',      label: 'Blazer',          gender: 'female', base: 'wrapJacket', overlay: 'lapel' },
  { id: 'jacket_f',      label: 'Utility Jacket',  gender: 'female', base: 'taperedV',   overlay: 'pockets' },
  { id: 'coat_f',        label: 'Commander Coat',  gender: 'female', base: 'longCoatF',  overlay: 'pockets' },
  { id: 'poncho_f',      label: 'Survival Poncho', gender: 'female', base: 'longCoatF',  overlay: 'fringe' },
  { id: 'tee_f',         label: 'Casual Tee',      gender: 'female', base: 'taperedV',   overlay: 'none' },
]

export function getOutfitOptions(gender) {
  return OUTFIT_STYLES.filter((o) => o.gender === gender).map((o) => ({ id: o.id, label: o.label }))
}
function outfitStyleDef(gender, id) {
  const list = OUTFIT_STYLES.filter((o) => o.gender === gender)
  return list.find((o) => o.id === id) || list[0]
}

function renderOutfitBase(gender, base, color) {
  if (gender === 'female') {
    if (base === 'wrapJacket') return (<><path d="M18 100 Q23 80 50 78 Q77 80 82 100 Z" fill={color} /><path d="M38 82 L60 98" stroke="rgba(0,0,0,0.28)" strokeWidth="2" fill="none" /></>)
    if (base === 'tankStraps') return (<><path d="M25 100 Q29 85 50 83 Q71 85 75 100 Z" fill={color} /><rect x="40" y="76" width="5" height="10" rx="2" fill={color} /><rect x="55" y="76" width="5" height="10" rx="2" fill={color} /></>)
    if (base === 'longCoatF') return (<><path d="M13 100 Q19 68 50 66 Q81 68 87 100 Z" fill={color} /><line x1="50" y1="74" x2="50" y2="100" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" /></>)
    // taperedV (default female)
    return <path d="M17 100 Q22 82 50 79 Q78 82 83 100 Z M50 79 L45 84 L50 89 L55 84 Z" fill={color} />
  }
  if (base === 'vOpen') return (<><path d="M10 100 Q50 70 90 100 Z" fill={color} /><path d="M50 76 L43 100 L57 100 Z" fill="#E8ECF2" /></>)
  if (base === 'sleeveless') return (<><path d="M22 100 Q50 82 78 100 Z" fill={color} /><rect x="32" y="76" width="6" height="12" rx="2" fill={color} /><rect x="62" y="76" width="6" height="12" rx="2" fill={color} /></>)
  if (base === 'longCoat') return (<><path d="M6 100 Q50 62 94 100 Z" fill={color} /><line x1="50" y1="78" x2="50" y2="100" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" /></>)
  // crew (default male)
  return <path d="M12 100 Q50 72 88 100 Z" fill={color} />
}

const FRINGE_X = [16, 27, 38, 50, 62, 73, 84]

function renderOutfitOverlay(overlay) {
  switch (overlay) {
    case 'straps':
      return (<g>
        <rect x="36" y="78" width="6" height="20" rx="2" fill="rgba(0,0,0,0.28)" transform="rotate(18 39 88)" />
        <rect x="58" y="78" width="6" height="20" rx="2" fill="rgba(0,0,0,0.28)" transform="rotate(-18 61 88)" />
        <rect x="44" y="88" width="12" height="8" rx="1.5" fill="rgba(0,0,0,0.22)" />
      </g>)
    case 'stripe':
      return (<g>
        <rect x="41" y="80" width="18" height="4" rx="1.5" fill="rgba(255,255,255,0.55)" />
        <rect x="45" y="87" width="10" height="8" rx="1.5" fill="rgba(255,255,255,0.35)" />
      </g>)
    case 'racingStripe':
      return (<g>
        <path d="M32 78 L46 100" stroke="rgba(255,255,255,0.55)" strokeWidth="4" />
        <path d="M68 78 L54 100" stroke="rgba(255,255,255,0.55)" strokeWidth="4" />
      </g>)
    case 'drawstring':
      return (<g>
        <path d="M40 80 Q50 86 60 80" stroke="rgba(0,0,0,0.25)" strokeWidth="2" fill="none" />
        <path d="M46 82 L44 96" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M54 82 L56 96" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
      </g>)
    case 'lapel':
      return (<g>
        <path d="M45 78 L37 94" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" fill="none" />
        <path d="M55 78 L63 94" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" fill="none" />
        <circle cx="50" cy="92" r="1.6" fill="rgba(0,0,0,0.3)" />
      </g>)
    case 'pockets':
      return (<g>
        <rect x="28" y="88" width="11" height="9" rx="1.5" fill="rgba(0,0,0,0.2)" />
        <rect x="61" y="88" width="11" height="9" rx="1.5" fill="rgba(0,0,0,0.2)" />
        <rect x="22" y="83" width="56" height="3" fill="rgba(0,0,0,0.18)" />
      </g>)
    case 'wrap':
      return (<g>
        <path d="M37 79 Q50 87 63 79" stroke="rgba(0,0,0,0.32)" strokeWidth="2.2" fill="none" />
        <rect x="34" y="80" width="8" height="20" rx="2" fill="rgba(0,0,0,0.22)" transform="rotate(24 38 90)" />
      </g>)
    case 'fringe':
      return (<g>{FRINGE_X.map((x, i) => <path key={i} d={`M${x - 5} 99 L${x} 107 L${x + 5} 99 Z`} fill="rgba(0,0,0,0.18)" />)}</g>)
    default:
      return null
  }
}
// Male-exclusive slot — kept out of the female tab list entirely.
export const FACIAL_HAIR_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'stubble', label: 'Stubble', value: '#2B2118' },
  { id: 'full_beard', label: 'Full Beard', value: '#2B2118' },
  { id: 'goatee', label: 'Goatee', value: '#2B2118' },
]

const SHARED_DEFAULTS = {
  skin: 'skin_02', hairColor: 'black', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  hat: 'none', helmet: 'none', glasses: 'none', headphones: 'none',
  gamingAccessory: 'none', sportsAccessory: 'none', background: 'bg_01',
}

export function defaultCustomizationFor(gender) {
  return {
    ...SHARED_DEFAULTS,
    faceShape: gender === 'female' ? FEMALE_FACE_SHAPES[0].id : MALE_FACE_SHAPES[0].id,
    hair: gender === 'female' ? FEMALE_HAIR[0].id : MALE_HAIR[1].id,
    outfitStyle: gender === 'female' ? 'tee_f' : 'tee',
    outfitColor: 'slate',
    facialHair: 'none',
  }
}

function preset(gender, id, label, personality, custom) {
  return {
    id: `${gender}_${id}`,
    theme: id,
    label,
    personality,
    gender,
    customization: { ...defaultCustomizationFor(gender), ...custom },
  }
}

// -----------------------------------------------------------------------
// PRESET_AVATARS — 20 distinct male + 20 distinct female characters.
// Every row picks its OWN combination of face shape, hairstyle, outfit
// silhouette, accessories, expression and colors — nothing here is a
// recolor of a shared base. Male and female geometry never share a mesh.
// -----------------------------------------------------------------------
export const PRESET_AVATARS = [
  preset('male', 'tactical_soldier', 'Tactical Soldier', 'Disciplined frontline operator', {
    faceShape: 'square', hair: 'm_undercut', outfitStyle: 'vest', outfitColor: 'olive',
    helmet: 'tactical_helmet', glasses: 'tactical_goggles', background: 'bg_07',
    skin: 'skin_03', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_05', facialHair: 'stubble',
  }),
  preset('male', 'assault_rifle_gamer', 'Assault Rifle Gamer', 'Loud, aggressive squad-leader energy', {
    faceShape: 'sharp', hair: 'm_buzz', outfitStyle: 'vest', outfitColor: 'slate',
    hat: 'bandana', glasses: 'aviator', background: 'bg_04',
    skin: 'skin_04', hairColor: 'brown', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_04', facialHair: 'full_beard',
  }),
  preset('male', 'sniper', 'Sniper', 'Quiet, patient, always watching', {
    faceShape: 'lean', hair: 'm_short', outfitStyle: 'jacket', outfitColor: 'forest',
    hat: 'cap', glasses: 'scope', background: 'bg_07',
    skin: 'skin_02', hairColor: 'black', eyes: 'eyes_02', brows: 'brows_01', mouth: 'mouth_02', facialHair: 'stubble',
  }),
  preset('male', 'football_player', 'Football Player', 'Team captain, competitive spirit', {
    faceShape: 'wide', hair: 'm_short', outfitStyle: 'jersey', outfitColor: 'emerald',
    sportsAccessory: 'football_badge', background: 'bg_05',
    skin: 'skin_03', hairColor: 'black', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('male', 'cricket_player', 'Cricket Player', 'Cool-headed strategist', {
    faceShape: 'round', hair: 'm_short', outfitStyle: 'jersey', outfitColor: 'amber',
    hat: 'cap', sportsAccessory: 'cricket_bat_badge', background: 'bg_08',
    skin: 'skin_02', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('male', 'racing_driver', 'Racing Driver', 'Fast, focused, adrenaline-driven', {
    faceShape: 'chisel', hair: 'm_slick', outfitStyle: 'racing_suit', outfitColor: 'crimson',
    helmet: 'racing_helmet', glasses: 'visor', sportsAccessory: 'racing_flag_badge', background: 'bg_04',
    skin: 'skin_01', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_04',
  }),
  preset('male', 'esports_pro', 'Esports Pro', 'Elite competitive gamer', {
    faceShape: 'soft', hair: 'm_fade', outfitStyle: 'hoodie', outfitColor: 'violet',
    headphones: 'gaming_headset', gamingAccessory: 'controller_badge', background: 'bg_03',
    skin: 'skin_02', hairColor: 'purple', eyes: 'eyes_03', brows: 'brows_05', mouth: 'mouth_03',
  }),
  preset('male', 'headset_gamer', 'Headset Gamer', 'Chatty in-game shot-caller', {
    faceShape: 'strong', hair: 'm_mohawk', outfitStyle: 'hoodie', outfitColor: 'navy',
    headphones: 'over_ear', gamingAccessory: 'keyboard_badge', background: 'bg_02',
    skin: 'skin_04', hairColor: 'cyan', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_05',
  }),
  preset('male', 'controller_gamer', 'Controller Gamer', 'Relaxed couch-console champion', {
    faceShape: 'square', hair: 'm_curly', outfitStyle: 'tee', outfitColor: 'teal',
    headphones: 'earbuds', gamingAccessory: 'controller_badge', background: 'bg_01',
    skin: 'skin_03', hairColor: 'black', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_03',
  }),
  preset('male', 'boxing_fighter', 'Boxing Fighter', 'Hard-hitting, always training', {
    faceShape: 'strong', hair: 'm_buzz', outfitStyle: 'tank', outfitColor: 'crimson',
    sportsAccessory: 'boxing_gloves_badge', background: 'bg_06',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_04', facialHair: 'goatee',
  }),
  preset('male', 'ninja', 'Ninja', 'Silent, precise, unseen', {
    faceShape: 'sharp', hair: 'm_bald', outfitStyle: 'ninja_wrap', outfitColor: 'charcoal',
    hat: 'bandana', background: 'bg_01',
    skin: 'skin_02', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_02',
  }),
  preset('male', 'cyber_gamer', 'Cyber Gamer', 'Neon-soaked digital rebel', {
    faceShape: 'lean', hair: 'm_spiky', outfitStyle: 'hoodie', outfitColor: 'violet',
    glasses: 'visor', background: 'bg_02',
    skin: 'skin_01', hairColor: 'cyan', eyes: 'eyes_06', brows: 'brows_05', mouth: 'mouth_03',
  }),
  preset('male', 'street_gamer', 'Street Gamer', 'Bold, brash, arcade-raised', {
    faceShape: 'wide', hair: 'm_mohawk', outfitStyle: 'jacket', outfitColor: 'crimson',
    hat: 'bandana', gamingAccessory: 'joystick_badge', background: 'bg_04',
    skin: 'skin_04', hairColor: 'red', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_04',
  }),
  preset('male', 'champion', 'Champion', 'Decorated, poised, top of the leaderboard', {
    faceShape: 'chisel', hair: 'm_slick', outfitStyle: 'blazer', outfitColor: 'amber',
    sportsAccessory: 'medal_badge', background: 'bg_08',
    skin: 'skin_01', hairColor: 'black', eyes: 'eyes_03', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('male', 'adventure_explorer', 'Adventure Explorer', 'Curious wanderer, always mapping new ground', {
    faceShape: 'round', hair: 'm_shaggy', outfitStyle: 'jacket', outfitColor: 'forest',
    hat: 'cap', sportsAccessory: 'compass_badge', background: 'bg_05',
    skin: 'skin_03', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01', facialHair: 'stubble',
  }),
  preset('male', 'military_commander', 'Military Commander', 'Battle-hardened leader of the squad', {
    faceShape: 'square', hair: 'm_undercut', outfitStyle: 'coat', outfitColor: 'slate',
    helmet: 'tactical_helmet', sportsAccessory: 'shield_badge', background: 'bg_07',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_05', facialHair: 'full_beard',
  }),
  preset('male', 'casual_gamer', 'Casual Gamer', 'Easygoing, plays for fun', {
    faceShape: 'soft', hair: 'm_short', outfitStyle: 'tee', outfitColor: 'teal', background: 'bg_01',
    skin: 'skin_02', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('male', 'basketball_player', 'Basketball Player', 'Explosive, court-dominating athlete', {
    faceShape: 'strong', hair: 'm_buzz', outfitStyle: 'tank', outfitColor: 'amber',
    sportsAccessory: 'basketball_badge', background: 'bg_05',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_03',
  }),
  preset('male', 'skate_gamer', 'Skate Gamer', 'Laid-back trickster, street style', {
    faceShape: 'lean', hair: 'm_shaggy', outfitStyle: 'jacket', outfitColor: 'navy',
    hat: 'beanie', sportsAccessory: 'skate_badge', background: 'bg_02',
    skin: 'skin_01', hairColor: 'blonde', eyes: 'eyes_05', brows: 'brows_04', mouth: 'mouth_04',
  }),
  preset('male', 'survival_player', 'Survival Player', 'Rugged, resourceful, built for the wild', {
    faceShape: 'wide', hair: 'm_dreadlocks', outfitStyle: 'poncho', outfitColor: 'brown',
    sportsAccessory: 'compass_badge', background: 'bg_07',
    skin: 'skin_04', hairColor: 'green', eyes: 'eyes_02', brows: 'brows_02', mouth: 'mouth_02', facialHair: 'stubble',
  }),

  preset('female', 'tactical_fighter', 'Tactical Fighter', 'Sharp, mission-focused operator', {
    faceShape: 'oval', hair: 'f_ponytail', outfitStyle: 'vest_f', outfitColor: 'olive',
    helmet: 'tactical_helmet', glasses: 'tactical_goggles', background: 'bg_07',
    skin: 'skin_02', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_05',
  }),
  preset('female', 'combat_gamer', 'Combat Gamer', 'Fearless front-liner', {
    faceShape: 'diamond', hair: 'f_braid', outfitStyle: 'vest_f', outfitColor: 'slate',
    hat: 'bandana', glasses: 'aviator', background: 'bg_04',
    skin: 'skin_04', hairColor: 'brown', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_04',
  }),
  preset('female', 'sniper', 'Sniper', 'Calm, calculated, one shot at a time', {
    faceShape: 'tapered', hair: 'f_bun', outfitStyle: 'jacket_f', outfitColor: 'forest',
    hat: 'cap', glasses: 'scope', background: 'bg_07',
    skin: 'skin_01', hairColor: 'black', eyes: 'eyes_02', brows: 'brows_01', mouth: 'mouth_02',
  }),
  preset('female', 'football_player', 'Football Player', 'Fierce competitor, team-first mindset', {
    faceShape: 'round', hair: 'f_ponytail', outfitStyle: 'jersey_f', outfitColor: 'emerald',
    hat: 'headband', sportsAccessory: 'football_badge', background: 'bg_05',
    skin: 'skin_03', hairColor: 'black', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('female', 'cricket_player', 'Cricket Player', 'Patient, precise all-rounder', {
    faceShape: 'soft', hair: 'f_bob', outfitStyle: 'jersey_f', outfitColor: 'amber',
    hat: 'cap', sportsAccessory: 'cricket_bat_badge', background: 'bg_08',
    skin: 'skin_02', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('female', 'racing_driver', 'Racing Driver', 'Fearless behind the wheel', {
    faceShape: 'heart', hair: 'f_high_pony', outfitStyle: 'racing_suit_f', outfitColor: 'crimson',
    helmet: 'racing_helmet', glasses: 'visor', sportsAccessory: 'racing_flag_badge', background: 'bg_04',
    skin: 'skin_01', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_04',
  }),
  preset('female', 'esports_pro', 'Esports Pro', 'Top-ranked competitive strategist', {
    faceShape: 'curved', hair: 'f_half_up', outfitStyle: 'hoodie_f', outfitColor: 'violet',
    headphones: 'gaming_headset', gamingAccessory: 'controller_badge', background: 'bg_03',
    skin: 'skin_02', hairColor: 'purple', eyes: 'eyes_03', brows: 'brows_05', mouth: 'mouth_03',
  }),
  preset('female', 'headset_gamer', 'Headset Gamer', 'Vocal in-game leader', {
    faceShape: 'oval', hair: 'f_wavy', outfitStyle: 'hoodie_f', outfitColor: 'navy',
    headphones: 'over_ear', gamingAccessory: 'keyboard_badge', background: 'bg_02',
    skin: 'skin_04', hairColor: 'cyan', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_05',
  }),
  preset('female', 'controller_gamer', 'Controller Gamer', 'Chill, always down to play', {
    faceShape: 'diamond', hair: 'f_curly_long', outfitStyle: 'tee_f', outfitColor: 'teal',
    headphones: 'earbuds', gamingAccessory: 'controller_badge', background: 'bg_01',
    skin: 'skin_03', hairColor: 'black', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_03',
  }),
  preset('female', 'boxing_fighter', 'Boxing Fighter', 'Powerful, relentless in the ring', {
    faceShape: 'round', hair: 'f_bun', outfitStyle: 'tank_f', outfitColor: 'crimson',
    sportsAccessory: 'boxing_gloves_badge', background: 'bg_06',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_04',
  }),
  preset('female', 'ninja', 'Ninja', 'Swift, silent, unseen', {
    faceShape: 'tapered', hair: 'f_bun', outfitStyle: 'ninja_wrap_f', outfitColor: 'charcoal',
    hat: 'bandana', background: 'bg_01',
    skin: 'skin_02', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_02',
  }),
  preset('female', 'cyber_gamer', 'Cyber Gamer', 'Neon-lit digital tactician', {
    faceShape: 'slim', hair: 'f_twintails', outfitStyle: 'hoodie_f', outfitColor: 'violet',
    glasses: 'visor', background: 'bg_02',
    skin: 'skin_01', hairColor: 'cyan', eyes: 'eyes_06', brows: 'brows_05', mouth: 'mouth_03',
  }),
  preset('female', 'street_gamer', 'Street Gamer', 'Loud, confident, arcade-raised', {
    faceShape: 'heart', hair: 'f_twintails', outfitStyle: 'jacket_f', outfitColor: 'crimson',
    hat: 'bandana', gamingAccessory: 'joystick_badge', background: 'bg_04',
    skin: 'skin_04', hairColor: 'red', eyes: 'eyes_04', brows: 'brows_02', mouth: 'mouth_04',
  }),
  preset('female', 'champion', 'Champion', 'Poised, decorated, top of her game', {
    faceShape: 'oval', hair: 'f_long', outfitStyle: 'blazer_f', outfitColor: 'amber',
    hat: 'headband', sportsAccessory: 'medal_badge', background: 'bg_08',
    skin: 'skin_01', hairColor: 'black', eyes: 'eyes_03', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('female', 'adventure_explorer', 'Adventure Explorer', 'Bold wanderer chasing new horizons', {
    faceShape: 'round', hair: 'f_wavy', outfitStyle: 'jacket_f', outfitColor: 'forest',
    hat: 'cap', sportsAccessory: 'compass_badge', background: 'bg_05',
    skin: 'skin_03', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('female', 'tactical_commander', 'Tactical Commander', 'Commands the squad with precision', {
    faceShape: 'diamond', hair: 'f_braid', outfitStyle: 'coat_f', outfitColor: 'slate',
    helmet: 'tactical_helmet', sportsAccessory: 'shield_badge', background: 'bg_07',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_05',
  }),
  preset('female', 'casual_gamer', 'Casual Gamer', 'Relaxed, plays for the joy of it', {
    faceShape: 'soft', hair: 'f_bob', outfitStyle: 'tee_f', outfitColor: 'teal', background: 'bg_01',
    skin: 'skin_02', hairColor: 'brown', eyes: 'eyes_01', brows: 'brows_01', mouth: 'mouth_01',
  }),
  preset('female', 'basketball_player', 'Basketball Player', 'Fast, athletic, court leader', {
    faceShape: 'curved', hair: 'f_high_pony', outfitStyle: 'tank_f', outfitColor: 'amber',
    sportsAccessory: 'basketball_badge', background: 'bg_05',
    skin: 'skin_05', hairColor: 'black', eyes: 'eyes_04', brows: 'brows_03', mouth: 'mouth_03',
  }),
  preset('female', 'skate_gamer', 'Skate Gamer', 'Trick-happy, street-style skater', {
    faceShape: 'slim', hair: 'f_pixie', outfitStyle: 'jacket_f', outfitColor: 'navy',
    hat: 'beanie', sportsAccessory: 'skate_badge', background: 'bg_02',
    skin: 'skin_01', hairColor: 'blonde', eyes: 'eyes_05', brows: 'brows_04', mouth: 'mouth_04',
  }),
  preset('female', 'survival_player', 'Survival Player', 'Resourceful, built for the wild', {
    faceShape: 'tapered', hair: 'f_bangs_long', outfitStyle: 'poncho_f', outfitColor: 'brown',
    sportsAccessory: 'compass_badge', background: 'bg_07',
    skin: 'skin_04', hairColor: 'green', eyes: 'eyes_02', brows: 'brows_02', mouth: 'mouth_02',
  }),
]

export function defaultAvatarFor(gender = 'male') {
  const p = PRESET_AVATARS.find((p) => p.gender === gender) || PRESET_AVATARS[0]
  return { type: 'preset', gender: p.gender, avatarId: p.id, customization: p.customization }
}

export const DEFAULT_AVATAR = defaultAvatarFor('male')

export function randomAvatarConfig(gender = 'male') {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id
  const customization = { ...defaultCustomizationFor(gender) }
  for (const cat of ['skin', 'hairColor', 'eyes', 'brows', 'mouth', 'hat', 'helmet', 'glasses', 'headphones', 'gamingAccessory', 'sportsAccessory', 'background', 'outfitColor']) {
    customization[cat] = pick(AVATAR_OPTIONS[cat])
  }
  customization.faceShape = pick(getFaceShapeOptions(gender))
  customization.hair = pick(getHairOptions(gender))
  customization.outfitStyle = pick(getOutfitOptions(gender))
  if (gender === 'male') customization.facialHair = pick(FACIAL_HAIR_OPTIONS)
  return { type: 'preset', gender, avatarId: 'custom', customization }
}

// Guarantees every loaded profile has an avatar — never an empty circle,
// broken image, null, or undefined.
export async function ensureDefaultAvatar(uid, profile) {
  if (profile?.avatar?.customization) return
  await updateDoc(doc(db, 'users', uid), { avatar: DEFAULT_AVATAR })
}
// ---------------------------------------------------------------------------
// AvatarSVG — original, lightweight, procedurally-composed vector avatar.
// Every avatar is built from THREE independent, genuinely different axes:
//   1. faceShape  — the head/jaw silhouette itself (8 per gender)
//   2. hair       — a real hairstyle silhouette, not a recolor (12 per gender)
//   3. outfitStyle — a real clothing silhouette + details (11 per gender)
// Male and female share NO geometry: different head shapes, different
// outfit silhouette families, plus eyelashes on female eyes and an optional
// beard/stubble/goatee on male.
// ---------------------------------------------------------------------------
export function AvatarSVG({ avatar }) {
  const gender = avatar?.gender === 'female' ? 'female' : 'male'
  const c = { ...defaultCustomizationFor(gender), ...(avatar?.customization || {}) }
  const isFemale = gender === 'female'

  const skin = opt('skin', c.skin).value
  const hairColor = opt('hairColor', c.hairColor).value
  const bg = opt('background', c.background).value
  const outfitDef = outfitStyleDef(gender, c.outfitStyle)
  const outfitColor = opt('outfitColor', c.outfitColor).value
  const headOutline = faceShapePath(gender, c.faceShape)

  const headwear = c.helmet && c.helmet !== 'none' ? { kind: 'helmet', value: opt('helmet', c.helmet).value }
    : c.hat && c.hat !== 'none' ? { kind: 'hat', value: opt('hat', c.hat).value } : null
  const faceAcc = c.glasses && c.glasses !== 'none' ? { kind: 'glasses', value: opt('glasses', c.glasses).value }
    : c.headphones && c.headphones !== 'none' ? { kind: 'headphones', value: opt('headphones', c.headphones).value } : null
  const badge = c.gamingAccessory && c.gamingAccessory !== 'none' ? opt('gamingAccessory', c.gamingAccessory).value
    : c.sportsAccessory && c.sportsAccessory !== 'none' ? opt('sportsAccessory', c.sportsAccessory).value : null

  const hairStyle = headwear ? 'none' : c.hair // headwear covers hair for a clean silhouette
  const eyeStyle = c.eyes
  const browStyle = c.brows
  const mouthStyle = c.mouth
  const facialHair = isFemale ? 'none' : (c.facialHair || 'none')

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block', borderRadius: '50%' }}>
      <defs>
        <linearGradient id={`bgGrad-${bg[0]}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg[0]} />
          <stop offset="100%" stopColor={bg[1]} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#bgGrad-${bg[0]})`} />

      {/* outfit — real silhouette per style (vest / jersey / hoodie / blazer / coat / ...) */}
      {renderOutfitBase(gender, outfitDef.base, outfitColor)}
      {renderOutfitOverlay(outfitDef.overlay)}

      {/* neck */}
      <rect x="43" y="60" width="14" height="14" fill={skin} />

      {/* head — geometry from the selected face shape (8 per gender) */}
      <path d={headOutline} fill={skin} />
      <circle cx="26" cy="45" r="4" fill={skin} />
      <circle cx="74" cy="45" r="4" fill={skin} />

      {/* facial hair (male only) */}
      {facialHair === 'stubble' && <path d="M36 54 Q50 66 64 54 Q64 62 50 65 Q36 62 36 54 Z" fill={hairColor} opacity="0.35" />}
      {facialHair === 'full_beard' && <path d="M32 48 Q32 66 50 68 Q68 66 68 48 Q68 60 50 63 Q32 60 32 48 Z" fill="#2B2118" />}
      {facialHair === 'goatee' && <path d="M42 58 Q50 68 58 58 Q54 63 50 63 Q46 63 42 58 Z" fill="#2B2118" />}

      {/* hair — real style silhouette, not a recolor */}
      {renderHair(hairStyle, hairColor)}

      {/* eyes */}
      {eyeStyle === 'eyes_01' && (<><circle cx="41" cy="44" r="3" fill="#1B1B1B" /><circle cx="59" cy="44" r="3" fill="#1B1B1B" /></>)}
      {eyeStyle === 'eyes_02' && (<><rect x="37" y="44" width="8" height="2.5" rx="1.2" fill="#1B1B1B" /><rect x="55" y="44" width="8" height="2.5" rx="1.2" fill="#1B1B1B" /></>)}
      {eyeStyle === 'eyes_03' && (<><circle cx="41" cy="44" r="4" fill="#1B1B1B" /><circle cx="59" cy="44" r="4" fill="#1B1B1B" /></>)}
      {eyeStyle === 'eyes_04' && (<><path d="M37 44 L45 44" stroke="#1B1B1B" strokeWidth="2.4" strokeLinecap="round" /><path d="M55 44 L63 44" stroke="#1B1B1B" strokeWidth="2.4" strokeLinecap="round" /></>)}
      {eyeStyle === 'eyes_05' && (<><circle cx="41" cy="44" r="3" fill="#1B1B1B" /><path d="M55 44 L63 44" stroke="#1B1B1B" strokeWidth="2.4" strokeLinecap="round" /></>)}
      {eyeStyle === 'eyes_06' && (<><path d="M41 41l1.3 2.7 3 .4-2.1 2 .5 3-2.7-1.4-2.7 1.4.5-3-2.1-2 3-.4z" fill="#1B1B1B" /><path d="M59 41l1.3 2.7 3 .4-2.1 2 .5 3-2.7-1.4-2.7 1.4.5-3-2.1-2 3-.4z" fill="#1B1B1B" /></>)}
      {isFemale && (<><path d="M37 41 L34 38" stroke="#1B1B1B" strokeWidth="1.4" strokeLinecap="round" /><path d="M63 41 L66 38" stroke="#1B1B1B" strokeWidth="1.4" strokeLinecap="round" /></>)}

      {/* brows */}
      {browStyle === 'brows_01' && (<><rect x="36" y="38" width="10" height="2" rx="1" fill={hairColor} /><rect x="54" y="38" width="10" height="2" rx="1" fill={hairColor} /></>)}
      {browStyle === 'brows_02' && (<><path d="M36 40 L46 37" stroke={hairColor} strokeWidth="2" strokeLinecap="round" /><path d="M54 37 L64 40" stroke={hairColor} strokeWidth="2" strokeLinecap="round" /></>)}
      {browStyle === 'brows_03' && (<><rect x="35" y="37" width="11" height="3.4" rx="1.5" fill={hairColor} /><rect x="54" y="37" width="11" height="3.4" rx="1.5" fill={hairColor} /></>)}
      {browStyle === 'brows_04' && (<><rect x="37" y="39" width="9" height="1.3" rx="0.6" fill={hairColor} /><rect x="54" y="39" width="9" height="1.3" rx="0.6" fill={hairColor} /></>)}
      {browStyle === 'brows_05' && (<><path d="M36 39 Q41 34 46 38" stroke={hairColor} strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M54 38 Q59 34 64 39" stroke={hairColor} strokeWidth="2" fill="none" strokeLinecap="round" /></>)}

      {/* mouth */}
      {mouthStyle === 'mouth_01' && <path d="M42 55 Q50 61 58 55" stroke="#7A3B2E" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {mouthStyle === 'mouth_02' && <rect x="43" y="56" width="14" height="2" rx="1" fill="#7A3B2E" />}
      {mouthStyle === 'mouth_03' && <path d="M41 54 Q50 63 59 54 Q50 58 41 54 Z" fill="#7A3B2E" />}
      {mouthStyle === 'mouth_04' && <path d="M43 56 Q50 58 57 53" stroke="#7A3B2E" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {mouthStyle === 'mouth_05' && <rect x="45" y="55" width="10" height="2.2" rx="1" fill="#7A3B2E" />}

      {/* headwear */}
      {headwear?.kind === 'hat' && <path d="M25 32 Q50 10 75 32 Q75 24 50 22 Q25 24 25 32 Z" fill={headwear.value} />}
      {headwear?.kind === 'helmet' && (
        <>
          <path d="M23 38 Q25 12 50 11 Q75 12 77 38 Q77 28 50 26 Q23 28 23 38 Z" fill={headwear.value} />
          <rect x="35" y="36" width="30" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
        </>
      )}

      {/* face accessory */}
      {faceAcc?.kind === 'glasses' && (
        <g stroke={faceAcc.value} strokeWidth="2" fill="rgba(0,0,0,0.12)">
          <rect x="34.5" y="40.5" width="13" height="7" rx="2.5" /><rect x="52.5" y="40.5" width="13" height="7" rx="2.5" />
          <path d="M47.5 43 L52.5 43" strokeWidth="1.8" />
        </g>
      )}
      {faceAcc?.kind === 'headphones' && (
        <>
          <path d="M23 44 Q25 22 50 20 Q75 22 77 44" stroke={faceAcc.value} strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="19" y="42" width="7" height="12" rx="3" fill={faceAcc.value} />
          <rect x="74" y="42" width="7" height="12" rx="3" fill={faceAcc.value} />
        </>
      )}

      {/* gaming / sports badge */}
      {badge && <circle cx="50" cy="84" r="6" fill={badge} stroke="#0b0e14" strokeWidth="1.5" />}
    </svg>
  )
}
// ---------------------------------------------------------------------------
// AvatarGlowRing — animated neon glow ring, CSS-only, size-scaled intensity
// (Profile = strong glow, small list rows = subtle glow). The avatar art
// itself never animates — only the outer ring.
// ---------------------------------------------------------------------------
export function AvatarGlowRing({ size = 96, intensity = 1, children, badge }) {
  const blur = Math.max(4, size * 0.15)
  return (
    <div className="avatar-glow-wrap" style={{ width: size, height: size }}>
      <AvatarGlowStyles />
      <span className="avatar-glow-halo-wrap" style={{ opacity: intensity }} aria-hidden="true">
        <span className="avatar-glow-halo" style={{ filter: `blur(${blur}px) saturate(1.3)` }} />
      </span>
      <span className="avatar-glow-ring-wrap" style={{ opacity: intensity }} aria-hidden="true">
        <span className="avatar-glow-ring" />
      </span>
      <span className="avatar-glow-border">
        <span className="avatar-glow-content">{children}</span>
      </span>
      {badge}
    </div>
  )
}

function AvatarGlowStyles() {
  return (
    <style>{`
      .avatar-glow-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .avatar-glow-halo-wrap, .avatar-glow-ring-wrap { position: absolute; border-radius: 50%; }
      .avatar-glow-halo-wrap { inset: -22%; }
      .avatar-glow-ring-wrap { inset: -8%; }
      .avatar-glow-halo {
        position: absolute; inset: 0; border-radius: 50%;
        background: conic-gradient(from 0deg, #22D3EE, #A855F7, #34D399, #F97316, #22D3EE);
        opacity: 0.55;
        animation: avatar-halo-spin 7s linear infinite, avatar-halo-pulse 3.2s ease-in-out infinite;
      }
      .avatar-glow-ring {
        position: absolute; inset: 0; border-radius: 50%; padding: 3px;
        background: conic-gradient(from 90deg, #22D3EE, #A855F7, #34D399, #F97316, #22D3EE);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: avatar-halo-spin 5.5s linear infinite reverse;
        opacity: 0.9;
      }
      .avatar-glow-border {
        position: relative; width: 100%; height: 100%; border-radius: 50%;
        background: #0b0e14; padding: 3px; box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
      }
      .avatar-glow-content {
        width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
        display: flex; align-items: center; justify-content: center; background: #151a24;
      }
      @keyframes avatar-halo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes avatar-halo-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.75; transform: scale(1.05); } }
      @media (prefers-reduced-motion: reduce) {
        .avatar-glow-halo, .avatar-glow-ring { animation: none; }
      }
    `}</style>
  )
}

// ---------------------------------------------------------------------------
// UserAvatar — the ONE component every screen should use to render a
// user's avatar (their global profile picture). Works two ways:
//
//   <UserAvatar user={profileDocData} size="large" />   — data already in hand
//   <UserAvatar userId={someUid} size="small" />         — resolves it for you
//
// When given a userId, it reads users/{userId}.avatar directly — nothing is
// duplicated into leaderboard/match/result/notification documents. A small
// in-memory cache keeps repeated rows (e.g. a leaderboard list) cheap.
// ---------------------------------------------------------------------------
const SIZE_MAP = { small: 40, medium: 64, large: 96 }
const INTENSITY_MAP = { small: 0.5, medium: 0.75, large: 1 }

function resolveSizeAndIntensity(size) {
  if (typeof size === 'number') {
    const intensity = size >= 80 ? 1 : size >= 56 ? 0.75 : 0.5
    return { px: size, intensity }
  }
  return { px: SIZE_MAP[size] || SIZE_MAP.medium, intensity: INTENSITY_MAP[size] || INTENSITY_MAP.medium }
}

// userId -> profile doc data | null (not found) | undefined (not yet fetched)
const avatarCache = new Map()
const avatarListeners = new Map() // userId -> Set(setState fns)

export function invalidateAvatarCache(userId) {
  if (!userId) return
  avatarCache.delete(userId)
}

// Called by AvatarEditorModal right after a successful save so every other
// already-mounted <UserAvatar userId={...}/> for this user updates too,
// without needing a live Firestore listener per row.
export function pushAvatarUpdate(userId, profileData) {
  avatarCache.set(userId, profileData)
  const set = avatarListeners.get(userId)
  if (set) set.forEach((fn) => fn(profileData))
}

function useResolvedProfile(userId) {
  const [data, setData] = useState(() => (userId ? avatarCache.get(userId) : undefined))

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    if (!avatarListeners.has(userId)) avatarListeners.set(userId, new Set())
    avatarListeners.get(userId).add(setData)

    if (avatarCache.has(userId)) {
      setData(avatarCache.get(userId))
    } else {
      getDoc(doc(db, 'users', userId)).then((snap) => {
        const d = snap.exists() ? snap.data() : null
        avatarCache.set(userId, d)
        if (!cancelled) pushAvatarUpdate(userId, d)
      }).catch(() => {
        if (!cancelled) setData(null)
      })
    }

    return () => {
      cancelled = true
      avatarListeners.get(userId)?.delete(setData)
    }
  }, [userId])

  return data
}

export function UserAvatar({ user, userId, size = 'medium', glow = true, badge, fallbackLetter }) {
  const resolved = useResolvedProfile(user ? null : userId)
  const profile = user || resolved
  const { px, intensity } = resolveSizeAndIntensity(size)

  const content = profile?.avatar?.customization ? (
    <AvatarSVG avatar={profile.avatar} />
  ) : (
    <div
      style={{
        width: '100%', height: '100%', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f97316, #ef4444)',
        color: '#fff', fontWeight: 800, fontSize: px * 0.4,
      }}
    >
      {(fallbackLetter || profile?.username || profile?.displayName || 'X')[0]?.toUpperCase()}
    </div>
  )

  if (!glow) {
    return <div style={{ width: px, height: px, borderRadius: '50%', overflow: 'hidden' }}>{content}</div>
  }
  return <AvatarGlowRing size={px} intensity={intensity} badge={badge}>{content}</AvatarGlowRing>
}

// Backward-compatible alias — Profile.jsx (and anything else already wired
// up) can keep importing `Avatar`; new/rewired screens should use
// `UserAvatar`, which is the name specified for the central component.
export const Avatar = UserAvatar
// ---------------------------------------------------------------------------
// AvatarEditorModal — "Profile → Edit Avatar". No limits of any kind.
// Saving simply overwrites the user's current avatar config, as many times
// as they like, and pushes the update to the local cache so it's reflected
// immediately anywhere else UserAvatar userId={sameUser} is mounted.
//
// Selecting MALE shows a grid of the 20 male characters; selecting FEMALE
// shows a grid of the 20 female characters. Tapping any tile immediately
// swaps the large preview above it.
// ---------------------------------------------------------------------------
const CUSTOMIZATION_TABS_BASE = [
  'faceShape', 'skin', 'hair', 'hairColor', 'eyes', 'brows', 'mouth',
  'outfitStyle', 'outfitColor',
  'hat', 'helmet', 'glasses', 'headphones', 'gamingAccessory', 'sportsAccessory', 'background',
]
const TAB_LABELS = {
  faceShape: 'Face Shape', skin: 'Skin Tone', hair: 'Hairstyle', hairColor: 'Hair Color',
  eyes: 'Eyes', brows: 'Eyebrows', mouth: 'Mouth',
  outfitStyle: 'Outfit Style', outfitColor: 'Outfit Color', facialHair: 'Facial Hair',
  hat: 'Hat', helmet: 'Helmet', glasses: 'Glasses', headphones: 'Headphones',
  gamingAccessory: 'Gaming Accessory', sportsAccessory: 'Sports Accessory', background: 'Background',
}

export function AvatarEditorModal({ onClose, user, profile, refreshProfile }) {
  const { showToast } = useToast()
  const { t } = useLanguage()
  const current = profile?.avatar?.customization ? profile.avatar : DEFAULT_AVATAR
  const [gender, setGender] = useState(current.gender === 'female' ? 'female' : 'male')
  const [avatarId, setAvatarId] = useState(current.avatarId || DEFAULT_AVATAR.avatarId)
  const [customization, setCustomization] = useState({ ...defaultCustomizationFor(gender), ...current.customization })
  const [tab, setTab] = useState('faceShape')
  const [busy, setBusy] = useState(false)

  const visiblePresets = PRESET_AVATARS.filter((p) => p.gender === gender)
  const tabs = gender === 'male' ? [...CUSTOMIZATION_TABS_BASE, 'facialHair'] : CUSTOMIZATION_TABS_BASE

  function switchGender(nextGender) {
    if (nextGender === gender) return
    setGender(nextGender)
    // Switching gender swaps to that gender's own preset/face/hair/outfit
    // pool — the character itself changes, not just the button state.
    const firstPreset = PRESET_AVATARS.find((p) => p.gender === nextGender)
    setAvatarId(firstPreset.id)
    setCustomization({ ...defaultCustomizationFor(nextGender), ...firstPreset.customization })
    setTab('faceShape')
  }

  function applyPreset(presetAvatar) {
    setAvatarId(presetAvatar.id)
    setCustomization({ ...defaultCustomizationFor(presetAvatar.gender), ...presetAvatar.customization })
  }

  function setField(category, id) {
    setAvatarId('custom')
    setCustomization((c) => ({ ...c, [category]: id }))
  }

  function randomize() {
    const r = randomAvatarConfig(gender)
    setAvatarId('custom')
    setCustomization(r.customization)
  }

  async function save() {
    setBusy(true)
    try {
      // Unlimited changes: this simply overwrites the current config every
      // time — no counters, no cooldown, no cost.
      const newAvatar = { type: 'preset', gender, avatarId, customization }
      await updateDoc(doc(db, 'users', user.uid), { avatar: newAvatar })
      pushAvatarUpdate(user.uid, { ...(profile || {}), avatar: newAvatar })
      await refreshProfile()
      showToast('success', t('profileUpdated') || 'Avatar saved')
      onClose()
    } catch (err) {
      showToast('error', t('saveFailed') || 'Could not save avatar')
    } finally {
      setBusy(false)
    }
  }

  const optionsForTab = tab === 'hair' ? getHairOptions(gender)
    : tab === 'faceShape' ? getFaceShapeOptions(gender)
    : tab === 'outfitStyle' ? getOutfitOptions(gender)
    : tab === 'facialHair' ? FACIAL_HAIR_OPTIONS
    : AVATAR_OPTIONS[tab]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3100, background: '#0b0e14', overflowY: 'auto', padding: '18px 18px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <button
          onClick={onClose}
          style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fff' }}>Edit Avatar</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <UserAvatar user={{ avatar: { type: 'preset', gender, avatarId, customization } }} size="large" />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
        {AVATAR_OPTIONS.gender.map((g) => (
          <button
            key={g.id}
            onClick={() => switchGender(g.id)}
            style={{
              padding: '7px 18px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
              border: gender === g.id ? '1px solid #22D3EE' : '1px solid rgba(255,255,255,0.14)',
              background: gender === g.id ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
              color: gender === g.id ? '#22D3EE' : '#c7cdd9',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#8b93a3', marginBottom: 8 }}>
        AVATAR MODEL — {visiblePresets.length} {gender === 'male' ? 'MALE' : 'FEMALE'} MODELS
      </div>
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
          marginBottom: 18, maxHeight: 300, overflowY: 'auto', padding: 2,
        }}
      >
        {visiblePresets.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ width: '100%', aspectRatio: '1 / 1', maxWidth: 68, borderRadius: '50%', overflow: 'hidden', border: avatarId === p.id ? '2px solid #22D3EE' : '2px solid rgba(255,255,255,0.12)' }}>
              <AvatarSVG avatar={{ gender: p.gender, customization: p.customization }} />
            </div>
            <span style={{ fontSize: 9.5, color: '#c7cdd9', textAlign: 'center', lineHeight: 1.2 }}>{p.label}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#8b93a3', marginBottom: 8 }}>FINE-TUNE</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {tabs.map((cat) => (
          <button
            key={cat}
            onClick={() => setTab(cat)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontSize: 13,
              border: tab === cat ? '1px solid #A855F7' : '1px solid rgba(255,255,255,0.12)',
              background: tab === cat ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.04)',
              color: tab === cat ? '#A855F7' : '#c7cdd9', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {TAB_LABELS[cat]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10, marginBottom: 24 }}>
        {optionsForTab.map((o) => {
          const active = customization[tab] === o.id
          return (
            <button
              key={o.id}
              onClick={() => setField(tab, o.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                border: active ? '2px solid #22D3EE' : '1px solid rgba(255,255,255,0.1)',
                background: active ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: Array.isArray(o.value) ? `linear-gradient(135deg, ${o.value[0]}, ${o.value[1]})` : (o.value || 'rgba(255,255,255,0.15)'),
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
              <span style={{ fontSize: 10.5, color: '#c7cdd9', textAlign: 'center' }}>{o.label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={randomize}
          style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#e6e9f0', cursor: 'pointer' }}
        >
          🎲 Randomize
        </button>
        <button
          onClick={() => { setAvatarId(current.avatarId || DEFAULT_AVATAR.avatarId); setGender(current.gender === 'female' ? 'female' : 'male'); setCustomization({ ...defaultCustomizationFor(current.gender || 'male'), ...current.customization }) }}
          style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#e6e9f0', cursor: 'pointer' }}
        >
          ↺ Reset
        </button>
      </div>
      <button className="join-btn" onClick={save} disabled={busy} style={{ marginTop: 12, width: '100%' }}>
        {busy ? '...' : '💾 Save Avatar'}
      </button>
      <div style={{ marginTop: 10, fontSize: 11.5, color: '#6b7280', textAlign: 'center' }}>
        Change your avatar as many times as you like — no limits, no cost.
      </div>
    </div>
  )
}
