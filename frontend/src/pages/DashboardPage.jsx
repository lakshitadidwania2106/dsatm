import { useEffect } from 'react'
import { MapView } from '../components/MapView'
import { RoutePlanner } from '../components/RoutePlanner'
import { RouteOverview } from '../components/RouteOverview'
import { BusInfoCard } from '../components/BusInfoCard'
import { PopularRoutes } from '../components/PopularRoutes'
import { ChatAssistant } from '../components/ChatAssistant'
import { useAppStore } from '../store/useAppStore'

export const DashboardPage = () => {
  const refreshBuses = useAppStore((state) => state.refreshBuses)
  const hydratePopularRoutes = useAppStore((state) => state.hydratePopularRoutes)
  const buses = useAppStore((state) => state.buses)
  const userLocation = useAppStore((state) => state.userLocation)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const selectedBus = useAppStore((state) => state.selectedBus)
  const setSelectedBus = useAppStore((state) => state.setSelectedBus)
  const routePreview = useAppStore((state) => state.routePreview)

  useEffect(() => {
    refreshBuses()
    hydratePopularRoutes()
    const interval = setInterval(refreshBuses, 30000)
    return () => clearInterval(interval)
  }, [refreshBuses, hydratePopularRoutes])

  useEffect(() => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true },
    )
  }, [setUserLocation])

  return (
    <div className="dashboard-grid">
      <MapView
        buses={buses}
        userLocation={userLocation}
        selectedBus={selectedBus}
        routePreview={routePreview}
        onSelectBus={setSelectedBus}
      />
      <div className="stacked-panels">
        <RoutePlanner />
        <RouteOverview />
        <BusInfoCard />
        <PopularRoutes />
        <ChatAssistant />
      </div>
    </div>
  )
}

