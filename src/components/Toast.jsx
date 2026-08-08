import { useEffect } from 'react'
import './Toast.css'
import { useLanguage } from '../context/LanguageContext'

const ICONS = {
  error: '⚠️',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
}

const TITLE_KEYS = {
  error: 'toastError',
  warning: 'toastWarning',
  success: 'toastSuccess',
  info: 'toastInfo',
}

// A single Toast card — dark + red-border style,
// icon blinks/pulses (CSS animation).
export default function Toast({ id, type = 'error', title, message, duration = 5000, onClose }) {
  const { t } = useLanguage()

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
          <span className="toast-title">{title || t(TITLE_KEYS[type] || 'toastError')}</span>
          <button className="toast-close" onClick={() => onClose(id)} aria-label={t('toastClose')}>✕</button>
        </div>
        <div className="toast-message">{message}</div>
      </div>
    </div>
  )
}