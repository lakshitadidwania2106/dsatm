// GTFS Routing Service using OSM/OSRM for road-following routes
import { delhiStops } from '../data/delhiStops'

// OSRM API endpoint (public instance)
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1'

// Parse GTFS data structure
const parseGTFSRoute = (routeId, stops) => {
  return stops
    .filter(stop => stop.route_id === routeId)
    .sort((a, b) => {
      // Sort by arrival time
      const timeA = a.arrival_time ? a.arrival_time.split(':').map(Number) : [0, 0, 0]
      const timeB = b.arrival_time ? b.arrival_time.split(':').map(Number) : [0, 0, 0]
      const totalA = timeA[0] * 3600 + timeA[1] * 60 + timeA[2]
      const totalB = timeB[0] * 3600 + timeB[1] * 60 + timeB[2]
      return totalA - totalB
    })
}

// Get OSRM route between two points (following roads)
const getOSRMRoute = async (startLat, startLng, endLat, endLng, profile = 'driving') => {
  try {
    const url = `${OSRM_BASE_URL}/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error('OSRM routing failed')
    }
    
    const data = await response.json()
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]) // Convert [lng, lat] to [lat, lng]
      return {
        coordinates,
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
      }
    }
    
    return null
  } catch (error) {
    console.error('OSRM routing error:', error)
    return null
  }
}

// Find nearest stop from GTFS data
const findNearestGTFSStop = (lat, lng, allStops) => {
  if (!allStops || allStops.length === 0) return null
  
  let nearest = null
  let minDistance = Infinity
  
  for (const stop of allStops) {
    const distance = Math.sqrt(
      Math.pow(lat - stop.stop_lat, 2) + Math.pow(lng - stop.stop_lon, 2)
    )
    if (distance < minDistance) {
      minDistance = distance
      nearest = stop
    }
  }
  
  return nearest ? { ...nearest, distance: minDistance * 111 } : null // Convert to km (rough)
}

// Find routes that pass through both start and end stops
const findGTFSRoutes = async (startStop, endStop) => {
  try {
    // Load GTFS data (in production, this would be from an API or parsed file)
    // For now, we'll use a simplified approach with the CSV data structure
    
    // This would typically involve:
    // 1. Loading stops.txt, routes.txt, trips.txt, stop_times.txt from GTFS
    // 2. Finding routes that serve both stops
    // 3. Getting the actual path coordinates
    
    // For now, return a mock structure that will be replaced with actual GTFS parsing
    return []
  } catch (error) {
    console.error('Error finding GTFS routes:', error)
    return []
  }
}

// Plan multi-modal route using GTFS and OSM
export const planGTFSRoute = async (startLocation, endLocation, preference = 'time') => {
  try {
    // Step 1: Find nearest GTFS stops
    const allStops = delhiStops.map(s => ({
      stop_id: s.id,
      stop_name: s.name,
      stop_lat: s.lat,
      stop_lon: s.lng,
    }))
    
    const startStop = findNearestGTFSStop(startLocation.lat, startLocation.lng, allStops)
    const endStop = findNearestGTFSStop(endLocation.lat, endLocation.lng, allStops)
    
    if (!startStop || !endStop) {
      throw new Error('Could not find nearest stops')
    }
    
    // Step 2: Get walking route to start stop (using OSRM)
    const walkToStart = await getOSRMRoute(
      startLocation.lat,
      startLocation.lng,
      startStop.stop_lat,
      startStop.stop_lon,
      'foot'
    )
    
    // Step 3: Get walking route from end stop to destination (using OSRM)
    const walkFromEnd = await getOSRMRoute(
      endStop.stop_lat,
      endStop.stop_lon,
      endLocation.lat,
      endLocation.lng,
      'foot'
    )
    
    // Step 4: Find GTFS routes between stops
    const gtfsRoutes = await findGTFSRoutes(startStop, endStop)
    
    // Step 5: Build route options
    const routes = []
    
    // Option 1: Direct bus route (if available)
    if (gtfsRoutes.length > 0) {
      const directRoute = gtfsRoutes[0]
      const busRoute = await getOSRMRoute(
        startStop.stop_lat,
        startStop.stop_lon,
        endStop.stop_lat,
        endStop.stop_lon,
        'driving'
      )
      
      if (busRoute) {
        const allCoordinates = [
          ...(walkToStart?.coordinates || []),
          ...busRoute.coordinates,
          ...(walkFromEnd?.coordinates || [])
        ]
        
        routes.push({
          id: 'route-1',
          name: `${startStop.stop_name} ⇌ ${endStop.stop_name}`,
          totalTravelTime: Math.round(
            (walkToStart?.duration || 0) +
            busRoute.duration +
            (walkFromEnd?.duration || 0)
          ),
          estimatedCost: 30,
          transfers: 0,
          boarding: startStop.stop_name,
          alighting: endStop.stop_name,
          eta: `${Math.round(busRoute.duration)} mins`,
          coordinates: allCoordinates,
          steps: [
            {
              step: 1,
              type: 'walk',
              description: `Walk to ${startStop.stop_name}`,
              duration: Math.round(walkToStart?.duration || 5),
            },
            {
              step: 2,
              type: 'bus',
              description: `Take bus from ${startStop.stop_name} to ${endStop.stop_name}`,
              duration: Math.round(busRoute.duration),
            },
            {
              step: 3,
              type: 'walk',
              description: `Walk to destination`,
              duration: Math.round(walkFromEnd?.duration || 5),
            },
          ],
        })
      }
    }
    
    // Option 2: Bus + Metro (if no direct route)
    if (routes.length === 0) {
      // Find a metro station near midpoint
      const midLat = (startStop.stop_lat + endStop.stop_lat) / 2
      const midLng = (startStop.stop_lon + endStop.stop_lon) / 2
      
      // This would use actual metro station data
      // For now, create a route with bus + walking
      const busToMid = await getOSRMRoute(
        startStop.stop_lat,
        startStop.stop_lon,
        midLat,
        midLng,
        'driving'
      )
      
      const busFromMid = await getOSRMRoute(
        midLat,
        midLng,
        endStop.stop_lat,
        endStop.stop_lon,
        'driving'
      )
      
      if (busToMid && busFromMid) {
        const allCoordinates = [
          ...(walkToStart?.coordinates || []),
          ...busToMid.coordinates,
          ...busFromMid.coordinates,
          ...(walkFromEnd?.coordinates || [])
        ]
        
        routes.push({
          id: 'route-2',
          name: `${startStop.stop_name} ⇌ ${endStop.stop_name} (via Metro)`,
          totalTravelTime: Math.round(
            (walkToStart?.duration || 0) +
            busToMid.duration +
            busFromMid.duration +
            (walkFromEnd?.duration || 0)
          ),
          estimatedCost: 45,
          transfers: 1,
          boarding: startStop.stop_name,
          alighting: endStop.stop_name,
          eta: `${Math.round(busToMid.duration + busFromMid.duration)} mins`,
          coordinates: allCoordinates,
          steps: [
            {
              step: 1,
              type: 'walk',
              description: `Walk to ${startStop.stop_name}`,
              duration: Math.round(walkToStart?.duration || 5),
            },
            {
              step: 2,
              type: 'bus',
              description: `Take bus to transfer point`,
              duration: Math.round(busToMid.duration),
            },
            {
              step: 3,
              type: 'metro',
              description: `Take metro to ${endStop.stop_name}`,
              duration: Math.round(busFromMid.duration),
            },
            {
              step: 4,
              type: 'walk',
              description: `Walk to destination`,
              duration: Math.round(walkFromEnd?.duration || 5),
            },
          ],
        })
      }
    }
    
    // Option 3: Fallback - direct OSRM route
    if (routes.length === 0) {
      const directRoute = await getOSRMRoute(
        startLocation.lat,
        startLocation.lng,
        endLocation.lat,
        endLocation.lng,
        'driving'
      )
      
      if (directRoute) {
        routes.push({
          id: 'route-3',
          name: `${startLocation.name} ⇌ ${endLocation.name}`,
          totalTravelTime: Math.round(directRoute.duration),
          estimatedCost: 50,
          transfers: 0,
          boarding: startLocation.name,
          alighting: endLocation.name,
          eta: `${Math.round(directRoute.duration)} mins`,
          coordinates: directRoute.coordinates,
          steps: [
            {
              step: 1,
              type: 'walk',
              description: `Direct route to destination`,
              duration: Math.round(directRoute.duration),
            },
          ],
        })
      }
    }
    
    return routes
  } catch (error) {
    console.error('Error planning GTFS route:', error)
    return []
  }
}

