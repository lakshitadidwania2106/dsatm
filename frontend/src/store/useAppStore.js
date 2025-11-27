import { create } from 'zustand'
import { fetchBuses, fetchPopularRoutes } from '../api/busService'
import { cityStops, routeCatalog } from '../data/cityStops'

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
  setAccessibilityMode: (enabled) => set({ accessibilityMode: enabled }),

  setSelectedBus: (selectedBus) => set({ selectedBus }),
  setUserLocation: (userLocation) => set({ userLocation }),

  filterBuses: ({ start = '', end = '' }) => {
    const { buses } = get()
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
      return startMatch && endMatch
    })

    set({ filteredBuses: filtered })
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

