import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useSpeech } from '../hooks/useSpeech'

const langVoiceMap = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
}

const shouldAnnounce = (target) => {
  if (!target) return false
  if (target.closest('[data-announce="false"]')) return false
  return Boolean(
    target.closest(
      'button, a, [role="button"], input, textarea, select, label, h1, h2, h3, h4, h5, h6, p, li, .panel-card, .route-card',
    ),
  )
}

const extractText = (element) => {
  if (!element) return ''
  const nodeWithData = element.closest('[data-announce-text]')
  if (nodeWithData) {
    return nodeWithData.getAttribute('data-announce-text') ?? ''
  }
  const labelledNode = element.closest('[aria-label]')
  if (labelledNode) {
    return labelledNode.getAttribute('aria-label') ?? ''
  }
  const content = element.closest(
    'button, a, [role="button"], label, .panel-card, .route-card, h1, h2, h3, p, li',
  )
  if (!content) {
    return element.textContent ?? ''
  }
  return content.innerText || content.textContent || ''
}

export const AccessibilityAnnouncer = () => {
  const accessibilityMode = useAppStore((state) => state.accessibilityMode)
  const ttsEnabled = useAppStore((state) => state.ttsEnabled)
  const language = useAppStore((state) => state.language)
  const { speak, speechSynthesisSupported } = useSpeech()

  useEffect(() => {
    if (!accessibilityMode || !ttsEnabled || !speechSynthesisSupported) {
      return
    }

    const handleClick = (event) => {
      const target = event.target
      if (!shouldAnnounce(target)) return
      const text = extractText(target)
      const cleaned = text?.replace(/\s+/g, ' ').trim()
      if (!cleaned) return
      speak(cleaned, langVoiceMap[language] ?? 'en-IN')
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        window.speechSynthesis?.cancel()
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [accessibilityMode, ttsEnabled, speechSynthesisSupported, speak, language])

  return null
}

