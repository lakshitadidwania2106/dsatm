const CARPOOL_API_URL = import.meta.env.VITE_CARPOOL_API_URL || 'http://localhost:8000/api/carpool'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

// Get auth token from localStorage or Supabase session
const getAuthToken = () => {
  // Try to get from Supabase session
  if (window.supabase) {
    const session = window.supabase.auth.session()
    if (session?.access_token) {
      return session.access_token
    }
  }
  
  // Fallback to localStorage
  const token = localStorage.getItem('auth_token')
  return token
}

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${CARPOOL_API_URL}${endpoint}`, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Helper to get user ID
const getUserId = () => {
  return localStorage.getItem('user_id') || 'user-' + Date.now()
}

// Ride Management
export const createRide = async (rideData) => {
  return apiCall('/rides', {
    method: 'POST',
    body: JSON.stringify({
      user_id: getUserId(),
      start_location: rideData.startLocation,
      start_lat: rideData.startLat,
      start_lng: rideData.startLng,
      end_location: rideData.endLocation,
      end_lat: rideData.endLat,
      end_lng: rideData.endLng,
      available_seats: rideData.availableSeats,
      total_seats: rideData.totalSeats,
      cost_per_person: rideData.costPerPerson,
    }),
  })
}

export const startTracking = async (rideId) => {
  return apiCall(`/rides/${rideId}/start-tracking`, {
    method: 'POST',
  })
}

export const stopTracking = async (rideId) => {
  return apiCall(`/rides/${rideId}/stop-tracking`, {
    method: 'POST',
  })
}

export const updateLocation = async (rideId, location) => {
  return apiCall(`/rides/${rideId}/location`, {
    method: 'POST',
    body: JSON.stringify({
      ride_id: rideId,
      lat: location.lat,
      lng: location.lng,
      speed: location.speed,
      heading: location.heading,
    }),
  })
}

export const getPassengerRequests = async (rideId) => {
  return apiCall(`/rides/${rideId}/requests`)
}

// Search and Booking
export const searchRides = async (searchData) => {
  return apiCall('/search', {
    method: 'POST',
    body: JSON.stringify({
      from_location: searchData.fromLocation,
      from_lat: searchData.fromLat,
      from_lng: searchData.fromLng,
      to_location: searchData.toLocation,
      to_lat: searchData.toLat,
      to_lng: searchData.toLng,
      members: searchData.members || 1,
    }),
  })
}

export const createBooking = async (bookingData) => {
  return apiCall('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      ride_id: bookingData.rideId,
      passenger_id: getUserId(),
      from_location: bookingData.fromLocation,
      from_lat: bookingData.fromLat,
      from_lng: bookingData.fromLng,
      to_location: bookingData.toLocation,
      to_lat: bookingData.toLat,
      to_lng: bookingData.toLng,
      members: bookingData.members || 1,
    }),
  })
}

export const confirmBooking = async (bookingId) => {
  return apiCall(`/bookings/${bookingId}/confirm`, {
    method: 'POST',
  })
}

export const ignoreBooking = async (bookingId) => {
  // This would cancel/reject a booking
  return apiCall(`/bookings/${bookingId}`, {
    method: 'DELETE',
  })
}

export const getCurrentBookings = async () => {
  return apiCall('/bookings/current')
}

export const getBookingHistory = async () => {
  return apiCall('/bookings/history')
}

// Passenger Requests
export const createPassengerRequest = async (requestData) => {
  return apiCall('/passenger-requests', {
    method: 'POST',
    body: JSON.stringify({
      user_id: getUserId(),
      from_location: requestData.fromLocation,
      from_lat: requestData.fromLat,
      from_lng: requestData.fromLng,
      to_location: requestData.toLocation,
      to_lat: requestData.toLat,
      to_lng: requestData.toLng,
      members: requestData.members || 1,
    }),
  })
}

// Search by bus (for same-bus matching)
export const searchByBus = async (busData) => {
  return apiCall('/search-by-bus', {
    method: 'POST',
    body: JSON.stringify({
      user_id: getUserId(),
      bus_id: busData.busId,
      bus_trip_id: busData.busTripId,
      bus_route: busData.busRoute,
    }),
  })
}

// Get passengers on a bus
export const getBusPassengers = async (busId) => {
  return apiCall(`/buses/${busId}/passengers`)
}

// WebSocket Connection
export class CarpoolWebSocket {
  constructor(userId) {
    this.userId = userId
    this.ws = null
    this.listeners = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${WS_URL}/ws/${this.userId}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.attemptReconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(data) {
    const { type } = data
    
    // Call all listeners for this message type
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })
    }

    // Call all listeners for 'all' type
    if (this.listeners.has('all')) {
      this.listeners.get('all').forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })
    }
  }

  subscribe(rideId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe_ride',
        ride_id: rideId,
      }))
    }
  }

  on(messageType, callback) {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, [])
    }
    this.listeners.get(messageType).push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(messageType)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  off(messageType, callback) {
    const callbacks = this.listeners.get(messageType)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
      console.log(`Attempting to reconnect in ${delay}ms...`)
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error)
        })
      }, delay)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }
}

// Location tracking helper
export const startLocationTracking = (rideId, onLocationUpdate, interval = 5000) => {
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported')
    return null
  }

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed || 0,
        heading: position.coords.heading || 0,
      }

      try {
        await updateLocation(rideId, location)
        if (onLocationUpdate) {
          onLocationUpdate(location)
        }
      } catch (error) {
        console.error('Error updating location:', error)
      }
    },
    (error) => {
      console.error('Geolocation error:', error)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  )

  return () => {
    navigator.geolocation.clearWatch(watchId)
  }
}
