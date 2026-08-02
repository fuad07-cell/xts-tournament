import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from './Toast'
import './Toast.css'

const ToastContext = createContext(null)

// App.jsx এর সবচেয়ে বাইরে <ToastProvider> দিয়ে wrap করে দিন, যেমন:
//
//   <ToastProvider>
//     <App />
//   </ToastProvider>
//
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((type, message, opts = {}) => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, type, message, title: opts.title, duration: opts.duration ?? 5000 }])
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, closeToast }}>
      {children}
      <div className="toast-viewport">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={closeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// যেকোনো component এর ভেতরে ব্যবহার:
//
//   const { showToast } = useToast()
//   showToast('error', 'Insufficient balance. You need ৳10 (৳10 × 1). Please deposit funds first.')
//   showToast('success', 'Withdrawal request submitted!')
//
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
