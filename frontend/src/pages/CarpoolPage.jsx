import { useState, useMemo } from 'react'
import { Hand, Car, Leaf, Users, MapPin, Clock, DollarSign, Star, Repeat, X, CheckCircle } from 'lucide-react'
import { LocationSelectorModal } from '../components/LocationSelectorModal'
import { delhiStops } from '../data/delhiStops'

// Mode: 'selector' | 'join' | 'offer'
const MODE_SELECTOR = 'selector'
const MODE_JOIN = 'join'
const MODE_OFFER = 'offer'

// Simulated data
const recentRequests = [
  { id: 1, from: 'Connaught Place', to: 'Gurgaon', members: 2 },
  { id: 2, from: 'Dwarka', to: 'Rajiv Chowk', members: 1 },
  { id: 3, from: 'Noida', to: 'Karol Bagh', members: 1 },
]

const currentRide = {
  driver: 'Priya',
  rating: 4.9,
  from: 'Connaught Place',
  to: 'Gurgaon',
  eta: '15 min',
  cost: '₹80',
}

const pastRides = [
  { id: 1, driver: 'Rahul', from: 'Dwarka', to: 'Rajiv Chowk', date: '2024-01-15', cost: '₹60' },
  { id: 2, driver: 'Meera', from: 'Noida', to: 'Karol Bagh', date: '2024-01-10', cost: '₹70' },
]

const availableDrivers = [
  {
    id: 1,
    driver: 'Amit',
    rating: 4.8,
    routeStart: 'Rohini',
    routeEnd: 'Laxmi Nagar',
    routeCoverage: 85,
    cost: '₹65',
    seats: 2,
    eta: '12 min',
  },
  {
    id: 2,
    driver: 'Sneha',
    rating: 4.9,
    routeStart: 'Connaught Place',
    routeEnd: 'Gurgaon',
    routeCoverage: 92,
    cost: '₹80',
    seats: 1,
    eta: '8 min',
  },
  {
    id: 3,
    driver: 'Vikram',
    rating: 4.7,
    routeStart: 'Dwarka',
    routeEnd: 'Rajiv Chowk',
    routeCoverage: 78,
    cost: '₹60',
    seats: 3,
    eta: '20 min',
  },
]

const passengerRequests = [
  {
    id: 1,
    name: 'Raj',
    from: 'Connaught Place',
    to: 'Gurgaon',
    members: 2,
    proximity: '0.5 km',
    deviation: '2.3 km',
  },
  {
    id: 2,
    name: 'Priya',
    from: 'Dwarka Sector 10',
    to: 'Rajiv Chowk',
    members: 1,
    proximity: '1.2 km',
    deviation: '3.1 km',
  },
]

export const CarpoolPage = () => {
  const [mode, setMode] = useState(MODE_SELECTOR)
  const [locationModal, setLocationModal] = useState({ isOpen: false, field: null, label: '' })
  
  // Join Ride state
  const [joinFrom, setJoinFrom] = useState('')
  const [joinTo, setJoinTo] = useState('')
  const [joinMembers, setJoinMembers] = useState(1)
  const [joinFromCoords, setJoinFromCoords] = useState(null)
  const [joinToCoords, setJoinToCoords] = useState(null)
  
  // Offer Ride state
  const [offerStart, setOfferStart] = useState('')
  const [offerEnd, setOfferEnd] = useState('')
  const [offerSeats, setOfferSeats] = useState(1)
  const [isTracking, setIsTracking] = useState(false)
  const [offerStartCoords, setOfferStartCoords] = useState(null)
  const [offerEndCoords, setOfferEndCoords] = useState(null)

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

  // Filter drivers based on route coverage (no deviation constraint)
  const matchingDrivers = useMemo(() => {
    if (!joinFrom || !joinTo) return []
    
    // Simulate matching logic - drivers whose route covers passenger's route
    return availableDrivers.filter(driver => {
      // In real app, check if passenger's route is on driver's route
      // For now, return all drivers with route coverage > 70%
      return driver.routeCoverage >= 70
    })
  }, [joinFrom, joinTo])

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

              <button className="primary search-button" disabled={!joinFrom || !joinTo}>
                Search Rides
              </button>
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
              {currentRide ? (
                <div className="current-ride-card">
                  <div className="ride-header">
                    <div className="driver-info">
                      <div className="driver-avatar">{currentRide.driver[0]}</div>
                      <div>
                        <strong>{currentRide.driver}</strong>
                        <div className="rating">
                          <Star size={14} fill="#fbbf24" />
                          {currentRide.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ride-route">
                    <MapPin size={14} />
                    {currentRide.from} → {currentRide.to}
                  </div>
                  <div className="ride-meta">
                    <span><Clock size={14} /> ETA: {currentRide.eta}</span>
                    <span><DollarSign size={14} /> {currentRide.cost}</span>
                  </div>
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
            {joinFrom && joinTo && (
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
                      <button className="primary small">Book Ride</button>
                    </div>
                  ))}
                </div>
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
                  onClick={() => setIsTracking(!isTracking)}
                  disabled={!offerStart || !offerEnd}
                >
                  {isTracking ? 'Stop Tracking' : 'Publish & Start Tracking'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Half - Passenger Requests */}
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
                    <button className="secondary ignore-button">
                      <X size={16} />
                      Ignore
                    </button>
                    <button className="primary offer-button">
                      <CheckCircle size={16} />
                      Offer Ride
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
