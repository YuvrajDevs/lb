import { useRef } from 'react'

// Drag the dial to spin the room 360°. The red needle always points to the window wall (north).
function Compass({ az, onChange, onReset, onNudge }) {
  const ref = useRef(null)
  const drag = useRef(null)

  const angleAt = e => {
    const r = ref.current.getBoundingClientRect()
    return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)))
  }
  const down = e => {
    drag.current = { a0: angleAt(e), az0: az, moved: false }
    ref.current.setPointerCapture(e.pointerId)
  }
  const move = e => {
    if (!drag.current) return
    const d = angleAt(e) - drag.current.a0
    if (Math.abs(d) > 0.05) drag.current.moved = true
    onChange(drag.current.az0 + d)
  }
  const up = () => {
    if (drag.current && !drag.current.moved) onReset()
    drag.current = null
  }

  return (
    <div className="compass-wrap">
      <button className="nudge" aria-label="rotate left" onClick={() => onNudge(Math.PI / 4)}>‹</button>
      <div
        ref={ref}
        className="compass"
        role="slider"
        aria-label="compass: drag to rotate the view, click to reset"
        aria-valuenow={Math.round((az * 180) / Math.PI)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <svg viewBox="-50 -50 100 100" width="84" height="84">
          <circle r="46" className="c-face" />
          <circle r="46" className="c-ring" />
          <g style={{ transform: `rotate(${az}rad)`, transition: drag.current ? 'none' : 'transform 0.12s' }}>
            {[...Array(12)].map((_, i) => (
              <line key={i} x1="0" y1="-42" x2="0" y2={i % 3 === 0 ? -35 : -38} className="c-tick" transform={`rotate(${i * 30})`} />
            ))}
            <text y="-24" className="c-n">N</text>
            <text y="31" className="c-s">S</text>
            <text x="-28" y="4" className="c-s">W</text>
            <text x="28" y="4" className="c-s">E</text>
            <polygon points="0,-20 5,0 -5,0" className="c-needle-n" />
            <polygon points="0,20 5,0 -5,0" className="c-needle-s" />
          </g>
          <circle r="3" className="c-pin" />
        </svg>
      </div>
      <button className="nudge" aria-label="rotate right" onClick={() => onNudge(-Math.PI / 4)}>›</button>
    </div>
  )
}

export default Compass
