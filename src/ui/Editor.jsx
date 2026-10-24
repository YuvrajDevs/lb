import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, itemsOf, rarityOf, ITEM_BY_ID } from '../game/catalog'
import { areaList, areaOf } from '../game/areas'
import { store } from '../game/store'
import { sfx } from '../game/audio'
import { useStore } from './useStore'
import { Icon } from './icons'
import Preview from './Preview'
import { editInset } from './layout'

// short names keep every tab on one line
const SHORT = { living: 'Living' }
const AREA_ICON = { home: 'bed', study: 'table', bedroom: 'bed', kitchen: 'plant', living: 'sofa', garden: 'fence' }
const SNAPS = [['fine', 'Fine', '10 cm'], ['normal', 'Medium', '30 cm'], ['big', 'Large', '60 cm']]
const VIEWS = [['top', 'Top'], ['angle', 'Angled'], ['front', 'Front']]

/** categories you can place in an area */
const placeable = areaId => CATEGORIES.filter(c => (areaId === 'garden' ? c.place === 'garden' : ['floor', 'flat', 'ceiling', 'wall'].includes(c.place)))

function Swatch({ item, on, onClick }) {
  const r = rarityOf(item.tier)
  return (
    <button className={`tile ${on ? 'sel' : ''}`} style={{ '--rc': r.color }} onClick={onClick} title={item.name}>
      <Preview id={item.id} size={64} />
      <span>{item.name}</span>
    </button>
  )
}

