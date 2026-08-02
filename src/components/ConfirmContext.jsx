import { createContext, useCallback, useContext, useState } from 'react'

const ConfirmContext = createContext(null)

// App.jsx এর সবচেয়ে বাইরে <ConfirmProvider> দিয়ে wrap করে দিন (ToastProvider এর
// পাশাপাশি বা ভেতরে/বাইরে, ক্রম কোনো ব্যাপার না):
//
//   <ConfirmProvider>
//     <ToastProvider>
//       <App />
//     </ToastProvider>
//   </ConfirmProvider>
//
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null) // { message, danger, resolve }

  const confirmAction = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({ message, danger: !!opts.danger, resolve })
    })
  }, [])

  function handle(result) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {state && (
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
                বাতিল
              </button>
              <button
                onClick={() => handle(true)}
                className="join-btn"
                style={{
                  flex: 1, margin: 0,
                  background: state.danger ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : undefined,
                }}
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// ব্যবহার:
//
//   const confirmAction = useConfirm()
//   if (!(await confirmAction('আপনি কি নিশ্চিত?'))) return
//   if (!(await confirmAction('এটা ডিলিট হয়ে যাবে', { danger: true }))) return
//
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
