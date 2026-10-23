import { useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'

const COLORS = [
  ['pink', '#ff8fb8'], ['lilac', '#c3a6ff'], ['mint', '#8fe3c0'],
  ['butter', '#ffe08a'], ['sky', '#9ad0ff'], ['peach', '#ffb59a'],
]

function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

function App() {
  const mount = useRef(null)
  const game = useRef(null)
  const logEnd = useRef(null)
  const [color, setColor] = useState(() => load('cc:color', COLORS[0][1]))
  const [log, setLog] = useState([])
  const [text, setText] = useState('')

  useEffect(() => {
    const g = createGame(mount.current, {
      color,
      onChat: m => setLog(l => [...l.slice(-49), m]),
    })
    game.current = g
    return () => g.dispose()
    // the world is created once; later colour changes go through setColor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'end' }) }, [log])

  const pick = c => {
    setColor(c)
    save('cc:color', c)
    game.current?.setColor(c)
  }

  const send = e => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    game.current?.say(t)
    setText('')
  }

  return (
    <div className="stage">
      <div ref={mount} className="world" />

      <header className="hud top-left">
        <h1>cc</h1>
        <p>our little room</p>
      </header>

      <aside className="hud top-right panel">
        <span className="label">your cube</span>
        <div className="swatches">
          {COLORS.map(([n, c]) => (
            <button
              key={n}
              title={n}
              aria-label={n}
              className={`swatch ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => pick(c)}
            />
          ))}
        </div>
        <button className="heart-btn" onClick={() => game.current?.heart()}>♥ send love</button>
      </aside>

      <section className="hud bottom panel chat">
        <div className="log">
          {log.length === 0 && <p className="empty">say something sweet…</p>}
          {log.map((m, i) => (
            <p key={i} className={m.who === 'me' ? 'mine' : ''}>
              <b>{m.from}</b> {m.text}
            </p>
          ))}
          <div ref={logEnd} />
        </div>
        <form onSubmit={send}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={120}
            placeholder="type a message and press enter"
          />
          <button type="submit">send</button>
        </form>
      </section>

      <p className="hud hint">WASD / arrows or click the floor to move · scroll to zoom</p>
    </div>
  )
}

export default App
