import { useState, useMemo, useEffect, useRef } from 'react'
import { Hand, Car, Leaf, Users, MapPin, Clock, DollarSign, Star, Repeat, X, CheckCircle, AlertCircle } from 'lucide-react'
import { LocationSelectorModal } from '../components/LocationSelectorModal'
import { delhiStops } from '../data/delhiStops'
import {
  searchRides,
  createBooking,
  createRide,
  startTracking,
  stopTracking,
  updateLocation,
  getCurrentBookings,
  getBookingHistory,
  getPassengerRequests,
  confirmBooking,
  CarpoolWebSocket,
  startLocationTracking,
} from '../api/carpoolService'
import { useAppStore } from '../store/useAppStore'
import { fetchBuses } from '../api/busService'
import { Bus } from 'lucide-react'

// Mode: 'selector' | 'join' | 'offer'
const MODE_SELECTOR = 'selector'
const MODE_JOIN = 'join'
const MODE_OFFER = 'offer'

// Helper to get user ID (mock for now - should come from auth)
const getUserId = () => {
  // In production, get from Supabase auth or store
  return localStorage.getItem('user_id') || 'user-' + Date.now()
}

export const CarpoolPage = () => {
  const [mode, setMode] = useState(MODE_SELECTOR)
  const [locationModal, setLocationModal] = useState({ isOpen: false, field: null, label: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Join Ride state
  const [joinFrom, setJoinFrom] = useState('')
  const [joinTo, setJoinTo] = useState('')
  const [joinMembers, setJoinMembers] = useState(1)
  const [joinFromCoords, setJoinFromCoords] = useState(null)
  const [joinToCoords, setJoinToCoords] = useState(null)
  const [matchingDrivers, setMatchingDrivers] = useState([])
  const [currentBooking, setCurrentBooking] = useState(null)
  const [pastRides, setPastRides] = useState([])
  const [recentRequests, setRecentRequests] = useState([])
  
  // Offer Ride state
  const [offerStart, setOfferStart] = useState('')
  const [offerEnd, setOfferEnd] = useState('')
  const [offerSeats, setOfferSeats] = useState(1)
  const [costPerPerson, setCostPerPerson] = useState(50)
  const [isTracking, setIsTracking] = useState(false)
  const [currentRideId, setCurrentRideId] = useState(null)
  const [offerStartCoords, setOfferStartCoords] = useState(null)
  const [offerEndCoords, setOfferEndCoords] = useState(null)
  const [passengerRequests, setPassengerRequests] = useState([])
  
  // WebSocket and location tracking
  const wsRef = useRef(null)
  const locationTrackingRef = useRef(null)
  const userId = getUserId()
  
  // Live buses along route
  const [routeBuses, setRouteBuses] = useState([])
  const [loadingBuses, setLoadingBuses] = useState(false)
  const busesRefreshInterval = useRef(null)

  const openLocationModal = (field, label) => {
    setLocationModal({ isOpen: true, field, label })
  }

  const handleLocationConfirm = (coords) => {
    const [lat, lng] = coords
    
    // Try to find nearest Delhi stop (within 500m)
    const findNearestStop = (targetLat, targetLng) => {
      let nearest = null
      let minDistance = Infinity
      
      delhiStops.forEach(stop => {
        const distance = Math.sqrt(
          Math.pow(targetLat - stop.lat, 2) + Math.pow(targetLng - stop.lng, 2)
        ) * 111 // Rough conversion to km
        if (distance < minDistance && distance < 0.5) { // Within 500m
          minDistance = distance
          nearest = stop
        }
      })
      
      return nearest
    }
    
    const nearestStop = findNearestStop(lat, lng)
    const address = nearestStop ? nearestStop.name : `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    
    if (locationModal.field === 'joinFrom') {
      setJoinFrom(address)
      setJoinFromCoords(coords)
    } else if (locationModal.field === 'joinTo') {
      setJoinTo(address)
      setJoinToCoords(coords)
    } else if (locationModal.field === 'offerStart') {
      setOfferStart(address)
      setOfferStartCoords(coords)
    } else if (locationModal.field === 'offerEnd') {
      setOfferEnd(address)
      setOfferEndCoords(coords)
    }
    
    setLocationModal({ isOpen: false, field: null, label: '' })
  }

  // Initialize WebSocket connection
  useEffect(() => {
    if (userId) {
      wsRef.current = new CarpoolWebSocket(userId)
      wsRef.current.connect().catch(console.error)
      
      // Listen for booking confirmations
      wsRef.current.on('booking_confirmed', (data) => {
        setCurrentBooking(prev => prev ? { ...prev, status: 'confirmed' } : null)
      })
      
      // Listen for new booking requests (for drivers)
      wsRef.current.on('new_booking_request', async (data) => {
        if (currentRideId) {
          await loadPassengerRequests()
        }
      })
      
      // Listen for location updates
      wsRef.current.on('location_update', (data) => {
        // Update driver location on map if needed
        console.log('Location update:', data)
      })
      
      return () => {
        wsRef.current?.disconnect()
      }
    }
  }, [userId, currentRideId])

  // Load current bookings and history
  useEffect(() => {
    loadBookings()
    loadHistory()
  }, [])

  // Load passenger requests when tracking
  useEffect(() => {
    if (isTracking && currentRideId) {
      loadPassengerRequests()
      const interval = setInterval(loadPassengerRequests, 10000) // Refresh every 10s
      return () => clearInterval(interval)
    }
  }, [isTracking, currentRideId])

  // Fetch and filter buses along selected route
  useEffect(() => {
    const loadRouteBuses = async () => {
      // For join mode
      if (mode === MODE_JOIN && joinFromCoords && joinToCoords) {
        await fetchAndFilterBuses(joinFromCoords, joinToCoords)
      }
      // For offer mode
      if (mode === MODE_OFFER && offerStartCoords && offerEndCoords) {
        await fetchAndFilterBuses(offerStartCoords, offerEndCoords)
      }
    }

    loadRouteBuses()
    
    // Refresh buses every 30 seconds
    busesRefreshInterval.current = setInterval(loadRouteBuses, 30000)
    
    return () => {
      if (busesRefreshInterval.current) {
        clearInterval(busesRefreshInterval.current)
      }
    }
  }, [mode, joinFromCoords, joinToCoords, offerStartCoords, offerEndCoords])

  // Helper: Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Helper: Calculate distance from point to line segment
  const distanceToLineSegment = (pointLat, pointLng, lineStartLat, lineStartLng, lineEndLat, lineEndLng) => {
    // Convert to radians
    const toRad = (deg) => deg * Math.PI / 180
    const R = 6371 // Earth radius in km
    
    const pLat = toRad(pointLat)
    const pLng = toRad(pointLng)
    const sLat = toRad(lineStartLat)
    const sLng = toRad(lineStartLng)
    const eLat = toRad(lineEndLat)
    const eLng = toRad(lineEndLng)
    
    // Calculate distance from point to start
    const dStart = Math.acos(
      Math.sin(pLat) * Math.sin(sLat) +
      Math.cos(pLat) * Math.cos(sLat) * Math.cos(pLng - sLng)
    ) * R
    
    // Calculate distance from point to end
    const dEnd = Math.acos(
      Math.sin(pLat) * Math.sin(eLat) +
      Math.cos(pLat) * Math.cos(eLat) * Math.cos(pLng - eLng)
    ) * R
    
    // Calculate distance from point to line segment (simplified - using perpendicular distance)
    // For simplicity, we'll use the minimum distance to either endpoint or midpoint
    const midLat = (lineStartLat + lineEndLat) / 2
    const midLng = (lineStartLng + lineEndLng) / 2
    const dMid = calculateDistance(pointLat, pointLng, midLat, midLng)
    
    return Math.min(dStart, dEnd, dMid)
  }

  const fetchAndFilterBuses = async (startCoords, endCoords) => {
    if (!startCoords || !endCoords) return
    
    setLoadingBuses(true)
    try {
      const allBuses = await fetchBuses()
      
      // Filter buses that are near the route (within 2km of the route line)
      const filteredBuses = allBuses
        .filter(bus => {
          if (!bus.lat || !bus.lng) return false
          
          // Calculate distance from bus to route line
          const distance = distanceToLineSegment(
            bus.lat,
            bus.lng,
            startCoords[0],
            startCoords[1],
            endCoords[0],
            endCoords[1]
          )
          
          // Also check if bus is near start or end point (within 1km)
          const distToStart = calculateDistance(bus.lat, bus.lng, startCoords[0], startCoords[1])
          const distToEnd = calculateDistance(bus.lat, bus.lng, endCoords[0], endCoords[1])
          
          return distance < 2 || distToStart < 1 || distToEnd < 1
        })
        .map(bus => {
          // Calculate distance for sorting and display
          const distance = distanceToLineSegment(
            bus.lat,
            bus.lng,
            startCoords[0],
            startCoords[1],
            endCoords[0],
            endCoords[1]
          )
          return {
            ...bus,
            distanceFromRoute: distance
          }
        })
      
      // Sort by distance to route
      filteredBuses.sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)
      
      setRouteBuses(filteredBuses.slice(0, 20)) // Limit to 20 closest buses
    } catch (err) {
      console.error('Error fetching route buses:', err)
      setRouteBuses([])
    } finally {
      setLoadingBuses(false)
    }
  }

  const loadBookings = async () => {
    try {
      const response = await getCurrentBookings()
      if (response.bookings && response.bookings.length > 0) {
        const active = response.bookings.find(b => ['pending', 'confirmed', 'in_progress'].includes(b.status))
        if (active) {
          const ride = active.rides
          setCurrentBooking({
            id: active.id,
            driver: ride?.users?.name || 'Driver',
            rating: ride?.users?.rating || 5.0,
            from: active.from_location,
            to: active.to_location,
            eta: 'Calculating...',
            cost: `₹${active.cost}`,
            status: active.status,
          })
        }
      }
    } catch (err) {
      console.error('Error loading bookings:', err)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await getBookingHistory()
      if (response.history) {
        setPastRides(response.history.map(h => ({
          id: h.id,
          driver: 'Driver', // Would come from join
          from: h.from_location,
          to: h.to_location,
          date: h.ride_date,
          cost: `₹${h.cost}`,
        })))
      }
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }

  const loadPassengerRequests = async () => {
    if (!currentRideId) return
    try {
      const response = await getPassengerRequests(currentRideId)
      if (response.requests) {
        setPassengerRequests(response.requests)
      }
    } catch (err) {
      console.error('Error loading passenger requests:', err)
    }
  }

  const handleSearchRides = async () => {
    if (!joinFrom || !joinTo || !joinFromCoords || !joinToCoords) {
      setError('Please select both start and destination locations')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await searchRides({
        fromLocation: joinFrom,
        fromLat: joinFromCoords[0],
        fromLng: joinFromCoords[1],
        toLocation: joinTo,
        toLat: joinToCoords[0],
        toLng: joinToCoords[1],
        members: joinMembers,
      })
      setMatchingDrivers(response.rides || [])
    } catch (err) {
      setError(err.message || 'Failed to search rides')
      setMatchingDrivers([])
    } finally {
      setLoading(false)
    }
  }

  const handleBookRide = async (rideId) => {
    if (!joinFrom || !joinTo || !joinFromCoords || !joinToCoords) {
      setError('Please select both start and destination locations')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await createBooking({
        rideId,
        fromLocation: joinFrom,
        fromLat: joinFromCoords[0],
        fromLng: joinFromCoords[1],
        toLocation: joinTo,
        toLat: joinToCoords[0],
        toLng: joinToCoords[1],
        members: joinMembers,
      })
      
      if (response.success) {
        setCurrentBooking({
          id: response.booking.id,
          driver: 'Driver',
          rating: 5.0,
          from: joinFrom,
          to: joinTo,
          eta: 'Pending confirmation',
          cost: `₹${response.booking.cost}`,
          status: 'pending',
        })
        setError(null)
        alert('Booking request sent! Waiting for driver confirmation.')
      }
    } catch (err) {
      setError(err.message || 'Failed to book ride')
    } finally {
      setLoading(false)
    }
  }

  const handlePublishRide = async () => {
    if (!offerStart || !offerEnd || !offerStartCoords || !offerEndCoords) {
      setError('Please select both start and destination locations')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await createRide({
        startLocation: offerStart,
        startLat: offerStartCoords[0],
        startLng: offerStartCoords[1],
        endLocation: offerEnd,
        endLat: offerEndCoords[0],
        endLng: offerEndCoords[1],
        availableSeats: offerSeats,
        totalSeats: offerSeats,
        costPerPerson,
      })
      
      if (response.success) {
        setCurrentRideId(response.ride.id)
        await handleStartTracking(response.ride.id)
      }
    } catch (err) {
      setError(err.message || 'Failed to create ride')
    } finally {
      setLoading(false)
    }
  }

  const handleStartTracking = async (rideId = currentRideId) => {
    if (!rideId) return

    setLoading(true)
    try {
      await startTracking(rideId)
      setIsTracking(true)
      
      // Subscribe to ride updates
      wsRef.current?.subscribe(rideId)
      
      // Start location tracking
      locationTrackingRef.current = startLocationTracking(
        rideId,
        (location) => {
          // Location updated
        },
        5000 // Update every 5 seconds
      )
    } catch (err) {
      setError(err.message || 'Failed to start tracking')
    } finally {
      setLoading(false)
    }
  }

  const handleStopTracking = async () => {
    if (!currentRideId) return

    setLoading(true)
    try {
      await stopTracking(currentRideId)
      setIsTracking(false)
      
      // Stop location tracking
      if (locationTrackingRef.current) {
        locationTrackingRef.current()
        locationTrackingRef.current = null
      }
    } catch (err) {
      setError(err.message || 'Failed to stop tracking')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmBooking = async (bookingId) => {
    setLoading(true)
    try {
      await confirmBooking(bookingId)
      await loadPassengerRequests()
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to confirm booking')
    } finally {
      setLoading(false)
    }
  }

  if (mode === MODE_SELECTOR) {
    return (
      <div className="carpool-selector-page">
        <div className="carpool-selector-hero">
          <h1>Share Your Journey</h1>
          <p>Connect with fellow commuters and make every ride count</p>
        </div>

        <div className="carpool-mode-selectors">
          <button
            className="mode-selector-card"
            onClick={() => setMode(MODE_JOIN)}
          >
            <div className="mode-icon-wrapper">
              <Hand size={48} />
            </div>
            <h2>Join a Ride</h2>
            <p>Find available rides along your route</p>
          </button>

          <button
            className="mode-selector-card"
            onClick={() => setMode(MODE_OFFER)}
          >
            <div className="mode-icon-wrapper">
              <Car size={48} />
            </div>
            <h2>Offer a Ride</h2>
            <p>Share your journey and help others</p>
          </button>
        </div>

        <div className="carpool-benefits">
          <h3>Why Carpool?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <Leaf size={24} />
              <div className="benefit-content">
                <strong>Reduced Pollution</strong>
                <p>Share rides to significantly cut down vehicle emissions and carbon footprint. Every shared journey helps create cleaner air for our communities.</p>
              </div>
            </div>
            <div className="benefit-item">
              <Users size={24} />
              <div className="benefit-content">
                <strong>Sharing Economy</strong>
                <p>Be part of a sustainable transportation movement that connects people. Build meaningful connections while reducing traffic congestion on roads.</p>
              </div>
            </div>
            <div className="benefit-item">
              <DollarSign size={24} />
              <div className="benefit-content">
                <strong>Saving Money</strong>
                <p>Split fuel and parking costs with fellow commuters. Reduce your daily travel expenses significantly while maintaining convenience and comfort.</p>
              </div>
            </div>
            <div className="benefit-item">
              <Clock size={24} />
              <div className="benefit-content">
                <strong>Saving Time</strong>
                <p>Access carpool lanes and reduce commute time. Share the driving responsibility and enjoy a more relaxed journey to your destination.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === MODE_JOIN) {
    return (
      <div className="carpool-join-page">
        <div className="carpool-page-header">
          <button className="back-button" onClick={() => setMode(MODE_SELECTOR)}>
            ← Back
          </button>
          <h1>Join a Ride</h1>
        </div>

        <div className="carpool-split-layout">
          {/* Left Half - Input & Request */}
          <div className="carpool-left-panel">
            <div className="carpool-input-section">
              <h2>Your Trip Details</h2>
              
              <div className="input-group">
                <label>From</label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={joinFrom}
                    onChange={(e) => {
                      setJoinFrom(e.target.value)
                      const selected = delhiStops.find(s => s.name === e.target.value || s.shortLabel === e.target.value)
                      if (selected) {
                        setJoinFromCoords([selected.lat, selected.lng])
                      }
                    }}
                    placeholder="Select start location"
                    list="delhi-stops-from"
                  />
                  <button
                    className="map-pin-button"
                    onClick={() => openLocationModal('joinFrom', 'Start Location')}
                    aria-label="Select location on map"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
                <datalist id="delhi-stops-from">
                  {delhiStops.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.shortLabel}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>To</label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={joinTo}
                    onChange={(e) => {
                      setJoinTo(e.target.value)
                      const selected = delhiStops.find(s => s.name === e.target.value || s.shortLabel === e.target.value)
                      if (selected) {
                        setJoinToCoords([selected.lat, selected.lng])
                      }
                    }}
                    placeholder="Select destination"
                    list="delhi-stops-to"
                  />
                  <button
                    className="map-pin-button"
                    onClick={() => openLocationModal('joinTo', 'Destination')}
                    aria-label="Select location on map"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
                <datalist id="delhi-stops-to">
                  {delhiStops.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.shortLabel}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>Number of Members</label>
                <select
                  value={joinMembers}
                  onChange={(e) => setJoinMembers(Number(e.target.value))}
                  className="members-select"
                >
                  {[1, 2, 3, 4].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <button 
                className="primary search-button" 
                disabled={!joinFrom || !joinTo || loading}
                onClick={handleSearchRides}
              >
                {loading ? 'Searching...' : 'Search Rides'}
              </button>
              {error && (
                <div className="error-message" style={{ color: 'red', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            <div className="recent-requests-section">
              <h3>Repeat Recent Request</h3>
              <div className="recent-requests-list">
                {recentRequests.map(req => (
                  <div key={req.id} className="recent-request-card">
                    <div>
                      <strong>{req.from} → {req.to}</strong>
                      <p>{req.members} {req.members === 1 ? 'member' : 'members'}</p>
                    </div>
                    <button
                      className="repeat-button"
                      onClick={() => {
                        setJoinFrom(req.from)
                        setJoinTo(req.to)
                        setJoinMembers(req.members)
                      }}
                    >
                      <Repeat size={16} />
                      Repeat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Half - Rides Status */}
          <div className="carpool-right-panel">
            <div className="current-ride-section">
              <h3>Current Booked Ride</h3>
              {currentBooking ? (
                <div className="current-ride-card">
                  <div className="ride-header">
                    <div className="driver-info">
                      <div className="driver-avatar">{currentBooking.driver[0]}</div>
                      <div>
                        <strong>{currentBooking.driver}</strong>
                        <div className="rating">
                          <Star size={14} fill="#fbbf24" />
                          {currentBooking.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ride-route">
                    <MapPin size={14} />
                    {currentBooking.from} → {currentBooking.to}
                  </div>
                  <div className="ride-meta">
                    <span><Clock size={14} /> ETA: {currentBooking.eta}</span>
                    <span><DollarSign size={14} /> {currentBooking.cost}</span>
                  </div>
                  {currentBooking.status === 'pending' && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#f59e0b' }}>
                      Waiting for driver confirmation...
                    </div>
                  )}
                </div>
              ) : (
                <p className="empty-state">No active ride</p>
              )}
            </div>

            <div className="past-rides-section">
              <h3>Previously Booked Rides</h3>
              <div className="past-rides-list">
                {pastRides.map(ride => (
                  <div key={ride.id} className="past-ride-card">
                    <div>
                      <strong>{ride.driver}</strong>
                      <p>{ride.from} → {ride.to}</p>
                      <small>{ride.date}</small>
                    </div>
                    <span className="cost">{ride.cost}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Matching Results */}
            {matchingDrivers.length > 0 && (
              <div className="matching-results-section">
                <h3>Available Rides</h3>
                <div className="driver-cards-list">
                  {matchingDrivers.map(driver => (
                    <div key={driver.id} className="driver-card">
                      <div className="driver-card-header">
                        <div className="driver-info">
                          <div className="driver-avatar">{driver.driver[0]}</div>
                          <div>
                            <strong>{driver.driver}</strong>
                            <div className="rating">
                              <Star size={14} fill="#fbbf24" />
                              {driver.rating}
                            </div>
                          </div>
                        </div>
                        <span className="seats-badge">{driver.seats} seats</span>
                      </div>
                      <div className="route-coverage">
                        <div className="coverage-header">
                          <span>Route Coverage</span>
                          <strong>{driver.routeCoverage}%</strong>
                        </div>
                        <div className="coverage-bar">
                          <div
                            className="coverage-fill"
                            style={{ width: `${driver.routeCoverage}%` }}
                          />
                        </div>
                      </div>
                      <div className="driver-route">
                        <MapPin size={14} />
                        {driver.routeStart} → {driver.routeEnd}
                      </div>
                      <div className="driver-meta">
                        <span><Clock size={14} /> {driver.eta}</span>
                        <span className="cost"><DollarSign size={14} /> {driver.cost}</span>
                      </div>
                      <button 
                        className="primary small"
                        onClick={() => handleBookRide(driver.id)}
                        disabled={loading}
                      >
                        {loading ? 'Booking...' : 'Book Ride'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {matchingDrivers.length === 0 && joinFrom && joinTo && !loading && (
              <div className="matching-results-section">
                <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                  No matching rides found. Try adjusting your search criteria.
                </p>
              </div>
            )}

            {/* Live Buses on Route */}
            {joinFrom && joinTo && (
              <div className="route-buses-section">
                <h3>
                  <Bus size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
                  Live Buses on Your Route
                  {routeBuses.length > 0 && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '14px', 
                      fontWeight: 'normal', 
                      color: '#666' 
                    }}>
                      ({routeBuses.length} {routeBuses.length === 1 ? 'bus' : 'buses'})
                    </span>
                  )}
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '11px', 
                    fontWeight: 'normal', 
                    color: '#16a34a',
                    fontStyle: 'italic'
                  }}>
                    (Live from OTD API)
                  </span>
                </h3>
                {loadingBuses ? (
                  <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    Loading buses from OTD API...
                  </p>
                ) : routeBuses.length > 0 ? (
                  <div className="buses-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {routeBuses.map((bus, idx) => {
                      const speedKmh = bus.speed !== undefined && bus.speed > 0 
                        ? (bus.speed * 3.6).toFixed(1) 
                        : null
                      const isMoving = speedKmh && parseFloat(speedKmh) > 5
                      
                      return (
                        <div key={bus.id || idx} className="bus-item-card" style={{
                          padding: '14px',
                          marginBottom: '10px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <Bus size={18} color={isMoving ? "#16a34a" : "#f59e0b"} />
                                <div>
                                  <strong style={{ fontSize: '15px', color: '#1f2937' }}>
                                    {bus.trip_id ? `Trip ${bus.trip_id}` : `Bus ${bus.id?.substring(0, 12) || 'Unknown'}`}
                                  </strong>
                                  {isMoving && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px', 
                                      color: '#16a34a',
                                      fontWeight: 'normal'
                                    }}>
                                      ● Live
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                                <div style={{ marginBottom: '4px' }}>
                                  <strong>Location:</strong> {bus.lat?.toFixed(6)}, {bus.lng?.toFixed(6)}
                                </div>
                                {speedKmh && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Speed:</strong> {speedKmh} km/h
                                    <span style={{ marginLeft: '8px', color: isMoving ? '#16a34a' : '#f59e0b' }}>
                                      {isMoving ? 'Moving' : 'Stopped'}
                                    </span>
                                  </div>
                                )}
                                {bus.distanceFromRoute !== undefined && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Distance from route:</strong> {bus.distanceFromRoute.toFixed(2)} km
                                  </div>
                                )}
                                {bus.trip_id && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Trip ID:</strong> {bus.trip_id}
                                  </div>
                                )}
                                {bus.route && (
                                  <div>
                                    <strong>Route:</strong> {bus.route}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#999', 
                              textAlign: 'right',
                              paddingLeft: '12px'
                            }}>
                              <div style={{ marginBottom: '4px' }}>
                                {bus.provider || 'Delhi Transit'}
                              </div>
                              <div style={{ 
                                fontSize: '10px',
                                color: '#6b7280',
                                fontStyle: 'italic'
                              }}>
                                Live Data
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', padding: '20px', fontSize: '14px' }}>
                    No buses currently on this route
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <LocationSelectorModal
          isOpen={locationModal.isOpen}
          onClose={() => setLocationModal({ isOpen: false, field: null, label: '' })}
          onConfirm={handleLocationConfirm}
          fieldLabel={locationModal.label}
          defaultCenter={joinFromCoords || [28.6139, 77.2090]}
        />
      </div>
    )
  }

  if (mode === MODE_OFFER) {
    return (
      <div className="carpool-offer-page">
        <div className="carpool-page-header">
          <button className="back-button" onClick={() => setMode(MODE_SELECTOR)}>
            ← Back
          </button>
          <h1>Offer a Ride</h1>
        </div>

        <div className="carpool-split-layout">
          {/* Left Half - Route & Status */}
          <div className="carpool-left-panel">
            <div className="carpool-input-section">
              <h2>Your Route</h2>
              
              <div className="input-group">
                <label>My Route Start</label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={offerStart}
                    onChange={(e) => {
                      setOfferStart(e.target.value)
                      const selected = delhiStops.find(s => s.name === e.target.value || s.shortLabel === e.target.value)
                      if (selected) {
                        setOfferStartCoords([selected.lat, selected.lng])
                      }
                    }}
                    placeholder="Select start location"
                    list="delhi-stops-offer-start"
                  />
                  <button
                    className="map-pin-button"
                    onClick={() => openLocationModal('offerStart', 'Route Start')}
                    aria-label="Select location on map"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
                <datalist id="delhi-stops-offer-start">
                  {delhiStops.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.shortLabel}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>My Route End</label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={offerEnd}
                    onChange={(e) => {
                      setOfferEnd(e.target.value)
                      const selected = delhiStops.find(s => s.name === e.target.value || s.shortLabel === e.target.value)
                      if (selected) {
                        setOfferEndCoords([selected.lat, selected.lng])
                      }
                    }}
                    placeholder="Select destination"
                    list="delhi-stops-offer-end"
                  />
                  <button
                    className="map-pin-button"
                    onClick={() => openLocationModal('offerEnd', 'Route End')}
                    aria-label="Select location on map"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
                <datalist id="delhi-stops-offer-end">
                  {delhiStops.map((stop) => (
                    <option key={stop.id} value={stop.name}>
                      {stop.shortLabel}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label>Available Seats</label>
                <div className="seats-selector">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      className={`seat-option ${offerSeats === num ? 'active' : ''}`}
                      onClick={() => setOfferSeats(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>Cost per Person (₹)</label>
                <input
                  type="number"
                  value={costPerPerson}
                  onChange={(e) => setCostPerPerson(Number(e.target.value))}
                  min="10"
                  max="500"
                  placeholder="50"
                />
              </div>

              {error && (
                <div className="error-message" style={{ color: 'red', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="tracking-status">
                <div className="status-indicator">
                  {isTracking && (
                    <div className="car-animation">
                      <Car size={20} />
                    </div>
                  )}
                  <span>{isTracking ? 'Published & Tracking' : 'Not Published'}</span>
                </div>
                <button
                  className={`primary ${isTracking ? 'stop' : 'start'}`}
                  onClick={isTracking ? handleStopTracking : handlePublishRide}
                  disabled={!offerStart || !offerEnd || loading}
                >
                  {loading ? 'Processing...' : isTracking ? 'Stop Tracking' : 'Publish & Start Tracking'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Half - Passenger Requests & Buses */}
          <div className="carpool-right-panel">
            <h2>New Passenger Requests</h2>
            <div className="passenger-requests-list">
              {passengerRequests.map(req => (
                <div key={req.id} className="passenger-request-card">
                  <div className="request-header">
                    <div className="passenger-info">
                      <div className="passenger-avatar">{req.name[0]}</div>
                      <div>
                        <strong>{req.name}</strong>
                        <p>{req.members} {req.members === 1 ? 'passenger' : 'passengers'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="request-route">
                    <MapPin size={14} />
                    {req.from} → {req.to}
                  </div>
                  <div className="request-meta">
                    <span>Proximity: {req.proximity}</span>
                    <span>Deviation: {req.deviation}</span>
                  </div>
                  <div className="request-actions">
                    <button 
                      className="secondary ignore-button"
                      onClick={() => {
                        setPassengerRequests(prev => prev.filter(r => r.id !== req.id))
                      }}
                    >
                      <X size={16} />
                      Ignore
                    </button>
                    <button 
                      className="primary offer-button"
                      onClick={() => handleConfirmBooking(req.id)}
                      disabled={loading}
                    >
                      <CheckCircle size={16} />
                      Offer Ride
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Buses on Route */}
            {offerStart && offerEnd && (
              <div className="route-buses-section" style={{ marginTop: '24px' }}>
                <h3>
                  <Bus size={18} style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />
                  Live Buses on Your Route
                  {routeBuses.length > 0 && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '14px', 
                      fontWeight: 'normal', 
                      color: '#666' 
                    }}>
                      ({routeBuses.length} {routeBuses.length === 1 ? 'bus' : 'buses'})
                    </span>
                  )}
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '11px', 
                    fontWeight: 'normal', 
                    color: '#16a34a',
                    fontStyle: 'italic'
                  }}>
                    (Live from OTD API)
                  </span>
                </h3>
                {loadingBuses ? (
                  <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    Loading buses from OTD API...
                  </p>
                ) : routeBuses.length > 0 ? (
                  <div className="buses-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {routeBuses.map((bus, idx) => {
                      const speedKmh = bus.speed !== undefined && bus.speed > 0 
                        ? (bus.speed * 3.6).toFixed(1) 
                        : null
                      const isMoving = speedKmh && parseFloat(speedKmh) > 5
                      
                      return (
                        <div key={bus.id || idx} className="bus-item-card" style={{
                          padding: '14px',
                          marginBottom: '10px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <Bus size={18} color={isMoving ? "#16a34a" : "#f59e0b"} />
                                <div>
                                  <strong style={{ fontSize: '15px', color: '#1f2937' }}>
                                    {bus.trip_id ? `Trip ${bus.trip_id}` : `Bus ${bus.id?.substring(0, 12) || 'Unknown'}`}
                                  </strong>
                                  {isMoving && (
                                    <span style={{ 
                                      marginLeft: '8px', 
                                      fontSize: '11px', 
                                      color: '#16a34a',
                                      fontWeight: 'normal'
                                    }}>
                                      ● Live
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                                <div style={{ marginBottom: '4px' }}>
                                  <strong>Location:</strong> {bus.lat?.toFixed(6)}, {bus.lng?.toFixed(6)}
                                </div>
                                {speedKmh && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Speed:</strong> {speedKmh} km/h
                                    <span style={{ marginLeft: '8px', color: isMoving ? '#16a34a' : '#f59e0b' }}>
                                      {isMoving ? 'Moving' : 'Stopped'}
                                    </span>
                                  </div>
                                )}
                                {bus.distanceFromRoute !== undefined && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Distance from route:</strong> {bus.distanceFromRoute.toFixed(2)} km
                                  </div>
                                )}
                                {bus.trip_id && (
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Trip ID:</strong> {bus.trip_id}
                                  </div>
                                )}
                                {bus.route && (
                                  <div>
                                    <strong>Route:</strong> {bus.route}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#999', 
                              textAlign: 'right',
                              paddingLeft: '12px'
                            }}>
                              <div style={{ marginBottom: '4px' }}>
                                {bus.provider || 'Delhi Transit'}
                              </div>
                              <div style={{ 
                                fontSize: '10px',
                                color: '#6b7280',
                                fontStyle: 'italic'
                              }}>
                                Live Data
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', padding: '20px', fontSize: '14px' }}>
                    No buses currently on this route
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <LocationSelectorModal
          isOpen={locationModal.isOpen}
          onClose={() => setLocationModal({ isOpen: false, field: null, label: '' })}
          onConfirm={handleLocationConfirm}
          fieldLabel={locationModal.label}
          defaultCenter={offerStartCoords || [28.6139, 77.2090]}
        />
      </div>
    )
  }

  return null
}
