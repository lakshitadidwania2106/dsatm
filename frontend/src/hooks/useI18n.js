import { useCallback } from 'react'
import { translations } from '../i18n/translations'
import { useAppStore } from '../store/useAppStore'

export const useI18n = () => {
  const language = useAppStore((state) => state.language)

  const t = useCallback(
    (key) => translations[language]?.[key] ?? translations.en?.[key] ?? key,
    [language],
  )

  return { t, language }
}

