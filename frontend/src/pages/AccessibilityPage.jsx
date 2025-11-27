import { AccessibilityPanel } from '../components/AccessibilityPanel'
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
        <section className="panel-card tips">
          <h3>{t('accessibilityTipsTitle')}</h3>
          <ul>
            <li>{t('accessibilityTipOne')}</li>
            <li>{t('accessibilityTipTwo')}</li>
            <li>{t('accessibilityTipThree')}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

