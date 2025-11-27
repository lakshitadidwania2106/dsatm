const BUS_API_URL = import.meta.env.VITE_BUS_API_URL
const POPULAR_ROUTES_API_URL = import.meta.env.VITE_POPULAR_ROUTES_API_URL

const fallbackBuses = [
  {
    id: 'bus-101',
    lat: 12.97623,
    lng: 77.60329,
    route: 'City Center ⇄ Tech Park',
    cost: '₹32',
    eta: '3 mins',
    occupancy: 'Light',
    start: 'Majestic',
    end: 'Electronic City',
    provider: 'Namma Transit',
  },
  {
    id: 'bus-202',
    lat: 12.96481,
    lng: 77.61021,
    route: 'Metro Hub ⇄ Airport',
    cost: '₹180',
    eta: '7 mins',
    occupancy: 'Moderate',
    start: 'Cubbon Park',
    end: 'BLR Airport',
    provider: 'FlyBus',
  },
  {
    id: 'bus-303',
    lat: 12.98831,
    lng: 77.59401,
    route: 'Old Town ⇄ Metro Hub',
    cost: '₹22',
    eta: '5 mins',
    occupancy: 'High',
    start: 'KR Market',
    end: 'Indiranagar',
    provider: 'City Rapid',
  },
]

const fallbackRoutes = [
  {
    id: 'rt-04',
    name: 'Outer Ring Shuttle',
    eta: '4 mins',
    frequency: 'Every 5 mins',
    occupancy: 'Moderate',
    stops: 18,
  },
]

const parseResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Unable to fetch data')
  }
  return res.json()
}

export const fetchBuses = async (bounds) => {
  if (!BUS_API_URL) {
    return fallbackBuses
  }

  const params = new URLSearchParams()
  if (bounds) {
    Object.entries(bounds).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value)
      }
    })
  }

  const url = params.size ? `${BUS_API_URL}?${params}` : BUS_API_URL
  const payload = await parseResponse(await fetch(url))

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.buses)) {
    return payload.buses
  }

  return fallbackBuses
}

export const fetchPopularRoutes = async () => {
  if (!POPULAR_ROUTES_API_URL) {
    return fallbackRoutes
  }

  const payload = await parseResponse(await fetch(POPULAR_ROUTES_API_URL))
  if (Array.isArray(payload)) {
    return payload
  }

  return fallbackRoutes
}

