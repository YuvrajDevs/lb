// The street: the row of homes along the cliff. Pure maths (no Three.js), shared by the world and the tests.

const GAP = 3 // between neighbouring fences: room to walk between the homes

/**
 * The street: every home in the world in one row, in the order people joined, the same for everyone, so a walk
 * from one home to the next looks the same on every screen. Yours is at x = 0. Returns [{ x, half, member }] in
 * the order of `members` (which includes you, marked `you`).
 */
export function streetPlots(members, myHalf) {
  const halfOf = m => (m.you ? myHalf : m.kind === 'couple' ? 12.8 : 9.3)
  let me = members.findIndex(m => m.you)
  const list = me < 0 ? [{ you: true }, ...members] : members
  if (me < 0) me = 0
  const out = list.map(m => ({ x: 0, half: halfOf(m), member: m }))
  let r = myHalf
  for (let i = me + 1; i < out.length; i++) { out[i].x = r + GAP + out[i].half; r = out[i].x + out[i].half }
  let l = -myHalf
  for (let i = me - 1; i >= 0; i--) { out[i].x = l - GAP - out[i].half; l = out[i].x - out[i].half }
  return out
}

/** the other homes' plots ([{ x, half, member }]), in street order */
export const neighbourPlots = (members, myHalf) => streetPlots(members, myHalf).filter(p => !p.member.you)

/** how far the street reaches to the left and right ([left, right] x) */
export function neighbourSpan(members, myHalf) {
  let left = -myHalf, right = myHalf
  streetPlots(members, myHalf).forEach(p => { left = Math.min(left, p.x - p.half); right = Math.max(right, p.x + p.half) })
  return [left, right]
}

