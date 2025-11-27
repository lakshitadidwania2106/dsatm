export const cityStops = [
  { id: 'majestic', name: 'Majestic Bus Stand', shortLabel: 'Majestic', lat: 12.9778, lng: 77.5713 },
  { id: 'mg-road', name: 'MG Road', shortLabel: 'MG Road', lat: 12.9755, lng: 77.605 },
  { id: 'indiranagar', name: 'Indiranagar 100 ft', shortLabel: 'Indiranagar', lat: 12.9719, lng: 77.6412 },
  { id: 'koramangala', name: 'Koramangala Sony World', shortLabel: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { id: 'whitefield', name: 'Whitefield Main Road', shortLabel: 'Whitefield', lat: 12.9698, lng: 77.7509 },
  { id: 'electronic-city', name: 'Electronic City Phase 1', shortLabel: 'Electronic City', lat: 12.839, lng: 77.677 },
  { id: 'hebbal', name: 'Hebbal Flyover', shortLabel: 'Hebbal', lat: 13.0358, lng: 77.597 },
  { id: 'airport', name: 'Kempegowda Airport (KIAL)', shortLabel: 'Airport', lat: 13.1986, lng: 77.7066 },
  { id: 'banashankari', name: 'Banashankari TTMC', shortLabel: 'Banashankari', lat: 12.918, lng: 77.5731 },
  { id: 'yeshwanthpur', name: 'Yeshwanthpur Metro', shortLabel: 'Yeshwanthpur', lat: 13.0183, lng: 77.5563 },
]

const route = (startId, endId, overrides = {}) => {
  const start = cityStops.find((stop) => stop.id === startId)
  const end = cityStops.find((stop) => stop.id === endId)
  if (!start || !end) return null

  const coordinates = [
    [start.lat, start.lng],
    [
      (start.lat + end.lat) / 2 + 0.01,
      (start.lng + end.lng) / 2 + 0.01,
    ],
    [end.lat, end.lng],
  ]

  return {
    id: `${start.id}-${end.id}`,
    name: `${start.shortLabel} ⇄ ${end.shortLabel}`,
    distance: overrides.distance ?? 'Approx. 18 km',
    duration: overrides.duration ?? 'Approx. 55 mins',
    buses: overrides.buses ?? ['BMTC V-201R', 'KIAS-5'],
    coordinates: overrides.coordinates ?? coordinates,
    steps:
      overrides.steps ??
      [
        `Start at ${start.shortLabel} platform`,
        'Continue along Outer Ring Road corridor',
        `Arrive near ${end.shortLabel}`,
      ],
  }
}

export const routeCatalog = {
  ['majestic-whitefield']: route('majestic', 'whitefield', {
    distance: '26 km',
    duration: '70 mins',
    buses: ['335E', 'V-335'],
  }),
  ['koramangala-electronic-city']: route('koramangala', 'electronic-city', {
    distance: '14 km',
    duration: '40 mins',
    buses: ['356CW', 'V-356'],
  }),
  ['hebbal-airport']: route('hebbal', 'airport', {
    distance: '33 km',
    duration: '55 mins',
    buses: ['KIAS-8', 'KIAS-12'],
  }),
  ['mg-road-indiranagar']: route('mg-road', 'indiranagar', {
    distance: '5 km',
    duration: '15 mins',
    buses: ['201R', 'V-201G'],
  }),
}

