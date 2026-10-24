import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'
import { setHomeKind } from './game/areas'
import { prefetchPreviews } from './world/preview'
import { resolveDefaults } from './world/furnish'
import { autoFurnish } from './world/autofurnish'
import { setAudio, startOnFirstGesture, sfx } from './game/audio'
import { ITEM_BY_ID } from './game/catalog'
import { store } from './game/store'
import { windowEarning, WINDOW_MIN } from './game/economy'
import { useStore } from './ui/useStore'
import { Boxet, Icon } from './ui/icons'
import Compass from './Compass'
import Dock from './ui/Dock'
import Toasts from './ui/Toasts'
import Shop, { Inventory } from './ui/Shop'
import Editor from './ui/Editor'
import { editInset } from './ui/layout'
import Wardrobe from './ui/Wardrobe'
import Settings from './ui/Settings'
import Onboarding from './ui/Onboarding'
import World from './ui/World'
import DailyReward from './ui/DailyReward'
import StarCatch from './ui/StarCatch'
import Title from './ui/Title'
import './ui/ui.css'

const VIEWS = [
  ['house', 'house'],
  ['room', 'room'],
  ['close', 'close-up'],
  ['eyes', 'my eyes'],
  ['street', 'street'],
  ['playground', 'playground'],
]
const HINTS = {
  house: 'drag or Q/E to spin · scroll in for a room, out for the street · click lamps and curtains',
  room: 'WASD or click the floor to move · scroll in to get close, out for the whole house · click lamps and curtains',
  close: 'WASD or click the floor to move · scroll in to see through your eyes, out for the room',
  eyes: 'W/S walk · A/D step aside · drag to look · click lamps and curtains · scroll out to leave',
  street: 'drag or Q/E to walk around the house · scroll in to come back to the house',
  playground: 'click anywhere to walk there · walk up to a glowing station to play · scroll in to come back',
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
  const [ready, setReady] = useState(false) // the 3D world exists
  const [viewMenu, setViewMenu] = useState(false) // the camera picker under the compass
  const [title, setTitle] = useState(true) // the title screen, shown once each time the game opens
  const viewPick = useRef(null)

  // a couple lives in the four-room house; everyone else in their starter home (rebuilt when that changes)
  const homeKind = s.couple.state === 'active' ? 'couple' : 'solo'
  const titleRef = useRef(true)
  titleRef.current = title
  const lastKind = useRef(homeKind)
  // a couple's breakup takes effect once its 24-hour wait is over
  useEffect(() => { store.checkBreakup(); const t = setInterval(() => store.checkBreakup(), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    let alive = true
    let g = null
    const saved = store.get()
    setHomeKind(homeKind)
    // two homes becoming one: the new house rises out of a big cloud
    const intro = lastKind.current === 'solo' && homeKind === 'couple' ? 'merge' : null
    lastKind.current = homeKind
    const boot = async () => {
      // canvas text (signs, name plates) needs Oswald loaded before it is drawn
      try { await Promise.all([document.fonts.load('600 40px Oswald'), document.fonts.load('400 40px Oswald')]) } catch { /* the fallback font is fine */ }
      if (!alive) return
      g = createGame(mount.current, {
      onView: setView,
      layout: saved.layout,
      style: saved.style,
      fence: saved.equipped.fence ? ITEM_BY_ID[saved.equipped.fence].tier : 0,
      sign: saved.equipped.sign ? ITEM_BY_ID[saved.equipped.sign].tier : 0,
      onLayoutInit: store.initLayout,
      onLayoutChange: (id, list) => store.setArea(id, list),
      onLayoutFix: store.fixArea,
      switches: saved.switches,
      intro,
      neighbours: saved.world.members.filter(m => !m.you),
      lowerArt: !saved.settings.artLowered, // a one-off: hang the pictures at eye height
      onSwitch: store.setSwitch,
      onEditor: setEd,
      onBlocked: reason => store.notify(reason, 'warn'),
      onSfx: sfx,
      onNotice: text => store.notify(text, 'info'),
      onStation: id => {
        if (id === 'stars') setOpen('stars')
        else if (id === 'quiz') store.notify('The couple quiz needs your partner here with you. It arrives with online play.', 'info')
        else store.notify('The arcade is still being built. Soon!', 'info')
      },
      })
      game.current = g
      if (titleRef.current) g.setView('title')
      if (!saved.settings.artLowered) store.setSetting('artLowered', true)
      setReady(true)
      if (debug) { window.__cc = g; window.__store = store }
    }
    boot()
    return () => { alive = false; g?.dispose(); game.current = null; setReady(false); setEd(null) }
  }, [homeKind])

  // keep the 3D world in sync with the app state
  const skin = tryOn.skin ?? store.equippedTier('skin')
  const hat = tryOn.hat ?? store.equippedTier('hat')
  useEffect(() => { game.current?.setSkin(skin) }, [skin, ready])
  useEffect(() => { game.current?.setHat(hat) }, [hat, ready])
  useEffect(() => { game.current?.setName(s.profile.house) }, [s.profile.house, ready])
  useEffect(() => { game.current?.setQuality(s.settings.quality) }, [s.settings.quality, ready])
  useEffect(() => { game.current?.setReduceMotion(s.settings.reduceMotion) }, [s.settings.reduceMotion, ready])
  useEffect(() => { game.current?.setTimeOfDay(s.settings.time || 'night') }, [s.settings.time, ready])
  const editing = !!ed?.active
  useEffect(() => { game.current?.setInputEnabled(!open && !editing && !title && !!s.settings.onboarded) }, [open, editing, ready, title, s.settings.onboarded])
  useEffect(() => { game.current?.setIdle(!!open && !editing) }, [open, editing, ready])
  // a minigame draws its own world: the home stops drawing meanwhile
  useEffect(() => { game.current?.setPaused(open === 'stars') }, [open, ready])

  // what the home looks like follows the saved state (this also handles undo, redo and reset)
  useEffect(() => { if (s.layout) game.current?.setLayout(s.layout) }, [s.layout, ready])
  useEffect(() => { (game.current?.roomIds || []).forEach(id => game.current?.setStyle(id, s.style[id])) }, [s.style, ready])
  const fenceTier = s.equipped.fence ? ITEM_BY_ID[s.equipped.fence].tier : 0
  const signTier = s.equipped.sign ? ITEM_BY_ID[s.equipped.sign].tier : 0
  useEffect(() => { game.current?.setFence(fenceTier) }, [fenceTier, ready])
  useEffect(() => { game.current?.setSign(signTier) }, [signTier, ready])

  // the camera picker closes when you click anywhere else
  useEffect(() => {
    if (!viewMenu) return
    const away = e => { if (!viewPick.current?.contains(e.target)) setViewMenu(false) }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [viewMenu])

  // active time: any input in the last 2 minutes, with the game visible, counts towards the next payout
  const lastInput = useRef(Date.now())
  useEffect(() => {
    const mark = () => { lastInput.current = Date.now() }
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const STEP = 15
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > 120000 || !store.get().settings.onboarded) return
      store.addActive(STEP, windowEarning({ onlineActive: 1, withPartner: false }))
    }, STEP * 1000)
    return () => { evs.forEach(e => window.removeEventListener(e, mark)); clearInterval(t) }
  }, [])

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
  // the title screen's menu
  const firstTime = !s.settings.onboarded
  const titleItems = [
    { id: 'enter', label: firstTime ? 'Begin' : 'Continue', enter: true },
    { id: 'guide', label: 'How to play', enter: true },
    { id: 'settings', label: 'Settings' },
  ]
  const pickTitle = id => {
    if (id === 'settings') { setOpen('settings'); return }
    if (id === 'guide') store.setSetting('onboarded', false)
    sfx('whoosh')
    game.current?.setView('house') // the camera flies in from the title shot
    setTimeout(() => setTitle(false), 650)
  }
  const tryItem = useCallback((slot, tier) => setTryOn(t => ({ ...t, [slot]: tier })), [])
  const openShopAt = useCallback(cat => { setShopCat(cat); setOpen('shop') }, [])

  const AREA_OF = { home: 'home', study: 'study', bedroom: 'bedroom', kitchen: 'kitchen', 'living room': 'living' }
  const startEdit = () => {
    setOpen(null)
    game.current?.enterEdit(AREA_OF[view.room] || game.current?.roomIds[0], editInset())
  }
  const stopEdit = () => { game.current?.exitEdit(); setOpen(null) }
  const resetArea = id => { store.resetArea(id, resolveDefaults(id)); sfx('pick') }
  const autoArea = id => {
    const { list, added } = autoFurnish(id, store.get().layout[id] || [], store.available)
    if (!added) { store.notify('Nothing left to place here: buy a few more things in the shop', 'warn'); return }
    store.setArea(id, list)
    store.notify(`Placed ${added} thing${added === 1 ? '' : 's'} to match the room`, 'good')
    sfx('place')
  }

  // (offline, only you count as online; with online play the server counts friends and your partner)
  const rate = windowEarning({ onlineActive: 1, withPartner: false })
  const minsLeft = Math.max(1, Math.ceil(WINDOW_MIN - (s.active?.sec || 0) / 60))
  const eyes = view.mode === 'eyes'

  return (
    <div className={`stage ${editing ? 'editing' : ''}`}>
      <div ref={mount} className="world" />
      {eyes && <div className="eye-vignette" />}
      {eyes && !open && <p className="hud look-tip">hold and drag to look · scroll out to leave</p>}

      {title && ready && <Title items={titleItems} onPick={pickTitle} footnote="Offline · your home is saved on this device" />}
      {!title && <>
      <header className="hud top-left">
        <h1>NeighBoxed</h1>
        <p>{view.room}</p>
        <button className="pill" onClick={() => setOpen('shop')} aria-label={`${s.boxets} Boxets. Open the shop`}>
          <Boxet size={18} /> <b>{s.boxets.toLocaleString()}</b>
          <small title={`Every ${WINDOW_MIN} minutes of play pays ${rate} Boxets`}>+{rate} in {minsLeft} min</small>
        </button>
      </header>

      <aside className="hud top-right">
        <Compass
          az={view.az}
          onChange={a => game.current?.setAzimuth(a, true)}
          onReset={() => game.current?.resetAzimuth()}
          onNudge={d => game.current?.rotateBy(d)}
        />
        {!editing && (
          <div className="view-pick" ref={viewPick}>
            <button className={`icon-btn eye-btn ${viewMenu ? 'on' : ''}`} aria-label="Choose the camera" aria-expanded={viewMenu} onClick={() => setViewMenu(v => !v)}>
              <Icon name="eye" size={18} />
            </button>
            {viewMenu && (
              <div className="panel views menu" role="menu">
                {VIEWS.map(([id, label]) => (
                  <button key={id} role="menuitemradio" aria-checked={view.mode === id} className={view.mode === id ? 'on' : ''} onClick={() => { game.current?.setView(id); setViewMenu(false) }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {view.stairs && !open && !editing && (
        <button className="hud stairs" onClick={() => game.current?.takeStairs()}>
          {view.stairs === 'up' ? '▲ go upstairs' : '▼ go downstairs'}
        </button>
      )}

      {s.settings.hints && !open && !editing && <p className="hud hint">{HINTS[view.mode]}</p>}

      {!editing && <Dock open={open} onOpen={id => (id === 'edit' ? startEdit() : setOpen(id))} giftReady={store.canClaim()} />}
      {editing && <Editor game={game.current} ed={ed} onExit={stopEdit} onOpenShop={() => setOpen('shop')} onReset={resetArea} onAuto={autoArea} />}
      </>}

      {open === 'shop' && <Shop onClose={close} onTry={tryItem} initial={shopCat} key={shopCat} />}
      {open === 'inventory' && <Inventory onClose={close} />}
      {open === 'wardrobe' && <Wardrobe onClose={close} onOpenShop={openShopAt} />}
      {open === 'world' && <World onClose={close} />}
      {open === 'daily' && <DailyReward onClose={close} />}
      {open === 'settings' && <Settings onClose={close} debug={debug} />}
      {open === 'stars' && <StarCatch onClose={close} skin={skin} hat={hat} />}

      {!title && <>

      {rotateNote && !open && !editing && (
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

      </>}
      {ready && !title && !s.settings.onboarded && <Onboarding onDone={() => store.setSetting('onboarded', true)} />}
      <Toasts />
    </div>
  )
}

export default App
