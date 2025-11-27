import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MapController = ({ center, zoom, isDemo }) => {
  const map = useMap()
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!center) return
    
    if (isFirstLoad.current) {
      map.setView(center, zoom || 16)
      isFirstLoad.current = false
      return
    }
    
    // During demo, let SmoothDemoMarker handle panning to avoid conflicts
    // Only set initial view here, not during updates
    if (!isDemo) {
      map.setView(center, zoom || 16, { animate: true })
    }
  }, [center, map, zoom, isDemo])

  return null
}

// Smooth moving marker for demo - updates position without causing re-renders
const SmoothDemoMarker = ({ position, driverProfile }) => {
  const circleRef = useRef(null)
  const map = useMap()
  const lastPanTime = useRef(0)

  // Create the marker once
  useEffect(() => {
    if (!circleRef.current && position) {
      const circle = L.circleMarker([position.lat, position.lng], {
        radius: 10,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(map)

      const popupContent = `
        <div style="text-align: center;">
          <strong style="font-size: 14px; display: block; margin-bottom: 4px;">Demo Location</strong>
          ${driverProfile ? `
            <div style="font-size: 12px; color: #666;">Bus: ${driverProfile.busNumber}</div>
            <div style="font-size: 12px; color: #666;">Route: ${driverProfile.route}</div>
          ` : ''}
          <div style="font-size: 11px; color: #999; margin-top: 4px;">Demo mode active</div>
        </div>
      `
      circle.bindPopup(popupContent)
      circleRef.current = circle
    }

    return () => {
      if (circleRef.current) {
        map.removeLayer(circleRef.current)
        circleRef.current = null
      }
    }
  }, [map, driverProfile]) // Only run once on mount

  // Update position smoothly
  useEffect(() => {
    if (circleRef.current && position) {
      // Update marker position directly (smooth, no re-render)
      circleRef.current.setLatLng([position.lat, position.lng])
      
      // Throttle map panning to reduce flicker (only pan every 500ms)
      const now = Date.now()
      if (now - lastPanTime.current > 500) {
        // Use panTo instead of setView for smoother movement
        map.panTo([position.lat, position.lng], {
          animate: true,
          duration: 0.5,
          easeLinearity: 0.25
        })
        lastPanTime.current = now
      }
    }
  }, [position, map])

  return null
}

// Create a custom bus icon for driver
const createDriverBusIcon = () => {
  return L.divIcon({
    className: 'driver-bus-icon',
    html: `
      <div style="
        position: relative;
        background-color: #22c55e;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" fill="currentColor"/>
          <path d="M7 8H17V10H7V8Z" fill="white"/>
          <path d="M7 12H17V14H7V12Z" fill="white"/>
          <circle cx="8" cy="17" r="1.5" fill="white"/>
          <circle cx="16" cy="17" r="1.5" fill="white"/>
        </svg>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #22c55e;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          border: 2px solid white;
        ">YOU'RE HERE</div>
      </div>
    `,
    iconSize: [40, 56],
    iconAnchor: [20, 56],
    popupAnchor: [0, -56]
  })
}

export const DriverMapView = ({ driverLocation, driverProfile, isDemo }) => {
  const [mapReady, setMapReady] = useState(false)
  const stableCenterRef = useRef(null)
  
  // Default to Delhi if no location
  const defaultCenter = [28.6139, 77.2090]
  
  // During demo, use stable center (set once) to prevent re-renders
  // During normal mode, use current location
  let mapCenter
  if (isDemo) {
    // Set stable center only once when demo starts
    if (!stableCenterRef.current && driverLocation) {
      stableCenterRef.current = [driverLocation.lat, driverLocation.lng]
    }
    mapCenter = stableCenterRef.current || defaultCenter
  } else {
    // Normal mode: update center with location
    mapCenter = driverLocation 
      ? [driverLocation.lat, driverLocation.lng] 
      : defaultCenter
    // Reset stable center when not in demo
    stableCenterRef.current = null
  }
  
  // Use zoomed in view for demo, normal zoom otherwise
  const mapZoom = isDemo ? 18 : (driverLocation ? 16 : 13)

  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
    setMapReady(true)
  }, [])

  if (!mapReady) {
    return <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>Loading map...</div>
  }

  return (
    <MapContainer 
      center={mapCenter} 
      zoom={mapZoom} 
      scrollWheelZoom 
      className="leaflet-root"
      style={{ height: '100%', width: '100%' }}
      key="driver-map-static" // Static key to prevent remounting
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapController center={mapCenter} zoom={mapZoom} isDemo={isDemo} />
      {driverLocation && (
        <>
          {isDemo ? (
            <SmoothDemoMarker position={driverLocation} driverProfile={driverProfile} />
          ) : (
            <Marker
              position={[driverLocation.lat, driverLocation.lng]}
              icon={createDriverBusIcon()}
            >
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    You're Here
                  </strong>
                  {driverProfile && (
                    <>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Bus: {driverProfile.busNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Route: {driverProfile.route}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    {driverLocation.timestamp && 
                      `Last updated: ${new Date(driverLocation.timestamp).toLocaleTimeString()}`
                    }
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </>
      )}
    </MapContainer>
  )
}
