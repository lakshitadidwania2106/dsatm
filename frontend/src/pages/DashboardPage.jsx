import { useEffect } from 'react'
import { MapView } from '../components/MapView'
import { RouteOverview } from '../components/RouteOverview'
import { BusInfoCard } from '../components/BusInfoCard'
import { FieldTripPlanner } from '../components/FieldTripPlanner'
import { useAppStore } from '../store/useAppStore'

export const DashboardPage = () => {
  const refreshBuses = useAppStore((state) => state.refreshBuses)
  const buses = useAppStore((state) => state.buses)
  const userLocation = useAppStore((state) => state.userLocation)
  const setUserLocation = useAppStore((state) => state.setUserLocation)
  const selectedBus = useAppStore((state) => state.selectedBus)
  const setSelectedBus = useAppStore((state) => state.setSelectedBus)
  const routePreview = useAppStore((state) => state.routePreview)

  useEffect(() => {
    refreshBuses()
    const interval = setInterval(refreshBuses, 10000)
    return () => clearInterval(interval)
  }, [refreshBuses])

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
        />
        <BusInfoCard />
      </div>
      <div className="stacked-panels">
        <FieldTripPlanner />
        <RouteOverview />
      </div>
    </div>
  )
}

