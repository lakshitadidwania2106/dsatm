import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import { SmoothBusMarker } from './SmoothBusMarker'
import { delhiMetroStations, delhiMetroLineColors } from '../data/delhiMetro'
import { fetchVirtualBuses, fetchShapes } from '../api/busService'

const MapController = ({ center, selectedBus, userLocation }) => {
  const map = useMap()
  const isFirstLoad = useRef(true)
  const hasCenteredOnUser = useRef(false)

  useEffect(() => {
    // Priority 1: Center on user location when it becomes available (first time only)
    if (userLocation && !hasCenteredOnUser.current) {
      map.setView([userLocation.lat, userLocation.lng], 14, { animate: true })
      hasCenteredOnUser.current = true
      isFirstLoad.current = false
      return
    }

    // Scenario A: First load - Center the map on default location
    if (isFirstLoad.current && center) {
      map.setView(center, 13)
      isFirstLoad.current = false
      return
    }

    // Scenario B: User clicked a specific bus - Fly to it
    if (selectedBus) {
      map.flyTo([selectedBus.lat, selectedBus.lng], 15, { animate: true })
    }

    // We REMOVED the logic that blindly calls setView on every update.
    // The map will now stay where the user dragged it, even if data updates.
  }, [center, map, selectedBus, userLocation])

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
  const [virtualBuses, setVirtualBuses] = useState([])
  const [shapes, setShapes] = useState({})

  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])


  // Default center - Delhi (since we're using Delhi data)
  const defaultDelhiCenter = [28.6139, 77.2090] // Connaught Place, Delhi
  const mapCenter = userLocation ? [userLocation.lat, userLocation.lng] : defaultDelhiCenter

  // Fetch Virtual Buses and Shapes
  useEffect(() => {
    const fetchVirtual = async () => {
      const vBuses = await fetchVirtualBuses();
      setVirtualBuses(vBuses);
    };

    const loadShapes = async () => {
      const data = await fetchShapes();
      setShapes(data);
    };

    fetchVirtual();
    loadShapes();

    const interval = setInterval(fetchVirtual, 5000);
    return () => clearInterval(interval);
  }, []);
  const defaultMetroCenter = delhiMetroStations.length
    ? [delhiMetroStations[0].latitude, delhiMetroStations[0].longitude]
    : defaultDelhiCenter
  const center = userLocation ? [userLocation.lat, userLocation.lng] : defaultMetroCenter

  const lineLegend = Object.entries(delhiMetroLineColors).sort((a, b) => a[0].localeCompare(b[0]))

  // Merge real and virtual buses for display
  const allBuses = [...buses, ...virtualBuses];

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
        <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="leaflet-root">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController center={mapCenter} selectedBus={selectedBus} userLocation={userLocation} />
          {userLocation && (
            <CircleMarker center={[userLocation.lat, userLocation.lng]} pathOptions={userMarker}>
              <Popup>{t('locating')}</Popup>
            </CircleMarker>
          )}
          {routePreview?.coordinates && (
            <>
              <Polyline
                positions={routePreview.coordinates}
                pathOptions={{
                  color: '#2563eb',
                  weight: 6,
                  opacity: 0.8,
                  dashArray: '10, 5'
                }}
              />
              <CircleMarker
                center={routePreview.coordinates[0]}
                radius={10}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }}
              >
                <Popup>Start: {routePreview.route?.boarding || 'Start'}</Popup>
              </CircleMarker>
              <CircleMarker
                center={routePreview.coordinates[routePreview.coordinates.length - 1]}
                radius={10}
                pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 }}
              >
                <Popup>End: {routePreview.route?.alighting || 'End'}</Popup>
              </CircleMarker>
            </>
          )}
          {delhiMetroStations.map((station) => {
            const color = delhiMetroLineColors[station.line] || '#334155'
            return (
              <CircleMarker
                key={station.id}
                center={[station.latitude, station.longitude]}
                radius={4}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <strong>{station.name}</strong>
                  <br />
                  Line: {station.line}
                  {station.opened && (
                    <>
                      <br />
                      Opened: {station.opened}
                    </>
                  )}
                  {station.layout && (
                    <>
                      <br />
                      Layout: {station.layout}
                    </>
                  )}
                </Popup>
              </CircleMarker>
            )
          })}

          {/* OSRM Route Shape for Selected Bus */}
          {selectedBus && shapes[selectedBus.route] && (
            <Polyline
              positions={shapes[selectedBus.route]}
              pathOptions={{ color: '#ef4444', weight: 5, opacity: 0.8, dashArray: '10, 10' }}
            />
          )}

          {allBuses.map((bus) => (
            <SmoothBusMarker
              key={bus.id}
              bus={bus}
              isSelected={selectedBus?.id === bus.id}
              onSelect={onSelectBus}
            />
          ))}
        </MapContainer>
        <div className="map-legend">
          <p className="legend-title">Delhi Metro Lines</p>
          <div className="legend-grid">
            {lineLegend.map(([line, color]) => (
              <div className="legend-row" key={line}>
                <span className="legend-swatch" style={{ backgroundColor: color }} />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

