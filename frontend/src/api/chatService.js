const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL
const CHAT_API_KEY = import.meta.env.VITE_CHAT_API_KEY
const CHAT_PROVIDER = import.meta.env.VITE_CHAT_PROVIDER ?? 'gemini'

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-1.5-flash-latest'
const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ?? 'AIzaSyBx8nNJkURMhfDWw9bZfSa2RTE3ZgXf7nU'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const fallbackResponse = (question) =>
  `I noted your question: "${question}". A live assistant will reply once your chat API key is connected.`

const formatGeminiMessages = (messages) =>
  messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

const sendToGemini = async (messages) => {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: formatGeminiMessages(messages) }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Gemini replied with an error')
  }

  const payload = await response.json()
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      ?.trim() ?? ''

  if (text) {
    return { role: 'assistant', content: text }
  }

  return {
    role: 'assistant',
    content: fallbackResponse(messages[messages.length - 1]?.content ?? ''),
  }
}

export const sendChatPrompt = async (messages) => {
  if (!CHAT_API_URL && GEMINI_API_KEY) {
    return sendToGemini(messages)
  }

  if (!CHAT_API_URL) {
    const lastUser = messages.filter((m) => m.role === 'user').pop()
    return {
      role: 'assistant',
      content: fallbackResponse(lastUser?.content ?? ''),
    }
  }

  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(CHAT_API_KEY ? { Authorization: `Bearer ${CHAT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      provider: CHAT_PROVIDER,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error('Unable to contact assistant API')
  }

  const payload = await response.json()
  if (payload?.choices?.[0]?.message) {
    return payload.choices[0].message
  }

  if (payload?.message) {
    return payload.message
  }

  return {
    role: 'assistant',
    content: fallbackResponse(messages[messages.length - 1]?.content ?? ''),
  }
}

