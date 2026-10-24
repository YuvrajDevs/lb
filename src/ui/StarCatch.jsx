import { useCallback, useEffect, useRef, useState } from 'react'
import { store } from '../game/store'
import { sfx } from '../game/audio'
import { STAR_PAY } from '../game/economy'
import { createStarfall, ROUND } from '../games/starfall'
import { Boxet } from './icons'

// Star catch: the playground's first station. Stepping onto it teleports you to Starfall Bridge (its own 3D
// scene, see games/starfall.js) where you catch falling stars from the side. This is the screen around it:
// the teleport, the start screen, the live numbers, and the results.

const RATINGS = [[0.9, 'S'], [0.75, 'A'], [0.6, 'B'], [0.4, 'C'], [0, 'D']]
const ratingOf = pct => RATINGS.find(([min]) => pct >= min)[1]

export default function StarCatch({ onClose, skin, hat }) {
  const host = useRef(null)
  const game = useRef(null)
  const [phase, setPhase] = useState('ready') // ready | play | done
  const [warp, setWarp] = useState('in') // the teleport flash: 'in' on arrival, 'out' on leaving
  const [hud, setHud] = useState({ score: 0, time: ROUND, streak: 0, state: 'wait', count: 4 })
  const [result, setResult] = useState(null)
  const left = store.leftToday('stars')
  const best = store.get().settings.starBest || {}

  const finish = useCallback(async stats => {
    const pct = stats.spawned ? stats.caught / stats.spawned : 0
    const rating = ratingOf(pct)
    // (signed in, the server turns the score into Boxets, within today's cap)
    const give = stats.score > 0 ? await store.earn('stars', stats.score * STAR_PAY, null, true, stats.score) : 0
    store.questEvent('stars', stats.caught)
    const prev = store.get().settings.starBest || {}
    const order = 'SABCD'
    // your bests, counting this round
    const bests = {
      score: Math.max(prev.score || 0, stats.score),
      pct: Math.max(prev.pct || 0, pct),
      streak: Math.max(prev.streak || 0, stats.best),
      rating: !prev.rating || order.indexOf(rating) < order.indexOf(prev.rating) ? rating : prev.rating,
    }
    store.setSetting('starBest', bests)
    if (give > 0) sfx('claim')
    setResult({ ...stats, pct, rating, give, bests, newBest: stats.score > (prev.score || 0) })
    setPhase('done')
  }, [])

  // the 3D world: built once, behind the teleport flash
  useEffect(() => {
    const g = createStarfall(host.current, {
      skin, hat,
      reduceMotion: store.get().settings.reduceMotion,
      onHud: setHud,
      onEnd: finish,
      onSfx: sfx,
    })
    game.current = g
    sfx('whoosh')
    const t = setTimeout(() => setWarp(null), 900)
    return () => { clearTimeout(t); g.dispose(); game.current = null }
  }, [skin, hat, finish])

  const play = useCallback(() => { setResult(null); setPhase('play'); game.current?.play() }, [])
  const leave = useCallback(() => {
    if (warp === 'out') return
    sfx('whoosh')
    setWarp('out')
    setTimeout(onClose, 520)
  }, [onClose, warp])

  // Enter plays, Escape leaves
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') leave()
      if (e.key === 'Enter' && phase !== 'play') { e.preventDefault(); play() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leave, play, phase])

  const secs = Math.ceil(hud.time)
  return (
    <div className="mg" role="dialog" aria-modal="true" aria-label="Star catch">
      <div className="mg-world" ref={host} />
      <div className="mg-shade" data-phase={phase} />

      {phase === 'ready' && (
        <section className="mg-screen">
          <p className="mg-kicker">The playground · Starfall Bridge</p>
          <h1 className="mg-title">Star catch</h1>
          <hr className="mg-rule" />
          <div className="mg-stats">
            <div><b>{ROUND}s</b><span>A round</span></div>
            <div><b><Boxet size={22} /> {STAR_PAY}</b><span>Per point</span></div>
            <div><b>{left}</b><span>Left today</span></div>
            <div><b>{best.score || 0}</b><span>Your best</span></div>
          </div>
          <hr className="mg-rule" />
          <p className="mg-how">
            Float along the bridge and catch the falling stars. <em>Gold</em> is 1, <em className="pink">pink</em> is 3.
            Dodge the <em className="ember">meteors</em>.
          </p>
          {left === 0 && <p className="mg-note">You've earned all you can here today. Play for the fun of it.</p>}
          <nav className="mg-menu">
            <button className="on" onClick={play} autoFocus>Play</button>
            <button onClick={leave}>Back to the playground</button>
          </nav>
        </section>
      )}

      {phase === 'play' && (
        <div className="mg-hud">
          <div className="mg-hud-stat"><b>{hud.score}</b><span>Score</span></div>
          <div className="mg-hud-mid">
            <span className="mg-hud-name">Star catch</span>
            <i className="mg-time"><i style={{ transform: `scaleX(${hud.time / ROUND})` }} /></i>
            <span className="mg-hud-secs">{secs}</span>
          </div>
          <div className="mg-hud-stat right"><b>{hud.streak}</b><span>Streak</span></div>
        </div>
      )}
      {phase === 'play' && hud.state === 'count' && hud.count > 0 && <div className="mg-count" key={hud.count}>{hud.count}</div>}
      {phase === 'play' && hud.state === 'play' && hud.time > ROUND - 0.8 && <div className="mg-count go">Go</div>}
      {phase === 'play' && hud.state === 'outro' && <div className="mg-count go" key="time">Time</div>}

      {phase === 'done' && result && (
        <section className="mg-screen">
          <p className="mg-kicker">{result.newBest ? 'A new best' : 'Starfall Bridge'}</p>
          <h1 className="mg-title small">Star catch</h1>
          <hr className="mg-rule" />
          <div className="mg-stats big">
            <div><b>{result.score}</b><span>Score</span><small>Best: {result.bests.score}</small></div>
            <div><b className="mg-badge">{result.rating}</b><span>Rating</span><small>Best: {result.bests.rating}</small></div>
            <div><b>{Math.round(result.pct * 100)}%</b><span>Collected</span><small>Best: {Math.round(result.bests.pct * 100)}%</small></div>
            <div><b>{result.best}</b><span>Streak</span><small>Best: {result.bests.streak}</small></div>
          </div>
          <hr className="mg-rule" />
          <div className="mg-stats small">
            <div><i>{result.gold}</i><span>Gold</span></div>
            <div><i>{result.wish}</i><span>Wishing</span></div>
            <div><i>{result.spawned - result.caught}</i><span>Missed</span></div>
            <div><i><Boxet size={16} /> +{result.give}</i><span>Boxets</span></div>
          </div>
          <hr className="mg-rule" />
          <nav className="mg-menu row">
            <button className="on" onClick={play} autoFocus>Play again</button>
            <button onClick={leave}>Back to the playground</button>
          </nav>
        </section>
      )}

      <footer className="mg-keys" aria-hidden="true">
        {phase === 'play'
          ? <><kbd>←</kbd><kbd>→</kbd> Move <span className="sep" /> <kbd>Esc</kbd> Leave</>
          : <><kbd>Enter</kbd> {phase === 'done' ? 'Play again' : 'Play'} <span className="sep" /> <kbd>Esc</kbd> Leave</>}
      </footer>

      {warp && <div className={`teleport ${warp}`}><i /><i /><i /></div>}
    </div>
  )
}
