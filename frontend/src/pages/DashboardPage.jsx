import { useEffect } from 'react'
import { MapView } from '../components/MapView'
import { RouteOverview } from '../components/RouteOverview'
import { BusInfoCard } from '../components/BusInfoCard'
import { BusDetailsModal } from '../components/BusDetailsModal'
import { FieldTripPlanner } from '../components/FieldTripPlanner'
import { FeasibleRoutes } from '../components/FeasibleRoutes'
import { useAppStore } from '../store/useAppStore'

export const DashboardPage = () => {
  const refreshBuses = useAppStore((state) => state.refreshBuses)
  const buses = useAppStore((state) => state.buses)
  const userLocation = useAppStore((state) => state.userLocation)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const selectedBus = useAppStore((state) => state.selectedBus)
  const setSelectedBus = useAppStore((state) => state.setSelectedBus)
  const routePreview = useAppStore((state) => state.routePreview)
  const showBusModal = useAppStore((state) => state.showBusModal)
  const setShowBusModal = useAppStore((state) => state.setShowBusModal)
  const checkBusNotifications = useAppStore((state) => state.checkBusNotifications)

  useEffect(() => {
    refreshBuses();
    const interval = setInterval(refreshBuses, 10000);
  
    return () => clearInterval(interval);
  }, []);
  

  useEffect(() => {
    if (!navigator?.geolocation) {
      // If geolocation is not available, set a default Delhi location
      setUserLocation({
        lat: 28.6139,
        lng: 77.2090,
      })
      return
    }
    
    let locationSet = false
    
    // Try to get user location with timeout
    const timeoutId = setTimeout(() => {
      // Fallback to Delhi if location takes too long
      if (!locationSet) {
        setUserLocation({
          lat: 28.6139,
          lng: 77.2090,
        })
        locationSet = true
      }
    }, 3000)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId)
        locationSet = true
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        clearTimeout(timeoutId)
        locationSet = true
        // On error, use Delhi as fallback
        setUserLocation({
          lat: 28.6139,
          lng: 77.2090,
        })
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    )
  }, [setUserLocation])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Check for bus notifications periodically
  useEffect(() => {
    const notificationInterval = setInterval(() => {
      if (buses.length > 0) {
        checkBusNotifications()
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(notificationInterval)
  }, [buses, checkBusNotifications])

  // Show modal when bus is selected
  useEffect(() => {
    if (selectedBus) {
      setShowBusModal(true)
    }
  }, [selectedBus, setShowBusModal])

  const handleCloseModal = () => {
    setShowBusModal(false)
    setSelectedBus(null)
  }

  return (
    <>
      <div className="dashboard-grid">
        <div className="map-stack">
          <MapView
            buses={buses}
            userLocation={userLocation}
            selectedBus={selectedBus}
            routePreview={routePreview}
            onSelectBus={setSelectedBus}
          />
          <FeasibleRoutes />
          <BusInfoCard />
        </div>
        <div className="stacked-panels">
          <FieldTripPlanner />
          <RouteOverview />
        </div>
      </div>
      {showBusModal && selectedBus && (
        <BusDetailsModal bus={selectedBus} onClose={handleCloseModal} />
      )}
    </>
  )
}

