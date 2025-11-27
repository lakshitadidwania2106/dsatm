import { NavLink } from 'react-router-dom'
import { useI18n } from '../hooks/useI18n'
import { supportedLanguages } from '../i18n/translations'
import { useAppStore } from '../store/useAppStore'

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
            <small>Realtime beta</small>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            Map
          </NavLink>
          <NavLink to="/feedback">Feedback</NavLink>
          <NavLink to="/accessibility">Accessibility</NavLink>
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
    </div>
  )
}

