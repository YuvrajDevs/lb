import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { EXPRESSIONS, EXPRESSION_LABEL, faceIcon } from '../world/faces'

// Talking and emotes, bottom right. The log folds away to the last few lines; Enter (or T) opens it to type, and it
// folds again once you send, click anywhere else, or press Escape.
// Every line also shows as a bubble over the speaker's head. Hover a line to report it.

// little pictures of each expression on a pink cube (drawn once)
let icons = null
const iconsOf = () => (icons ||= Object.fromEntries(EXPRESSIONS.map(k => [k, faceIcon(k)])))

export default function Chat({ log, onSend, onEmote, onReport, meId, people }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [wheel, setWheel] = useState(false)
  const input = useRef(null)
  const list = useRef(null)
  const box = useRef(null)
  const close = () => { setOpen(false); setWheel(false); input.current?.blur() }
  // a click anywhere outside the chat folds it away
  useEffect(() => {
    if (!open && !wheel) return
    const away = e => { if (!box.current?.contains(e.target)) close() }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [open, wheel])

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
    setText('')
    close()
    if (t) onSend(t)
  }
  // folded, only what was said in the last few seconds stays on screen
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(t) }, [])
  const fresh = m => now - (Date.parse(m.at) || 0) < 10000
  const shown = open ? log : log.slice(-4).filter(fresh)
  const here = people.length

  return (
    <div className={`chat ${open ? 'open' : ''}`} ref={box}>
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
              onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') close() }} />
            <button className="icon-btn" aria-label="Send"><Icon name="chevron" size={16} /></button>
            <button type="button" className="icon-btn" aria-label="Close the chat" onClick={close}><Icon name="close" size={14} /></button>
          </form>
        ) : (
          <button className="chat-open" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0) }}>
            <Icon name="chat" size={16} /> Chat <small>{here > 1 ? `${here} here` : 'just you'}</small>
          </button>
        )}
        <button className={`icon-btn face-btn ${wheel ? 'on' : ''}`} aria-label="Expressions" aria-expanded={wheel} onClick={() => setWheel(w => !w)}>
          <img src={iconsOf().happy} alt="" draggable="false" />
        </button>
      </div>
      {wheel && (
        <div className="emote-row" role="menu">
          {EXPRESSIONS.map(k => (
            <button key={k} role="menuitem" title={EXPRESSION_LABEL[k]} aria-label={EXPRESSION_LABEL[k]} onClick={() => { onEmote(k); setWheel(false) }}>
              <img src={iconsOf()[k]} alt="" draggable="false" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
