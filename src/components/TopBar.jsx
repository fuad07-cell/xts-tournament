import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function TopBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="topbar">
      <div className="logo">
        <span className="bracket">XTS</span>Tournament
        <span className="logo-sub">BD</span>
      </div>
      <div className="top-actions">
        <NotificationBell />
        <div className="icon-pill wallet" onClick={() => navigate('/profile')}>
          ৳ {profile?.walletBalance ?? 0}
        </div>
      </div>
    </div>
  )
}
