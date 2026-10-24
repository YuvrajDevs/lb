import { supabase, rpc } from './client.js'
import { store } from '../game/store.js'

// Your account: signing in and out, loading everything that is yours from the server into the store, keeping
// your home saved, and listening for what changes elsewhere (a friend request, a partner moving the sofa, a top-up
// of your Boxets). While signed out you play as a guest, saved on this device only.
//
// The store keeps working the same way online; its actions call `server` below, which talks to the database.
// Money never moves here: buying, the daily gift and earnings are server functions (see supabase/migrations).

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
let user = null
let sub = null // the realtime subscription for this account
let homeOwner = null // whose home row holds the house you live in (yours, or your couple's user_a)
let homeData = {} // that row's data, as last saved
let ownData = {} // your own home row's data (for your cube; and your solo home while in a couple)
let saveTimer = 0
let worldId = null

/** sign in with Google: off to Google's page, then back here, signed in (an invite code waits on the device) */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}

/** permanently delete your account and everything in it */
export async function deleteAccount() {
  await rpc('delete_account')
  await supabase.auth.signOut()
}

/** start listening: called once when the app opens */
export function startAccount() {
  supabase.auth.onAuthStateChange((event, session) => {
    const next = session?.user || null
    if (next?.id === user?.id) return
    // (the callback must not await Supabase calls itself: hand off to the next tick)
    setTimeout(() => (next ? connect(next) : disconnect()), 0)
  })
}

export const currentUser = () => user
export const currentWorld = () => worldId

// ---------------------------------------------------------------- loading

async function connect(u) {
  user = u
  store.setNet({ status: 'loading', email: u.email })
  try {
    const guest = store.guestSnapshot()
    // a new account is named after the guest you played as, unless that was still the default: then your first name
    const fromGoogle = (u.user_metadata?.given_name || u.user_metadata?.full_name || u.user_metadata?.name || '').split(' ')[0]
    const name = guest.profile.name && guest.profile.name !== 'Sera' ? guest.profile.name : fromGoogle || 'Neighbour'
    const profile = await rpc('start_player', { p_name: name, p_tz: tz() })
    const snap = await loadAll(profile, guest)
    store.goOnline(server, snap, u.id)
    listen()
    store.setNet({ status: 'online', email: u.email })
  } catch (e) {
    console.error(e)
    store.setNet({ status: 'error', email: u.email, error: e.message })
  }
}

function disconnect() {
  user = null
  worldId = null
  homeOwner = null
  if (sub) { supabase.removeChannel(sub); sub = null }
  store.goOffline()
  store.setNet({ status: 'guest' })
}

/** everything that is yours, shaped the way the store keeps it */
async function loadAll(profile, guest) {
  const uid = profile.id
  const [wallet, inv, home, couple, today] = await Promise.all([
    one(supabase.from('wallets').select('boxets').eq('user_id', uid).single()),
    many(supabase.from('inventory').select('item_id, count').eq('user_id', uid)),
    one(supabase.from('homes').select('data').eq('user_id', uid).single()),
    rpc('my_couple'),
    rpc('my_today'),
  ])
  ownData = home?.data || {}

  // a brand-new account takes the guest's home with it (only the furniture the account actually owns)
  if (!ownData.solo && guest.layout && !couple) {
    ownData = { ...ownData, solo: { layout: keepOwned(guest.layout, countOf(inv)), style: guest.style, switches: guest.switches, fence: null, sign: null }, cube: { skin: null, hat: null } }
    await supabase.from('homes').update({ data: ownData, updated_at: new Date().toISOString() }).eq('user_id', uid)
  }

  // the house you live in: your own, or the couple house kept in user_a's row
  let owned = countOf(inv)
  let house = ownData.solo || {}
  homeOwner = uid
  homeData = ownData
  if (couple) {
    const a = uid < couple.partner ? uid : couple.partner
    homeOwner = a
    if (a !== uid) homeData = (await one(supabase.from('homes').select('data').eq('user_id', a).single()))?.data || {}
    house = homeData.couple || {}
    // a couple places anything either of them owns
    const theirs = countOf(await many(supabase.from('inventory').select('item_id, count').eq('user_id', couple.partner)))
    Object.entries(theirs).forEach(([k, n]) => { owned[k] = (owned[k] || 0) + n })
  }

  const [claims, earnings, world, questIds, questDone] = await Promise.all([
    many(supabase.from('claims').select('day').eq('user_id', uid)),
    many(supabase.from('earnings').select('source, amount').eq('user_id', uid).eq('day', today)),
    loadWorld(uid, couple?.world),
    rpc('my_quests'),
    many(supabase.from('quest_claims').select('quest').eq('user_id', uid).eq('day', today)),
  ])
  // (progress is counted on this device; keep today's if it is the same set)
  const cached = store.get().quests
  const quests = { date: today, ids: questIds || [], claimed: questDone.map(q => q.quest), progress: cached?.date === today && String(cached.ids) === String(questIds) ? cached.progress : {} }
  const by = Object.fromEntries(earnings.map(e => [e.source, e.amount]))
  return {
    // the sign on your house shows its name, kept with the house (shared by a couple)
    profile: { name: profile.name, house: house.name || (couple ? `${profile.name} & ${couple.partner_name}` : `${profile.name}'s home`), tag: profile.tag, id: uid },
    access: house.access || [],
    boxets: wallet.boxets,
    owned,
    layout: house.layout || null,
    style: house.style || {},
    switches: house.switches || {},
    equipped: { skin: ownData.cube?.skin ?? null, hat: ownData.cube?.hat ?? null, fence: house.fence ?? null, sign: house.sign ?? null },
    joined: profile.joined,
    today,
    claimedDays: claims.map(c => c.day),
    quests,
    earned: { date: today, total: earnings.reduce((n, e) => n + e.amount, 0), by, visited: [] },
    couple: couple
      ? { state: 'active', partner: couple.partner_name, partnerId: couple.partner, since: couple.since, endsAt: couple.ends_at ? Date.parse(couple.ends_at) : null }
      : { state: 'none', partner: null, since: null },
    world,
    ...(await loadSocial(uid)),
  }
}

