import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from './world/game'
import { setHomeKind } from './game/areas'
import { prefetchPreviews } from './world/preview'
import { resolveDefaults } from './world/furnish'
import { autoFurnish } from './world/autofurnish'
import { setAudio, startOnFirstGesture, sfx } from './game/audio'
import { ITEM_BY_ID } from './game/catalog'
import { store } from './game/store'
import { startAccount } from './net/account'
import { onLive, joinLive, leaveLive, track, sendMove, sendEmote, sendChat, chatHistory, sendKnock, sendAllow } from './net/live'
import Chat from './ui/Chat'
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
import Account from './ui/Account'
import JoinPrompt, { takeJoinFromUrl, pendingJoin } from './ui/JoinPrompt'
import DailyReward from './ui/DailyReward'
import StarCatch from './ui/StarCatch'
import Title, { Mark } from './ui/Title'
import Welcome from './ui/Welcome'
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
  // a new player's welcome: 'name' (who's moving in), 'rising' (the home rises from the cloud), 'guide'
  const [welcome, setWelcome] = useState(null)
  const arriving = useRef(!store.get().settings.arrived && !store.get().settings.onboarded) // brand new: the cloud waits
  // the title, the welcome and the house rising are moments of their own: no HUD over them
  const cinematic = title || welcome === 'name' || welcome === 'rising'
  const viewPick = useRef(null)

  // a couple lives in the four-room house; everyone else in their starter home (rebuilt when that changes)
  const myKind = s.couple.state === 'active' ? 'couple' : 'solo'
  const homeKind = myKind
  // the street: who lives next door (the world is rebuilt when that changes, which is rare)
  const street = s.world.members.filter(m => !m.you).map(m => `${m.id}:${m.kind}`).join('|')
  const isOnline = s.net?.status === 'online'
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
    const intro = arriving.current ? 'arrival' : lastKind.current === 'solo' && homeKind === 'couple' ? 'merge' : null
    lastKind.current = homeKind
    const fenceId = saved.equipped.fence, signId = saved.equipped.sign
    const boot = async () => {
      // canvas text (signs, name plates) needs Oswald loaded before it is drawn
      try { await Promise.all([document.fonts.load('600 40px Oswald'), document.fonts.load('400 40px Oswald')]) } catch { /* the fallback font is fine */ }
      if (!alive) return
      g = createGame(mount.current, {
      onView: setView,
      time: saved.settings.time || 'evening',
      layout: saved.layout,
      style: saved.style,
      fence: fenceId ? ITEM_BY_ID[fenceId].tier : 0,
      sign: signId ? ITEM_BY_ID[signId].tier : 0,
      name: saved.profile.house,
      onLayoutInit: store.initLayout,
      onLayoutChange: (id, list) => store.setArea(id, list),
      onLayoutFix: store.fixArea,
      switches: saved.switches,
      intro,
      // the whole street, every home as it really is (yours in the middle, marked `you`)
      neighbours: saved.world.members,
      onGate: setGatePlot,
      onEnterHome: id => {
        const plot = store.get().world.members.find(m => m.id === id)
        store.server()?.visitHome(plot?.ids?.[0] || id).then(given => {
          store.notify(`Welcome to ${plot?.house || 'their home'}${given ? ` · +${given} Boxets for visiting` : ''}`, 'good')
          store.questEvent('visit')
        }, () => {})
      },
      onReach: place => store.questEvent(place), // 'cliff' or 'playground'
      lowerArt: !saved.settings.artLowered, // a one-off: hang the pictures at eye height
      onSwitch: store.setSwitch,
      onEditor: setEd,
      onBlocked: reason => store.notify(reason, 'warn'),
      onSfx: sfx,
      onNotice: text => store.notify(text, 'info'),
      partnerAI: !store.online(), // online, your real partner walks around instead
      onMove: m => { if (liveId.current) sendMove(liveId.current, m) },
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
  }, [homeKind, street, isOnline])

  // keep the 3D world in sync with the app state
  const skin = tryOn.skin ?? store.equippedTier('skin')
  const hat = tryOn.hat ?? store.equippedTier('hat')
  useEffect(() => { game.current?.setSkin(skin) }, [skin, ready])
  useEffect(() => { game.current?.setHat(hat) }, [hat, ready])
  useEffect(() => { game.current?.setName(s.profile.house) }, [s.profile.house, ready])
  useEffect(() => { game.current?.setQuality(s.settings.quality) }, [s.settings.quality, ready])
  useEffect(() => { game.current?.setReduceMotion(s.settings.reduceMotion) }, [s.settings.reduceMotion, ready])
  useEffect(() => { game.current?.setTimeOfDay(s.settings.time || 'evening') }, [s.settings.time, ready])
  const editing = !!ed?.active
  useEffect(() => { game.current?.setInputEnabled(!open && !editing && !cinematic && !!s.settings.onboarded) }, [open, editing, ready, cinematic, s.settings.onboarded])
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
    let beatIn = 0
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > 120000 || !store.get().settings.onboarded) return
      const srv = store.server()
      if (!srv) { store.addActive(STEP, windowEarning({ onlineActive: 1, withPartner: false })); return }
      // signed in: the server counts active time (a beat a minute) and pays, with friends and your partner online
      store.patchOnline({ active: { sec: Math.min((store.get().active?.sec || 0) + STEP, WINDOW_MIN * 60) } })
      beatIn -= STEP
      if (beatIn > 0) return
      beatIn = 60
      srv.heartbeat().then(r => {
        store.patchOnline({ boxets: r.boxets, active: { sec: r.sec } })
        if (r.paid > 0) { sfx('claim'); store.notify(`+${r.paid} Boxets for ${WINDOW_MIN} minutes of play`, 'good'); store.questEvent('payout') }
      }, () => { /* offline for a moment: the next beat catches up */ })
    }, STEP * 1000)
    return () => { evs.forEach(e => window.removeEventListener(e, mark)); clearInterval(t) }
  }, [])

  // a drag in the game is always a look-around or a furniture move, never the browser dragging a picture of the
  // page (Firefox would otherwise float a ghost of the screen under the cursor)
  useEffect(() => {
    const stop = e => { if (!e.target.closest?.('input, textarea')) e.preventDefault() }
    window.addEventListener('dragstart', stop)
    return () => window.removeEventListener('dragstart', stop)
  }, [])

  // your account: signs you back in if you were, and loads it into the store
  const [joinCode, setJoinCode] = useState(() => { takeJoinFromUrl(); return pendingJoin() })

  // ---- visiting: everyone's home is on the street at once. At a neighbour's gate you ask to come in; when they
  // let you (or they have said you may always come in, from Edit home) their gate and door simply open for you.
  const [gatePlot, setGatePlot] = useState(null) // the plot id of the gate you are standing at
  const [knocked, setKnocked] = useState({}) // plot id -> when you last asked
  const [knocks, setKnocks] = useState([]) // people asking to come into yours: [{ from, name, plot }]
  const plotById = id => s.world.members.find(m => m.id === id)
  const knock = plot => {
    if (!liveId.current) return
    sendKnock(liveId.current, s.profile.name, plot.id)
    setKnocked(k => ({ ...k, [plot.id]: Date.now() }))
    sfx('door')
    store.notify(`You asked to visit ${plot.house}`, 'info')
  }
  const answerKnock = (k, yes) => {
    sendAllow(k.from, k.plot, yes)
    setKnocks(list => list.filter(x => x !== k))
  }
  // homes you may walk into follow the world (their owner's list, or a yes to your knock)
  useEffect(() => { s.world.members.forEach(m => { if (!m.you && m.allowed) game.current?.setAllowed(m.id, true) }) }, [s.world.members, ready])
  // a neighbour changed their home: only that house is built again
  const homesSeen = useRef({})
  useEffect(() => {
    s.world.members.forEach(m => {
      if (m.you) return
      if (homesSeen.current[m.id] && homesSeen.current[m.id] !== m.home) game.current?.updateHome(m.id, m.home)
      homesSeen.current[m.id] = m.home
    })
  }, [s.world.members])
  useEffect(() => { homesSeen.current = {} ; s.world.members.forEach(m => { homesSeen.current[m.id] = m.home }) }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- together, live: who is in your world right now, where they are, what they say ----
  const [here, setHere] = useState([])
  const [chatLog, setChatLog] = useState([])
  const liveId = useRef(null) // your id while connected
  const shown = useRef(new Set()) // peers currently in the game
  useEffect(() => {
    onLive({
      presence: list => {
        setHere(list)
        const g = game.current
        const now = new Set(list.filter(p => p.id !== liveId.current).map(p => p.id))
        shown.current.forEach(id => { if (!now.has(id)) g?.peerRemove(id) })
        list.forEach(p => { if (p.id !== liveId.current) g?.peerSet(p.id, { name: p.name, skin: p.skin ?? null, hat: p.hat ?? null }) })
        shown.current = now
      },
      move: (id, m) => game.current?.peerMove(id, m),
      emote: (id, kind) => game.current?.emote(id, kind),
      chat: msg => { setChatLog(l => [...l.slice(-80), msg]); game.current?.say(msg.from, msg.body) },
      knock: k => {
        // someone at the gate of a home that is yours (or your couple's)
        const mine = store.get().world.members.find(m => m.you)
        if (!mine || k.plot !== mine.id) return
        sfx('door')
        setKnocks(list => [...list.filter(x => x.from !== k.from), k])
      },
      allow: a => {
        if (a.to !== liveId.current) return
        const plot = store.get().world.members.find(m => m.id === a.plot)
        if (a.yes) { game.current?.setAllowed(a.plot, true); store.notify(`${plot?.house || 'They'}: come on in!`, 'good') }
        else store.notify(`${plot?.house || 'They'} can't have visitors right now`, 'info')
      },
    })
  }, [])
  const signedInNow = s.net?.status === 'online'
  const worldNow = signedInNow ? s.world.id : null
  const meLive = signedInNow ? { id: s.profile.id, name: s.profile.name, skin: store.equippedTier('skin'), hat: store.equippedTier('hat') } : null
  const meKey = meLive && `${meLive.id}|${meLive.name}|${meLive.skin}|${meLive.hat}`
  useEffect(() => {
    if (!worldNow || !meLive) { liveId.current = null; leaveLive(); setHere([]); return }
    liveId.current = meLive.id
    joinLive(worldNow, meLive)
    chatHistory(worldNow).then(setChatLog)
  }, [worldNow]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (meLive && worldNow) track(meLive) }, [meKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // the world was rebuilt (a new street): put everyone back in it
  useEffect(() => {
    if (!ready) return
    shown.current = new Set()
    here.forEach(p => { if (p.id !== liveId.current) { game.current?.peerSet(p.id, { name: p.name, skin: p.skin ?? null, hat: p.hat ?? null }); shown.current.add(p.id) } })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const say = async text => {
    try {
      const msg = await sendChat(worldNow, meLive, text)
      setChatLog(l => [...l.slice(-80), msg])
      game.current?.say('me', text)
      store.questEvent('chat')
    } catch (e) { store.notify(e.message, 'warn') }
  }
  const emote = kind => { game.current?.emote('me', kind); if (liveId.current) sendEmote(liveId.current, kind); store.questEvent('emote') }
  useEffect(() => { startAccount() }, [])

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
  const signedIn = s.net?.status === 'online'
  const moveIn = ({ name, house }) => {
    store.setName(name)
    store.setHouseName(house)
    store.setSetting('arrived', true)
    if (!arriving.current) { setWelcome(null); return }
    arriving.current = false
    game.current?.setView('house')
    game.current?.arrive() // the cloud parts and the home rises, with you in it
    setWelcome('rising')
    setTimeout(() => setWelcome('guide'), 6400)
  }
  const titleItems = [
    { id: 'enter', label: firstTime ? 'Begin' : 'Continue', enter: true },
    { id: 'account', label: signedIn ? 'Account' : 'Sign in' },
    { id: 'guide', label: 'How to play', enter: true },
    { id: 'settings', label: 'Settings' },
  ]
  const pickTitle = id => {
    if (id === 'settings' || id === 'account') { setOpen(id); return }
    if (id === 'guide') store.setSetting('onboarded', false)
    sfx('whoosh')
    game.current?.setView(arriving.current ? 'street' : 'house') // the camera flies in from the title shot (a newcomer's: to the cloud)
    setTimeout(() => setTitle(false), 650)
    // someone new (or still called by the old default name) is asked who they are first
    const p = store.get().profile
    if (arriving.current || !p.name || p.name === 'Sera') setTimeout(() => setWelcome('name'), 700)
  }
  const tryItem = useCallback((slot, tier) => { setTryOn(t => ({ ...t, [slot]: tier })); if (tier != null) store.questEvent('tryon') }, [])
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
  const quests = store.quests()

  return (
    <div className={`stage ${editing ? 'editing' : ''}`}>
      <div ref={mount} className="world" />
      {eyes && <div className="eye-vignette" />}
      {eyes && !open && <p className="hud look-tip">hold and drag to look · scroll out to leave</p>}

      {title && ready && <Title items={titleItems} onPick={pickTitle} footnote={signedIn ? `Signed in · ${s.profile.name} ${s.profile.tag}` : s.net?.status === 'loading' ? 'Opening your account…' : 'Guest · your home is saved on this device'} />}
      {welcome === 'name' && !title && <Welcome initialName={s.profile.name === 'Sera' ? '' : s.profile.name} onDone={moveIn} />}
      {!cinematic && <>
      <header className="hud top-left">
        <div className="hud-id">
          <Mark size={30} />
          <div><h1>NeighBoxed</h1><p>{view.room === 'home' ? s.profile.house : view.room}</p></div>
        </div>
        <button className="purse" onClick={() => setOpen('shop')} aria-label={`${s.boxets} Boxets. Open the shop`}>
          <span className="purse-num"><Boxet size={20} /> {s.boxets.toLocaleString()}</span>
          <span className="purse-next" title={`Every ${WINDOW_MIN} minutes of play pays ${rate} Boxets`}>
            <i><i style={{ transform: `scaleX(${(s.active?.sec || 0) / (WINDOW_MIN * 60)})` }} /></i>
            +{rate} in {minsLeft} min
          </span>
        </button>
        <button className="quest-pips" onClick={() => setOpen('daily')} aria-label={`Today's quests: ${quests.claimed.length} of ${quests.ids.length} done`}>
          {quests.ids.map(id => <i key={id} className={quests.claimed.includes(id) ? 'on' : ''} />)}
          <span>Quests</span>
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

      {gatePlot && !open && !editing && plotById(gatePlot) && !plotById(gatePlot).you && !game.current?.homesAllowed().includes(gatePlot) && (
        Date.now() - (knocked[gatePlot] || 0) < 30000
          ? <div className="hud stairs waiting">Waiting for {plotById(gatePlot).house}…</div>
          : <button className="hud stairs" onClick={() => knock(plotById(gatePlot))}>Ask to visit {plotById(gatePlot).house}</button>
      )}
      {knocks.length > 0 && !editing && (
        <div className="hud knocks">
          {knocks.map(k => (
            <div className="knock" key={k.from}>
              <span><b>{k.name}</b> would like to come in</span>
              <button className="btn primary" onClick={() => answerKnock(k, true)}>Let in</button>
              <button className="btn ghost" onClick={() => answerKnock(k, false)}>Not now</button>
            </div>
          ))}
        </div>
      )}

      {view.stairs && !open && !editing && (
        <button className="hud stairs" onClick={() => game.current?.takeStairs()}>
          {view.stairs === 'up' ? '▲ go upstairs' : '▼ go downstairs'}
        </button>
      )}

      {s.settings.hints && !open && !editing && <p className="hud hint">{HINTS[view.mode]}</p>}

      {!editing && <Dock open={open} onOpen={id => (id === 'edit' ? startEdit() : setOpen(id))} giftReady={store.canClaim()} />}
      {!editing && !open && signedInNow && worldNow && (
        <Chat log={chatLog} onSend={say} onEmote={emote} meId={s.profile.id} people={here}
          onReport={m => store.server()?.report(m.from, 'Something they said in chat', m.id).then(() => store.notify(`Reported. Thank you.`, 'good'), e => store.notify(e.message, 'warn'))} />
      )}
      {editing && <Editor game={game.current} ed={ed} onExit={stopEdit} onOpenShop={() => setOpen('shop')} onReset={resetArea} onAuto={autoArea} />}
      </>}

      {open === 'shop' && <Shop onClose={close} onTry={tryItem} initial={shopCat} key={shopCat} />}
      {open === 'inventory' && <Inventory onClose={close} />}
      {open === 'wardrobe' && <Wardrobe onClose={close} onOpenShop={openShopAt} />}
      {open === 'world' && <World onClose={close} onAccount={() => setOpen('account')} />}
      {open === 'daily' && <DailyReward onClose={close} />}
      {open === 'settings' && <Settings onClose={close} debug={debug} onAccount={() => setOpen('account')} />}
      {open === 'account' && <Account onClose={close} />}
      {joinCode && !open && ready && s.net?.status !== 'loading' && (
        <JoinPrompt code={joinCode} signedIn={signedIn} onClose={() => setJoinCode(null)} onSignIn={() => setOpen('account')} />
      )}
      {open === 'stars' && <StarCatch onClose={close} skin={skin} hat={hat} />}

      {!cinematic && <>

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
      {ready && !cinematic && !s.settings.onboarded && (welcome === 'guide' || s.settings.arrived) && (
        <Onboarding name={s.profile.name} onDone={() => { store.setSetting('onboarded', true); setWelcome(null) }} />
      )}
      <Toasts />
    </div>
  )
}

export default App
