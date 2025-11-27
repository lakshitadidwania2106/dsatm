const BUS_API_URL = 'http://localhost:8000/api'
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
    wheelchairAccessible: true,
    hasRamps: true,
    elevatorAccess: false,
    isSteep: false,
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
    wheelchairAccessible: true,
    hasRamps: false,
    elevatorAccess: true,
    isSteep: false,
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
    wheelchairAccessible: false,
    hasRamps: true,
    elevatorAccess: false,
    isSteep: true,
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


export const fetchStops = async () => {
  if (!BUS_API_URL) {
    return []
  }

  const response = await fetch(`${BUS_API_URL}/stops`)
  return parseResponse(response)
}

export const fetchRoutes = async () => {
  if (!BUS_API_URL) {
    return []
  }

  const response = await fetch(`${BUS_API_URL}/routes`)
  return parseResponse(response)
}

export const fetchRouteDetails = async (routeId) => {
  if (!BUS_API_URL) {
    return null
  }

  const response = await fetch(`${BUS_API_URL}/routes/${routeId}`)
  return parseResponse(response)
}

// Polyline decoder
export const decodePolyline = (str, precision) => {
  var index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision || 5)

  while (index < str.length) {
    byte = null
    shift = 0
    result = 0

    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    latitude_change = result & 1 ? ~(result >> 1) : result >> 1

    shift = result = 0

    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    longitude_change = result & 1 ? ~(result >> 1) : result >> 1

    lat += latitude_change
    lng += longitude_change

    coordinates.push([lat / factor, lng / factor])
  }

  return coordinates
}
