import { Megaphone } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'
import { useSpeech } from '../hooks/useSpeech'

const formatDetails = (bus, t) =>
  `${bus.route}. ${t('eta')}: ${bus.eta}. ${t('cost')}: ${bus.cost}. ${t('boarding')}: ${
    bus.start
  }. ${t('alighting')}: ${bus.end}.`

export const BusInfoCard = () => {
  const { t, language } = useI18n()
  const selectedBus = useAppStore((state) => state.selectedBus)
  const filteredBuses = useAppStore((state) => state.filteredBuses)
  const ttsEnabled = useAppStore((state) => state.ttsEnabled)
  const fallbackBus = filteredBuses[0]
  const bus = selectedBus ?? fallbackBus
  const { speak, speechSynthesisSupported } = useSpeech()

  if (!bus) {
    return null
  }

  const announce = () => {
    if (!ttsEnabled || !speechSynthesisSupported) return
    speak(formatDetails(bus, t), language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN')
  }

  return (
    <div className="panel-card emphasis">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('route')}</p>
          <h2>{bus.route}</h2>
        </div>
        {ttsEnabled && speechSynthesisSupported && (
          <button className="ghost" onClick={announce} aria-label={t('speakSelection')}>
            <Megaphone size={16} />
          </button>
        )}
      </header>
      <dl className="detail-grid">
        <div>
          <dt>{t('eta')}</dt>
          <dd>{bus.eta}</dd>
        </div>
        <div>
          <dt>{t('cost')}</dt>
          <dd>{bus.cost}</dd>
        </div>
        <div>
          <dt>{t('boarding')}</dt>
          <dd>{bus.start}</dd>
        </div>
        <div>
          <dt>{t('alighting')}</dt>
          <dd>{bus.end}</dd>
        </div>
      </dl>
    </div>
  )
}

