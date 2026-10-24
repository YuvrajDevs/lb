import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { EMOTE_LIST } from '../world/peers'

// Talking and emotes, bottom right. The log folds away to the last few lines; Enter (or T) opens it to type.
// Every line also shows as a bubble over the speaker's head. Hover a line to report it.

const EMOJI = { wave: '👋', heart: '💗', hug: '🤗', laugh: '😄', dance: '💃', sleep: '💤', star: '✨' }

export default function Chat({ log, onSend, onEmote, onReport, meId, people }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [wheel, setWheel] = useState(false)
  const input = useRef(null)
  const list = useRef(null)

  // Enter or T opens the chat (when nothing else has the keyboard); Escape closes it
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea')) return
      if (document.querySelector('.scrim, .mg, .title, .onboard-scrim')) return
      if (e.key === 'Enter' || e.key === 't') { e.preventDefault(); setOpen(true); setTimeout(() => input.current?.focus(), 0) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight }, [log, open])

  const send = e => {
    e.preventDefault()
    const t = text.trim()
    if (!t) { setOpen(false); input.current?.blur(); return }
    onSend(t)
    setText('')
  }
  const shown = open ? log : log.slice(-4)
  const here = people.length

  return (
    <div className={`chat ${open ? 'open' : ''}`}>
      {shown.length > 0 && (
        <ol className="chat-log" ref={list} aria-live="polite">
          {shown.map(m => (
            <li key={m.id} className={m.from === meId ? 'mine' : ''}>
              <b>{m.name}</b> <span>{m.body}</span>
              {m.from !== meId && open && <button className="chat-report" onClick={() => onReport(m)} aria-label={`Report ${m.name}`}>Report</button>}
            </li>
          ))}
        </ol>
      )}
      <div className="chat-bar">
        {open ? (
          <form onSubmit={send}>
            <input ref={input} value={text} maxLength={300} placeholder={here > 1 ? `Say something to the ${here - 1} here…` : 'Say something…'}
              onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur() } }} />
            <button className="icon-btn" aria-label="Send"><Icon name="chevron" size={16} /></button>
          </form>
        ) : (
          <button className="chat-open" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0) }}>
            <Icon name="chat" size={16} /> Chat <small>{here > 1 ? `${here} here` : 'just you'}</small>
          </button>
        )}
        <button className={`icon-btn ${wheel ? 'on' : ''}`} aria-label="Emotes" aria-expanded={wheel} onClick={() => setWheel(w => !w)}>
          <span className="emoji">😊</span>
        </button>
      </div>
      {wheel && (
        <div className="emote-row" role="menu">
          {EMOTE_LIST.map(k => <button key={k} role="menuitem" aria-label={k} onClick={() => { onEmote(k); setWheel(false) }}>{EMOJI[k]}</button>)}
        </div>
      )}
    </div>
  )
}
