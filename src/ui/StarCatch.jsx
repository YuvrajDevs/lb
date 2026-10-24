import { useCallback, useEffect, useRef, useState } from 'react'
import { store } from '../game/store'
import { sfx } from '../game/audio'
import { STAR_PAY } from '../game/economy'
import { Boxet, Icon } from './icons'

// Star catch, at the playground's first station: stars drift down the night sky for 40 seconds, tap them before
// they fall away. Gold stars are 1 point, the rare pink wishing stars 3. Every point pays STAR_PAY Boxets,
// up to the game's daily cap. Drawn on one canvas over the dimmed world.

const ROUND = 40 // seconds
const reduce = () => !!store.get().settings.reduceMotion

function drawStar(g, x, y, r, rot, color, glow) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.shadowColor = color
  g.shadowBlur = glow
  g.fillStyle = color
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
  g.shadowBlur = 0
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export default function StarCatch({ onClose }) {
  const canvas = useRef(null)
  const [phase, setPhase] = useState('ready') // ready | count | play | done
  const [count, setCount] = useState(3)
  const [hud, setHud] = useState({ score: 0, time: ROUND, streak: 0 })
  const [result, setResult] = useState(null)
  const left = store.leftToday('stars')
  const best = store.get().settings.bestStars || 0

  // Escape leaves, at any point (a round in progress is simply dropped)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const start = useCallback(() => { setResult(null); setHud({ score: 0, time: ROUND, streak: 0 }); setCount(3); setPhase('count') }, [])

  // 3, 2, 1
  useEffect(() => {
    if (phase !== 'count') return
    sfx('tick')
    if (count === 0) { setPhase('play'); return }
    const t = setTimeout(() => setCount(c => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count])

  const finish = useCallback(score => {
    const give = score > 0 ? store.earn('stars', score * STAR_PAY, null, true) : 0
    const prevBest = store.get().settings.bestStars || 0
    if (score > prevBest) store.setSetting('bestStars', score)
    if (give > 0) sfx('claim')
    setResult({ score, give, best: Math.max(score, prevBest), newBest: score > prevBest && score > 0 })
    setPhase('done')
  }, [])

  // the round itself
  useEffect(() => {
    if (phase !== 'play') return
    const cv = canvas.current
    const g = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const fit = () => {
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    const s = { stars: [], bits: [], pops: [], score: 0, streak: 0, lastCatch: 0, t: 0, spawn: 0.4, over: false }
    const calm = reduce()
    const scale = () => Math.min(1.25, Math.max(0.75, Math.min(W, H) / 700))

    const spawn = () => {
      const wish = Math.random() < 0.1
      const k = scale()
      s.stars.push({
        x: 40 + Math.random() * (W - 80), y: -30,
        vy: (wish ? 170 : 70 + Math.random() * 70) * (1 + s.t / ROUND * 0.6) * k,
        r: (wish ? 15 : 14 + Math.random() * 10) * k,
        sway: Math.random() * Math.PI * 2, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2,
        wish, born: s.t,
      })
    }

    const tap = e => {
      if (s.over) return
      const r = cv.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      let hit = -1, bestD = Infinity
      s.stars.forEach((st, i) => {
        const d = Math.hypot((st.hx ?? st.x) - x, st.y - y) // where it is drawn, swaying
        if (d < st.r + 22 && d < bestD) { bestD = d; hit = i }
      })
      if (hit < 0) { s.streak = 0; return }
      const st = s.stars.splice(hit, 1)[0]
      st.x = st.hx ?? st.x
      const pts = st.wish ? 3 : 1
      s.streak = s.t - s.lastCatch < 1.4 ? s.streak + 1 : 1
      s.lastCatch = s.t
      const bonus = s.streak > 0 && s.streak % 8 === 0 ? 2 : 0 // a long run of catches earns a little extra
      s.score += pts + bonus
      sfx('star')
      const color = st.wish ? '#ff9fc6' : '#ffd46b'
      for (let i = 0; i < (calm ? 6 : 16); i++) {
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160
        s.bits.push({ x: st.x, y: st.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color })
      }
      s.pops.push({ x: st.x, y: st.y, text: `+${pts + bonus}`, life: 1, color })
      setHud({ score: s.score, time: Math.max(0, ROUND - s.t), streak: s.streak })
    }
    cv.addEventListener('pointerdown', tap)

    let raf = 0, last = performance.now(), hudAt = 0
    const frame = now => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (document.hidden) return
      s.t += dt
      // stars come faster as the round goes on
      s.spawn -= dt
      if (s.spawn <= 0) { spawn(); s.spawn = 1.0 - (s.t / ROUND) * 0.55 + Math.random() * 0.25 }
      g.clearRect(0, 0, W, H)
      for (let i = s.stars.length - 1; i >= 0; i--) {
        const st = s.stars[i]
        st.y += st.vy * dt
        st.sway += dt * 1.6
        st.rot += st.spin * dt
        const x = st.x + Math.sin(st.sway) * 14
        const fade = Math.min(1, (H + 30 - st.y) / 80)
        if (st.y > H + 30) { s.stars.splice(i, 1); continue }
        g.globalAlpha = Math.max(0, fade)
        // a faint trail above each star
        const grad = g.createLinearGradient(x, st.y - st.r * 4, x, st.y)
        grad.addColorStop(0, 'rgba(255,220,150,0)')
        grad.addColorStop(1, st.wish ? 'rgba(255,159,198,0.35)' : 'rgba(255,212,107,0.3)')
        g.fillStyle = grad
        g.fillRect(x - st.r * 0.25, st.y - st.r * 4, st.r * 0.5, st.r * 4)
        drawStar(g, x, st.y, st.r, st.rot, st.wish ? '#ff9fc6' : '#ffd46b', calm ? 8 : 22)
        st.hx = x
      }
      g.globalAlpha = 1
      for (let i = s.bits.length - 1; i >= 0; i--) {
        const b = s.bits[i]
        b.life -= dt * 1.6
        if (b.life <= 0) { s.bits.splice(i, 1); continue }
        b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt
        g.globalAlpha = b.life
        g.fillStyle = b.color
        g.beginPath(); g.arc(b.x, b.y, 2.2 * b.life + 0.6, 0, Math.PI * 2); g.fill()
      }
      g.font = '600 22px Oswald, sans-serif'
      g.textAlign = 'center'
      for (let i = s.pops.length - 1; i >= 0; i--) {
        const p = s.pops[i]
        p.life -= dt * 1.2
        if (p.life <= 0) { s.pops.splice(i, 1); continue }
        g.globalAlpha = p.life
        g.fillStyle = p.color
        g.fillText(p.text, p.x, p.y - (1 - p.life) * 40)
      }
      g.globalAlpha = 1
      if (now - hudAt > 200) { hudAt = now; setHud(h => ({ ...h, time: Math.max(0, ROUND - s.t) })) }
      if (s.t >= ROUND && !s.over) { s.over = true; cancelAnimationFrame(raf); finish(s.score) }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', tap); window.removeEventListener('resize', fit); g.clearRect(0, 0, W, H) }
  }, [phase, finish])

  const secs = Math.ceil(hud.time)
  return (
    <div className="game-scrim" role="dialog" aria-modal="true" aria-label="Star catch">
      <canvas ref={canvas} className="game-canvas" />
      {phase === 'play' && (
        <div className="game-hud">
          <div className="game-stat"><small>score</small><b>{hud.score}</b></div>
          <div className="game-timer" aria-label={`${secs} seconds left`}><i style={{ transform: `scaleX(${hud.time / ROUND})` }} /><span>{secs}s</span></div>
          <div className="game-stat right"><small>Boxets</small><b><Boxet size={16} /> {Math.min(hud.score * STAR_PAY, left)}</b></div>
          {hud.streak >= 3 && <div className="game-streak" key={hud.streak}>{hud.streak} in a row</div>}
        </div>
      )}
      {phase === 'count' && <div className="game-count" key={count}>{count || 'Go!'}</div>}
      {phase === 'ready' && (
        <section className="game-card">
          <div className="game-badge"><Icon name="star" size={34} /></div>
          <h2>Star catch</h2>
          <p>Stars are falling over the playground. Tap them before they drift away. Gold stars are worth 1, pink wishing stars 3.</p>
          <ul className="game-facts">
            <li><b>{ROUND}s</b><small>a round</small></li>
            <li><b><Boxet size={15} /> {STAR_PAY}</b><small>per point</small></li>
            <li><b>{left}</b><small>left today</small></li>
          </ul>
          {left === 0 && <p className="soft">You've earned all you can from Star catch today. You can still play for fun.</p>}
          {best > 0 && <p className="soft">Your best: <b>{best}</b></p>}
          <div className="game-actions">
            <button className="btn ghost" onClick={onClose}>Not now</button>
            <button className="btn primary" onClick={start} autoFocus>Play</button>
          </div>
        </section>
      )}
      {phase === 'done' && result && (
        <section className="game-card">
          <div className="game-badge"><Icon name="star" size={34} /></div>
          <h2>{result.newBest ? 'New best!' : 'Time!'}</h2>
          <p className="game-score">{result.score}<small> points</small></p>
          <ul className="game-facts">
            <li><b><Boxet size={15} /> +{result.give}</b><small>earned</small></li>
            <li><b>{result.best}</b><small>your best</small></li>
            <li><b>{store.leftToday('stars')}</b><small>left today</small></li>
          </ul>
          <div className="game-actions">
            <button className="btn ghost" onClick={onClose}>Back to the playground</button>
            <button className="btn primary" onClick={start} autoFocus>Play again</button>
          </div>
        </section>
      )}
      {phase !== 'ready' && phase !== 'done' && <button className="icon-btn game-close" onClick={onClose} aria-label="Leave the game"><Icon name="close" /></button>}
    </div>
  )
}
