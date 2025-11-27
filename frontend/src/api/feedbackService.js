const FEEDBACK_API_URL = import.meta.env.VITE_FEEDBACK_API_URL

export const submitFeedback = async (payload) => {
  if (!FEEDBACK_API_URL) {
    console.info('Feedback (mock)', payload)
    return { status: 'saved' }
  }

  const response = await fetch(FEEDBACK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Unable to submit feedback right now.')
  }

  return response.json()
}

