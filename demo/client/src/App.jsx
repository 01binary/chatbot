import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import './App.css'
import systemPromptContent from '../../system-prompt.md?raw'
import fewShotData from '../../few-shot.json'
import cookImg from './assets/cook.png'

const FEW_SHOT_COUNT = fewShotData.messages.length
const INITIAL_MESSAGES = [{ role: 'system', content: systemPromptContent }, ...fewShotData.messages]
const SESSION_START_MSG = { role: 'user', content: '{"type":"session_start"}' }

const api = (path, opts = {}) => fetch(`/api${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } })

const isToolCall = (content) => typeof content === 'string' && content.trim().startsWith('{')

const isNaturalLanguageAndToolCall = (content) => typeof content === 'string' && content.indexOf('{') !== -1 && content.indexOf('}') !== -1

/** Extract a JSON object from content; returns { naturalLanguage, toolCallJson } (toolCallJson null if none) */
function extractToolCall(content) {
  const s = typeof content === 'string' ? content.trim() : ''
  const start = s.indexOf('{')
  if (start === -1) return { naturalLanguage: s, toolCallJson: null }
  for (let end = s.indexOf('}', start); end !== -1; end = s.indexOf('}', end + 1)) {
    try {
      const toolCallJson = s.slice(start, end + 1)
      const parsed = JSON.parse(toolCallJson)
      if (parsed && typeof parsed.operation === 'string') {
        const naturalLanguage = (s.slice(0, start) + s.slice(end + 1)).replace(/\s+/g, ' ').trim()
        return { naturalLanguage, toolCallJson }
      }
    } catch (_) {}
  }
  return { naturalLanguage: s, toolCallJson: null }
}

function isJsonMessage(content) {
  if (typeof content !== 'string') return false
  const s = content.trim()
  if (!(s.startsWith('{') || s.startsWith('['))) return false
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}

async function tool(content) {
  const { operation, ...args } = JSON.parse(content)
  switch (operation) {
    case 'get_ingredients': {
      const r = await api(`/ingredients?category=${encodeURIComponent(args.category)}`)
      return r.json()
    }
    case 'new_order': {
      const r = await api('/orders', { method: 'POST', body: JSON.stringify(args) })
      return r.json()
    }
    case 'cancel_order': {
      const r = await api(`/orders/${args.id}/cancel`, { method: 'POST' })
      return r.json()
    }
    case 'report_complaint': {
      const r = await api('/complaint', { method: 'POST', body: JSON.stringify({ details: args.details }) })
      return r.json()
    }
    default:
      return { error: 'Unknown operation' }
  }
}

async function chatTurn(messagesForApi, queryClient) {
  const toAppend = []
  let current = messagesForApi

  while (true) {
    const req = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: current })
    })
    const msg = await req.json()

    const isPureToolCall = isToolCall(msg.content)
    const isMixed = !isPureToolCall && isNaturalLanguageAndToolCall(msg.content)
    if (!isPureToolCall && !isMixed) {
      toAppend.push(msg)
      break
    }

    const { naturalLanguage, toolCallJson } = isPureToolCall
      ? { naturalLanguage: '', toolCallJson: msg.content }
      : extractToolCall(msg.content)

    if (!toolCallJson) {
      toAppend.push(msg)
      break
    }

    const parsed = JSON.parse(toolCallJson)
    if (parsed.operation === 'report_complaint') {
      await tool(toolCallJson)
      toAppend.push({ role: 'assistant', content: 'The complaint has been filed and police were dispatched to your location.' })
      break
    }
    const result = await tool(toolCallJson)
    if (queryClient && parsed.operation === 'new_order' && result?.id) {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
    if (queryClient && parsed.operation === 'cancel_order' && !result?.error) {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
    const userMsg = { role: 'user', content: JSON.stringify(result) }
    if (naturalLanguage) toAppend.push({ ...msg, content: naturalLanguage })
    toAppend.push(userMsg)
    current = [...current, msg, userMsg]
  }
  return toAppend
}

function formatIngredientValue(val) {
  if (val == null) return null
  if (typeof val === 'boolean') return val ? 'yes' : 'no'
  if (Array.isArray(val)) return val.length ? val.join(', ') : null
  return String(val)
}

const ORDER_EMOJI = { bread: '🍞', cheese: '🧀', proteins: '🥩', vegetables: '🥬', condiments: '🧂', toast: '🔥' }

function OrderCard({ order }) {
  const lines = ['bread', 'cheese', 'proteins', 'vegetables', 'condiments', 'toast'].map((key) => {
    const val = formatIngredientValue(order[key])
    if (val === null) return null
    return { emoji: ORDER_EMOJI[key], value: val, key }
  }).filter(Boolean)
  return (
    <div className="order-card">
      <div className="order-card-id">{order.id}</div>
      <div className="order-card-ingredients">
        {lines.map(({ emoji, value, key }) => (
          <div key={key} className="order-card-line">
            <span className="order-card-emoji" aria-hidden>{emoji}</span>
            <span className="order-card-value">{value}</span>
          </div>
        ))}
      </div>
      {order.status === 'cancelled' && <div className="order-card-status">Cancelled</div>}
    </div>
  )
}

function OrderList() {
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api('/orders').then((r) => r.json()),
  })
  return (
    <ul className="order-list">
      {orders.map((o) => (
        <li key={o.id}>
          <OrderCard order={o} />
        </li>
      ))}
    </ul>
  )
}


export default function App() {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const sessionStartSentRef = useRef(false)

  useEffect(() => {
    if (sessionStartSentRef.current) return
    sessionStartSentRef.current = true
    const userMsg = SESSION_START_MSG
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    chatTurn([...INITIAL_MESSAGES, userMsg], queryClient)
      .then((toAppend) => setMessages((m) => [...m, ...toAppend]))
      .catch(() => setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, the assistant is unavailable.' }]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    try {
      const toAppend = await chatTurn([...messages, userMsg], queryClient)
      setMessages((m) => [...m, ...toAppend])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, the assistant is unavailable.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <h1>Superway</h1>
        <h2>Sandwich Shop</h2>
      </header>
      <div className="app">
        <main>
          <div className="content">
            <section className="chat-section">
              <div className="messages">
                {messages
                  .slice(FEW_SHOT_COUNT + 1)
                  .filter((msg) => !(msg.role === 'user' && msg.content === SESSION_START_MSG.content))
                  .filter((msg) => !isJsonMessage(msg.content))
                  .map((msg, i) => (
                    <div key={i} className={`msg ${msg.role}`}>
                      {msg.content}
                    </div>
                  ))}
                {loading && <div className="msg assistant">…</div>}
                <div ref={bottomRef} />
              </div>
              <form
                className="chat-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your order…" />
                <button type="submit">Send</button>
              </form>
            </section>
            <div className="robot-section">
              <img src={cookImg} alt="" className="robot-illustration" />
            </div>
          </div>
        </main>
        <aside>
          <h3>Orders</h3>
          <OrderList />
        </aside>
      </div>
    </>
  )
}
