import { useMemo, useState } from 'react'
import { Users, Leaf, CalendarClock, Search, Car, Star, MapPin, DollarSign, Clock } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { cityStops } from '../data/cityStops'

const sampleRides = [
  {
    id: 'ride-01',
    driver: 'Priya',
    rating: '4.9',
    start: 'Connaught Place',
    end: 'Gurgaon',
    departure: '07:45 AM',
    seats: 2,
    cost: '₹80 share',
    eco: 'Saves 4kg CO₂',
    tag: 'hot',
  },
  {
    id: 'ride-02',
    driver: 'Rahul',
    rating: '4.7',
    start: 'Dwarka',
    end: 'Rajiv Chowk',
    departure: '08:10 AM',
    seats: 1,
    cost: '₹60 share',
    eco: 'Saves 3kg CO₂',
    tag: 'new',
  },
  {
    id: 'ride-03',
    driver: 'Meera',
    rating: '5.0',
    start: 'Noida',
    end: 'Karol Bagh',
    departure: '06:30 PM',
    seats: 3,
    cost: '₹70 share',
    eco: 'Saves 5kg CO₂',
  },
  {
    id: 'ride-04',
    driver: 'Amit',
    rating: '4.8',
    start: 'Rohini',
    end: 'Laxmi Nagar',
    departure: '07:15 AM',
    seats: 2,
    cost: '₹65 share',
    eco: 'Saves 4kg CO₂',
  },
]

export const CarpoolPage = () => {
  const { t } = useI18n()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const matches = useMemo(() => {
    const normalizedStart = start.trim().toLowerCase()
    const normalizedEnd = end.trim().toLowerCase()
    return sampleRides.filter((ride) => {
      const startMatch = normalizedStart
        ? ride.start.toLowerCase().includes(normalizedStart)
        : true
      const endMatch = normalizedEnd ? ride.end.toLowerCase().includes(normalizedEnd) : true
      return startMatch && endMatch
    })
  }, [start, end])

  return (
    <div className="carpool-page-new">
      <div className="carpool-top-banner">
        <section className="panel-card carpool-hero-banner">
          <div className="hero-content">
            <p className="eyebrow">{t('carpoolTitle')}</p>
            <h1>{t('carpoolHero')}</h1>
            <p>{t('carpoolBody')}</p>
            <div className="carpool-highlights-banner">
              <span>
                <Leaf size={16} /> Each ride offsets up to 5kg CO₂
              </span>
              <span>
                <Users size={16} /> Verified local riders
              </span>
            </div>
          </div>
        </section>

        <aside className="panel-card why-carpool-banner">
          <p className="eyebrow">{t('carpoolWhyTitle')}</p>
          <h3>{t('carpoolWhyTitle')}</h3>
          <ul>
            <li>
              <DollarSign size={18} />
              Save money every commute
            </li>
            <li>
              <Leaf size={18} />
              Reduce pollution
            </li>
            <li>
              <Users size={18} />
              Build community
            </li>
          </ul>
        </aside>
      </div>

      <div className="carpool-bottom-row">
        <section className="panel-card carpool-finder-new">
          <header className="section-header">
            <div>
              <p className="eyebrow">{t('carpoolSearchTitle')}</p>
              <h2>{t('carpoolSearch')}</h2>
            </div>
            <span className="meta">
              {matches.length} {t('carpoolMatches')}
            </span>
          </header>
          <div className="finder-actions-new">
            <button className="pill teal">{t('carpoolJoinRide')}</button>
            <button className="pill peach">{t('carpoolOfferSeat')}</button>
          </div>
          <div className="finder-inputs-new">
            <label className="input-field">
              <span>{t('startPlaceholder')}</span>
              <input
                value={start}
                onChange={(event) => setStart(event.target.value)}
                list="delhi-stops-start"
                placeholder="Select start location"
              />
            </label>
            <label className="input-field">
              <span>{t('endPlaceholder')}</span>
              <input
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                list="delhi-stops-end"
                placeholder="Select destination"
              />
            </label>
            <button className="circle search" type="button" aria-label={t('findRoutes')}>
              <Search size={18} />
            </button>
          </div>
          <datalist id="delhi-stops-start">
            {cityStops.map((stop) => (
              <option key={stop.id} value={stop.name} />
            ))}
          </datalist>
          <datalist id="delhi-stops-end">
            {cityStops.map((stop) => (
              <option key={stop.id} value={stop.name} />
            ))}
          </datalist>
        </section>

        <section className="panel-card rides-table-new">
          <header className="section-header">
            <div>
              <p className="eyebrow">{t('carpoolAvailableTitle')}</p>
              <h2>{t('carpoolAvailable')}</h2>
            </div>
          </header>
          {matches.length === 0 ? (
            <div className="empty-state">
              <p>{t('carpoolNoResults')}</p>
              <p className="meta">{t('carpoolEncourage')}</p>
            </div>
          ) : (
            <div className="rides-table-container">
              <table className="rides-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Route</th>
                    <th>Time</th>
                    <th>Seats</th>
                    <th>Price</th>
                    <th>Impact</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((ride) => (
                    <tr key={ride.id}>
                      <td>
                        <div className="driver-cell">
                          <span className="avatar-small">{ride.driver[0]}</span>
                          <div>
                            <strong>{ride.driver}</strong>
                            <span className="rating-small">
                              <Star size={12} fill="#fbbf24" /> {ride.rating}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="route-cell">
                          <MapPin size={14} />
                          <span>
                            {ride.start} → {ride.end}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="time-cell">
                          <Clock size={14} />
                          <span>{ride.departure}</span>
                        </div>
                      </td>
                      <td>
                        <span className="seats-badge">{ride.seats} available</span>
                      </td>
                      <td>
                        <strong className="price-cell">{ride.cost}</strong>
                      </td>
                      <td>
                        <span className="eco-badge">
                          <Leaf size={12} />
                          {ride.eco}
                        </span>
                      </td>
                      <td>
                        <button className="primary small">{t('carpoolJoin')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

