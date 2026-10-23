import { useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'
import Compass from './Compass'

const VIEWS = [
  ['house', 'house'],
  ['room', 'room'],
  ['close', 'close-up'],
  ['eyes', 'my eyes'],
  ['street', 'street'],
]
const HINTS = {
  house: 'drag or Q/E to spin · scroll to zoom into a room · WASD or click to move',
  room: 'WASD / arrows or click the floor to move · drag or Q/E to spin · scroll to zoom',
  close: 'WASD / arrows or click the floor to move · drag or Q/E to spin · scroll to zoom',
  eyes: 'W/S walk · A/D turn · drag to look around',
  street: 'drag or Q/E to walk around the house · scroll to zoom',
}

function App() {
  const mount = useRef(null)
  const game = useRef(null)
  const [view, setView] = useState({ mode: 'room', az: 0, room: 'study', stairs: null })

  useEffect(() => {
    const g = createGame(mount.current, { onView: setView })
    game.current = g
    if (new URLSearchParams(location.search).has('debug')) window.__cc = g
    return () => g.dispose()
  }, [])

  return (
    <div className="stage">
      <div ref={mount} className="world" />
      {view.mode === 'eyes' && <div className="eye-vignette" />}

      <header className="hud top-left">
        <h1>cc</h1>
        <p>{view.room}</p>
      </header>

      <aside className="hud top-right">
        <Compass
          az={view.az}
          onChange={a => game.current?.setAzimuth(a, true)}
          onReset={() => game.current?.resetAzimuth()}
          onNudge={d => game.current?.rotateBy(d)}
        />
        <div className="panel views">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              className={view.mode === id ? 'on' : ''}
              onClick={() => game.current?.setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>

      {view.stairs && (
        <button className="hud stairs" onClick={() => game.current?.takeStairs()}>
          {view.stairs === 'up' ? '▲ go upstairs' : '▼ go downstairs'} <span>space</span>
        </button>
      )}

      <p className="hud hint">{HINTS[view.mode]}</p>
    </div>
  )
}

export default App
