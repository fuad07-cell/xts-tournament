import { useEffect } from 'react'
import './Toast.css'

const ICONS = {
  error: '⚠️',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
}

const TITLES = {
  error: 'ব্যর্থ',
  warning: 'সতর্কতা',
  success: 'সফল',
  info: 'তথ্য',
}

// একটা একক Toast card — 2nd ss এর মতো dark + red-border style,
// icon টা blink/pulse করে (CSS animation দিয়ে)।
export default function Toast({ id, type = 'error', title, message, duration = 5000, onClose }) {
  useEffect(() => {
    if (!duration) return
    const timer = setTimeout(() => onClose(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-icon-wrap">
        <span className="toast-icon">{ICONS[type] || ICONS.error}</span>
      </div>

      <div className="toast-content">
        <div className="toast-title-row">
          <span className="toast-title">{title || TITLES[type] || TITLES.error}</span>
          <button className="toast-close" onClick={() => onClose(id)} aria-label="বন্ধ করুন">✕</button>
        </div>
        <div className="toast-message">{message}</div>
      </div>
    </div>
  )
}
