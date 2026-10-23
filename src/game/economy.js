// Pure rules for the economy. No Three.js, no React: the server mirrors these exact functions.

export const BASE_PER_WINDOW = 15 // Boxets per 30 minutes of active time
export const WINDOW_MIN = 30
export const PARTNERSHIP_CAP = 3 // multiplier cap
export const COUPLE_MULT = 3
export const DAILY_CAP = 600

export const WORLD_BASE_SLOTS = 4
export const WORLD_MAX_SLOTS = 6
export const SLOT_PRICES = { 5: 500, 6: 1000 }

/** Boxets per active 30-minute window for one player */
export function windowEarning({ onlineActive = 1, withPartner = false }) {
  const partnership = Math.min(Math.max(onlineActive, 1), PARTNERSHIP_CAP)
  const couple = withPartner ? COUPLE_MULT : 1
  return BASE_PER_WINDOW * partnership * couple
}

/** reward for the calendar day since joining (day 1 = the day you joined) */
export function dailyReward(day) {
  return Math.min(20 + 2 * day, 150)
}

/** cosmetic given on milestone days (claimable on that day only) */
export const MILESTONES = { 7: 'a free cube hat', 30: 'a golden frame', 100: 'a glowing sign', 365: 'a legendary skin' }
export const milestoneOf = day => MILESTONES[day] || null
/** the shop item each milestone actually gives you */
export const MILESTONE_ITEMS = { 7: 'hats-1', 30: 'art-9', 100: 'signs-6', 365: 'skins-10' }

/** the next price to open another house slot, or null at the cap */
export function nextSlotPrice(slots) {
  return slots >= WORLD_MAX_SLOTS ? null : SLOT_PRICES[slots + 1]
}

/** whole days between two YYYY-MM-DD strings */
export function daysBetween(a, b) {
  const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((t(b) - t(a)) / 86400000)
}
export const dayNumber = (joined, today) => daysBetween(joined, today) + 1
// the player's own calendar day (local time), so the daily gift turns over at their midnight, not at UTC midnight
export const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
