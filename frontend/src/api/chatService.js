const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL
const CHAT_API_KEY = import.meta.env.VITE_CHAT_API_KEY
const CHAT_PROVIDER = import.meta.env.VITE_CHAT_PROVIDER ?? 'openai'

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-2.0-flash'
const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ?? 'AIzaSyAH_bKOU1YQxgLDSMOOqaCD3orB-sc_l5s'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

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

const sendToOpenAI = async (messages) => {
  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: 0.6,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'OpenAI replied with an error')
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (content) {
    return { role: 'assistant', content }
  }

  return {
    role: 'assistant',
    content: fallbackResponse(messages[messages.length - 1]?.content ?? ''),
  }
}

export const sendChatPrompt = async (messages) => {
  if (!CHAT_API_URL) {
    if (CHAT_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      return sendToGemini(messages)
    }
    if (CHAT_PROVIDER === 'openai' && OPENAI_API_KEY) {
      return sendToOpenAI(messages)
    }
    if (OPENAI_API_KEY) {
      return sendToOpenAI(messages)
    }
    if (GEMINI_API_KEY) {
      return sendToGemini(messages)
    }
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

