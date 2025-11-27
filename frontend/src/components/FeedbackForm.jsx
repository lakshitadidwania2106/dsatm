import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { submitFeedback } from '../api/feedbackService'
import { useI18n } from '../hooks/useI18n'

export const FeedbackForm = () => {
  const { t } = useI18n()
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: '',
    rating: 4,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus('')
    try {
      await submitFeedback(formState)
      setStatus(t('feedbackThanks'))
      setFormState({ name: '', email: '', message: '', rating: 4 })
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="feedback">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('feedbackTitle')}</p>
          <h2>{t('feedbackSubtitle')}</h2>
        </div>
      </header>
      <form className="feedback-form" onSubmit={handleSubmit}>
        <label className="input-field">
          <span>{t('name')}</span>
          <input name="name" value={formState.name} onChange={handleChange} required />
        </label>
        <label className="input-field">
          <span>{t('email')}</span>
          <input
            type="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            required
          />
        </label>
        <label className="input-field">
          <span>{t('rating')}</span>
          <input
            type="number"
            min="1"
            max="5"
            name="rating"
            value={formState.rating}
            onChange={handleChange}
          />
        </label>
        <label className="input-field">
          <span>{t('message')}</span>
          <textarea
            name="message"
            rows="3"
            value={formState.message}
            onChange={handleChange}
            required
          />
        </label>
        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 size={16} className="spin" /> : null}
          {t('submit')}
        </button>
        {status && <p className="status">{status}</p>}
      </form>
    </section>
  )
}

