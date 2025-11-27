import { useEffect } from 'react'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'

export const AccessibilityPanel = () => {
  const { t } = useI18n()
  const fontScale = useAppStore((state) => state.fontScale)
  const setFontScale = useAppStore((state) => state.setFontScale)
  const highContrast = useAppStore((state) => state.highContrast)
  const toggleHighContrast = useAppStore((state) => state.toggleHighContrast)
  const sttEnabled = useAppStore((state) => state.sttEnabled)
  const ttsEnabled = useAppStore((state) => state.ttsEnabled)
  const setSpeechPreferences = useAppStore((state) => state.setSpeechPreferences)
  const accessibilityMode = useAppStore((state) => state.accessibilityMode)
  const setAccessibilityMode = useAppStore((state) => state.setAccessibilityMode)

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', fontScale)
  }, [fontScale])

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal'
  }, [highContrast])

  return (
    <section className="accessibility-panel" id="accessibility">
      <header>
        <p className="eyebrow">{t('accessibilityTitle')}</p>
        <h3>{t('accessibilityTitle')}</h3>
      </header>
      <div className="accessibility-controls">
        <div className="switch-row">
          <div>
            <span className="switch-label">{t('accessibilityMode')}</span>
            <p className="switch-subtext">{t('speakSelection')}</p>
          </div>
          <button
            type="button"
            className={`switch ${accessibilityMode ? 'on' : ''}`}
            onClick={() => setAccessibilityMode(!accessibilityMode)}
            aria-pressed={accessibilityMode}
          >
            <span className="thumb" />
          </button>
        </div>
        <label>
          <span>{t('fontSize')}</span>
          <input
            type="range"
            min="0.9"
            max="1.4"
            step="0.05"
            value={fontScale}
            onChange={(event) => setFontScale(Number(event.target.value))}
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={highContrast} onChange={toggleHighContrast} />
          <span>{t('highContrast')}</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={ttsEnabled}
            onChange={(event) => setSpeechPreferences({ ttsEnabled: event.target.checked })}
          />
          <span>{t('textToSpeech')}</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={sttEnabled}
            onChange={(event) => setSpeechPreferences({ sttEnabled: event.target.checked })}
          />
          <span>{t('speechToText')}</span>
        </label>
        <button
          className="ghost stretch"
          type="button"
          onClick={() => window.speechSynthesis?.cancel()}
        >
          {t('stopSpeaking')}
        </button>
      </div>
    </section>
  )
}