/** your world (the one your couple lives in, or the first you joined) and everyone in it */
async function loadWorld(uid, preferred) {
  const mine = await many(supabase.from('world_members').select('world_id, joined_at').eq('user_id', uid).order('joined_at'))
  if (!mine.length) return { id: null, name: 'No world', slots: 4, fund: 0, members: [], invites: [], list: [] }
  worldId = preferred && mine.some(m => m.world_id === preferred) ? preferred : (worldId && mine.some(m => m.world_id === worldId) ? worldId : mine[0].world_id)
  const [worlds, members, couples] = await Promise.all([
    many(supabase.from('worlds').select('id, name, creator, slots, fund').in('id', mine.map(m => m.world_id))),
    many(supabase.from('world_members').select('user_id, joined_at, profiles(name, tag, house_name, last_seen)').eq('world_id', worldId).order('joined_at')),
    many(supabase.from('couples').select('user_a, user_b').eq('world_id', worldId)),
  ])
  const w = worlds.find(x => x.id === worldId)
  const partnerOf = {}
  couples.forEach(c => { partnerOf[c.user_a] = c.user_b; partnerOf[c.user_b] = c.user_a })
  const online = p => p?.last_seen && Date.now() - Date.parse(p.last_seen) < 3 * 60 * 1000
  const people = members.map(m => ({ id: m.user_id, name: m.profiles?.name || '?', tag: m.profiles?.tag, house: m.profiles?.house_name, online: m.user_id === uid || !!online(m.profiles), you: m.user_id === uid, joined: m.joined_at, partner: partnerOf[m.user_id] || null }))
  // a couple shares one plot (shown once, at the partner who joined first)
  const shown = new Set()
  const plots = []
  people.forEach(p => {
    if (shown.has(p.id)) return
    shown.add(p.id)
    if (p.partner) {
      const q = people.find(x => x.id === p.partner)
      if (q) shown.add(q.id)
      plots.push({ ...p, kind: 'couple', house: `${p.name} & ${q?.name || '?'}`, you: p.you || !!q?.you, online: p.online || !!q?.online, ids: [p.id, p.partner] })
    } else plots.push({ ...p, kind: 'solo', ids: [p.id] })
  })
  // every home on the street, as its owner furnished it (a couple's lives in their user_a's row)
  const rows = await many(supabase.from('homes').select('user_id, data').in('user_id', people.map(p => p.id)))
  plots.forEach(p => { p.home = homeOf(p, rows); p.allowed = !p.you && (p.home.access || []).includes(uid) })
  return {
    id: w.id, name: w.name, slots: w.slots, fund: w.fund, creator: w.creator,
    people, members: plots, invites: [],
    list: worlds.map(x => ({ id: x.id, name: x.name })),
  }
}

/** the house on a plot, from the homes rows: { layout, style, switches, fence, sign, name, access } */
function homeOf(plot, rows) {
  const owner = plot.kind === 'couple' ? [...plot.ids].sort()[0] : plot.id
  const data = rows.find(r => r.user_id === owner)?.data || {}
  const h = (plot.kind === 'couple' ? data.couple : data.solo) || {}
  return { ...h, name: h.name || plot.house }
}

