const OTP_URL = 'http://localhost:8080/otp/routers/default/index/graphql'

export const planTrip = async ({ from, to, date, time, modes = ['WALK', 'BUS'] }) => {
    const query = `
    query PlanTrip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $date: String, $time: String, $modes: [TransportMode]!) {
      plan(
        from: { lat: $fromLat, lon: $fromLon }
        to: { lat: $toLat, lon: $toLon }
        date: $date
        time: $time
        transportModes: $modes
      ) {
        itineraries {
          duration
          startTime
          endTime
          legs {
            mode
            startTime
            endTime
            from {
              name
              lat
              lon
            }
            to {
              name
              lat
              lon
            }
            route {
              shortName
              longName
            }
            legGeometry {
              points
            }
          }
        }
      }
    }
  `

    const variables = {
        fromLat: from.lat,
        fromLon: from.lng,
        toLat: to.lat,
        toLon: to.lng,
        date: date || new Date().toISOString().split('T')[0],
        time: time || new Date().toLocaleTimeString('en-US', { hour12: false }),
        modes: modes.map(m => ({ mode: m }))
    }

    try {
        const response = await fetch(OTP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
        })

        const data = await response.json()
        if (data.errors) {
            throw new Error(data.errors[0].message)
        }
        return data.data.plan.itineraries
    } catch (error) {
        console.error('OTP Error:', error)
        return []
    }
}
