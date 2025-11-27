import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'

export const RouteOverview = () => {
  const { t } = useI18n()
  const routePreview = useAppStore((state) => state.routePreview)

  if (!routePreview) {
    return null
  }

  return (
    <div className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('routeSummary')}</p>
          <h2>{routePreview.name}</h2>
        </div>
        <div className="route-meta">
          <span>{routePreview.distance}</span>
          <span>{routePreview.duration}</span>
        </div>
      </header>
      <ul className="route-steps">
        {routePreview.steps?.map((step, index) => (
          <li key={index}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ul>
      <div className="route-badges">
        <span>{t('recommendedBuses')}</span>
        <div>
          {routePreview.buses?.map((bus) => (
            <strong key={bus}>{bus}</strong>
          ))}
        </div>
      </div>
    </div>
  )
}

