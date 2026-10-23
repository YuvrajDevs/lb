import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'
import { prefetchPreviews } from './world/preview'
import { resolveDefaults } from './world/furnish'
import { setAudio, startOnFirstGesture, sfx } from './game/audio'
import { ITEM_BY_ID } from './game/catalog'
import { store } from './game/store'
import { windowEarning } from './game/economy'
import { useStore } from './ui/useStore'
import { Boxet } from './ui/icons'
import Compass from './Compass'
import Dock from './ui/Dock'
import Toasts from './ui/Toasts'
import Shop, { Inventory } from './ui/Shop'
import Editor from './ui/Editor'
import { editInset } from './ui/layout'
import Wardrobe from './ui/Wardrobe'
import Settings from './ui/Settings'
import World from './ui/World'
import DailyReward from './ui/DailyReward'
import './ui/ui.css'

const VIEWS = [
  ['house', 'house'],
  ['room', 'room'],
  ['close', 'close-up'],
  ['eyes', 'my eyes'],
  ['street', 'street'],
]
const HINTS = {
  house: 'drag or Q/E to spin · scroll to zoom into a room',
  room: 'WASD or click the floor to move · drag or Q/E to spin · scroll to zoom',
  close: 'WASD or click the floor to move · drag or Q/E to spin · scroll to zoom',
  eyes: 'W/S walk · A/D turn · drag to look around',
  street: 'drag or Q/E to walk around the house · scroll to zoom',
}
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')

