import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useSpeech } from '../hooks/useSpeech'
import { planTrip } from '../services/tripPlannerService'
import { delhiStops } from '../data/delhiStops'

const langMap = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
}

export const VoiceCommandHandler = () => {
  const navigate = useNavigate()
  const accessibilityMode = useAppStore((state) => state.accessibilityMode)
  const language = useAppStore((state) => state.language)
  const setPlannedRoutes = useAppStore((state) => state.setPlannedRoutes)
  const setRoutePreview = useAppStore((state) => state.setRoutePreview)
  const { startListening, stopListening, speechRecognitionSupported } = useSpeech()
  const isListeningRef = useRef(false)
  const recognitionTimeoutRef = useRef(null)
  const recognitionRef = useRef(null)

  const handleVoiceCommand = (command) => {
    console.log('Voice command:', command)
    
    // "go to home" or "go home" or "home"
    if (command.includes('go to home') || command.includes('go home') || command === 'home' || command.includes('home page')) {
      navigate('/')
      return
    }

    // "show me route from X to Y" or "route from X to Y" or "show route from X to Y"
    const routeMatch = command.match(/show me route from (.+?) to (.+)/i) || 
                      command.match(/route from (.+?) to (.+)/i) ||
                      command.match(/show route from (.+?) to (.+)/i)
    
    if (routeMatch) {
      const startLocation = routeMatch[1].trim()
      const endLocation = routeMatch[2].trim()
      
      // Find locations in delhiStops
      const startStop = delhiStops.find(
        (stop) =>
          stop.name.toLowerCase().includes(startLocation.toLowerCase()) ||
          stop.shortLabel.toLowerCase().includes(startLocation.toLowerCase())
      )
      
      const endStop = delhiStops.find(
        (stop) =>
          stop.name.toLowerCase().includes(endLocation.toLowerCase()) ||
          stop.shortLabel.toLowerCase().includes(endLocation.toLowerCase())
      )

      if (startStop && endStop) {
        const start = { lat: startStop.lat, lng: startStop.lng, name: startStop.name }
        const end = { lat: endStop.lat, lng: endStop.lng, name: endStop.name }
        
        planTrip(start, end, 'time').then((routes) => {
          if (routes && routes.length > 0) {
            setPlannedRoutes(routes)
            if (routes[0].coordinates) {
              setRoutePreview({
                coordinates: routes[0].coordinates,
                route: routes[0]
              })
            }
            // Navigate to home to see the routes
            navigate('/')
          }
        }).catch((error) => {
          console.error('Error planning route:', error)
        })
      }
    }
  }

  useEffect(() => {
    if (!accessibilityMode || !speechRecognitionSupported) {
      return
    }

    // Initialize speech recognition for continuous listening
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = false
    recognitionRef.current.lang = langMap[language] ?? 'en-IN'

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript
      handleVoiceCommand(transcript.toLowerCase().trim())
    }

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      // Restart on error
      if (accessibilityMode) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start()
          } catch (e) {
            console.error('Failed to restart recognition:', e)
          }
        }, 1000)
      }
    }

    recognitionRef.current.onend = () => {
      // Restart listening when it ends
      if (accessibilityMode) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start()
          } catch (e) {
            console.error('Failed to restart recognition:', e)
          }
        }, 100)
      }
    }

    // Start continuous listening
    try {
      recognitionRef.current.start()
    } catch (e) {
      console.error('Failed to start recognition:', e)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [accessibilityMode, language, navigate, setPlannedRoutes, setRoutePreview])

  return null
}

