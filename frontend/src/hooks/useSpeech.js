import { useEffect, useMemo, useRef, useState } from 'react'

const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const speechRecognitionConstructor =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition)

export const useSpeech = () => {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [recognitionReady, setRecognitionReady] = useState(false)

  useEffect(() => {
    if (speechRecognitionConstructor && !recognitionRef.current) {
      recognitionRef.current = new speechRecognitionConstructor()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      setRecognitionReady(true)
    }
  }, [])

  const speak = useMemo(() => {
    if (!speechSynthesisSupported) {
      return () => {}
    }

    return (text, lang = 'en-IN') => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const startListening = ({ onResult, lang = 'en-IN' }) => {
    if (!recognitionRef.current) {
      return
    }
    recognitionRef.current.lang = lang
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResult?.(transcript)
    }
    recognitionRef.current.onerror = () => setIsListening(false)
    recognitionRef.current.onend = () => setIsListening(false)
    recognitionRef.current.start()
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return {
    speak,
    startListening,
    stopListening,
    isListening,
    speechSynthesisSupported,
    speechRecognitionSupported: recognitionReady,
  }
}

