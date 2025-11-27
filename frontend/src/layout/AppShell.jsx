import { NavLink } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { supportedLanguages } from '../i18n/translations'
import { useAppStore } from '../store/useAppStore'
import { ChatAssistant } from '../components/ChatAssistant'

export const AppShell = ({ children }) => {
  const { t, language } = useI18n()
  const setLanguage = useAppStore((state) => state.setLanguage)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="pulse" />
          <div>
            <strong>{t('appTitle')}</strong>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            {t('mapNav')}
          </NavLink>
<<<<<<< HEAD
          <NavLink to="/carpool">Carpool</NavLink>
          <NavLink to="/accessibility">Accessibility</NavLink>
=======
          <NavLink to="/carpool">{t('carpoolNav')}</NavLink>
          <NavLink to="/accessibility">{t('accessibilityNav')}</NavLink>
>>>>>>> e2334fe94ba052a26343e54887915823ec58d2e7
        </nav>
        <div className="header-actions">
          <label>
            {t('languageLabel')}
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="content-area">{children}</main>
      <ChatAssistant />
    </div>
  )
}

