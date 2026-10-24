import { supabase, rpc } from './client.js'

// Being together, live: one private Realtime channel per world ('world:<id>', open only to its members; see
// the policies in supabase/migrations). On it:
//   presence  who is here right now, with their name, cube and where they are (home, or visiting someone)
//   'm'       where someone is: about 8 times a second while they move (relative to the nearest home, see
//             encode() in world/game.js), every few seconds when still
//   'e'       an emote (wave, heart, hug...)
//   'chat'    a chat line, for instant display (it is also stored by send_message for history and moderation)
//   'knock'   someone at your gate asks to come in; 'allow' is the answer (it lasts while you are both here)
// Nothing here moves money; it is only what people see of each other.

let channel = null
let joined = null
const handlers = { presence: () => {}, move: () => {}, emote: () => {}, chat: () => {}, knock: () => {}, allow: () => {}, status: () => {} }

/** set what happens when things arrive: { presence(list), move(id, m), emote(id, kind), chat(msg), status(s) } */
export function onLive(h) { Object.assign(handlers, h) }

/** join a world's channel as `me` ({ id, name, skin, hat, at }); leaves the previous one */
export async function joinLive(worldId, me) {
  if (joined === worldId && channel) { track(me); return }
  await leaveLive()
  if (!worldId) return
  joined = worldId
  await supabase.realtime.setAuth() // private channels need the signed-in token
  const ch = supabase.channel(`world:${worldId}`, { config: { private: true, presence: { key: me.id }, broadcast: { self: false } } })
  channel = ch
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState()
    handlers.presence(Object.entries(state).map(([id, metas]) => ({ id, ...metas[metas.length - 1] })))
  })
  ch.on('broadcast', { event: 'm' }, ({ payload }) => handlers.move(payload.id, payload))
  ch.on('broadcast', { event: 'e' }, ({ payload }) => handlers.emote(payload.id, payload.kind))
  ch.on('broadcast', { event: 'chat' }, ({ payload }) => handlers.chat(payload))
  ch.on('broadcast', { event: 'knock' }, ({ payload }) => handlers.knock(payload))
  ch.on('broadcast', { event: 'allow' }, ({ payload }) => handlers.allow(payload))
  ch.subscribe(async status => {
    handlers.status(status)
    if (status === 'SUBSCRIBED') await ch.track(me)
  })
}

export async function leaveLive() {
  if (channel) { const ch = channel; channel = null; joined = null; await supabase.removeChannel(ch) }
}

/** update what others see of you (name, cube, where you are) */
export function track(me) { channel?.track(me) }

/** your position (from the game's onMove) */
export function sendMove(id, m) { channel?.send({ type: 'broadcast', event: 'm', payload: { id, ...m } }) }

/** ask to come into a home (plot: its id) */
export function sendKnock(from, name, plot) { channel?.send({ type: 'broadcast', event: 'knock', payload: { from, name, plot } }) }
/** let someone in (or not) */
export function sendAllow(to, plot, yes) { channel?.send({ type: 'broadcast', event: 'allow', payload: { to, plot, yes } }) }

export function sendEmote(id, kind) { channel?.send({ type: 'broadcast', event: 'e', payload: { id, kind } }) }

/** say something to the world: stored on the server (checked, rate-limited), then shown to everyone at once */
export async function sendChat(worldId, me, text) {
  const m = await rpc('send_message', { p_body: text, p_world: worldId })
  const msg = { id: m.id, from: me.id, name: me.name, body: m.body, at: m.created_at }
  channel?.send({ type: 'broadcast', event: 'chat', payload: msg })
  return msg
}

/** the last messages in a world (for when you arrive) */
export async function chatHistory(worldId, limit = 40) {
  const { data, error } = await supabase.from('messages').select('id, from_user, body, created_at, profiles!messages_from_user_fkey(name)')
    .eq('world_id', worldId).order('created_at', { ascending: false }).limit(limit)
  if (error) return []
  return data.reverse().map(m => ({ id: m.id, from: m.from_user, name: m.profiles?.name || '?', body: m.body, at: m.created_at }))
}
