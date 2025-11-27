import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, X } from 'lucide-react'

// Fix Leaflet default icon
if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const MapController = ({ center, onLocationFound, onMapClick }) => {
  const map = useMap()
  const hasLocated = useRef(false)

  useMapEvents({
    click: (e) => {
      onMapClick(e)
    },
  })

  useEffect(() => {
    if (hasLocated.current) return

    // Try to get user's current location with high accuracy
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          
          // Only use if accuracy is reasonable (within 100 meters)
          if (accuracy <= 100) {
            const userLocation = { lat: latitude, lng: longitude }
            map.setView([latitude, longitude], 16)
            onLocationFound?.(userLocation)
            hasLocated.current = true
          } else {
            // If accuracy is poor, still use it but zoom out a bit
            map.setView([latitude, longitude], 14)
            onLocationFound?.({ lat: latitude, lng: longitude })
            hasLocated.current = true
          }
        },
        () => {
          // Fallback to Leaflet's locate method
          map.locate({
            setView: true,
            maxZoom: 16,
            enableHighAccuracy: true,
            timeout: 10000,
            watch: false,
          })

          const handleLocationFound = (e) => {
            if (!hasLocated.current) {
              const latlng = e.latlng || { lat: e.lat, lng: e.lng }
              map.setView([latlng.lat, latlng.lng], 16)
              onLocationFound?.({ lat: latlng.lat, lng: latlng.lng })
              hasLocated.current = true
            }
          }

          const handleLocationError = () => {
            // Gracefully fallback to default center (Delhi)
            // No error message shown to user
            if (!hasLocated.current) {
              map.setView(center, 13)
              hasLocated.current = true
            }
          }

          map.on('locationfound', handleLocationFound)
          map.on('locationerror', handleLocationError)

          return () => {
            map.off('locationfound', handleLocationFound)
            map.off('locationerror', handleLocationError)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Don't use cached position
        }
      )
    } else {
      // Fallback if geolocation is not supported
      map.setView(center, 13)
      hasLocated.current = true
    }
  }, [map, center, onLocationFound])

  return null
}

export const LocationSelectorModal = ({ isOpen, onClose, onConfirm, fieldLabel, defaultCenter = [28.6139, 77.2090] }) => {
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [marker, setMarker] = useState(null)

  useEffect(() => {
    if (isOpen) {
      // Set initial marker to default center
      setMarker(defaultCenter)
      setSelectedLocation(defaultCenter)
    } else {
      // Reset when closed
      setMarker(null)
      setSelectedLocation(null)
    }
  }, [isOpen, defaultCenter])

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng
    setMarker([lat, lng])
    setSelectedLocation([lat, lng])
  }

  const handleLocationFound = (location) => {
    const lat = location.lat || location.latitude
    const lng = location.lng || location.longitude
    setMarker([lat, lng])
    setSelectedLocation([lat, lng])
  }

  const handleConfirm = () => {
    if (selectedLocation) {
      onConfirm(selectedLocation)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="location-modal-overlay" onClick={onClose}>
      <div className="location-modal" onClick={(e) => e.stopPropagation()}>
        <div className="location-modal-header">
          <h3>Select {fieldLabel}</h3>
          <button className="location-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="location-modal-map">
          <MapContainer
            center={defaultCenter}
            zoom={13}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
            key={isOpen ? 'open' : 'closed'}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController
              center={defaultCenter}
              onLocationFound={handleLocationFound}
              onMapClick={handleMapClick}
            />
            {marker && <Marker position={marker} />}
          </MapContainer>
        </div>
        <div className="location-modal-footer">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={handleConfirm} disabled={!selectedLocation}>
            <MapPin size={16} />
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  )
}

