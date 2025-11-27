import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Bus, User, Navigation, Power, Clock, PlayCircle, Gauge, Route } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useNavigate } from 'react-router-dom'
import { DriverMapView } from '../components/DriverMapView'
import './DriverPage.css'

// Demo route with stops around Connaught Place, Delhi
const DEMO_ROUTE_STOPS = [
  { name: 'Connaught Place', lat: 28.6304, lng: 77.2177 },
  { name: 'Rajiv Chowk Metro', lat: 28.6325, lng: 77.2200 },
  { name: 'Janpath Market', lat: 28.6340, lng: 77.2220 },
  { name: 'India Gate', lat: 28.6129, lng: 77.2295 },
  { name: 'Khan Market', lat: 28.6000, lng: 77.2250 },
  { name: 'Lodhi Garden', lat: 28.5930, lng: 77.2200 },
  { name: 'Jor Bagh', lat: 28.5850, lng: 77.2150 },
  { name: 'AIIMS Metro', lat: 28.5670, lng: 77.2100 },
]

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export const DriverPage = () => {
  const navigate = useNavigate()
  const driverProfile = useAppStore((state) => state.driverProfile)
  const isSharingLocation = useAppStore((state) => state.isSharingLocation)
  const toggleLocationSharing = useAppStore((state) => state.toggleLocationSharing)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationInterval, setLocationInterval] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [demoBusAdded, setDemoBusAdded] = useState(false)
  const [busSpeed, setBusSpeed] = useState(0) // Speed in km/h
  const [nextStop, setNextStop] = useState(null)
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const demoAnimationRef = useRef(null)
  const lastLocationRef = useRef(null)
  const lastUpdateTimeRef = useRef(null)
  const isSharingRef = useRef(isSharingLocation)
  const demoBusAddedRef = useRef(false)
  
  // Keep refs in sync with state
  useEffect(() => {
    isSharingRef.current = isSharingLocation
  }, [isSharingLocation])
  
  useEffect(() => {
    demoBusAddedRef.current = demoBusAdded
  }, [demoBusAdded])

  // Get initial location on mount for map display
  useEffect(() => {
    if (!currentLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString(),
          })
        },
        () => {
          // Location permission denied or error - will use default in map
          console.log('Location not available')
        },
        { enableHighAccuracy: true }
      )
    }
  }, [])

  // Update driver bus in the global buses list
  const updateDriverBusInStore = useCallback((location) => {
    const buses = useAppStore.getState().buses
    const driverBusId = `driver-${driverProfile.busNumber}`
    
    // Create or update driver bus
    const driverBus = {
      id: driverBusId,
      lat: location.lat,
      lng: location.lng,
      route: driverProfile.route,
      cost: '₹25',
      eta: 'Now',
      occupancy: 'Moderate',
      start: driverProfile.route.split(' → ')[0] || 'Start',
      end: driverProfile.route.split(' → ')[1] || 'End',
      provider: 'Delhi Transit',
      busNumber: driverProfile.busNumber,
      driverName: driverProfile.name,
      wheelchairAccessible: true,
      hasRamps: true,
      elevatorAccess: false,
      isSteep: false,
    }

    // Check if driver bus already exists
    const existingBusIndex = buses.findIndex(bus => bus.id === driverBusId)
    
    if (existingBusIndex >= 0) {
      // Update existing bus
      const updatedBuses = [...buses]
      updatedBuses[existingBusIndex] = driverBus
      useAppStore.setState({ buses: updatedBuses, filteredBuses: updatedBuses, lastUpdated: new Date().toISOString() })
    } else {
      // Add new bus
      const updatedBuses = [...buses, driverBus]
      useAppStore.setState({ buses: updatedBuses, filteredBuses: updatedBuses, lastUpdated: new Date().toISOString() })
    }
  }, [driverProfile])

  // Remove driver bus from store
  const removeDriverBusFromStore = useCallback(() => {
    const buses = useAppStore.getState().buses
    const driverBusId = `driver-${driverProfile.busNumber}`
    const updatedBuses = buses.filter(bus => bus.id !== driverBusId)
    useAppStore.setState({ buses: updatedBuses, filteredBuses: updatedBuses })
  }, [driverProfile])

  useEffect(() => {
    let interval = null
    
    if (isSharingLocation && !demoBusAdded && !currentLocation?.isDemo) {
      // Real location sharing (not demo)
      const updateLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const loc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString(),
                isDemo: false,
              }
              
              // Calculate speed if we have previous location
              if (lastLocationRef.current && lastUpdateTimeRef.current) {
                const now = Date.now()
                const timeDiff = (now - lastUpdateTimeRef.current) / 1000 // seconds
                const distanceMoved = calculateDistance(
                  lastLocationRef.current.lat,
                  lastLocationRef.current.lng,
                  loc.lat,
                  loc.lng
                )
                const speedMps = distanceMoved / timeDiff
                const speedKmh = (speedMps * 3600) / 1000
                setBusSpeed(Math.round(speedKmh))
              }
              
              lastLocationRef.current = loc
              lastUpdateTimeRef.current = Date.now()
              
              setCurrentLocation(loc)
              setUserLocation(loc)
              // Update driver bus in the buses list
              updateDriverBusInStore(loc)
            },
            (error) => console.error('Location error:', error),
            { enableHighAccuracy: true }
          )
        }
      }

      updateLocation()
      interval = setInterval(updateLocation, 5000) // Update every 5 seconds
      setLocationInterval(interval)
    } else if (!isSharingLocation) {
      // Remove driver bus from store when sharing stops
      removeDriverBusFromStore()
      // Reset speed and next stop
      setBusSpeed(0)
      setNextStop(null)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isSharingLocation, setUserLocation, updateDriverBusInStore, removeDriverBusFromStore, demoBusAdded, currentLocation])

  // Demo function - animates bus movement along route
  const handleDemoTracking = () => {
    setIsDemoMode(true)
    setDemoBusAdded(true)
    // Update refs immediately
    demoBusAddedRef.current = true
    setCurrentStopIndex(0)
    lastLocationRef.current = null
    lastUpdateTimeRef.current = Date.now()
    
    // Start from first stop
    const startLocation = {
      lat: DEMO_ROUTE_STOPS[0].lat,
      lng: DEMO_ROUTE_STOPS[0].lng,
      timestamp: new Date().toISOString(),
      isDemo: true,
    }
    
    setCurrentLocation(startLocation)
    setNextStop(DEMO_ROUTE_STOPS[1])
    setBusSpeed(0)
    
    // Add driver bus to the buses list (for dashboard)
    updateDriverBusInStore(startLocation)
    
    // Start location sharing for demo
    if (!isSharingLocation) {
      isSharingRef.current = true
      toggleLocationSharing()
    }
    
    // Start animation
    let currentIndex = 0
    let progress = 0 // 0 to 1, progress between current and next stop
    
    const animate = () => {
      // Check if location sharing is still active - stop if not (use refs for current state)
      if (!isSharingRef.current || !demoBusAddedRef.current) {
        if (demoAnimationRef.current) {
          clearTimeout(demoAnimationRef.current)
          demoAnimationRef.current = null
        }
        return
      }
      
      if (currentIndex >= DEMO_ROUTE_STOPS.length - 1) {
        // Loop back to start
        currentIndex = 0
        progress = 0
      }
      
      const currentStop = DEMO_ROUTE_STOPS[currentIndex]
      const nextStopIndex = currentIndex + 1
      const targetStop = DEMO_ROUTE_STOPS[nextStopIndex]
      
      // Calculate distance and time
      const distance = calculateDistance(
        currentStop.lat,
        currentStop.lng,
        targetStop.lat,
        targetStop.lng
      )
      
      // Bus speed: 30-40 km/h in city (8.33-11.11 m/s)
      // Use 35 km/h average (9.72 m/s)
      const speedMps = 9.72 // meters per second
      const timeToNextStop = distance / speedMps // seconds
      const updateInterval = 100 // Update every 100ms
      const progressIncrement = updateInterval / (timeToNextStop * 1000)
      
      progress += progressIncrement
      
      if (progress >= 1) {
        // Reached next stop
        progress = 0
        currentIndex = nextStopIndex
        setCurrentStopIndex(currentIndex)
        
        if (currentIndex < DEMO_ROUTE_STOPS.length - 1) {
          setNextStop(DEMO_ROUTE_STOPS[currentIndex + 1])
        } else {
          setNextStop(DEMO_ROUTE_STOPS[0]) // Loop back
        }
      }
      
      // Interpolate position
      const lat = currentStop.lat + (targetStop.lat - currentStop.lat) * progress
      const lng = currentStop.lng + (targetStop.lng - currentStop.lng) * progress
      
      const newLocation = {
        lat,
        lng,
        timestamp: new Date().toISOString(),
        isDemo: true,
      }
      
      // Calculate speed
      const now = Date.now()
      if (lastLocationRef.current && lastUpdateTimeRef.current) {
        const timeDiff = (now - lastUpdateTimeRef.current) / 1000 // seconds
        const distanceMoved = calculateDistance(
          lastLocationRef.current.lat,
          lastLocationRef.current.lng,
          lat,
          lng
        )
        const speedMps = distanceMoved / timeDiff
        const speedKmh = (speedMps * 3600) / 1000
        setBusSpeed(Math.round(speedKmh))
      }
      
      lastLocationRef.current = newLocation
      lastUpdateTimeRef.current = now
      
      setCurrentLocation(newLocation)
      updateDriverBusInStore(newLocation)
      
      // Check again before scheduling next update (use refs for current state)
      if (isSharingRef.current && demoBusAddedRef.current) {
        demoAnimationRef.current = setTimeout(animate, updateInterval)
      } else {
        // Stop animation if sharing stopped
        if (demoAnimationRef.current) {
          clearTimeout(demoAnimationRef.current)
          demoAnimationRef.current = null
        }
      }
    }
    
    animate()
    setIsDemoMode(false)
  }
  
  // Cleanup demo animation and stop when location sharing stops
  useEffect(() => {
    if (!isSharingLocation && demoBusAdded) {
      // Update refs immediately to stop animation
      isSharingRef.current = false
      demoBusAddedRef.current = false
      
      // Stop demo animation when location sharing stops
      if (demoAnimationRef.current) {
        clearTimeout(demoAnimationRef.current)
        demoAnimationRef.current = null
      }
      setDemoBusAdded(false)
      setBusSpeed(0)
      setNextStop(null)
      setCurrentStopIndex(0)
      setCurrentLocation(null)
      lastLocationRef.current = null
      lastUpdateTimeRef.current = null
    }
    
    return () => {
      if (demoAnimationRef.current) {
        clearTimeout(demoAnimationRef.current)
      }
    }
  }, [isSharingLocation, demoBusAdded])

  const handleToggleSharing = () => {
    // Check if we're currently sharing (before toggle)
    const wasSharing = isSharingLocation
    
    // Update refs immediately to stop animation
    if (wasSharing) {
      isSharingRef.current = false
      demoBusAddedRef.current = false
    }
    
    toggleLocationSharing()
    
    // If we were sharing and now stopping, clean everything up
    if (wasSharing) {
      removeDriverBusFromStore()
      // Stop demo animation
      if (demoAnimationRef.current) {
        clearTimeout(demoAnimationRef.current)
        demoAnimationRef.current = null
      }
      setDemoBusAdded(false)
      setBusSpeed(0)
      setNextStop(null)
      setCurrentStopIndex(0)
      setCurrentLocation(null)
      lastLocationRef.current = null
      lastUpdateTimeRef.current = null
    }
  }

  const handleLogout = () => {
    removeDriverBusFromStore()
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
        <div className="driver-left-panel">
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
                <div className="detail-content">
                  <p className="detail-label">Vehicle Number</p>
                  <p className="detail-value">{driverProfile.busNumber}</p>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-icon">
                  <MapPin size={20} />
                </div>
                <div className="detail-content">
                  <p className="detail-label">Route</p>
                  <p className="detail-value">{driverProfile.route}</p>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-icon license-icon">
                  <svg width="32" height="22" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="licenseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#BBDEFB" />
                        <stop offset="100%" stopColor="#90CAF9" />
                      </linearGradient>
                    </defs>
                    <rect x="2" y="4" width="116" height="72" rx="6" fill="url(#licenseGradient)"/>
                    <rect x="2" y="4" width="116" height="72" rx="6" stroke="#1565C0" strokeWidth="2.5"/>
                    <rect x="6" y="8" width="108" height="64" rx="4" fill="#E3F2FD" opacity="0.6"/>
                    <text x="60" y="45" fontFamily="'Segoe UI', Arial, sans-serif" fontSize="28" fontWeight="700" fill="#0D47A1" textAnchor="middle" dominantBaseline="middle" letterSpacing="2">DL</text>
                  </svg>
                </div>
                <div className="detail-content">
                  <p className="detail-label">License Number</p>
                  <p className="detail-value">{driverProfile.licenseNumber || 'DL1234567890'}</p>
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-icon">
                  <Bus size={20} />
                </div>
                <div className="detail-content">
                  <p className="detail-label">Vehicle Type</p>
                  <p className="detail-value">AC Low Floor Bus</p>
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

            <button
              className={`demo-small-button ${demoBusAdded ? 'active' : ''}`}
              onClick={handleDemoTracking}
              disabled={isDemoMode}
              title="Start demo test"
            >
              <PlayCircle size={18} />
              <span>{demoBusAdded ? 'Demo Running' : 'Demo Test'}</span>
            </button>
          </section>

          {/* Bus Status Card */}
          {(isSharingLocation || demoBusAdded) && (
            <section className="bus-status-card">
              <div className="status-header">
                <h3>Bus Status</h3>
                <div className={`status-badge ${isSharingLocation ? 'active' : ''}`}>
                  <div className="status-dot" />
                  <span>{isSharingLocation ? 'Live' : 'Demo'}</span>
                </div>
              </div>

              <div className="status-grid">
                <div className="status-item">
                  <div className="status-icon speed">
                    <Gauge size={20} />
                  </div>
                  <div className="status-content">
                    <p className="status-label">Current Speed</p>
                    <p className="status-value">{busSpeed} km/h</p>
                  </div>
                </div>

                {nextStop && (
                  <div className="status-item">
                    <div className="status-icon next">
                      <Route size={20} />
                    </div>
                    <div className="status-content">
                      <p className="status-label">Next Stop</p>
                      <p className="status-value">{nextStop.name}</p>
                    </div>
                  </div>
                )}

                {currentLocation && (
                  <div className="status-item">
                    <div className="status-icon location">
                      <MapPin size={20} />
                    </div>
                    <div className="status-content">
                      <p className="status-label">Last Update</p>
                      <p className="status-value">
                        {new Date(currentLocation.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <section className="driver-map-card">
          <div className="map-card-header">
            <div>
              <h3>Your Location</h3>
              <p>View your current position on the map</p>
            </div>
            {currentLocation && (
              <div className="location-status">
                <div className="location-dot" />
                <span>Active</span>
              </div>
            )}
          </div>
          <div className="driver-map-wrapper">
            <DriverMapView 
              driverLocation={currentLocation} 
              driverProfile={driverProfile}
              isDemo={currentLocation?.isDemo}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

