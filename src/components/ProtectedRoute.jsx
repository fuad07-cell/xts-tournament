import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) return <div className="loading-screen">{t('loading')}</div>
  if (!user) return <Navigate to="/auth" replace />
  return children
}
