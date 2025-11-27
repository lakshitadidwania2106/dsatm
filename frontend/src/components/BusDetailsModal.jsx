import { useState } from 'react'
import { X, Star, Bell, MapPin } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import './BusDetailsModal.css'

export const BusDetailsModal = ({ bus, onClose }) => {
  const { t } = useI18n()
  const favorites = useAppStore((state) => state.favorites)
  const addFavorite = useAppStore((state) => state.addFavorite)
  const removeFavorite = useAppStore((state) => state.removeFavorite)
  const favoriteStops = useAppStore((state) => state.favoriteStops)
  const addFavoriteStop = useAppStore((state) => state.addFavoriteStop)
  const cityStops = useAppStore((state) => state.cityStops)
  
  const [selectedStop, setSelectedStop] = useState('')
  const [showStopSelector, setShowStopSelector] = useState(false)
  
  const isFavorite = bus && favorites.some((fav) => fav.id === bus.id)
  const busFavoriteStops = bus ? favoriteStops.filter((fs) => fs.busId === bus.id) : []

  const handleToggleFavorite = () => {
    if (!bus) return
    
    if (isFavorite) {
      removeFavorite(bus.id)
    } else {
      addFavorite(bus)
    }
  }

  const handleAddStopNotification = () => {
    if (!bus || !selectedStop) return
    
    addFavoriteStop({
      busId: bus.id,
      stopName: selectedStop,
      busRoute: bus.route,
    })
    
    setSelectedStop('')
    setShowStopSelector(false)
    
    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const handleRemoveStop = (stopId) => {
    useAppStore.getState().removeFavoriteStop(stopId)
  }

  if (!bus) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bus-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="modal-header">
          <h2>{bus.route}</h2>
          <button
            className={`favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={handleToggleFavorite}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="modal-details">
          <div className="detail-row">
            <span className="detail-label">{t('eta')}</span>
            <span className="detail-value">{bus.eta}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('cost')}</span>
            <span className="detail-value">{bus.cost}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('boarding')}</span>
            <span className="detail-value">{bus.start}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('alighting')}</span>
            <span className="detail-value">{bus.end}</span>
          </div>
          {bus.occupancy && (
            <div className="detail-row">
              <span className="detail-label">Occupancy</span>
              <span className="detail-value">{bus.occupancy}</span>
            </div>
          )}
        </div>

        <div className="notification-section">
          <div className="notification-header">
            <Bell size={18} />
            <h3>Get Notifications</h3>
          </div>
          <p className="notification-desc">
            Get notified when this bus arrives at a specific stop
          </p>

          {!showStopSelector ? (
            <button
              className="add-stop-btn"
              onClick={() => setShowStopSelector(true)}
            >
              <MapPin size={16} />
              Add Stop Notification
            </button>
          ) : (
            <div className="stop-selector">
              <select
                value={selectedStop}
                onChange={(e) => setSelectedStop(e.target.value)}
                className="stop-select"
              >
                <option value="">Select a stop</option>
                {cityStops.map((stop) => (
                  <option key={stop.id} value={stop.name}>
                    {stop.name}
                  </option>
                ))}
              </select>
              <div className="stop-selector-actions">
                <button
                  className="save-stop-btn"
                  onClick={handleAddStopNotification}
                  disabled={!selectedStop}
                >
                  Save
                </button>
                <button
                  className="cancel-stop-btn"
                  onClick={() => {
                    setShowStopSelector(false)
                    setSelectedStop('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {busFavoriteStops.length > 0 && (
            <div className="favorite-stops-list">
              <p className="stops-label">Watching stops:</p>
              {busFavoriteStops.map((fs) => (
                <div key={fs.id} className="favorite-stop-item">
                  <MapPin size={14} />
                  <span>{fs.stopName}</span>
                  <button
                    className="remove-stop-btn"
                    onClick={() => handleRemoveStop(fs.id)}
                    aria-label="Remove stop"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

