import { ITEM_BY_ID, CAT_BY_ID } from './catalog.js'
import { dailyReward, milestoneOf, dayNumber, toDateStr, nextSlotPrice, WORLD_BASE_SLOTS, MILESTONE_ITEMS, earnable, EARN_CAPS, WINDOW_MIN } from './economy.js'
import { starterOwned } from './defaults.js'
import { sfx } from './audio.js'

// A tiny local store (localStorage) that stands in for the server until accounts exist.
// All money rules live in economy.js; every action here is one the server will own later.

// ?debug&save=name keeps a separate save, so testing never touches the real one
const testSave = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug') && new URLSearchParams(location.search).get('save')
const KEY = testSave ? `cc:v3:test:${testSave}` : 'cc:v3'
const listeners = new Set()
let undoStack = []
let redoStack = []

const today = () => toDateStr(new Date())

function fresh() {
  const t = today()
  return {
    profile: { name: 'Sera', house: "Sera's home" },
    boxets: 1500,
    owned: starterOwned(), // itemId -> count: the standard homes' furniture to start with
    equipped: { skin: null, hat: null, fence: null, sign: null },
    layout: null, // { areaId: [placed items] }, filled in when the world first builds the standard furnishing
    style: {}, // { roomId: { paint, floor } }
    switches: {}, // { placedUid: { off } for lamps, { closed } for curtains }
    joined: t,
    claimedDays: [], // day numbers already claimed
    today: t, // overridable with the dev "next day" button
    settings: { quality: 'medium', perfV: 2, music: true, sfx: true, chat: true, names: true, hints: true, reduceMotion: false },
    world: {
      name: "Sera's block",
      slots: WORLD_BASE_SLOTS,
      fund: 120,
      members: [
        { id: 'me', name: 'Sera', house: "Sera's home", online: true, kind: 'solo', you: true },
        { id: 'm1', name: 'Mochi', house: "Mochi's nook", online: true, kind: 'solo' },
        { id: 'm2', name: 'Alex', house: "Alex's den", online: false, kind: 'solo' },
      ],
      invites: [{ id: 'i1', name: 'Juno', dir: 'out' }],
    },
    // a new player starts on their own, in the starter home; becoming a couple moves them into the big house
    couple: { partner: null, since: null, state: 'none' },
    toasts: [],
  }
}

let state = load()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = { ...fresh(), ...JSON.parse(raw), toasts: [] }
      // older saves defaulted to the heaviest setting, which ran laptops hot: move them to balanced once
      if (!saved.settings.perfV) saved.settings = { ...saved.settings, quality: 'medium', perfV: 2 }
      // the date was saved on the first visit and never moved on, so new days never arrived: catch up to today
      // (a date ahead of today stays, so the dev "next day" button keeps working)
      if (!saved.today || saved.today < today()) saved.today = today()
      return saved
    }
  } catch { /* private mode */ }
  return fresh()
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...state, toasts: [] })) } catch { /* private mode */ }
}

function set(patch) {
  state = { ...state, ...patch }
  persist()
  listeners.forEach(l => l())
}

