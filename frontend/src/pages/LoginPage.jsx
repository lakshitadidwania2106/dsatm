import { useState } from 'react'
import { Bus, Train, User, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useI18n } from '../hooks/useI18n'
import './LoginPage.css'

export const LoginPage = () => {
  const { t } = useI18n()
  const [selectedRole, setSelectedRole] = useState(null)
  const navigate = useNavigate()
  const setUserRole = useAppStore((state) => state.setUserRole)

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setUserRole(role)
    
    setTimeout(() => {
      if (role === 'driver') {
        navigate('/driver')
      } else {
        navigate('/')
      }
    }, 500)
  }

  return (
    <div className="login-page">
      <div className="login-animation-container">
        <div className="track">
          <div className="bus-animation">
            <Bus size={48} />
          </div>
          <div className="metro-animation">
            <Train size={48} />
          </div>
        </div>
      </div>
      
      <div className="login-content">
        <div className="login-header">
          <h1>EasyRide</h1>
          <p>{t('chooseRole')}</p>
        </div>

        <div className="role-selection">
          <button
            className={`role-card ${selectedRole === 'user' ? 'selected' : ''}`}
            onClick={() => handleRoleSelect('user')}
          >
            <div className="role-icon">
              <User size={32} />
            </div>
            <h2>{t('userRole')}</h2>
            <p>{t('userRoleDesc')}</p>
          </button>

          <button
            className={`role-card ${selectedRole === 'driver' ? 'selected' : ''}`}
            onClick={() => handleRoleSelect('driver')}
          >
            <div className="role-icon">
              <Shield size={32} />
            </div>
            <h2>{t('driverRole')}</h2>
            <p>{t('driverRoleDesc')}</p>
          </button>
        </div>
      </div>
    </div>
  )
}

