import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'

const MapAutoCenter = ({ center }) => {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, 14)
    }
  }, [center, map])
  return null
}

const userMarker = {
  radius: 10,
  color: '#2563eb',
  fillColor: '#2563eb',
  fillOpacity: 0.3,
}

export const MapView = ({ buses, onSelectBus, selectedBus, userLocation, routePreview }) => {
  const { t } = useI18n()
  const lastUpdated = useAppStore((state) => state.lastUpdated)

  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const center = userLocation ? [userLocation.lat, userLocation.lng] : [12.9716, 77.5946]

  return (
    <div className="map-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('mapTitle')}</p>
          <h2>{t('liveBuses')}</h2>
        </div>
        {lastUpdated && (
          <span className="meta">{`${t('lastUpdated')}: ${new Date(lastUpdated).toLocaleTimeString()}`}</span>
        )}
      </header>
      <div className="map-container">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-root">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapAutoCenter center={center} />
          {userLocation && (
            <CircleMarker center={[userLocation.lat, userLocation.lng]} pathOptions={userMarker}>
              <Popup>{t('locating')}</Popup>
            </CircleMarker>
          )}
          {routePreview?.coordinates && (
            <>
              <Polyline positions={routePreview.coordinates} pathOptions={{ color: '#2563eb', weight: 6 }} />
              <CircleMarker
                center={routePreview.coordinates[0]}
                radius={9}
                pathOptions={{ color: '#2563eb', fillColor: '#fff', fillOpacity: 1 }}
              />
              <CircleMarker
                center={routePreview.coordinates[routePreview.coordinates.length - 1]}
                radius={9}
                pathOptions={{ color: '#16a34a', fillColor: '#fff', fillOpacity: 1 }}
              />
            </>
          )}
          {buses.map((bus) => (
            <CircleMarker
              key={bus.id}
              center={[bus.lat, bus.lng]}
              pathOptions={{
                color: selectedBus?.id === bus.id ? '#16a34a' : '#0f172a',
                fillColor: '#0f172a',
                fillOpacity: 0.8,
              }}
              radius={8}
              eventHandlers={{
                click: () => onSelectBus(bus),
              }}
            >
              <Popup>
                <strong>{bus.route}</strong>
                <br />
                {t('eta')}: {bus.eta}
                <br />
                {t('cost')}: {bus.cost}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}

