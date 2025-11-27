import { fetchBuses } from '../api/busService'
import { delhiStops } from '../data/delhiStops'
import { metroStations } from '../data/metroStations'

const GEMINI_API_KEY = 'AIzaSyAZsZOq6Y-hdQ85YjKIOzZVTJSdsIwoBSw'
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// Helper: Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper: Find nearest stop/station to a location
const findNearestStop = (lat, lng, stops) => {
  if (!stops || stops.length === 0) return null
  let nearest = stops[0]
  let minDistance = calculateDistance(lat, lng, stops[0].lat, stops[0].lng)

  for (const stop of stops) {
    const distance = calculateDistance(lat, lng, stop.lat, stop.lng)
    if (distance < minDistance) {
      minDistance = distance
      nearest = stop
    }
  }
  return { ...nearest, walkDistance: minDistance }
}

// Helper: Call Gemini API for route planning
const callGeminiForRoute = async (startLocation, endLocation, preference) => {
  try {
    const prompt = `Plan a public transport route in Delhi, India from "${startLocation.name}" (${startLocation.lat}, ${startLocation.lng}) to "${endLocation.name}" (${endLocation.lat}, ${endLocation.lng}).

Preference: ${preference === 'time' ? 'Fastest route' : preference === 'cost' ? 'Cheapest route' : 'Minimum transfers'}

Available stops: ${delhiStops.slice(0, 50).map(s => s.name).join(', ')}

Return a JSON array with 3 route options. Each route should have:
- name: Route name (e.g., "City Center ⇌ Tech Park")
- totalTravelTime: Total time in minutes
- estimatedCost: Cost in rupees
- transfers: Number of transfers
- boarding: Starting stop name
- alighting: Ending stop name
- eta: Estimated time of arrival in format "X mins"
- steps: Array of step objects with {step: number, type: "bus"|"metro"|"walk", description: string, duration: minutes}

Return only valid JSON, no markdown.`

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    })

    if (!response.ok) {
      throw new Error('Gemini API error')
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return null
  } catch (error) {
    console.error('Gemini API error:', error)
    return null
  }
}

// Helper: Parse ETA string to minutes
const parseEtaToMinutes = (eta) => {
  if (!eta) return 5 // Default wait time
  const match = eta.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 5
}

