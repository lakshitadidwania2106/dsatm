import { useState, useEffect } from 'react'
import { MapPin, Bus, User, Phone, FileText, Navigation, Power, Clock, Users } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useNavigate } from 'react-router-dom'
import './DriverPage.css'

export const DriverPage = () => {
  const navigate = useNavigate()
  const driverProfile = useAppStore((state) => state.driverProfile)
  const isSharingLocation = useAppStore((state) => state.isSharingLocation)
  const toggleLocationSharing = useAppStore((state) => state.toggleLocationSharing)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationInterval, setLocationInterval] = useState(null)

  useEffect(() => {
    if (isSharingLocation) {
      const updateLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const loc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString(),
              }
              setCurrentLocation(loc)
              setUserLocation(loc)
            },
            (error) => console.error('Location error:', error),
            { enableHighAccuracy: true }
          )
        }
      }

      updateLocation()
      const interval = setInterval(updateLocation, 10000)
      setLocationInterval(interval)

      return () => {
        if (interval) clearInterval(interval)
      }
    } else {
      if (locationInterval) {
        clearInterval(locationInterval)
        setLocationInterval(null)
      }
    }
  }, [isSharingLocation, setUserLocation])

  const handleToggleSharing = () => {
    toggleLocationSharing()
  }

  const handleLogout = () => {
    useAppStore.getState().logout()
    navigate('/login')
  }

  return (
    <div className="driver-page">
      <header className="driver-header">
        <div>
          <h1>Driver Dashboard</h1>
          <p>Manage your route and location sharing</p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div className="driver-content">
        <section className="driver-profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              <User size={32} />
            </div>
            <div>
              <h2>{driverProfile.name}</h2>
              <p className="profile-role">Bus Driver</p>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-item">
              <div className="detail-icon">
                <Bus size={20} />
              </div>
              <div>
                <p className="detail-label">Bus Number</p>
                <p className="detail-value">{driverProfile.busNumber}</p>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-icon">
                <MapPin size={20} />
              </div>
              <div>
                <p className="detail-label">Route</p>
                <p className="detail-value">{driverProfile.route}</p>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-icon">
                <FileText size={20} />
              </div>
              <div>
                <p className="detail-label">Route ID</p>
                <p className="detail-value">{driverProfile.routeId}</p>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-icon">
                <FileText size={20} />
              </div>
              <div>
                <p className="detail-label">License Number</p>
                <p className="detail-value">{driverProfile.licenseNumber}</p>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-icon">
                <Phone size={20} />
              </div>
              <div>
                <p className="detail-label">Phone</p>
                <p className="detail-value">{driverProfile.phone}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="location-sharing-card">
          <div className="sharing-header">
            <div>
              <h3>Location Sharing</h3>
              <p>Share your real-time location with passengers</p>
            </div>
            <div className={`status-indicator ${isSharingLocation ? 'active' : ''}`}>
              <div className="status-dot" />
              <span>{isSharingLocation ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <button
            className={`sharing-toggle ${isSharingLocation ? 'active' : ''}`}
            onClick={handleToggleSharing}
          >
            <div className="toggle-icon">
              {isSharingLocation ? <Power size={24} /> : <Navigation size={24} />}
            </div>
            <div>
              <strong>{isSharingLocation ? 'Stop Sharing' : 'Start Sharing Location'}</strong>
              <p>
                {isSharingLocation
                  ? 'Your location is being shared with passengers'
                  : 'Enable real-time location tracking'}
              </p>
            </div>
          </button>

          {isSharingLocation && currentLocation && (
            <div className="location-info">
              <div className="location-detail">
                <MapPin size={16} />
                <span>
                  Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                </span>
              </div>
              <div className="location-detail">
                <Clock size={16} />
                <span>Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </section>

        <section className="stats-card">
          <h3>Today's Stats</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <Users size={24} />
              <div>
                <p className="stat-value">0</p>
                <p className="stat-label">Passengers</p>
              </div>
            </div>
            <div className="stat-item">
              <Clock size={24} />
              <div>
                <p className="stat-value">0h 0m</p>
                <p className="stat-label">Active Time</p>
              </div>
            </div>
            <div className="stat-item">
              <MapPin size={24} />
              <div>
                <p className="stat-value">0</p>
                <p className="stat-label">Trips Completed</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

