// The invisible placement grid. Pure maths (no Three.js, no React) so it can be tested and shared with the server.
//
// Every room is a fixed grid of square cells, CELL metres wide. The room interior is 10.8 x 7.2 units, so 108 x 72 cells,
// and the walls are 4.8 units = 48 cells tall. Square cells keep rotation exact; the count (~7.8k cells) is close
// to the 100 x 100 asked for, with the same fineness.

export const CELL = 0.1
export const COLS = 108
export const ROWS = 72
export const WALL_ROWS = 48
export const TABLE_TOP = 1.05 // height of a table surface, for things standing on tables
export const SNAPS = { fine: 1, normal: 3, big: 6 } // in cells

export const wallLen = wall => (wall === 'back' ? COLS : ROWS)

/** whole cells needed to hold `m` metres (a tiny tolerance stops 0.3000001 from becoming 4 cells) */
export const cellsFor = m => Math.max(1, Math.ceil(m / CELL - 1e-6))

/** footprint in cells of an item with rotation `rot` (0..3 quarter turns) */
export function footprint(size, rot) {
  const w = cellsFor(size.w), d = cellsFor(size.d)
  return rot % 2 ? { cw: d, cd: w } : { cw: w, cd: d }
}

export const rectAt = (i, j, fp) => ({ x0: i, z0: j, x1: i + fp.cw, z1: j + fp.cd })
export const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0
export const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.z0 >= b.z0 && a.z1 <= b.z1
export const snapTo = (v, step) => Math.round(v / step) * step
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** world metres (room-local, origin at the room centre) to continuous cell coordinates */
export const toCell = (m, half) => (m + half) / CELL
export const fromCell = (c, half) => c * CELL - half

/**
 * Where the top-left cell of a footprint goes so that its centre follows a point (in continuous cells),
 * snapped to `step` and kept inside the area.
 */
export function placeAround(cx, cz, fp, step, cols, rows) {
  const i = clamp(snapTo(cx - fp.cw / 2, step), 0, cols - fp.cw)
  const j = clamp(snapTo(cz - fp.cd / 2, step), 0, rows - fp.cd)
  return { i, j }
}

/**
 * An area is one editable place: a room, or the garden.
 *   cols, rows        grid size
 *   fixtures          cells nobody may build on: [{ x0, z0, x1, z1, blocks: ['floor','flat','ceiling'], label }]
 *   wallFixtures      per wall (back/left/right): [{ u0, u1, v0, v1, blocks: ['art','curtain'], label }]
 *   walls             true for rooms (garden has none)
 *
 * An item entry in a layout:
 *   { uid, id, i, j, rot }                       floor / flat / ceiling items (i, j = top-left cell)
 *   { uid, id, i, j, rot, on: parentUid }        something standing on a table
 *   { uid, id, wall, u, v, rot:0 }               wall item (u along the wall, v up it, both in cells)
 */
export function layerOf(kind, sub) {
  return kind === 'wall' ? sub : kind // 'floor' | 'flat' | 'ceiling' | 'art' | 'curtain'
}

/**
 * Can this candidate go here?
 *   cand: { kind: 'floor'|'flat'|'ceiling'|'wall'|'top', rect, wall?, sub?, parent? }
 *   others: the other entries of the layout (without the one being moved)
 *   info(id) -> { kind, sub, size }   how to treat each item
 * Returns { ok: true } or { ok: false, reason }.
 */
export function check(area, cand, others, info, footOf) {
  const { rect } = cand
  if (cand.kind === 'wall') {
    const len = wallLen(cand.wall)
    if (rect.x0 < 0 || rect.x1 > len || rect.z0 < 0 || rect.z1 > WALL_ROWS) return { ok: false, reason: 'Outside the wall' }
    for (const f of area.wallFixtures?.[cand.wall] || []) {
      if (f.blocks.includes(cand.sub) && overlap(rect, { x0: f.u0, x1: f.u1, z0: f.v0, z1: f.v1 })) return { ok: false, reason: `Blocked by the ${f.label}` }
    }
    for (const o of others) {
      if (o.wall !== cand.wall) continue
      const oi = info(o.id)
      if (oi.sub !== cand.sub) continue
      if (overlap(rect, wallRect(o, footOf(o)))) return { ok: false, reason: 'Something is already there' }
    }
    return { ok: true }
  }

  if (cand.kind === 'top') {
    const parent = others.find(o => o.uid === cand.parent)
    if (!parent) return { ok: false, reason: 'Needs a table' }
    if (!inside(rect, floorRect(parent, footOf(parent)))) return { ok: false, reason: 'Hangs off the table' }
    for (const o of others) if (o.on === cand.parent && overlap(rect, floorRect(o, footOf(o)))) return { ok: false, reason: 'Table spot taken' }
    return { ok: true }
  }

  if (rect.x0 < 0 || rect.z0 < 0 || rect.x1 > area.cols || rect.z1 > area.rows) return { ok: false, reason: 'Outside the room' }
  for (const f of area.fixtures || []) {
    if (f.blocks.includes(cand.kind) && overlap(rect, f)) return { ok: false, reason: `Blocked by the ${f.label}` }
  }
  for (const o of others) {
    if (o.wall || o.on) continue
    const oi = info(o.id)
    if (oi.kind !== cand.kind) continue
    if (overlap(rect, floorRect(o, footOf(o)))) return { ok: false, reason: 'Something is already there' }
  }
  return { ok: true }
}

export const floorRect = (o, fp) => rectAt(o.i, o.j, fp)
export const wallRect = (o, fp) => ({ x0: o.u, x1: o.u + fp.cw, z0: o.v, z1: o.v + fp.cd })

/**
 * When a table moves or turns, the things standing on it come along.
 * `before` / `after` are the table's rect before and after, `turns` how many quarter turns it was rotated by.
 * Returns the new top-left cell of one child (given its own footprint before and after).
 */
export function carryChild(child, childFpBefore, childFpAfter, before, after, turns) {
  const t = ((turns % 4) + 4) % 4
  // child centre relative to the table centre, in cells
  const bx = (before.x0 + before.x1) / 2, bz = (before.z0 + before.z1) / 2
  let dx = child.i + childFpBefore.cw / 2 - bx
  let dz = child.j + childFpBefore.cd / 2 - bz
  for (let k = 0; k < t; k++) [dx, dz] = [-dz, dx] // quarter turn clockwise seen from above
  const ax = (after.x0 + after.x1) / 2, az = (after.z0 + after.z1) / 2
  return { i: Math.round(ax + dx - childFpAfter.cw / 2), j: Math.round(az + dz - childFpAfter.cd / 2) }
}

/** one overlay "blocked" list for drawing: every fixture rectangle */
export const fixtureRects = area => (area.fixtures || []).map(f => ({ x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1, label: f.label }))

let uidCounter = 1
export const newUid = () => `p${Date.now().toString(36)}${(uidCounter++).toString(36)}`
