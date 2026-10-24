import { useEffect, useState } from 'react'

// The title screen, the first thing you see: your own home on the cliff at night, the camera drifting slowly
// past it from out over the sea, and the menu on the right. Arrow keys (or the mouse) pick, Enter chooses.

/** the NeighBoxed mark: a little house with a heart for a window, inside a soft shield */
export function Mark({ size = 64 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 3 L57 13 V30 C57 45 46 55 32 61 C18 55 7 45 7 30 V13 Z" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M18 31 L32 19 L46 31 V45 H18 Z" fill="currentColor" />
      <path d="M32 41 C27 37.5 25.5 35.5 25.5 33.3 C25.5 31.4 27 30.2 28.7 30.2 C30.1 30.2 31.3 31 32 32.1 C32.7 31 33.9 30.2 35.3 30.2 C37 30.2 38.5 31.4 38.5 33.3 C38.5 35.5 37 37.5 32 41 Z" fill="#2a1d4a" />
    </svg>
  )
}

/** which world to go into: ◀ its name ▶ (yours is Your World; the others are named after their owner) */
function WorldPicker({ worlds, current, onSwitch }) {
  const i = Math.max(0, worlds.findIndex(w => w.id === current))
  const step = d => onSwitch(worlds[(i + d + worlds.length) % worlds.length].id)
  return (
    <div className="world-pick" aria-label="Choose a world">
      <button aria-label="Previous world" onClick={() => step(-1)}>◀</button>
      <div className="world-pick-name" key={worlds[i].id}>
        <span>{worlds[i].name}</span>
        <i>{worlds.map(w => <b key={w.id} className={w.id === current ? 'on' : ''} />)}</i>
      </div>
      <button aria-label="Next world" onClick={() => step(1)}>▶</button>
    </div>
  )
}

export default function Title({ items, onPick, footnote, worlds = [], world, onWorld }) {
  const [k, setK] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const onKey = e => {
      // (not while a panel is open over the title, like Settings, or typing in a field)
      if (leaving || document.querySelector('.scrim') || e.target.closest?.('input, textarea')) return
      if (worlds.length > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const i = Math.max(0, worlds.findIndex(w => w.id === world))
        onWorld(worlds[(i + (e.key === 'ArrowLeft' ? -1 : 1) + worlds.length) % worlds.length].id)
      }
      if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); setK(i => (i + 1) % items.length) }
      if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); setK(i => (i - 1 + items.length) % items.length) }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(items[k]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // the main way in fades the menu out first, while the camera starts its flight to the house
  function choose(item) {
    if (!item.enter) { onPick(item.id); return }
    setLeaving(true)
    onPick(item.id)
  }

  return (
    <div className={`title ${leaving ? 'leaving' : ''}`}>
      <div className="title-shade" />
      <section className="title-menu">
        <div className="title-logo">
          <Mark size={70} />
          <h1>Neigh<span>Boxed</span></h1>
        </div>
        {worlds.length > 1 && <WorldPicker worlds={worlds} current={world} onSwitch={onWorld} />}
        <nav aria-label="Main menu">
          {items.map((it, i) => (
            <button key={it.id} className={i === k ? 'on' : ''} onMouseEnter={() => setK(i)} onFocus={() => setK(i)} onClick={() => choose(it)}>
              {it.label}
            </button>
          ))}
        </nav>
      </section>
      {footnote && <p className="title-foot">{footnote}</p>}
    </div>
  )
}
