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
  const apiUrl = BUS_API_URL || 'http://localhost:8000/api/live-buses'

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      console.warn('Backend not reachable, using fallback data')
      return fallbackBuses
    }
    const payload = await response.json()

    if (Array.isArray(payload)) {
      return payload.map(bus => ({
        id: bus.id,
        lat: bus.lat,
        lng: bus.lng,
        route: bus.route,
        cost: '₹20', // Placeholder
        eta: 'Unknown', // Placeholder
        occupancy: 'Moderate', // Placeholder
        start: 'Unknown', // Placeholder
        end: 'Unknown', // Placeholder
        provider: 'Delhi Transit',
        wheelchairAccessible: true, // Placeholder
        hasRamps: true, // Placeholder
        elevatorAccess: false, // Placeholder
        isSteep: false, // Placeholder
        speed: bus.speed
      }))
    }
    return fallbackBuses
  } catch (error) {
    console.warn('Error fetching buses:', error)
    return fallbackBuses
  }
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

// --- Virtual Bus APIs ---

const API_BASE_URL = 'http://localhost:8000/api';

export const fetchRoutes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/routes`);
    if (!response.ok) throw new Error('Failed to fetch routes');
    return await response.json();
  } catch (error) {
    console.error("Error fetching routes:", error);
    return [];
  }
};

export const broadcastLocation = async (report) => {
  try {
    const response = await fetch(`${API_BASE_URL}/broadcast-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });
    if (!response.ok) throw new Error('Failed to broadcast location');
    return await response.json();
  } catch (error) {
    console.error("Error broadcasting location:", error);
    return null;
  }
};

export const fetchVirtualBuses = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/virtual-buses`);
    if (!response.ok) throw new Error('Failed to fetch virtual buses');
    const data = await response.json();
    return data.map(bus => ({
      ...bus,
      type: 'virtual', // Mark as virtual for UI distinction
    }));
  } catch (error) {
    console.error("Error fetching virtual buses:", error);
    return [];
  }
};

export const fetchShapes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/shapes`);
    if (!response.ok) throw new Error('Failed to fetch shapes');
    return await response.json();
  } catch (error) {
    console.error("Error fetching shapes:", error);
    return {};
  }
};

