import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { sendChatPrompt } from '../api/chatService'
import { useI18n } from '../hooks/useI18n'

export const ChatAssistant = () => {
  const { t } = useI18n()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Ask me about fares, routes or delays.' },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return
    const nextMessages = [...messages, { role: 'user', content: input.trim() }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    try {
      const reply = await sendChatPrompt(nextMessages)
      setMessages([...nextMessages, reply])
    } catch (error) {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: error.message || t('chatbotFallback') },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('chatAssistantTitle')}</p>
          <h2>{t('chatAssistantTitle')}</h2>
        </div>
      </header>
      <div className="chat-window">
        {messages.map((message, index) => (
          <p key={index} className={`chat-line ${message.role}`}>
            {message.content}
          </p>
        ))}
      </div>
      <div className="chat-input">
        <input
          placeholder={t('chatPlaceholder')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
          }}
        />
        <button className="primary" onClick={handleSend} disabled={isSending}>
          {isSending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          {t('send')}
        </button>
      </div>
    </div>
  )
}