let toastId = 1
function toast(text, kind = 'info') {
  if (kind === 'warn') sfx('error')
  const t = { id: toastId++, text, kind }
  set({ toasts: [...state.toasts, t] })
  setTimeout(() => set({ toasts: state.toasts.filter(x => x.id !== t.id) }), 3600)
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

  notify(text, kind = 'info') { toast(text, kind) },

  // ---- shop ----
  owns: id => (state.owned[id] || 0) > 0,
  count: id => state.owned[id] || 0,
  canBuy(id) {
    const it = ITEM_BY_ID[id]
    if (!it) return { ok: false, reason: 'Unknown item' }
    if (it.kind === 'unique' && state.owned[id]) return { ok: false, reason: 'Owned' }
    if (state.boxets < it.price) return { ok: false, reason: 'Not enough Boxets' }
    return { ok: true }
  },
  buy(id) {
    const r = store.canBuy(id)
    const it = ITEM_BY_ID[id]
    if (!r.ok) { if (it) toast(r.reason, 'warn'); return false }
    set({ boxets: state.boxets - it.price, owned: { ...state.owned, [id]: (state.owned[id] || 0) + 1 } })
    sfx('buy')
    toast(`Bought ${it.name}`, 'good')
    return true
  },

  // ---- the home: what is placed where ----
  placedCount(id) {
    let n = 0
    Object.values(state.layout || {}).forEach(list => list.forEach(e => { if (e.id === id) n++ }))
    return n
  },
  available: id => (state.owned[id] || 0) - store.placedCount(id),
  /** called once, when the world first builds the standard furnishing */
  initLayout(layout) { if (!state.layout) set({ layout }) },
  /** replace an area's layout without an undo step (repairs, not player edits) */
  fixArea(areaId, list) { set({ layout: { ...state.layout, [areaId]: list } }) },
  setArea(areaId, list) {
    undoStack.push(state.layout)
    if (undoStack.length > 40) undoStack.shift()
    redoStack = []
    set({ layout: { ...state.layout, [areaId]: list } })
  },
  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
  undo() {
    if (!undoStack.length) return null
    redoStack.push(state.layout)
    set({ layout: undoStack.pop() })
    return state.layout
  },
  redo() {
    if (!redoStack.length) return null
    undoStack.push(state.layout)
    set({ layout: redoStack.pop() })
    return state.layout
  },
  /** back to the standard furnishing, using only what you still have free (nothing is ever duplicated) */
  resetArea(areaId, defaults) {
    const used = {}
    Object.entries(state.layout || {}).forEach(([k, list]) => { if (k !== areaId) list.forEach(e => { used[e.id] = (used[e.id] || 0) + 1 }) })
    const dropped = new Set()
    const out = []
    defaults.forEach(e => {
      if (e.on && dropped.has(e.on)) { dropped.add(e.uid); return }
      if ((state.owned[e.id] || 0) - (used[e.id] || 0) <= 0) { dropped.add(e.uid); return }
      used[e.id] = (used[e.id] || 0) + 1
      out.push(e)
    })
    store.setArea(areaId, out)
  },
  /** a lamp switched or curtains drawn: not an edit, so no undo step */
  setSwitch(uid, value) { set({ switches: { ...state.switches, [uid]: value } }) },
  applyStyle(areaId, kind, tier) {
    set({ style: { ...state.style, [areaId]: { ...(state.style[areaId] || {}), [kind]: tier || null } } })
  },

  // ---- cube ----
  equip(slot, id) {
    set({ equipped: { ...state.equipped, [slot]: id } })
  },
  equippedTier(slot) {
    const id = state.equipped[slot]
    return id ? ITEM_BY_ID[id].tier : null
  },

  // ---- daily reward ----
  day: () => dayNumber(state.joined, state.today),
  canClaim: () => !state.claimedDays.includes(dayNumber(state.joined, state.today)),
  claim() {
    const day = dayNumber(state.joined, state.today)
    if (state.claimedDays.includes(day)) return null
    const amount = dailyReward(day)
    const ms = milestoneOf(day)
    // milestone days also give the cosmetic they promise
    const gift = ms && MILESTONE_ITEMS[day]
    const owned = gift && !(ITEM_BY_ID[gift].kind === 'unique' && state.owned[gift]) ? { ...state.owned, [gift]: (state.owned[gift] || 0) + 1 } : state.owned
    set({ boxets: state.boxets + amount, claimedDays: [...state.claimedDays, day], owned })
    sfx('claim')
    toast(`+${amount} Boxets${ms ? ` and ${ms}!` : ''}`, 'good')
    return { amount, ms }
  },

  // ---- profile / settings ----
  setHouseName(name) {
    const n = name.trim().slice(0, 24) || state.profile.house
    set({ profile: { ...state.profile, house: n } })
  },
  setName(name) { set({ profile: { ...state.profile, name: name.trim().slice(0, 16) || state.profile.name } }) },
  setSetting(k, v) { set({ settings: { ...state.settings, [k]: v } }) },

  // ---- world (mock, until the server exists) ----
  invite(name) {
    const n = name.trim().slice(0, 16)
    if (!n) return false
    const used = state.world.members.length + state.world.invites.length
    if (used >= state.world.slots) { toast('No free house slots. Buy another slot first.', 'warn'); return false }
    set({ world: { ...state.world, invites: [...state.world.invites, { id: `i${Date.now()}`, name: n, dir: 'out' }] } })
    toast(`Invite sent to ${n}`, 'good')
    return true
  },
  cancelInvite(id) { set({ world: { ...state.world, invites: state.world.invites.filter(i => i.id !== id) } }) },
  addToFund(n) {
    if (state.boxets < n) return toast('Not enough Boxets', 'warn')
    set({ boxets: state.boxets - n, world: { ...state.world, fund: state.world.fund + n } })
    toast(`Added ${n} to the world fund`, 'good')
  },
  buySlot() {
    const price = nextSlotPrice(state.world.slots)
    if (price == null) return toast('This world is at its maximum size', 'warn')
    if (state.world.fund < price) return toast('The world fund needs more Boxets', 'warn')
    set({ world: { ...state.world, fund: state.world.fund - price, slots: state.world.slots + 1 } })
    toast('A new house slot is open!', 'good')
  },

  // ---- earning from games and visits (each capped per day; see economy.js) ----
  earnedToday() { return state.earned?.date === state.today ? state.earned : { date: state.today, total: 0, by: {}, visited: [] } },
  leftToday: source => Math.max(0, (EARN_CAPS[source] || 0) - (store.earnedToday().by[source] || 0)),
  /** pay out for a game, a visit or active time; returns how many Boxets were actually given */
  earn(source, amount, note, quiet = false) {
    const e = store.earnedToday()
    const give = earnable(source, amount, e)
    const next = { ...e, total: e.total + give, by: { ...e.by, [source]: (e.by[source] || 0) + give }, visited: note ? [...(e.visited || []), note] : e.visited || [] }
    set({ boxets: state.boxets + give, earned: next })
    if (quiet) return give
    if (give > 0) { sfx('claim'); toast(`+${give} Boxets`, 'good') } else toast("That's all you can earn from this today", 'info')
    return give
  },

  // ---- active time: every full window of active play pays (see economy.js; the server takes this over later) ----
  /** seconds of active play in the current window */
  activeSec: () => state.active?.sec || 0,
  /** count `sec` more seconds of active play; pays `rate` Boxets each time a window fills up */
  addActive(sec, rate) {
    let s = (state.active?.sec || 0) + sec
    const full = WINDOW_MIN * 60
    if (s < full) { set({ active: { sec: s } }); return 0 }
    s -= full
    set({ active: { sec: s } })
    const give = store.earn('time', rate, null, true)
    if (give > 0) { sfx('claim'); toast(`+${give} Boxets for ${WINDOW_MIN} minutes of play`, 'good') } else toast("You've earned all you can today. See you tomorrow!", 'info')
    return give
  },

  // ---- couple (mock, until the server exists): an invite the other person accepts, and a breakup with a wait ----
  /** you and `partner` become a couple: your homes merge into the four-room house */
  becomeCouple(partner) {
    const p = partner.trim().slice(0, 16)
    if (!p || state.couple.state === 'active') return false
    const house = `${state.profile.name} & ${p}`
    set({
      couple: { partner: p, since: toDateStr(new Date()), state: 'active', endsAt: null },
      profile: { ...state.profile, house },
      world: { ...state.world, members: state.world.members.map(m => (m.you ? { ...m, kind: 'couple', house } : m)) },
    })
    toast(`${p} said yes! Your homes are joining…`, 'good')
    return true
  },
  /** ending a couple needs a request and a 24-hour wait; either of you can cancel it before then */
  requestBreakup() {
    if (state.couple.state !== 'active') return
    set({ couple: { ...state.couple, endsAt: Date.now() + 24 * 3600 * 1000 } })
    toast('Request sent. Your homes separate in 24 hours unless one of you cancels.', 'info')
  },
  cancelBreakup() { set({ couple: { ...state.couple, endsAt: null } }); toast('Still together', 'good') },
  /** called now and then: once the wait is over, the couple ends and each goes back to their own home */
  checkBreakup(now = Date.now()) {
    if (state.couple.state !== 'active' || !state.couple.endsAt || now < state.couple.endsAt) return
    const house = `${state.profile.name}'s home`
    set({
      couple: { partner: null, since: null, state: 'none', endsAt: null },
      profile: { ...state.profile, house },
      world: { ...state.world, members: state.world.members.map(m => (m.you ? { ...m, kind: 'solo', house } : m)) },
    })
    toast('Your couple has ended. You are back in your own home, with your own things.', 'info')
  },

  // ---- dev helpers (only reachable with ?debug) ----
  dev: {
    addBoxets(n) { set({ boxets: state.boxets + n }) },
    nextDay() {
      const d = new Date(state.today + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      set({ today: toDateStr(d) })
    },
    skipDays(n) { for (let i = 0; i < n; i++) store.dev.nextDay() },
    reset() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } state = fresh(); set({}) },
    /** try either home: become a couple with a made-up partner, or go back to being on your own */
    toggleCouple() {
      const on = state.couple.state !== 'active'
      const partner = 'DeM'
      set({
        couple: on ? { partner, since: toDateStr(new Date()), state: 'active' } : { partner: null, since: null, state: 'none' },
        profile: { ...state.profile, house: on ? `${state.profile.name} & ${partner}` : `${state.profile.name}'s home` },
        world: { ...state.world, members: state.world.members.map(m => (m.you ? { ...m, kind: on ? 'couple' : 'solo', house: on ? `${state.profile.name} & ${partner}` : `${state.profile.name}'s home` } : m)) },
      })
    },
  },
}

export const categoryOfItem = id => CAT_BY_ID[ITEM_BY_ID[id].cat]
