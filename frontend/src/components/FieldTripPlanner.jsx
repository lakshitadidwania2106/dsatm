import { useState } from 'react'
import { Mic, Navigation, Clock, DollarSign, RefreshCw, Route as RouteIcon, ChevronDown } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useSpeech } from '../hooks/useSpeech'
import { planTrip } from '../services/tripPlannerService'
import { cityStops } from '../data/cityStops'
import { metroStations } from '../data/metroStations'
import { useAppStore } from '../store/useAppStore'

const langMap = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
}

export const FieldTripPlanner = () => {
  const { t, language } = useI18n()
  const { startListening, stopListening, isListening, speechRecognitionSupported } = useSpeech()
  const sttEnabled = useAppStore((state) => state.sttEnabled)
  const userLocation = useAppStore((state) => state.userLocation)
  const accessibilityFilters = useAppStore((state) => state.accessibilityFilters)
  const setAccessibilityFilters = useAppStore((state) => state.setAccessibilityFilters)

  const [startLocation, setStartLocation] = useState('')
  const [endLocation, setEndLocation] = useState('')
  const [preference, setPreference] = useState('time')
  const [routes, setRoutes] = useState([])
  const [isPlanning, setIsPlanning] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [startCoords, setStartCoords] = useState(null)
  const [endCoords, setEndCoords] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Geocode location (simplified - in production, use a real geocoding service)
  const geocodeLocation = (locationName) => {
    // Try to find in city stops
    const cityStop = cityStops.find(
      (stop) =>
        stop.name.toLowerCase().includes(locationName.toLowerCase()) ||
        stop.shortLabel.toLowerCase().includes(locationName.toLowerCase()),
    )
    if (cityStop) {
      return { lat: cityStop.lat, lng: cityStop.lng, name: cityStop.name }
    }

    // Try to find in metro stations
    const metroStation = metroStations.find(
      (station) =>
        station.name.toLowerCase().includes(locationName.toLowerCase()) ||
        station.code.toLowerCase().includes(locationName.toLowerCase()),
    )
    if (metroStation) {
      return { lat: metroStation.lat, lng: metroStation.lng, name: metroStation.name }
    }

    // Default fallback (use user location or a default)
    if (userLocation) {
      return { ...userLocation, name: locationName }
    }

    // Default to a central location (Bangalore)
    return { lat: 12.9716, lng: 77.5946, name: locationName }
  }

  const handlePlanTrip = async () => {
    if (!startLocation || !endLocation) {
      return
    }

    setIsPlanning(true)
    setShowResults(false)

    try {
      const start = geocodeLocation(startLocation)
      const end = geocodeLocation(endLocation)

      setStartCoords(start)
      setEndCoords(end)

      const plannedRoutes = await planTrip(start, end, preference)
      setRoutes(plannedRoutes)
      setShowResults(true)
    } catch (error) {
      console.error('Error planning trip:', error)
    } finally {
      setIsPlanning(false)
    }
  }

  const handleVoice = (field) => {
    if (!sttEnabled || !speechRecognitionSupported) {
      return
    }
    startListening({
      lang: langMap[language] ?? 'en-IN',
      onResult: (transcript) => {
        if (field === 'start') {
          setStartLocation(transcript)
        } else {
          setEndLocation(transcript)
        }
        stopListening()
      },
    })
  }

  const handleUseCurrentLocation = (field) => {
    if (!userLocation) {
      alert(t('locationNotAvailable') || 'Location not available')
      return
    }

    if (field === 'start') {
      setStartLocation(t('currentLocation') || 'Current Location')
      setStartCoords(userLocation)
    } else {
      setEndLocation(t('currentLocation') || 'Current Location')
      setEndCoords(userLocation)
    }
  }

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  return (
    <div className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('fieldTripPlannerTitle') || 'Field Trip Planner'}</p>
          <h2>{t('planYourJourney') || 'Plan Your Journey'}</h2>
        </div>
      </header>

      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault()
          handlePlanTrip()
        }}
      >
        <label className="input-field">
          <span>{t('from') || 'From'}</span>
          <div className="input-control">
            <input
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              placeholder={t('enterStartingAddress') || 'Enter starting address or current location'}
              list="location-autocomplete-start"
            />
            <div className="input-actions">
              {userLocation && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleUseCurrentLocation('start')}
                  aria-label={t('useCurrentLocation') || 'Use current location'}
                  title={t('useCurrentLocation') || 'Use current location'}
                >
                  <Navigation size={16} />
                </button>
              )}
              {sttEnabled && speechRecognitionSupported && (
                <button
                  type="button"
                  className={`ghost ${isListening ? 'active' : ''}`}
                  onClick={() => handleVoice('start')}
                  aria-label={t('speechToText')}
                >
                  <Mic size={16} />
                </button>
              )}
            </div>
          </div>
        </label>

        <label className="input-field">
          <span>{t('to') || 'To'}</span>
          <div className="input-control">
            <input
              value={endLocation}
              onChange={(e) => setEndLocation(e.target.value)}
              placeholder={t('enterFinalDestination') || 'Enter your final destination or landmark'}
              list="location-autocomplete-end"
            />
            <div className="input-actions">
              {userLocation && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleUseCurrentLocation('end')}
                  aria-label={t('useCurrentLocation') || 'Use current location'}
                  title={t('useCurrentLocation') || 'Use current location'}
                >
                  <Navigation size={16} />
                </button>
              )}
              {sttEnabled && speechRecognitionSupported && (
                <button
                  type="button"
                  className={`ghost ${isListening ? 'active' : ''}`}
                  onClick={() => handleVoice('end')}
                  aria-label={t('speechToText')}
                >
                  <Mic size={16} />
                </button>
              )}
            </div>
          </div>
        </label>

        <div className="preference-group">
          <label className="preference-label">{t('routePreferences') || 'Route Preferences'}</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="preference"
                value="time"
                checked={preference === 'time'}
                onChange={(e) => setPreference(e.target.value)}
              />
              <div>
                <Clock size={16} />
                <span>{t('timeEfficient') || 'Time Efficient'}</span>
              </div>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="preference"
                value="cost"
                checked={preference === 'cost'}
                onChange={(e) => setPreference(e.target.value)}
              />
              <div>
                <DollarSign size={16} />
                <span>{t('costEfficient') || 'Cost Efficient'}</span>
              </div>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="preference"
                value="switches"
                checked={preference === 'switches'}
                onChange={(e) => setPreference(e.target.value)}
              />
              <div>
                <RouteIcon size={16} />
                <span>{t('minimumSwitching') || 'Minimum Switching'}</span>
              </div>
            </label>
          </div>
        </div>

        <section className={`filter-grid ${filtersOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="filter-toggle"
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-expanded={filtersOpen}
          >
            <span>
              {t('accessibilityFiltersTitle')}
              <small>{t('accessibilityFiltersNote')}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {filtersOpen && (
            <div className="filter-body">
              <div className="filter-options">
                {[
                  { key: 'wheelchair', label: t('filterWheelchair') },
                  { key: 'ramps', label: t('filterRamps') },
                  { key: 'elevators', label: t('filterElevators') },
                  { key: 'avoidSteep', label: t('filterAvoidSteep') },
                  { key: 'avoidCrowded', label: t('filterAvoidCrowded') },
                ].map((filter) => (
                  <label key={filter.key} className="pill">
                    <input
                      type="checkbox"
                      checked={accessibilityFilters[filter.key]}
                      onChange={(event) =>
                        setAccessibilityFilters({ [filter.key]: event.target.checked })
                      }
                    />
                    <span>{filter.label}</span>
                  </label>
                ))}
              </div>
              <div className="switch-row compact">
                <div>
                  <span className="switch-label">{t('calmMode')}</span>
                  <p className="switch-subtext">{t('calmModeHint')}</p>
                </div>
                <button
                  type="button"
                  className={`switch ${accessibilityFilters.calmMode ? 'on' : ''}`}
                  onClick={() => setAccessibilityFilters({ calmMode: !accessibilityFilters.calmMode })}
                  aria-pressed={accessibilityFilters.calmMode}
                >
                  <span className="thumb" />
                </button>
              </div>
            </div>
          )}
        </section>

        <button className="primary" type="submit" disabled={isPlanning || !startLocation || !endLocation}>
          {isPlanning ? (
            <>
              <RefreshCw size={16} className="spinning" />
              {t('planning') || 'Planning...'}
            </>
          ) : (
            <>
              <RouteIcon size={16} />
              {t('planTrip') || 'Plan Trip'}
            </>
          )}
        </button>
      </form>

      {/* Autocomplete datalists */}
      <datalist id="location-autocomplete-start">
        {[...cityStops, ...metroStations].map((location) => (
          <option key={`start-${location.id || location.code}`} value={location.name} />
        ))}
      </datalist>
      <datalist id="location-autocomplete-end">
        {[...cityStops, ...metroStations].map((location) => (
          <option key={`end-${location.id || location.code}`} value={location.name} />
        ))}
      </datalist>

      {/* Results Display */}
      {showResults && routes.length > 0 && (
        <div className="trip-results">
          <h3 className="results-title">{t('feasibleRoutes') || 'Feasible Routes'}</h3>
          <div className="routes-list">
            {routes.map((route) => (
              <div key={route.id} className="route-card">
                <div className="route-header">
                  <h4>{route.name}</h4>
                  <div className="route-metrics">
                    <span className="metric">
                      <Clock size={14} />
                      {formatTime(route.totalTravelTime)}
                    </span>
                    <span className="metric">
                      <DollarSign size={14} />
                      ₹{route.estimatedCost}
                    </span>
                    <span className="metric">
                      <RouteIcon size={14} />
                      {route.transfers} {t('transfers') || 'transfers'}
                    </span>
                  </div>
                </div>

                <div className="route-steps">
                  <p className="steps-label">{t('detailedItinerary') || 'Detailed Step-by-Step Itinerary'}</p>
                  <ol className="steps-list">
                    {route.steps.map((step, index) => (
                      <li key={index} className={`step-item step-${step.type}`}>
                        <span className="step-number">{step.step}</span>
                        <span className="step-content">{step.description}</span>
                        {step.waitTime && (
                          <span className="step-wait-time">
                            {t('realTimeWait') || 'Real-Time Wait'}: {step.waitTime} min
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResults && routes.length === 0 && (
        <div className="empty-results">
          <p>{t('noRoutesFound') || 'No routes found for this journey. Please try different locations.'}</p>
        </div>
      )}
    </div>
  )
}

