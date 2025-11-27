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
  driverProfile: {
    name: 'Rajesh Kumar',
    busNumber: 'DL-01-AB-1234',
    route: 'Connaught Place → Gurgaon',
    routeId: 'CP-GGN-001',
    licenseNumber: 'DL1234567890',
    phone: '+91 98765 43210',
  },
  isSharingLocation: false,

  setUserRole: (role) => set({ userRole: role, isLoggedIn: true }),
  logout: () => set({ userRole: null, isLoggedIn: false }),
  setLanguage: (language) => set({ language }),
  setFontScale: (fontScale) => set({ fontScale }),
  toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
  setDriverProfile: (profile) => set({ driverProfile: { ...get().driverProfile, ...profile } }),
  toggleLocationSharing: () => set((state) => ({ isSharingLocation: !state.isSharingLocation })),
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
    if (!start || !end) {
      set({ routePreview: null })
      return
    }

    const normalize = (value = '') => value.trim().toLowerCase()
    const startStop =
      cityStops.find((stop) => normalize(stop.name) === normalize(start)) ?? cityStops[0]
    const endStop =
      cityStops.find((stop) => normalize(stop.name) === normalize(end)) ?? cityStops[1]

    const makeKey = (a, b) => [a, b].sort().join('-')
    const catalogKey = makeKey(startStop.id, endStop.id)
    const catalogRoute = routeCatalog[catalogKey]

    const route = catalogRoute ?? {
      id: catalogKey,
      name: `${startStop.shortLabel} ⇄ ${endStop.shortLabel}`,
      distance: 'Approx. 10 km',
      duration: 'Approx. 30 mins',
      buses: ['Metro Feeder', 'BMTC 500C'],
      coordinates: [
        [startStop.lat, startStop.lng],
        [
          (startStop.lat + endStop.lat) / 2 + 0.01,
          (startStop.lng + endStop.lng) / 2 - 0.005,
        ],
        [endStop.lat, endStop.lng],
      ],
      steps: [
        `Board near ${startStop.shortLabel}`,
        'Stay on ORR corridor',
        `Alight at ${endStop.shortLabel}`,
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
}))