/** friends, requests and people you have blocked */
async function loadSocial(uid) {
  const [friends, requests, blocks] = await Promise.all([
    many(supabase.from('friendships').select('user_a, user_b, status, requested_by')),
    many(supabase.from('couple_requests').select('from_user, to_user')),
    many(supabase.from('blocks').select('blocked')),
  ])
  const ids = [...new Set([...friends.flatMap(f => [f.user_a, f.user_b]), ...requests.flatMap(r => [r.from_user, r.to_user]), ...blocks.map(b => b.blocked)])].filter(id => id !== uid)
  const people = ids.length ? await many(supabase.from('profiles').select('id, name, tag, house_name, last_seen').in('id', ids)) : []
  const who = id => people.find(p => p.id === id) || { id, name: '?', tag: '' }
  return {
    friends: friends.map(f => {
      const other = f.user_a === uid ? f.user_b : f.user_a
      const p = who(other)
      return { id: other, name: p.name, tag: p.tag, status: f.status, incoming: f.status === 'pending' && f.requested_by !== uid, online: !!(p.last_seen && Date.now() - Date.parse(p.last_seen) < 180000) }
    }),
    coupleRequests: requests.map(r => ({ from: r.from_user, to: r.to_user, incoming: r.to_user === uid, name: who(r.from_user === uid ? r.to_user : r.from_user).name })),
    blocked: blocks.map(b => ({ id: b.blocked, name: who(b.blocked).name })),
  }
}

/** reload the social and world parts (after a change someone else made) */
async function refresh(parts = ['world', 'social']) {
  if (!user) return
  const patch = {}
  if (parts.includes('world')) patch.world = await loadWorld(user.id, store.get().couple?.state === 'active' ? null : worldId)
  if (parts.includes('social')) Object.assign(patch, await loadSocial(user.id))
  store.patchOnline(patch)
}

/** after becoming (or stopping being) a couple, everything about your home changes: load it all again */
async function reloadAll() {
  if (!user) return
  const profile = await one(supabase.from('profiles').select('*').eq('id', user.id).single())
  const snap = await loadAll(profile, store.guestSnapshot())
  store.goOnline(server, snap, user.id)
}

// ---------------------------------------------------------------- live changes from elsewhere

function listen() {
  if (sub) supabase.removeChannel(sub)
  const uid = user.id
  sub = supabase.channel(`me:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${uid}` }, p => {
      if (p.new?.boxets != null) store.patchOnline({ boxets: p.new.boxets })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => refresh(['social']))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_requests' }, () => refresh(['social']))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'world_members' }, () => refresh(['world']))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'homes' }, p => {
      // your partner moved something in your shared house
      if (p.new?.user_id === homeOwner && homeOwner !== uid) {
        homeData = p.new.data || {}
        const h = homeData.couple || {}
        store.patchOnline({ layout: h.layout || null, style: h.style || {}, switches: h.switches || {}, access: h.access || [], profile: { ...store.get().profile, house: h.name || store.get().profile.house } })
        return
      }
      // a neighbour changed their home: that plot (and whether you may walk in) follows
      const w = store.get().world
      const plot = w.members.find(m => !m.you && (m.kind === 'couple' ? [...m.ids].sort()[0] : m.id) === p.new?.user_id)
      if (!plot) return
      const home = homeOf(plot, [{ user_id: p.new.user_id, data: p.new.data }])
      store.patchOnline({ world: { ...w, members: w.members.map(m => (m === plot ? { ...m, home, allowed: m.allowed || (home.access || []).includes(uid), house: home.name } : m)) } })
    })
    .subscribe()
}

// ---------------------------------------------------------------- what the store calls while you are signed in

/** save the house you live in (debounced: furniture moves come in bursts) */
function saveHome() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const s = store.get()
    const house = { layout: s.layout, style: s.style, switches: s.switches, fence: s.equipped.fence, sign: s.equipped.sign, name: s.profile.house, access: s.access || [] }
    const coupleHouse = s.couple?.state === 'active'
    if (homeOwner === user.id) {
      ownData = { ...ownData, [coupleHouse ? 'couple' : 'solo']: house, cube: { skin: s.equipped.skin, hat: s.equipped.hat } }
      homeData = ownData
      await supabase.from('homes').update({ data: ownData, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    } else {
      // the shared house lives in your partner's row; your cube stays in yours
      homeData = { ...homeData, couple: house }
      ownData = { ...ownData, cube: { skin: s.equipped.skin, hat: s.equipped.hat } }
      await Promise.all([
        supabase.from('homes').update({ data: homeData, updated_at: new Date().toISOString() }).eq('user_id', homeOwner),
        supabase.from('homes').update({ data: ownData, updated_at: new Date().toISOString() }).eq('user_id', user.id),
      ])
    }
  }, 900)
}

