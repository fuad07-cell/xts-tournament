// Prefixes a root-relative asset path with Vite's BASE_URL.
//
// Why this exists: on localhost the site is served from "/", so
// "/images/foo.png" resolves correctly. On GitHub Pages the site is served
// from a subfolder ("/xts-tournament/"), so a hardcoded "/images/foo.png"
// actually points at the wrong place (the domain root) and 404s.
// import.meta.env.BASE_URL is "/" locally and "/xts-tournament/" in the
// GitHub Pages build (set via vite.config.js's `base`), so this helper
// makes every local image path work in both places automatically.
//
// Only touches paths that start with "/" (local paths). Full URLs
// (https://...) are returned unchanged, since those already work anywhere.
export function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
