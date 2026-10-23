import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'
import { prefetchPreviews } from './world/preview'
import { ITEM_BY_ID } from './game/catalog'
import { store } from './game/store'
import { windowEarning } from './game/economy'
import { useStore } from './ui/useStore'
import { Boxet } from './ui/icons'
import Compass from './Compass'
import Dock from './ui/Dock'
import Toasts from './ui/Toasts'
import Shop, { Inventory } from './ui/Shop'
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

  useEffect(() => {
    const g = createGame(mount.current, { onView: setView })
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
  useEffect(() => { game.current?.setInputEnabled(!open) }, [open])

  // pictures for the shop are made in the background once the world is up
  useEffect(() => {
    const t = setTimeout(() => prefetchPreviews(), 2500)
    return () => clearTimeout(t)
  }, [])

  const close = useCallback(() => { setOpen(null); setTryOn({ skin: null, hat: null }) }, [])
  const tryItem = useCallback((slot, tier) => setTryOn(t => ({ ...t, [slot]: tier })), [])
  const openShopAt = useCallback(cat => { setShopCat(cat); setOpen('shop') }, [])

  const online = s.world.members.filter(m => m.online).length
  const rate = windowEarning({ onlineActive: online, withPartner: s.couple.state === 'active' })
  const eyes = view.mode === 'eyes'
  void ITEM_BY_ID

  return (
    <div className="stage">
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
        <div className="panel views">
          {VIEWS.map(([id, label]) => (
            <button key={id} className={view.mode === id ? 'on' : ''} onClick={() => game.current?.setView(id)}>{label}</button>
          ))}
        </div>
      </aside>

      {view.stairs && !open && (
        <button className="hud stairs" onClick={() => game.current?.takeStairs()}>
          {view.stairs === 'up' ? '▲ go upstairs' : '▼ go downstairs'} <span>space</span>
        </button>
      )}

      {s.settings.hints && !open && <p className="hud hint">{HINTS[view.mode]}</p>}

      <Dock open={open} onOpen={setOpen} giftReady={store.canClaim()} />

      {open === 'shop' && <Shop onClose={close} onTry={tryItem} initial={shopCat} key={shopCat} />}
      {open === 'inventory' && <Inventory onClose={close} />}
      {open === 'wardrobe' && <Wardrobe onClose={close} onOpenShop={openShopAt} />}
      {open === 'world' && <World onClose={close} />}
      {open === 'daily' && <DailyReward onClose={close} />}
      {open === 'settings' && <Settings onClose={close} debug={debug} />}

      <Toasts />
    </div>
  )
}

export default App
