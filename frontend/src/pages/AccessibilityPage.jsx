import { AccessibilityPanel } from '../components/AccessibilityPanel'
import { AccessibilityReports } from '../components/AccessibilityReports'
import { useI18n } from '../hooks/useI18n'

export const AccessibilityPage = () => {
  const { t } = useI18n()
  return (
    <div className="accessibility-page">
      <section className="panel-card hero">
        <p className="eyebrow">{t('accessibilityTitle')}</p>
        <h1>{t('accessibilityHeroTitle')}</h1>
        <p>{t('accessibilityHeroBody')}</p>
      </section>
      <div className="accessibility-grid">
        <AccessibilityPanel />
        <AccessibilityReports />
      </div>
    </div>
  )
}

