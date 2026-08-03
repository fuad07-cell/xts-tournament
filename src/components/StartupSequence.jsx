import { useEffect, useMemo, useRef, useState } from 'react'
import './StartupSequence.css'

// ---------------------------------------------------------------------------
// StartupSequence — full-screen boot sequence shown once when the site opens.
//   Phase 1  "splash"   ~2.5s  logo fade-in + letter-reveal app name + glow bg
//   Phase 2  "loading"  ~2.0s  circular loader + progress bar + rotating text
//   Phase 3  "exit"      ~0.5s fade/scale out, then onDone() reveals the app
// Pure CSS animation (transform/opacity), no external libraries.
// ---------------------------------------------------------------------------

const APP_NAME = 'TOURNAMENT'

const LOADING_STEPS = [
  { at: 0, text: 'Initializing...' },
  { at: 25, text: 'Loading assets...' },
  { at: 60, text: 'Preparing tournaments...' },
  { at: 88, text: 'Almost Ready...' },
]

export default function StartupSequence({ onDone }) {
  const [phase, setPhase] = useState('splash')
  const [progress, setProgress] = useState(0)

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Phase 1 -> 2
  useEffect(() => {
    const splashDuration = reduceMotion ? 900 : 2500
    const t = setTimeout(() => setPhase('loading'), splashDuration)
    return () => clearTimeout(t)
  }, [reduceMotion])

  // Phase 2 progress drive
  useEffect(() => {
    if (phase !== 'loading') return
    const duration = reduceMotion ? 700 : 2000
    const start = performance.now()
    let raf

    function tick(now) {
      const elapsed = now - start
      const pct = Math.min(100, Math.round((elapsed / duration) * 100))
      setProgress(pct)
      if (pct < 100) {
        raf = requestAnimationFrame(tick)
      } else {
        setTimeout(() => setPhase('exit'), 220)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, reduceMotion])

  // Phase 3 -> onDone
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(() => doneRef.current?.(), reduceMotion ? 250 : 550)
    return () => clearTimeout(t)
  }, [phase, reduceMotion])

  const currentText =
    [...LOADING_STEPS].reverse().find((s) => progress >= s.at)?.text ?? LOADING_STEPS[0].text

  const R = 42
  const CIRCUMFERENCE = 2 * Math.PI * R
  const dashOffset = CIRCUMFERENCE * (1 - progress / 100)
  const isLoading = phase === 'loading' || phase === 'exit'

  return (
    <div
      className={'startup' + (phase === 'exit' ? ' startup-exit' : '')}
      role="status"
      aria-live="polite"
      aria-label="XTS Tournament BD লোড হচ্ছে"
    >
      <span className="startup-glow startup-glow-a" aria-hidden="true" />
      <span className="startup-glow startup-glow-b" aria-hidden="true" />
      <span className="startup-grid" aria-hidden="true" />

      <div className={'startup-stage' + (isLoading ? ' stage-loading' : ' stage-splash')}>
        {/* ---------- Phase 1: Splash ---------- */}
        <div className="splash-content">
          <div className="splash-logo">
            <span className="bracket splash-bracket">XTS</span>
            <span className="splash-name" aria-label={APP_NAME}>
              {APP_NAME.split('').map((ch, i) => (
                <span key={i} className="splash-letter" style={{ '--i': i }}>
                  {ch}
                </span>
              ))}
            </span>
            <span className="logo-sub splash-sub">BD</span>
          </div>
          <div className="splash-tag">COMPETITIVE ESPORTS ARENA</div>
        </div>

        {/* ---------- Phase 2: Loading ---------- */}
        <div className="loading-content">
          <div className="loader-ring-wrap">
            <svg className="loader-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="loader-track" cx="50" cy="50" r={R} />
              <circle
                className="loader-arc"
                cx="50"
                cy="50"
                r={R}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="loader-pct">{progress}%</span>
          </div>

          <div className="loader-bar-track">
            <div className="loader-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="loader-text" key={currentText}>
            {currentText}
          </div>
        </div>
      </div>
    </div>
  )
}
