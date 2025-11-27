import { Megaphone } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import { useSpeech } from '../hooks/useSpeech'

const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes} mins`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export const FeasibleRoutes = () => {
  const { t, language } = useI18n()
  const routes = useAppStore((state) => state.plannedRoutes)
  const setRoutePreview = useAppStore((state) => state.setRoutePreview)
  const ttsEnabled = useAppStore((state) => state.ttsEnabled)
  const { speak, speechSynthesisSupported } = useSpeech()

  if (!routes || routes.length === 0) {
    return null
  }

  const handleRouteClick = (route) => {
    setRoutePreview({
      coordinates: route.coordinates || [],
      route: route
    })
  }

  const announce = (route) => {
    if (!ttsEnabled || !speechSynthesisSupported) return
    const text = `Route: ${route.name}. ETA: ${route.eta || formatTime(route.totalTravelTime)}. Cost: ₹${route.estimatedCost}. Boarding: ${route.boarding}. Alighting: ${route.alighting}.`
    speak(text, language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN')
  }

  return (
    <div className="panel-card emphasis">
      <header className="section-header">
        <div>
          <p className="eyebrow">ROUTE</p>
          <h2>Feasible Routes</h2>
        </div>
      </header>
      <div className="routes-list-compact">
        {routes.map((route) => (
          <div 
            key={route.id} 
            className="route-card-dark-compact"
            onClick={() => handleRouteClick(route)}
          >
            <div className="route-card-header-dark">
              <div>
                <p className="route-label-dark">ROUTE</p>
                <h3 className="route-name-dark">{route.name || `${route.boarding || 'Start'} ⇌ ${route.alighting || 'End'}`}</h3>
                <p className="route-detail-dark">{route.boarding || 'Start'} → {route.alighting || 'End'}</p>
              </div>
              <div className="route-meta-dark">
                {ttsEnabled && speechSynthesisSupported && (
                  <button 
                    className="ghost-icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation()
                      announce(route)
                    }}
                    aria-label="Speak route"
                  >
                    <Megaphone size={16} />
                  </button>
                )}
                <div>
                  <p className="meta-label-dark">ETA</p>
                  <p className="meta-value-dark">{route.eta || formatTime(route.totalTravelTime)}</p>
                </div>
                <div>
                  <p className="meta-label-dark">COST</p>
                  <p className="meta-value-dark">₹{route.estimatedCost}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

