import { ITEM_BY_ID, CATEGORIES, itemsOf } from '../game/catalog.js'
import { check, rectAt, footprint } from '../game/grid.js'
import { areaOf } from '../game/areas.js'
import { infoOf, footOf } from './furnish.js'

let seq = 0
const uid = () => `a${Date.now().toString(36)}${(seq++).toString(36)}`

// one of each of these makes a room feel lived in; listed in the order they are placed (big things first)
const WANT_ROOM = ['beds', 'wardrobes', 'seating', 'tables', 'shelves', 'lamps', 'plants', 'rugs', 'pendants', 'curtains', 'art']
const WANT_GARDEN = ['gardenlights', 'gardenlights', 'gardenlights']

/**
 * Fills an area with things you own but have not placed yet, picking (for each kind of furniture the room is
 * missing) the piece whose style best matches what is already there, and finding it a free, allowed spot:
 * floor pieces against the walls first, then the middle; pictures and curtains on the walls at eye level.
 * Returns the new layout list (the old one plus what was added) and how many pieces were added.
 *   available(id) -> how many of that item are still free to place
 */
export function autoFurnish(areaId, entries, available) {
  const area = areaOf(areaId)
  const list = entries.slice()
  const isGarden = area.kind === 'garden'
  // the room's taste: the most common style among what is already placed (or none yet)
  const styles = {}
  list.forEach(e => { const s = ITEM_BY_ID[e.id]?.style; if (s) styles[s] = (styles[s] || 0) + 1 })
  const taste = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]?.[0]
  const has = cat => list.some(e => ITEM_BY_ID[e.id]?.cat === cat)
  const left = id => available(id) - list.filter(e => e.id === id).length + entries.filter(e => e.id === id).length
  const allowed = new Set(CATEGORIES.filter(c => (isGarden ? c.place === 'garden' : ['floor', 'flat', 'ceiling', 'wall'].includes(c.place))).map(c => c.id))

  let added = 0
  for (const cat of isGarden ? WANT_GARDEN : WANT_ROOM) {
    if (!allowed.has(cat) || (!isGarden && has(cat))) continue
    // best match first: same style as the room, then nearer in tier, then the nicer piece
    const tierOfTaste = taste ? itemsOf(cat).find(i => i.style === taste)?.tier || 5 : 5
    const options = itemsOf(cat).filter(i => left(i.id) > 0)
      .sort((a, b) => (b.style === taste) - (a.style === taste) || Math.abs(a.tier - tierOfTaste) - Math.abs(b.tier - tierOfTaste) || b.tier - a.tier)
    for (const item of options) {
      const e = place(area, item.id, list)
      if (e) { list.push(e); added++; break }
    }
  }
  return { list, added }
}

/** a free, allowed spot for one item, or null */
function place(area, itemId, list) {
  const info = infoOf(itemId)
  const others = list
  const ok = cand => check(area, cand, others, id => infoOf(id), footOf).ok
  if (info.kind === 'wall') {
    // walls: back first, then the sides; centred at eye height, sliding along until it fits
    const fp = footOf({ id: itemId })
    const v = Math.max(13, Math.round((2.3 - (fp.cd * 0.1) / 2) / 0.1))
    for (const wall of ['back', 'left', 'right']) {
      const len = wall === 'back' ? area.cols : area.rows
      const mid = Math.round((len - fp.cw) / 2)
      for (let d = 0; d <= len; d += 3) {
        for (const u of d ? [mid - d, mid + d] : [mid]) {
          if (u < 0 || u + fp.cw > len) continue
          const cand = { kind: 'wall', sub: info.sub, wall, rect: { x0: u, x1: u + fp.cw, z0: v, z1: v + fp.cd } }
          if (ok(cand)) return { uid: uid(), id: itemId, wall, u, v, rot: 0 }
        }
      }
    }
    return null
  }
  // floor, flat (rugs) and ceiling pieces: each kind has a natural spot in the room (0..1 across, 0..1 back to
  // front) and is placed as close to it as the rules allow, facing into the room from whichever wall it is by
  const ANCHOR = {
    beds: [0.2, 0.18], wardrobes: [0.88, 0.08], shelves: [0.03, 0.55], tables: [0.7, 0.5], seating: [0.7, 0.72],
    lamps: [0.05, 0.06], plants: [0.96, 0.08], rugs: [0.5, 0.5], pendants: [0.5, 0.45], gardenlights: [Math.random(), 0.3 + Math.random() * 0.4],
  }
  const [ax, az] = ANCHOR[info.item.cat] || [0.5, 0.5]
  const step = 3
  const tries = []
  for (const rot of [0, 1, 3, 2]) {
    const fp = footprint(info.size, rot)
    for (let j = 0; j + fp.cd <= area.rows; j += step) {
      for (let i = 0; i + fp.cw <= area.cols; i += step) {
        const cx = (i + fp.cw / 2) / area.cols, cz = (j + fp.cd / 2) / area.rows
        const score = Math.hypot(cx - ax, (cz - az) * (area.rows / area.cols))
        // against the back wall face the room (0); against the left wall face right (1), the right face left (3)
        const facing = i < 6 && cx < 0.3 && cz > 0.25 ? 1 : area.cols - (i + fp.cw) < 6 && cz > 0.25 ? 3 : 0
        if (info.kind === 'floor' && area.kind !== 'garden' && rot !== facing) continue
        tries.push({ i, j, rot, fp, score })
      }
    }
  }
  tries.sort((a, b) => a.score - b.score)
  for (const t of tries) {
    const cand = { kind: info.kind, rect: rectAt(t.i, t.j, t.fp) }
    if (ok(cand)) return { uid: uid(), id: itemId, i: t.i, j: t.j, rot: t.rot }
  }
  return null
}

