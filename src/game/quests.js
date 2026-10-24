// Daily quests: three small things to do each day. Each pays 20 Boxets, all three 30 more.
// Signed in, the server picks them (my_quests) and pays them (quest_claim); as a guest they are picked here.
// Keep the ids in step with my_quests() in supabase/migrations/0006_quests.sql.

export const QUEST_PAY = 20
export const QUEST_BONUS = 30

export const QUESTS = {
  lamp: { text: 'Switch a lamp off and on again', goal: 2, event: 'switch' },
  place: { text: 'Place or move something in your home', goal: 1, event: 'place' },
  stars: { text: 'Catch 15 stars in one round of Star catch', goal: 15, event: 'stars', best: true },
  cliff: { text: 'Walk out to the railing on the cliff', goal: 1, event: 'cliff' },
  visit: { text: "Visit a neighbour's home", goal: 1, event: 'visit', online: true },
  chat: { text: 'Say hello in chat', goal: 1, event: 'chat', online: true },
  emote: { text: 'Wave, hug or dance (the emote button)', goal: 1, event: 'emote', online: true },
  playground: { text: 'Go and play at the playground', goal: 1, event: 'playground' },
  buy: { text: 'Buy something in the shop', goal: 1, event: 'buy' },
  tryon: { text: 'Try on a hat or a skin', goal: 1, event: 'tryon' },
  time: { text: 'Play for 30 minutes', goal: 1, event: 'payout' },
}

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** a guest's three quests for `day` (online-only ones left out) */
export function pickLocal(day, seed = 'guest') {
  return Object.keys(QUESTS).filter(id => !QUESTS[id].online).sort((a, b) => hash(seed + day + a) - hash(seed + day + b)).slice(0, 3)
}

/** progress after `event` happened `n` times (or, for "best" quests, scored `n` once) */
export function advance(quests, event, n = 1) {
  let changed = false
  const progress = { ...quests.progress }
  quests.ids.forEach(id => {
    const q = QUESTS[id]
    if (!q || q.event !== event || quests.claimed.includes(id)) return
    const was = progress[id] || 0
    const now = Math.min(q.goal, q.best ? Math.max(was, n) : was + n)
    if (now !== was) { progress[id] = now; changed = true }
  })
  return changed ? { ...quests, progress } : quests
}

/** quests that are complete but not yet paid */
export const finished = quests => quests.ids.filter(id => !quests.claimed.includes(id) && (quests.progress[id] || 0) >= QUESTS[id].goal)
