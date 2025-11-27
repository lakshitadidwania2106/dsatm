import { useEffect } from 'react'
import { MapView } from '../components/MapView'
import { RoutePlanner } from '../components/RoutePlanner'
import { RouteOverview } from '../components/RouteOverview'
import { BusInfoCard } from '../components/BusInfoCard'
import { useAppStore } from '../store/useAppStore'

export const DashboardPage = () => {
  const refreshBuses = useAppStore((state) => state.refreshBuses)
  const buses = useAppStore((state) => state.buses)
  const userLocation = useAppStore((state) => state.userLocation)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const selectedBus = useAppStore((state) => state.selectedBus)
  const setSelectedBus = useAppStore((state) => state.setSelectedBus)
  const routePreview = useAppStore((state) => state.routePreview)

  const fetchStops = useAppStore((state) => state.fetchStops)
  const fetchRoutes = useAppStore((state) => state.fetchRoutes)
  const stops = useAppStore((state) => state.stops)

  useEffect(() => {
    refreshBuses()
    fetchStops()
    fetchRoutes()
    const interval = setInterval(refreshBuses, 30000)
    return () => clearInterval(interval)
  }, [refreshBuses, fetchStops, fetchRoutes])

  useEffect(() => {
    console.log('DashboardPage stops:', stops?.length)
  }, [stops])

  useEffect(() => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => { },
      { enableHighAccuracy: true },
    )
  }, [setUserLocation])

  return (
    <div className="dashboard-grid">
      <div className="map-stack">
        <MapView
          buses={buses}
          userLocation={userLocation}
          selectedBus={selectedBus}
          routePreview={routePreview}
          onSelectBus={setSelectedBus}
          stops={stops}
        />
        <BusInfoCard />
      </div>
      <div className="stacked-panels">
        <RouteOverview />
        <RoutePlanner />
      </div>
    </div>
  )
}

