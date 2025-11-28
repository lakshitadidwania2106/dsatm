import { create } from 'zustand'
import { fetchBuses, fetchPopularRoutes } from '../api/busService'
import { cityStops, routeCatalog } from '../data/cityStops'

const crowdRank = {
  light: 1,
  moderate: 2,
  busy: 3,
  high: 4,
}

const defaultRoutes = [
  {
    id: 'rt-01',
    name: 'City Center ⇄ Tech Park',
    eta: '5 mins',
    frequency: 'Every 6 mins',
    occupancy: 'Moderate',
    stops: 12,
  },
  {
    id: 'rt-02',
    name: 'Airport Express',
    eta: '12 mins',
    frequency: 'Every 10 mins',
    occupancy: 'Light',
    stops: 6,
  },
  {
    id: 'rt-03',
    name: 'Old Town ⇄ Metro Hub',
    eta: '9 mins',
    frequency: 'Every 8 mins',
    occupancy: 'Busy',
    stops: 15,
  },
]

export const useAppStore = create((set, get) => ({
  language: 'en',
  fontScale: 1,
  highContrast: false,
  sttEnabled: true,
  ttsEnabled: true,
  accessibilityMode: false,
  userRole: null,
  isLoggedIn: false,
  accessibilityFilters: {
    wheelchair: false,
    ramps: false,
    elevators: false,
    avoidSteep: false,
    avoidCrowded: false,
    calmMode: false,
  },
  buses: [],
  filteredBuses: [],
  selectedBus: null,
  popularRoutes: defaultRoutes,
  userLocation: null,
  isLoadingBuses: false,
  lastUpdated: null,
  error: null,
  cityStops,
  routePreview: null,
  plannedRoutes: [],
  setRoutePreview: (preview) => set({ routePreview: preview }),
  setPlannedRoutes: (routes) => set({ plannedRoutes: routes }),
  driverProfile: {
    name: 'Rajesh Kumar',
    busNumber: 'DL-01-AB-1234',
    route: 'Connaught Place → Gurgaon',
    routeId: 'CP-GGN-001',
    licenseNumber: 'DL1234567890',
    phone: '+91 98765 43210',
  },
  isSharingLocation: false,
  crowdCapacityRatio: 50, // Percentage (0-100)
  setCrowdCapacityRatio: (ratio) => set({ crowdCapacityRatio: ratio }),
  favorites: [],
  favoriteStops: [],
  showBusModal: false,

  setUserRole: (role) => set({ userRole: role, isLoggedIn: true }),
  logout: () => set({ userRole: null, isLoggedIn: false }),
  setLanguage: (language) => set({ language }),
  setFontScale: (fontScale) => set({ fontScale }),
  toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
  setDriverProfile: (profile) => set({ driverProfile: { ...get().driverProfile, ...profile } }),
  setSpeechPreferences: (preferences = {}) =>
    set((state) => ({
      sttEnabled: preferences.sttEnabled ?? state.sttEnabled,
      ttsEnabled: preferences.ttsEnabled ?? state.ttsEnabled,
    })),
  setAccessibilityFilters: (patch) =>
    set((state) => {
      const next = { ...state.accessibilityFilters, ...patch }
      setTimeout(() => {
        get().filterBuses({})
      }, 0)
      return { accessibilityFilters: next }
    }),

  setAccessibilityMode: (enabled) =>
    set((state) => ({
      accessibilityMode: enabled,
      ttsEnabled: enabled ? true : state.ttsEnabled,
    })),

  setSelectedBus: (selectedBus) => set({ selectedBus }),
  setUserLocation: (userLocation) => set({ userLocation }),

  filterBuses: ({ start = '', end = '' }) => {
    const { buses, accessibilityFilters } = get()
    if (!start && !end) {
      set({ filteredBuses: buses })
      return
    }

    const normalizedStart = start.toLowerCase()
    const normalizedEnd = end.toLowerCase()

    const filtered = buses.filter((bus) => {
      const startMatch = normalizedStart
        ? `${bus.start || ''} ${bus.route || ''}`.toLowerCase().includes(normalizedStart)
        : true
      const endMatch = normalizedEnd
        ? `${bus.end || ''} ${bus.route || ''}`.toLowerCase().includes(normalizedEnd)
        : true
      if (!startMatch || !endMatch) return false

      if (accessibilityFilters.wheelchair && !bus.wheelchairAccessible) return false
      if (accessibilityFilters.ramps && !bus.hasRamps) return false
      if (accessibilityFilters.elevators && !bus.elevatorAccess) return false
      if (accessibilityFilters.avoidSteep && bus.isSteep) return false
      if (accessibilityFilters.avoidCrowded && crowdRank[(bus.occupancy || 'moderate').toLowerCase()] > 2)
        return false
      return true
    })

    const results = [...filtered]
    if (accessibilityFilters.calmMode) {
      results.sort(
        (a, b) =>
          (crowdRank[(a.occupancy || '').toLowerCase()] ?? 5) -
          (crowdRank[(b.occupancy || '').toLowerCase()] ?? 5),
      )
    }

    set({ filteredBuses: results })
  },

  planRoute: async ({ start, end }) => {
    if (!start || !end) {
      set({ routePreview: null })
      return
    }

    const { cityStops } = get()
    const normalize = (value = '') => value.trim().toLowerCase()
    const startStop = cityStops.find((stop) => normalize(stop.name) === normalize(start))
    const endStop = cityStops.find((stop) => normalize(stop.name) === normalize(end))

    if (!startStop || !endStop) {
      console.warn("Start or End stop not found in cityStops")
      return
    }

    try {
      const { planTrip } = await import('../api/otpService')
      const itineraries = await planTrip({
        from: { lat: startStop.lat, lng: startStop.lng },
        to: { lat: endStop.lat, lng: endStop.lng },
        modes: ['WALK', 'BUS'] // Default modes
      })

      if (itineraries && itineraries.length > 0) {
        // Transform OTP itinerary to our app's route format (simplified for now)
        // We take the first itinerary
        const bestItinerary = itineraries[0]

        const route = {
          id: `otp-${Date.now()}`,
          name: `${startStop.shortLabel} ⇄ ${endStop.shortLabel}`,
          distance: 'Calculating...', // OTP gives duration, distance is in legs
          duration: `${Math.round(bestItinerary.duration / 60)} mins`,
          buses: bestItinerary.legs.filter(l => l.mode === 'BUS').map(l => l.route?.shortName || 'Bus'),
          coordinates: [], // We need to decode legGeometry points here if we want to draw it
          steps: bestItinerary.legs.map(leg => {
            if (leg.mode === 'WALK') return `Walk to ${leg.to.name}`
            return `Take ${leg.route?.shortName || 'Bus'} to ${leg.to.name}`
          }),
          legs: bestItinerary.legs // Store raw legs for MapView to render
        }
        set({ routePreview: route })
      } else {
        set({ routePreview: null, error: "No route found" })
      }
    } catch (error) {
      console.error("Route planning failed:", error)
      set({ error: "Route planning failed" })
    }
  },

  refreshBuses: async (bounds) => {
    set({ isLoadingBuses: true, error: null })
    try {
      const [fetchedBuses, virtualBuses] = await Promise.all([
        fetchBuses(bounds),
        import('../api/busService').then(module => module.fetchVirtualBuses())
      ])

      // Combine fetched buses and virtual buses (Driver buses are now part of virtual buses)
      const allBuses = [...fetchedBuses, ...virtualBuses]

      set({
        buses: allBuses,
        filteredBuses: allBuses,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error(error)
      set({ error: error.message })
    } finally {
      set({ isLoadingBuses: false })
    }
  },

  // Driver Location Broadcasting
  startDriverBroadcasting: () => {
    const { driverProfile } = get()
    if (!driverProfile || !driverProfile.routeId) return

    // Clear existing interval if any
    if (get().driverInterval) clearInterval(get().driverInterval)

    const interval = setInterval(() => {
      const { userLocation, isSharingLocation } = get()
      if (!isSharingLocation || !userLocation) return

      import('../api/busService').then(module => {
        module.broadcastLocation({
          user_id: `driver-${driverProfile.busNumber}`, // Unique ID for driver
          route_id: driverProfile.routeId, // e.g. "10575"
          lat: userLocation.lat,
          lng: userLocation.lng,
          speed: 30, // Simulate valid speed
          role: 'driver'
        })
      })
    }, 5000) // Broadcast every 5 seconds

    set({ driverInterval: interval })
  },

  stopDriverBroadcasting: () => {
    if (get().driverInterval) {
      clearInterval(get().driverInterval)
      set({ driverInterval: null })
    }
  },

  toggleLocationSharing: () => {
    const isSharing = !get().isSharingLocation
    set({ isSharingLocation: isSharing })

    if (isSharing) {
      get().startDriverBroadcasting()
    } else {
      get().stopDriverBroadcasting()
    }
  },

  hydratePopularRoutes: async () => {
    try {
      const routes = await fetchPopularRoutes()
      if (routes?.length) {
        set({ popularRoutes: routes })
      }
    } catch (error) {
      console.warn('Using fallback popular routes', error)
    }
  },
  addFavorite: (bus) => {
    const { favorites } = get()
    if (!favorites.some((fav) => fav.id === bus.id)) {
      set({ favorites: [...favorites, bus] })
    }
  },
  removeFavorite: (busId) => {
    const { favorites } = get()
    set({ favorites: favorites.filter((fav) => fav.id !== busId) })
  },
  addFavoriteStop: (stopData) => {
    const { favoriteStops } = get()
    const newStop = {
      id: `${stopData.busId}-${stopData.stopName}-${Date.now()}`,
      ...stopData,
    }
    set({ favoriteStops: [...favoriteStops, newStop] })
  },
  removeFavoriteStop: (stopId) => {
    const { favoriteStops } = get()
    set({ favoriteStops: favoriteStops.filter((fs) => fs.id !== stopId) })
  },
  setShowBusModal: (show) => set({ showBusModal: show }),
  checkBusNotifications: () => {
    const { favoriteStops, buses } = get()
    const userLocation = get().userLocation

    if (!userLocation || favoriteStops.length === 0) return

    favoriteStops.forEach((fs) => {
      const bus = buses.find((b) => b.id === fs.busId)
      if (!bus) return

      // Find the stop in cityStops
      const stop = cityStops.find((s) => s.name === fs.stopName)
      if (!stop) return

      // Calculate distance between bus and stop (simple distance check)
      const distance = Math.sqrt(
        Math.pow(bus.lat - stop.lat, 2) + Math.pow(bus.lng - stop.lng, 2)
      )

      // If bus is within ~500m of the stop (approximately 0.0045 degrees)
      if (distance < 0.0045 && 'Notification' in window && Notification.permission === 'granted') {
        // Check if we've already notified for this bus-stop combination recently
        const notificationKey = `notified-${fs.busId}-${fs.stopName}`
        const lastNotified = localStorage.getItem(notificationKey)
        const now = Date.now()

        if (!lastNotified || now - parseInt(lastNotified) > 60000) {
          // Show notification
          new Notification(`Bus ${fs.busRoute} is arriving!`, {
            body: `Your favorite bus is near ${fs.stopName}`,
            icon: '/vite.svg',
            tag: notificationKey,
          })

          localStorage.setItem(notificationKey, now.toString())
        }
      }
    })
  },
}))