function App() {
  const mount = useRef(null)
  const game = useRef(null)
  const s = useStore()
  const [view, setView] = useState({ mode: 'room', az: 0, room: 'study', stairs: null })
  const [open, setOpen] = useState(null)
  const [shopCat, setShopCat] = useState('beds')
  const [tryOn, setTryOn] = useState({ skin: null, hat: null })
  const [ed, setEd] = useState(null) // the room editor's live state
  const [rotateNote, setRotateNote] = useState(true)

  useEffect(() => {
    const saved = store.get()
    const g = createGame(mount.current, {
      onView: setView,
      layout: saved.layout,
      style: saved.style,
      fence: saved.equipped.fence ? ITEM_BY_ID[saved.equipped.fence].tier : 0,
      sign: saved.equipped.sign ? ITEM_BY_ID[saved.equipped.sign].tier : 0,
      onLayoutInit: store.initLayout,
      onLayoutChange: (id, list) => store.setArea(id, list),
      onEditor: setEd,
      onBlocked: reason => store.notify(reason, 'warn'),
      onSfx: sfx,
    })
    game.current = g
    if (debug) { window.__cc = g; window.__store = store }
    return () => g.dispose()
  }, [])

  // keep the 3D world in sync with the app state
  const skin = tryOn.skin ?? store.equippedTier('skin')
  const hat = tryOn.hat ?? store.equippedTier('hat')
  useEffect(() => { game.current?.setSkin(skin) }, [skin])
  useEffect(() => { game.current?.setHat(hat) }, [hat])
  useEffect(() => { game.current?.setName(s.profile.house) }, [s.profile.house])
  useEffect(() => { game.current?.setQuality(s.settings.quality) }, [s.settings.quality])
  const editing = !!ed?.active
  useEffect(() => { game.current?.setInputEnabled(!open && !editing) }, [open, editing])
  useEffect(() => { game.current?.setIdle(!!open && !editing) }, [open, editing])

  // what the home looks like follows the saved state (this also handles undo, redo and reset)
  useEffect(() => { if (s.layout) game.current?.setLayout(s.layout) }, [s.layout])
  useEffect(() => { ['study', 'bedroom', 'kitchen', 'living'].forEach(id => game.current?.setStyle(id, s.style[id])) }, [s.style])
  const fenceTier = s.equipped.fence ? ITEM_BY_ID[s.equipped.fence].tier : 0
  const signTier = s.equipped.sign ? ITEM_BY_ID[s.equipped.sign].tier : 0
  useEffect(() => { game.current?.setFence(fenceTier) }, [fenceTier])
  useEffect(() => { game.current?.setSign(signTier) }, [signTier])

  // sound
  useEffect(() => { startOnFirstGesture() }, [])
  useEffect(() => { setAudio(s.settings) }, [s.settings])
  useEffect(() => {
    const onClick = e => { if (e.target.closest?.('button')) sfx('click') }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  // Ctrl+Z / Ctrl+Y while editing
  useEffect(() => {
    const onKey = e => {
      if (!editing || !(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo() }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  // pictures for the shop are made in the background once the world is up
  useEffect(() => {
    const t = setTimeout(() => prefetchPreviews(), 2500)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => { setOpen(null); setTryOn({ skin: null, hat: null }) }, [])
  const tryItem = useCallback((slot, tier) => setTryOn(t => ({ ...t, [slot]: tier })), [])
  const openShopAt = useCallback(cat => { setShopCat(cat); setOpen('shop') }, [])

  const AREA_OF = { study: 'study', bedroom: 'bedroom', kitchen: 'kitchen', 'living room': 'living' }
  const startEdit = () => {
    setOpen(null)
    game.current?.enterEdit(AREA_OF[view.room] || 'study', editInset())
  }
  const stopEdit = () => { game.current?.exitEdit(); setOpen(null) }
  const resetArea = id => { store.resetArea(id, resolveDefaults(id)); sfx('pick') }

  const online = s.world.members.filter(m => m.online).length
  const rate = windowEarning({ onlineActive: online, withPartner: s.couple.state === 'active' })
  const eyes = view.mode === 'eyes'
  void ITEM_BY_ID

  return (
    <div className={`stage ${editing ? 'editing' : ''}`}>
      <div ref={mount} className="world" />
      {eyes && <div className="eye-vignette" />}

      <header className="hud top-left">
        <h1>cc</h1>
        <p>{view.room}</p>
        <button className="pill" onClick={() => setOpen('shop')} aria-label={`${s.boxets} Boxets. Open the shop`}>
          <Boxet size={18} /> <b>{s.boxets.toLocaleString()}</b>
          <small>{rate}/30 min</small>
        </button>
      </header>

      <aside className="hud top-right">
        <Compass
          az={view.az}
          onChange={a => game.current?.setAzimuth(a, true)}
          onReset={() => game.current?.resetAzimuth()}
          onNudge={d => game.current?.rotateBy(d)}
        />
        {!editing && <div className="panel views">
          {VIEWS.map(([id, label]) => (
            <button key={id} className={view.mode === id ? 'on' : ''} onClick={() => game.current?.setView(id)}>{label}</button>
          ))}
        </div>}
      </aside>

      {view.stairs && !open && !editing && (
        <button className="hud stairs" onClick={() => game.current?.takeStairs()}>
          {view.stairs === 'up' ? '▲ go upstairs' : '▼ go downstairs'} <span>space</span>
        </button>
      )}

      {s.settings.hints && !open && !editing && <p className="hud hint">{HINTS[view.mode]}</p>}

      {!editing && <Dock open={open} onOpen={id => (id === 'edit' ? startEdit() : setOpen(id))} giftReady={store.canClaim()} />}
      {editing && <Editor game={game.current} ed={ed} onExit={stopEdit} onOpenShop={() => setOpen('shop')} onReset={resetArea} />}

      {open === 'shop' && <Shop onClose={close} onTry={tryItem} initial={shopCat} key={shopCat} />}
      {open === 'inventory' && <Inventory onClose={close} />}
      {open === 'wardrobe' && <Wardrobe onClose={close} onOpenShop={openShopAt} />}
      {open === 'world' && <World onClose={close} />}
      {open === 'daily' && <DailyReward onClose={close} />}
      {open === 'settings' && <Settings onClose={close} debug={debug} />}

      {rotateNote && (
        <div className="rotate-note" role="note">
          <span>📱 Turn your phone sideways for the best view</span>
          <button aria-label="Dismiss" onClick={() => setRotateNote(false)}>×</button>
        </div>
      )}

      {!editing && !open && (
        <div className="pad" aria-label="Move">
          {[['u', '▲', 'w', 'arrowup'], ['l', '◀', 'a', 'arrowleft'], ['d', '▼', 's', 'arrowdown'], ['r', '▶', 'd', 'arrowright']].map(([cls, label, key]) => (
            <button
              key={cls}
              className={cls}
              aria-label={`Move ${cls}`}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); game.current?.setKey(key, true) }}
              onPointerUp={() => game.current?.setKey(key, false)}
              onPointerCancel={() => game.current?.setKey(key, false)}
            >{label}</button>
          ))}
        </div>
      )}

      <Toasts />
    </div>
  )
}

export default App
