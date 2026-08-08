import React, { createContext, useCallback, useContext, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

const ConfirmContext = createContext(null)

// Inner component that renders the dialog — placed INSIDE the Provider
// so it can consume LanguageContext.
function ConfirmDialog({ state, onResult }) {
  const { t } = useLanguage()

  function handle(result) {
    onResult(result)
  }

  return (
    <div className="overlay overlay-center" onClick={() => handle(false)}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', maxWidth: 360 }}
      >
        <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 22, color: '#e6e9f0' }}>
          {state.message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => handle(false)}
            style={{
              flex: 1, padding: '13px 10px', borderRadius: 12, cursor: 'pointer',
              fontWeight: 700, fontSize: 14, border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: '#b8bcc8',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => handle(true)}
            className="join-btn"
            style={{
              flex: 1, margin: 0,
              background: state.danger ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : undefined,
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { message, danger, resolve }

  const confirmAction = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({ message, danger: !!opts.danger, resolve })
    })
  }, [])

  function handleResult(result) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {state && <ConfirmDialog state={state} onResult={handleResult} />}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
