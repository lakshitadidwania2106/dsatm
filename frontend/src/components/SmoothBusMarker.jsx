import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

// Create a custom DivIcon with bus icon
const createBusIcon = (isSelected) => {
    return L.divIcon({
        className: 'custom-bus-icon',
        html: `
      <div style="
        background-color: ${isSelected ? '#16a34a' : '#0f172a'};
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        position: relative;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z" fill="currentColor"/>
          <path d="M7 8H17V10H7V8Z" fill="white"/>
          <path d="M7 12H17V14H7V12Z" fill="white"/>
          <circle cx="8" cy="17" r="1.5" fill="white"/>
          <circle cx="16" cy="17" r="1.5" fill="white"/>
        </svg>
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    })
}

export const SmoothBusMarker = ({ bus, isSelected, onSelect }) => {
    const markerRef = useRef(null)

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
        />
    )
}
