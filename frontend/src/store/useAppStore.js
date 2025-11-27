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

  setLanguage: (language) => set({ language }),
  setFontScale: (fontScale) => set({ fontScale }),
  toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
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

  planRoute: ({ start, end }) => {
    const { stops } = get()
    if (!start || !end) {
      set({ routePreview: null })
      return
    }

    const normalize = (value = '') => value.trim().toLowerCase()
    const startStop = stops.find((stop) => normalize(stop.name) === normalize(start))
    const endStop = stops.find((stop) => normalize(stop.name) === normalize(end))

    if (!startStop || !endStop) {
      console.warn('Start or end stop not found')
      return
    }

    const route = {
      id: `custom-${startStop.id}-${endStop.id}`,
      name: `${startStop.name} ⇄ ${endStop.name}`,
      distance: 'Calculating...',
      duration: 'Calculating...',
      buses: [],
      coordinates: [
        [startStop.lat, startStop.lng],
        [endStop.lat, endStop.lng],
      ],
      steps: [
        `Board at ${startStop.name}`,
        `Alight at ${endStop.name}`,
      ],
    }

    set({ routePreview: route })
  },

  refreshBuses: async (bounds) => {
    set({ isLoadingBuses: true, error: null })
    try {
      const buses = await fetchBuses(bounds)
      set({
        buses,
        filteredBuses: buses,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      console.error(error)
      set({ error: error.message })
    } finally {
      set({ isLoadingBuses: false })
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

  stops: [],
  routes: [],
  isLoadingStops: false,
  isLoadingRoutes: false,

  fetchStops: async () => {
    set({ isLoadingStops: true })
    try {
      console.log('Fetching stops...')
      const { fetchStops } = await import('../api/busService')
      const stops = await fetchStops()
      console.log('Stops fetched:', stops?.length)
      set({ stops })
    } catch (error) {
      console.error('Failed to fetch stops', error)
    } finally {
      set({ isLoadingStops: false })
    }
  },

  fetchRoutes: async () => {
    set({ isLoadingRoutes: true })
    try {
      const { fetchRoutes } = await import('../api/busService')
      const routes = await fetchRoutes()
      set({ routes })
    } catch (error) {
      console.error('Failed to fetch routes', error)
    } finally {
      set({ isLoadingRoutes: false })
    }
  },
  fetchRouteDetails: async (routeId) => {
    try {
      const { fetchRouteDetails, decodePolyline } = await import('../api/busService')
      const route = await fetchRouteDetails(routeId)

      if (route && route['0']) {
        // Use direction '0' for now
        const coordinates = decodePolyline(route['0'])
        set({
          routePreview: {
            id: routeId,
            coordinates,
            color: route.color
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch route details', error)
    }
  },
}))