export default function Editor({ game, ed, onExit, onOpenShop, onReset, onAuto }) {
  const s = useStore()
  const area = ed?.areaId
  const [tab, setTab] = useState('items')
  const [cat, setCat] = useState('all')
  const [armedDrag, setArmedDrag] = useState(false)
  const [view, setView] = useState('angle')
  const down = useRef(null)

  useEffect(() => { setCat('all'); setTab('items') }, [area])

  const cats = useMemo(() => placeable(area), [area])
  const owned = useMemo(() => {
    const out = []
    cats.forEach(c => itemsOf(c.id).forEach(i => { if ((s.owned[i.id] || 0) > 0) out.push(i) }))
    return out
  }, [cats, s.owned])
  const list = cat === 'all' ? owned : owned.filter(i => i.cat === cat)
  const ownedCats = cats.filter(c => owned.some(i => i.cat === c.id))

  // dragging an item card out of the drawer and onto the room
  useEffect(() => {
    const move = e => {
      const d = down.current
      if (!d) return
      if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { d.dragging = true; setArmedDrag(true) }
      if (d.dragging) game.editor.hover(e)
    }
    const up = e => {
      const d = down.current
      if (!d) return
      down.current = null
      setArmedDrag(false)
      if (d.dragging) { if (!game.editor.drop(e)) game.editor.cancel() }
      // a plain click keeps the item armed: it follows the pointer until you click the room
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [game])

  if (!ed?.active) return null
  const sel = ed.selection
  const selItem = sel ? ITEM_BY_ID[sel.itemId] : null
  const left = id => store.available(id)
  const armedItem = ed.armed ? ITEM_BY_ID[ed.armed] : null
  const styleOf = s.style[area] || {}

  const startCard = (e, item) => {
    if (left(item.id) <= 0) { store.notify('All of these are already placed', 'warn'); return }
    e.preventDefault()
    sfx('click')
    game.editor.arm(item.id)
    down.current = { x: e.clientX, y: e.clientY, dragging: false }
  }

  return (
    <>
      <div className="ed-top">
        <div className="ed-areas" role="tablist" aria-label="Where to edit">
          {areaList().map(id => (
            <button key={id} role="tab" aria-selected={area === id} className={area === id ? 'on' : ''} onClick={() => game.enterEdit(id, editInset())}>
              <Icon name={AREA_ICON[id]} size={16} /> <span>{SHORT[id] || areaOf(id).label}</span>
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={onExit}><Icon name="check" size={15} /> Done</button>
      </div>

      <aside className="ed-drawer" aria-label="Your items">
        <div className="ed-tabs">
          <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>{area === 'garden' ? 'Garden items' : 'Furniture'}</button>
          <button className={tab === 'style' ? 'on' : ''} onClick={() => setTab('style')}>{area === 'garden' ? 'Fence & sign' : 'Walls & floor'}</button>
        </div>

        {tab === 'items' && (
          <>
            <div className="chips tight">
              <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
              {ownedCats.map(c => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
            </div>
            <div className="ed-items">
              {list.map(i => {
                const n = left(i.id)
                const r = rarityOf(i.tier)
                return (
                  <button key={i.id} className={`ed-card ${n <= 0 ? 'none' : ''} ${ed.armed === i.id ? 'armed' : ''}`} style={{ '--rc': r.color }} onPointerDown={e => startCard(e, i)} title={i.name}>
                    <Preview id={i.id} size={78} />
                    <b>{i.name}</b>
                    <small>{n > 0 ? `${n} to place` : 'All placed'}</small>
                  </button>
                )
              })}
              {list.length === 0 && <p className="soft">{owned.length ? 'Nothing in this group.' : 'You have nothing to place here yet.'}</p>}
            </div>
            <button className="btn ghost wide-btn" onClick={onOpenShop}><Icon name="shop" size={15} /> Get more in the shop</button>
          </>
        )}

        {tab === 'style' && area !== 'garden' && (
          <div className="ed-style">
            {[['paint', 'Wall paint', 'paint'], ['floor', 'Flooring', 'floors']].map(([kind, label, catId]) => (
              <section key={kind}>
                <h4>{label}</h4>
                <div className="grid small">
                  <button className={`tile ${!styleOf[kind] ? 'sel' : ''}`} onClick={() => { store.applyStyle(area, kind, null); sfx('place') }}>
                    <div className="pv" style={{ width: 64, height: 64 }}><Icon name="close" size={22} /></div><span>Original</span>
                  </button>
                  {itemsOf(catId).filter(i => s.owned[i.id]).map(i => (
                    <Swatch key={i.id} item={i} on={styleOf[kind] === i.tier} onClick={() => { store.applyStyle(area, kind, i.tier); sfx('place') }} />
                  ))}
                </div>
              </section>
            ))}
            <p className="soft">Buy more paint and flooring in the shop. They apply to this room only.</p>
            <button className="btn ghost wide-btn" onClick={onOpenShop}><Icon name="shop" size={15} /> Open the shop</button>
          </div>
        )}

        {tab === 'style' && area === 'garden' && (
          <div className="ed-style">
            {[['fence', 'Fence', 'fences'], ['sign', 'Name sign', 'signs']].map(([slot, label, catId]) => (
              <section key={slot}>
                <h4>{label}</h4>
                <div className="grid small">
                  <button className={`tile ${!s.equipped[slot] ? 'sel' : ''}`} onClick={() => { store.equip(slot, null); sfx('place') }}>
                    <div className="pv" style={{ width: 64, height: 64 }}><Icon name="close" size={22} /></div><span>Standard</span>
                  </button>
                  {itemsOf(catId).filter(i => s.owned[i.id]).map(i => (
                    <Swatch key={i.id} item={i} on={s.equipped[slot] === i.id} onClick={() => { store.equip(slot, i.id); sfx('place') }} />
                  ))}
                </div>
              </section>
            ))}
            <button className="btn ghost wide-btn" onClick={onOpenShop}><Icon name="shop" size={15} /> Open the shop</button>
          </div>
        )}
      </aside>

      {sel && selItem && (
        <div className="sel-tools" style={{ left: Math.min(Math.max(sel.screen.x, 140), window.innerWidth - 140), top: Math.max(sel.screen.y, 128) }}>
          <span className="sel-name">{selItem.name}</span>
          {sel.canRotate && <button onClick={() => game.editor.rotate()} aria-label="Rotate (R)" title="Rotate (R)"><Icon name="rotate" size={17} /></button>}
          {left(selItem.id) > 0 && <button onClick={() => game.editor.duplicate()} aria-label="Place another" title="Place another"><Icon name="copy" size={17} /></button>}
          <button className="danger" onClick={() => game.editor.pickUp()} aria-label="Pick up (Delete)" title="Pick up (Delete)"><Icon name="trash" size={17} /></button>
        </div>
      )}

      {(ed.ghost || armedItem) && (
        <div className={`ed-msg ${ed.ghost ? (ed.ghost.valid ? 'ok' : 'bad') : ''}`}>
          {ed.ghost
            ? (ed.ghost.valid ? <><Icon name="check" size={15} /> {ITEM_BY_ID[ed.ghost.itemId].name} fits here. Release or click to place.</> : <>✕ {ed.ghost.reason}</>)
            : <>Move over the {area === 'garden' ? 'garden' : 'room'} to place {armedItem.name} · R turns it · Esc cancels</>}
        </div>
      )}

      <div className="ed-bar">
        <div className="ed-group">
          <small>Snap</small>
          <div className="seg" role="radiogroup" aria-label="Snap size">
            {SNAPS.map(([id, label, size]) => <button key={id} role="radio" aria-checked={ed.snap === id} className={ed.snap === id ? 'on' : ''} onClick={() => game.editor.setSnap(id)} title={`Moves in ${size} steps`}>{label}</button>)}
          </div>
        </div>
        <div className="ed-group">
          <small>View</small>
          <div className="seg" role="radiogroup" aria-label="Camera">
            {VIEWS.map(([id, label]) => <button key={id} role="radio" aria-checked={view === id} className={view === id ? 'on' : ''} onClick={() => { setView(id); game.setEditView(id) }}>{label}</button>)}
          </div>
        </div>
        <div className="ed-group tools">
          <button className="bar-btn icon" disabled={!store.canUndo()} onClick={() => { store.undo(); sfx('pick') }} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" size={17} /></button>
          <button className="bar-btn icon" disabled={!store.canRedo()} onClick={() => { store.redo(); sfx('pick') }} title="Redo" aria-label="Redo"><Icon name="redo" size={17} /></button>
          <button className="bar-btn accent" onClick={() => onAuto(area)} title="Fill the room with things you own but haven't placed, in a matching style"><Icon name="bolt" size={15} /> Auto-furnish</button>
          <button className="bar-btn" onClick={() => onReset(area)} title="Back to the standard furnishing">Reset</button>
        </div>
      </div>
      {armedDrag && <div className="ed-drag-hint" aria-hidden="true" />}
    </>
  )
}
