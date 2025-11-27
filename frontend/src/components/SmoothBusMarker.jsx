import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/useI18n' // adjust path if needed

const createBusIcon = (isSelected, isVirtual) => {
    const bgColor = isVirtual
        ? '#eab308'
        : isSelected
            ? '#16a34a'
            : '#0f172a'

    const borderColor = isVirtual ? '#fef08a' : 'white'

    return L.divIcon({
        className: 'custom-bus-icon',
        html: `
      <div style="
        background-color: ${bgColor};
        width: ${isVirtual ? '20px' : '16px'};
        height: ${isVirtual ? '20px' : '16px'};
        border-radius: 50%;
        border: 2px solid ${borderColor};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 1s linear;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">
        ${isVirtual ? '★' : ''}
      </div>
    `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    })
}

export const SmoothBusMarker = ({ bus, isSelected, onSelect }) => {
    const markerRef = useRef(null)
    const { t } = useI18n()
    const isVirtual = bus.type === 'virtual'

    useEffect(() => {
        const marker = markerRef.current
        if (marker) {
            marker.setLatLng([bus.lat, bus.lng])
        }
    }, [bus.lat, bus.lng])

    return (
        <Marker
            ref={markerRef}
            position={[bus.lat, bus.lng]}
            icon={createBusIcon(isSelected, isVirtual)}
            eventHandlers={{ click: () => onSelect(bus) }}
        >
            <Popup>
                <strong>{bus.route}</strong>

                {isVirtual && (
                    <div className="text-xs text-yellow-600 font-bold mt-1">
                        Verified by {bus.passenger_count} Users
                    </div>
                )}

                <br />

                {!isVirtual && (
                    <>
                        {t('eta')}: {bus.eta}
                        <br />
                        {t('cost')}: {bus.cost}
                    </>
                )}
            </Popup>
        </Marker>
    )
}
