import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/useAppStore'

export const PopularRoutes = () => {
  const { t } = useI18n()
  const routes = useAppStore((state) => state.popularRoutes)

  return (
    <div className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('popularRoutes')}</p>
          <h2>{t('liveBuses')}</h2>
        </div>
      </header>
      <div className="route-list">
        {routes.map((route) => (
          <article key={route.id} className="route-card">
            <h3>{route.name}</h3>
            <p>{route.frequency}</p>
            <dl>
              <div>
                <dt>{t('eta')}</dt>
                <dd>{route.eta}</dd>
              </div>
              <div>
                <dt>Stops</dt>
                <dd>{route.stops}</dd>
              </div>
              <div>
                <dt>Load</dt>
                <dd>{route.occupancy}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}

