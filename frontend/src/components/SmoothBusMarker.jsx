import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useI18n } from '../hooks/useI18n'

// Create a custom DivIcon that uses CSS transitions
const createBusIcon = (isSelected) => {
    return L.divIcon({
        className: 'custom-bus-icon',
        html: `
      <div style="
        background-color: ${isSelected ? '#16a34a' : '#0f172a'};
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 1s linear;
      "></div>
    `,
        iconSize: [16, 16],
        iconAnchor: [8, 8] // Center of the circle
    })
}

export const SmoothBusMarker = ({ bus, isSelected, onSelect }) => {
    const markerRef = useRef(null)
    const { t } = useI18n()

    useEffect(() => {
        const marker = markerRef.current
        if (marker) {
            // Leaflet usually snaps instantly. 
            // But because we use a CSS transition on the DivIcon, 
            // visual updates might look smoother.
            marker.setLatLng([bus.lat, bus.lng])
        }
    }, [bus.lat, bus.lng])

    return (
        <Marker
            ref={markerRef}
            position={[bus.lat, bus.lng]}
            icon={createBusIcon(isSelected)}
            eventHandlers={{ click: () => onSelect(bus) }}
        >
            <Popup>
                <strong>{bus.route}</strong>
                <br />
                {t('eta')}: {bus.eta}
                <br />
                {t('cost')}: {bus.cost}
            </Popup>
        </Marker>
    )
}
