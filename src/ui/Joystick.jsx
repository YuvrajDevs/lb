import { useRef, useState } from 'react'

// On phones: a joystick, bottom left. Put your thumb anywhere on it and drag: the further you push, the faster
// you go, in the direction you push (relative to the camera). Let go to stop.

const R = 46 // how far the knob travels (px)

export default function Joystick({ onMove }) {
  const base = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false })
  const move = e => {
    const r = base.current.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) { dx *= R / d; dy *= R / d }
    setKnob({ x: dx, y: dy, on: true })
    onMove(dx / R, -dy / R)
  }
  const end = () => { setKnob({ x: 0, y: 0, on: false }); onMove(0, 0) }
  return (
    <div className={`joystick ${knob.on ? 'on' : ''}`} ref={base} aria-label="Move"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e) }}
      onPointerMove={e => { if (knob.on) move(e) }}
      onPointerUp={end} onPointerCancel={end}>
      <i style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