let profileTimer = 0
export const server = {
  saveHome,
  buy: id => rpc('buy', { p_item: id }),
  claim: () => rpc('claim_daily'),
  finishGame: (game, score) => rpc('finish_game', { p_game: game, p_score: score }),
  heartbeat: () => rpc('heartbeat', { p_world: worldId }),
  questClaim: id => rpc('quest_claim', { p_quest: id }),
  setProfile(name, house) {
    clearTimeout(profileTimer)
    profileTimer = setTimeout(() => rpc('set_profile', { p_name: name, p_house: house, p_tz: tz() }).catch(e => store.notify(e.message, 'warn')), 800)
  },
  // friends
  addFriend: async tag => { await rpc('friend_request', { p_tag: tag }); await refresh(['social']) },
  answerFriend: async (id, yes) => { await rpc('friend_respond', { p_user: id, p_accept: yes }); await refresh(['social']) },
  removeFriend: async id => { await rpc('friend_remove', { p_user: id }); await refresh(['social']) },
  block: async id => { await rpc('block_user', { p_user: id }); await refresh(['social', 'world']) },
  unblock: async id => { await rpc('unblock_user', { p_user: id }); await refresh(['social']) },
  report: (id, reason, message = null) => rpc('report_user', { p_user: id, p_reason: reason, p_message: message }),
  // worlds
  createWorld: async name => { worldId = await rpc('world_create', { p_name: name }); await refresh(['world']) },
  invite: () => rpc('invite_create', { p_world: worldId }),
  peekInvite: code => rpc('invite_peek', { p_code: code }),
  joinWorld: async code => { worldId = await rpc('world_join', { p_code: code }); await reloadAll() },
  leaveWorld: async id => { await rpc('world_leave', { p_world: id }); if (id === worldId) worldId = null; await reloadAll() },
  removeMember: async id => { await rpc('world_remove', { p_world: worldId, p_user: id }); await refresh(['world']) },
  renameWorld: async name => { await rpc('world_rename', { p_world: worldId, p_name: name }); await refresh(['world']) },
  switchWorld: async id => { worldId = id; await refresh(['world']) },
  addToFund: async n => { await rpc('fund_add', { p_world: worldId, p_amount: n }); await refresh(['world']) },
  buySlot: async () => { await rpc('slot_buy', { p_world: worldId }); await refresh(['world']) },
  // visiting: a neighbour's home (their plot from world.members) as they furnished it
  async loadHome(plot) {
    const owner = plot.kind === 'couple' ? [...plot.ids].sort()[0] : plot.id
    const row = await one(supabase.from('homes').select('data').eq('user_id', owner).single())
    const h = (plot.kind === 'couple' ? row?.data?.couple : row?.data?.solo) || {}
    return { layout: h.layout || null, style: h.style || {}, switches: h.switches || {}, fence: h.fence ?? null, sign: h.sign ?? null }
  },
  visitHome: async hostId => {
    const r = await rpc('visit_home', { p_host: hostId })
    store.patchOnline({ boxets: r.boxets })
    return r.given
  },
  // couples
  askPartner: async id => { await rpc('couple_request', { p_user: id }); await refresh(['social']) },
  answerPartner: async (id, yes) => { await rpc('couple_respond', { p_user: id, p_accept: yes }); if (yes) await reloadAll(); else await refresh(['social']) },
  requestBreakup: () => rpc('breakup_request'),
  cancelBreakup: () => rpc('breakup_cancel'),
  checkCouple: async () => {
    const c = await rpc('my_couple')
    const was = store.get().couple?.state === 'active'
    if (was && !c) await reloadAll() // the 24 hours are up: back to your own homes
  },
}

// ---------------------------------------------------------------- small helpers

async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }
async function many(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data || [] }
function countOf(rows) { return Object.fromEntries(rows.map(r => [r.item_id, r.count])) }
/** a layout with only as many of each item as `owned` allows (extras are dropped, nothing is invented) */
function keepOwned(layout, owned) {
  const used = {}
  const out = {}
  Object.entries(layout || {}).forEach(([area, list]) => {
    const dropped = new Set()
    out[area] = list.filter(e => {
      // (whatever stood on a dropped table goes with it)
      if ((e.on && dropped.has(e.on)) || (used[e.id] || 0) >= (owned[e.id] || 0)) { dropped.add(e.uid); return false }
      used[e.id] = (used[e.id] || 0) + 1
      return true
    })
  })
  return out
}
