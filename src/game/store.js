import { ITEM_BY_ID, CAT_BY_ID } from './catalog.js'
import { dailyReward, milestoneOf, dayNumber, toDateStr, nextSlotPrice, WORLD_BASE_SLOTS } from './economy.js'

// A tiny local store (localStorage) that stands in for the server until accounts exist.
// All money rules live in economy.js; every action here is one the server will own later.

const KEY = 'cc:v2'
const listeners = new Set()

const today = () => toDateStr(new Date())

function fresh() {
  const t = today()
  return {
    profile: { name: 'Sera', house: 'Sera & DeM' },
    boxets: 1500,
    owned: {}, // itemId -> count
    equipped: { skin: null, hat: null },
    joined: t,
    claimedDays: [], // day numbers already claimed
    today: t, // overridable with the dev "next day" button
    settings: { quality: 'high', music: true, sfx: true, chat: true, names: true, hints: true, reduceMotion: false },
    world: {
      name: "Sera & DeM's block",
      slots: WORLD_BASE_SLOTS,
      fund: 120,
      members: [
        { id: 'me', name: 'Sera', house: 'Sera & DeM', online: true, kind: 'couple', you: true },
        { id: 'm1', name: 'Mochi', house: "Mochi's nook", online: true, kind: 'solo' },
        { id: 'm2', name: 'Alex', house: "Alex's den", online: false, kind: 'solo' },
      ],
      invites: [{ id: 'i1', name: 'Juno', dir: 'out' }],
    },
    couple: { partner: 'DeM', since: '2025-02-14', state: 'active' },
    toasts: [],
  }
}

let state = load()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fresh(), ...JSON.parse(raw), toasts: [] }
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
  const t = { id: toastId++, text, kind }
  set({ toasts: [...state.toasts, t] })
  setTimeout(() => set({ toasts: state.toasts.filter(x => x.id !== t.id) }), 3600)
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

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
    toast(`Bought ${it.name}`, 'good')
    return true
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
    set({ boxets: state.boxets + amount, claimedDays: [...state.claimedDays, day] })
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
  },
}

export const categoryOfItem = id => CAT_BY_ID[ITEM_BY_ID[id].cat]
