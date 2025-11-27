import { useState } from 'react'
import { Mic, Route, Search } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useI18n } from '../hooks/useI18n'
import { useSpeech } from '../hooks/useSpeech'

const langMap = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
}

export const RoutePlanner = () => {
  const { t, language } = useI18n()
  const filterBuses = useAppStore((state) => state.filterBuses)
  const planRoute = useAppStore((state) => state.planRoute)
  const setSelectedBus = useAppStore((state) => state.setSelectedBus)
  const cityStops = useAppStore((state) => state.cityStops)
  const accessibilityFilters = useAppStore((state) => state.accessibilityFilters)
  const setAccessibilityFilters = useAppStore((state) => state.setAccessibilityFilters)
  const sttEnabled = useAppStore((state) => state.sttEnabled)
  const filteredBuses = useAppStore((state) => state.filteredBuses)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const { startListening, stopListening, isListening, speechRecognitionSupported } = useSpeech()

  const handleSubmit = (event) => {
    event.preventDefault()
    filterBuses({ start, end })
  }

  const handleRoute = () => {
    planRoute({ start, end })
    filterBuses({ start, end })
  }

  const handleVoice = (field) => {
    if (!sttEnabled || !speechRecognitionSupported) {
      return
    }
    startListening({
      lang: langMap[language] ?? 'en-IN',
      onResult: (transcript) => {
        if (field === 'start') {
          setStart(transcript)
        } else {
          setEnd(transcript)
        }
        stopListening()
      },
    })
  }

  return (
    <div className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('routePlannerTitle')}</p>
          <h2>{t('availableBuses')}</h2>
        </div>
        <span className="meta">{filteredBuses.length}</span>
      </header>
      <form className="planner-form" onSubmit={handleSubmit}>
        <label className="input-field">
          <span>{t('startPlaceholder')}</span>
          <div className="input-control">
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder={t('startPlaceholder')}
              list="bangalore-stops"
            />
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
        </label>
        <label className="input-field">
          <span>{t('endPlaceholder')}</span>
          <div className="input-control">
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder={t('endPlaceholder')}
              list="bangalore-stops"
            />
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
        </label>
        <div className="planner-actions">
          <button className="secondary" type="button" onClick={handleRoute}>
            <Route size={16} />
            {t('showRoute')}
          </button>
          <button className="primary" type="submit">
            <Search size={16} />
            {t('findRoutes')}
          </button>
        </div>
      </form>
      <section className="filter-grid">
        <h3>{t('accessibilityFiltersTitle')}</h3>
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
      </section>
      <datalist id="bangalore-stops">
        {cityStops.map((stop) => (
          <option key={stop.id} value={stop.name} />
        ))}
      </datalist>
      {filteredBuses.length === 0 ? (
        <p className="empty-text">{t('emptyResults')}</p>
      ) : (
        <ul className="bus-results">
          {filteredBuses.map((bus) => (
            <li key={bus.id}>
              <button type="button" onClick={() => setSelectedBus(bus)}>
                <div>
                  <strong>{bus.route}</strong>
                  <p>
                    {bus.start} → {bus.end}
                  </p>
                </div>
                <div>
                  <span>
                    {t('eta')}: {bus.eta}
                  </span>
                  <span>
                    {t('cost')}: {bus.cost}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