// Helper: Parse cost string to number
const parseCostToNumber = (cost) => {
  if (!cost) return 0
  const match = cost.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// Helper: Calculate walking time (assuming 5 km/h average walking speed)
const calculateWalkTime = (distanceKm) => {
  const walkingSpeedKmh = 5
  return Math.round((distanceKm / walkingSpeedKmh) * 60) // in minutes
}

// Helper: Get real-time bus wait time for a stop
const getRealTimeWaitTime = async (stopLocation, buses) => {
  // Find buses near this stop
  const nearbyBuses = buses.filter((bus) => {
    const distance = calculateDistance(
      stopLocation.lat,
      stopLocation.lng,
      bus.lat,
      bus.lng,
    )
    return distance < 0.5 // Within 500m
  })

  if (nearbyBuses.length === 0) {
    return 10 // Default wait time if no buses found
  }

  // Get the minimum ETA from nearby buses
  const minEta = Math.min(...nearbyBuses.map((bus) => parseEtaToMinutes(bus.eta)))
  return minEta
}

// Generate route steps
const generateRouteSteps = (route, startLocation, endLocation) => {
  const steps = []
  let stepNumber = 1

  // Initial walk to first stop
  if (route.initialWalk > 0) {
    steps.push({
      step: stepNumber++,
      type: 'walk',
      description: `Walk (${route.initialWalk} min) to ${route.segments[0]?.fromStop || 'bus stop'}`,
      duration: route.initialWalk,
    })
  }

  // Transport segments
  route.segments.forEach((segment, index) => {
    if (segment.type === 'bus') {
      steps.push({
        step: stepNumber++,
        type: 'bus',
        description: `Take Bus #${segment.busId || segment.route} (Bus ID: ${segment.busId || 'N/A'}). Real-Time Wait: ${segment.waitTime} min.`,
        duration: segment.travelTime + segment.waitTime,
        busId: segment.busId,
        route: segment.route,
        waitTime: segment.waitTime,
      })
    } else if (segment.type === 'metro') {
      steps.push({
        step: stepNumber++,
        type: 'metro',
        description: `Switch to Metro ${segment.line} to ${segment.toStop}`,
        duration: segment.travelTime,
        line: segment.line,
        toStop: segment.toStop,
      })
    }

    // Transfer walk time
    if (index < route.segments.length - 1 && segment.transferWalk > 0) {
      steps.push({
        step: stepNumber++,
        type: 'walk',
        description: `Walk (${segment.transferWalk} min) to transfer point`,
        duration: segment.transferWalk,
      })
    }
  })

  // Final walk to destination
  if (route.finalWalk > 0) {
    steps.push({
      step: stepNumber++,
      type: 'walk',
      description: `Walk (${route.finalWalk} min) to ${endLocation.name || 'final destination'}`,
      duration: route.finalWalk,
    })
  }

  return steps
}

// Generate a route option
const generateRoute = async (
  startLocation,
  endLocation,
  preference,
  buses,
  routeId,
  geminiRoute = null,
) => {
  // Find nearest stops
  const allStops = [...delhiStops, ...metroStations]
  const startStop = findNearestStop(startLocation.lat, startLocation.lng, allStops)
  const endStop = findNearestStop(endLocation.lat, endLocation.lng, allStops)

  if (!startStop || !endStop) {
    return null
  }

  // If Gemini provided a route, use it
  if (geminiRoute) {
    const coordinates = [
      [startLocation.lat, startLocation.lng],
      [(startLocation.lat + endLocation.lat) / 2 + 0.01, (startLocation.lng + endLocation.lng) / 2 + 0.01],
      [endLocation.lat, endLocation.lng]
    ]
    
    return {
      id: `route-${routeId}`,
      name: geminiRoute.name || `Route ${routeId}`,
      totalTravelTime: geminiRoute.totalTravelTime || 45,
      estimatedCost: geminiRoute.estimatedCost || 30,
      transfers: geminiRoute.transfers || 0,
      steps: geminiRoute.steps || [],
      boarding: geminiRoute.boarding || startStop.name,
      alighting: geminiRoute.alighting || endStop.name,
      eta: geminiRoute.eta || '45 mins',
      coordinates,
      segments: [],
      initialWalk: 0,
      finalWalk: 0,
      preference,
    }
  }

  // Calculate initial and final walk times
  const initialWalk = calculateWalkTime(startStop.walkDistance || 0.5)
  const finalWalk = calculateWalkTime(endStop.walkDistance || 0.5)

  // Generate route segments based on preference
  const segments = []
  let totalCost = 0
  let totalTravelTime = 0
  let transfers = 0

  // Route 1: Direct bus (if available)
  if (routeId === 1) {
    const waitTime = await getRealTimeWaitTime(startStop, buses)
    const travelTime = 25 // Estimated travel time
    const cost = 30

    segments.push({
      type: 'bus',
      fromStop: startStop.name,
      toStop: endStop.name,
      busId: `bus-${Math.floor(Math.random() * 900) + 100}`,
      route: `${startStop.shortLabel || startStop.name || startStop.code} ⇄ ${endStop.shortLabel || endStop.name || endStop.code}`,
      waitTime,
      travelTime,
      cost,
    })

    totalCost = cost
    totalTravelTime = initialWalk + waitTime + travelTime + finalWalk
    transfers = 0
  }
  // Route 2: Bus + Metro
  else if (routeId === 2) {
    const busWaitTime = await getRealTimeWaitTime(startStop, buses)
    const busTravelTime = 15
    const busCost = 20

    // Find a metro station near the midpoint
    const midLat = (startStop.lat + endStop.lat) / 2
    const midLng = (startStop.lng + endStop.lng) / 2
    const metroStation = findNearestStop(midLat, midLng, metroStations)
    const transferWalk = metroStation ? calculateWalkTime(metroStation.walkDistance || 0.3) : 5

    segments.push({
      type: 'bus',
      fromStop: startStop.name,
      toStop: metroStation?.name || 'Metro Station',
      busId: `bus-${Math.floor(Math.random() * 900) + 100}`,
      route: `${startStop.shortLabel || startStop.name || startStop.code} → Metro`,
      waitTime: busWaitTime,
      travelTime: busTravelTime,
      cost: busCost,
      transferWalk,
    })

    segments.push({
      type: 'metro',
      fromStop: metroStation?.name || 'Metro Station',
      toStop: endStop.name,
      line: metroStation?.lines?.[0] || 'Green Line',
      travelTime: 20,
      cost: 15,
    })

    totalCost = busCost + 15
    totalTravelTime = initialWalk + busWaitTime + busTravelTime + transferWalk + 20 + finalWalk
    transfers = 1
  }
  // Route 3: Multiple buses
  else if (routeId === 3) {
    const bus1WaitTime = await getRealTimeWaitTime(startStop, buses)
    const bus1TravelTime = 12
    const bus1Cost = 15

    const midStop = findNearestStop(
      (startStop.lat + endStop.lat) / 2,
      (startStop.lng + endStop.lng) / 2,
      cityStops,
    )
    const transferWalk = midStop ? calculateWalkTime(midStop.walkDistance || 0.2) : 3

    segments.push({
      type: 'bus',
      fromStop: startStop.name,
      toStop: midStop?.name || 'Transfer Point',
      busId: `bus-${Math.floor(Math.random() * 900) + 100}`,
      route: `${startStop.shortLabel || startStop.name} → Transfer`,
      waitTime: bus1WaitTime,
      travelTime: bus1TravelTime,
      cost: bus1Cost,
      transferWalk,
    })

    const bus2WaitTime = 5 // Second bus wait time
    const bus2TravelTime = 15
    const bus2Cost = 15

    segments.push({
      type: 'bus',
      fromStop: midStop?.name || 'Transfer Point',
      toStop: endStop.name,
      busId: `bus-${Math.floor(Math.random() * 900) + 200}`,
      route: `Transfer → ${endStop.shortLabel || endStop.name || endStop.code}`,
      waitTime: bus2WaitTime,
      travelTime: bus2TravelTime,
      cost: bus2Cost,
    })

    totalCost = bus1Cost + bus2Cost
    totalTravelTime = initialWalk + bus1WaitTime + bus1TravelTime + transferWalk + bus2WaitTime + bus2TravelTime + finalWalk
    transfers = 1
  }

  const steps = generateRouteSteps(
    { segments, initialWalk, finalWalk },
    startLocation,
    endLocation,
  )

  return {
    id: `route-${routeId}`,
    name: `Route ${routeId}${preference === 'time' ? ' (Time Efficient)' : preference === 'cost' ? ' (Cost Efficient)' : ' (Minimum Switching)'}`,
    totalTravelTime,
    estimatedCost: totalCost,
    transfers,
    steps,
    segments,
    initialWalk,
    finalWalk,
    preference,
  }
}

// Main trip planning function
export const planTrip = async (startLocation, endLocation, preference = 'time') => {
  try {
    // Use GTFS + OSM routing for actual road-following routes
    const { planGTFSRoute } = await import('./gtfsRoutingService')
    const gtfsRoutes = await planGTFSRoute(startLocation, endLocation, preference)
    
    if (gtfsRoutes && gtfsRoutes.length > 0) {
      // Use GTFS routes (they follow actual roads via OSRM)
      return gtfsRoutes.slice(0, 3)
    }
    
    // Fallback: Fetch real-time bus data and use Gemini
    const buses = await fetchBuses()
    const geminiRoutes = await callGeminiForRoute(startLocation, endLocation, preference)
    
    let routes = []
    
    if (geminiRoutes && geminiRoutes.length > 0) {
      // Use Gemini routes
      const routePromises = geminiRoutes.slice(0, 3).map((geminiRoute, index) =>
        generateRoute(startLocation, endLocation, preference, buses, index + 1, geminiRoute),
      )
      routes = await Promise.all(routePromises)
    } else {
      // Fallback to default route generation
      const routePromises = [1, 2, 3].map((routeId) =>
        generateRoute(startLocation, endLocation, preference, buses, routeId),
      )
      routes = await Promise.all(routePromises)
    }
    
    routes = routes.filter((route) => route !== null)

    // Sort routes based on preference
    if (preference === 'time') {
      routes.sort((a, b) => a.totalTravelTime - b.totalTravelTime)
    } else if (preference === 'cost') {
      routes.sort((a, b) => a.estimatedCost - b.estimatedCost)
    } else if (preference === 'switches') {
      routes.sort((a, b) => a.transfers - b.transfers)
    }

    // Ensure at least 3 routes (duplicate best route if needed)
    while (routes.length < 3 && routes.length > 0) {
      const bestRoute = routes[0]
      routes.push({
        ...bestRoute,
        id: `${bestRoute.id}-alt`,
        name: `${bestRoute.name} (Alternative)`,
      })
    }

    return routes.slice(0, 3) // Return top 3 routes
  } catch (error) {
    console.error('Error planning trip:', error)
    // Return fallback routes
    return [
      {
        id: 'route-fallback-1',
        name: 'Route 1 (Time Efficient)',
        totalTravelTime: 45,
        estimatedCost: 30,
        transfers: 0,
        steps: [
          {
            step: 1,
            type: 'walk',
            description: 'Walk (5 min) to Majestic Bus Stand',
            duration: 5,
          },
          {
            step: 2,
            type: 'bus',
            description: 'Take Bus #101 (Bus ID: bus-101). Real-Time Wait: 3 min.',
            duration: 28,
            busId: 'bus-101',
            route: 'City Center ⇄ Tech Park',
            waitTime: 3,
          },
          {
            step: 3,
            type: 'walk',
            description: 'Walk (3 min) to final destination',
            duration: 3,
          },
        ],
      },
    ]
  }
}

