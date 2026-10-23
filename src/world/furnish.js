import * as THREE from 'three'
import { buildItem } from './items/index.js'
import { pool, cone } from './fx.js'
import { ITEM_BY_ID, CAT_BY_ID } from '../game/catalog.js'
import { CELL, TABLE_TOP, footprint, cellsFor } from '../game/grid.js'
import { DEFAULTS } from '../game/defaults.js'
import { areaOf } from '../game/areas.js'
import { wallTexture, floorTexture } from './items/decor.js'

// Turns a layout (a list of placed items on the grid) into 3D objects, and lights the room from its best lamp.

const sizeCache = new Map()

/** the real size of an item's model, measured once: { w, d, h, minY, cx, cz } in metres */
export function sizeOf(itemId) {
  if (sizeCache.has(itemId)) return sizeCache.get(itemId)
  const item = ITEM_BY_ID[itemId]
  const g = buildItem(item)
  g.updateMatrixWorld(true)
  const box = new THREE.Box3()
  g.traverse(o => { if (o.isMesh) box.union(new THREE.Box3().setFromObject(o)) })
  const s = box.getSize(new THREE.Vector3())
  const c = box.getCenter(new THREE.Vector3())
  const out = { w: s.x, d: s.z, h: s.y, minY: box.min.y, maxY: box.max.y, cx: c.x, cz: c.z }
  g.traverse(o => o.geometry?.dispose?.())
  sizeCache.set(itemId, out)
  return out
}

/** how the grid should treat an item: its kind, wall sub-kind, size */
export function infoOf(itemId) {
  const item = ITEM_BY_ID[itemId]
  const cat = CAT_BY_ID[item.cat]
  const kind = cat.place === 'garden' ? 'floor' : cat.place
  const sub = cat.place === 'wall' ? (item.cat === 'curtains' ? 'curtain' : 'art') : null
  return { kind, sub, size: sizeOf(itemId), item }
}

export function footOf(entry) {
  const { size, kind } = infoOf(entry.id)
  // wall pieces: cw = width along the wall, cd = height up the wall
  if (kind === 'wall') return { cw: cellsFor(size.w), cd: cellsFor(size.h) }
  return footprint(size, entry.rot || 0)
}

// ---------- light colours of lamps and pendants, by tier ----------
const LAMP_LIT = ['#ffe29a', '#ffa040', '#ff80b0', '#ffbe70', '#ffe9c0', '#ffb070', '#ff8ae0', '#9fe0ff', '#ffc060', '#b8a0ff']
const PEND_LIT = ['#ffe29a', '#ffbe70', '#ffe9c0', '#ffd38a', '#ffbe70', '#bff7ff', '#ffd9a0', '#d8f0ff', '#ffe29a', '#b8a0ff']

/** world position (room-local metres) of the middle of an entry, floor level */
export function centreOf(area, entry) {
  const fp = footOf(entry)
  const ox = area.kind === 'garden' ? area.origin.x : -5.4
  const oz = area.kind === 'garden' ? area.origin.z : -3.6
  return { x: ox + (entry.i + fp.cw / 2) * CELL, z: oz + (entry.j + fp.cd / 2) * CELL }
}

/** one item instantiated at its grid position (room-local metres; the caller adds it to the room group) */
export function instantiate(area, entry, y0 = 0) {
  const info = infoOf(entry.id)
  const { size, item } = info
  const model = buildItem(item)
  const inner = new THREE.Group()
  const outer = new THREE.Group()
  outer.userData.uid = entry.uid
  outer.userData.itemId = entry.id
  outer.add(inner)

  const ox = area.kind === 'garden' ? area.origin.x : -5.4
  const oz = area.kind === 'garden' ? area.origin.z : -3.6
  inner.add(model)

  if (info.kind === 'wall') {
    // origin of the wall piece: centre of its width, the bottom at v, pushed against the wall
    const fp = footOf(entry)
    const u = (entry.u + fp.cw / 2) * CELL
    const v = entry.v * CELL
    inner.position.set(-size.cx, v - size.minY, -size.cz)
    if (entry.wall === 'back') { outer.position.set(ox + u, 0, oz + size.d / 2 + 0.03); outer.rotation.y = 0 }
    if (entry.wall === 'left') { outer.position.set(ox + size.d / 2 + 0.03, 0, oz + u); outer.rotation.y = Math.PI / 2 }
    if (entry.wall === 'right') { outer.position.set(-ox - size.d / 2 - 0.03, 0, oz + u); outer.rotation.y = -Math.PI / 2 }
    outer.position.y += y0
    return outer
  }

  const fp = footprint(size, entry.rot || 0)
  inner.position.set(-size.cx, 0, -size.cz)
  outer.position.set(ox + (entry.i + fp.cw / 2) * CELL, y0 + (entry.on ? TABLE_TOP : 0), oz + (entry.j + fp.cd / 2) * CELL)
  outer.rotation.y = ((entry.rot || 0) * Math.PI) / 2
  if (info.kind === 'ceiling') {
    // the model hangs from y = 3.2 (its cord top); lift it so the cord meets the ceiling
    outer.position.y = y0 + 4.8 - size.maxY
  }
  return outer
}

/**
 * Builds the whole furnished group for an area. Returns { group, light } where `light` describes the
 * lamp/pendant that should light the room: { x, y, z, color, power } or null.
 */
export function furnishArea(area, entries, { y0 = 0 } = {}) {
  const group = new THREE.Group()
  let best = null
  for (const e of entries) {
    const info = infoOf(e.id)
    const obj = instantiate(area, e, y0)
    group.add(obj)

    const cat = info.item.cat
    if (cat === 'lamps' || cat === 'pendants' || cat === 'gardenlights') {
      const t = info.item.tier
      const color = (cat === 'pendants' ? PEND_LIT : LAMP_LIT)[t - 1]
      const c = centreOf(area, e)
      const worldY = cat === 'pendants' ? y0 + 3.4 : y0 + (e.on ? TABLE_TOP : 0) + Math.min(info.size.h, 2.4) * 0.85
      if (area.kind !== 'garden') {
        const floorY = y0 + 0.012
        const r = cat === 'pendants' ? 1.9 + t * 0.12 : 1.1 + t * 0.12
        pool(group, [c.x, floorY, c.z], color, r, cat === 'pendants' ? 0.3 : 0.26)
        if (cat === 'pendants' && t >= 2) cone(group, [c.x, y0 + 3.3, c.z], color, 3.1, 1.3 + t * 0.06, 0.1)
        const power = (cat === 'pendants' ? 40 : 30) + t * (cat === 'pendants' ? 3 : 4) + (e.on ? -6 : 0)
        if (!best || power > best.power) best = { x: c.x, y: worldY, z: c.z, color, power }
      }
    }
  }
  return { group, light: best }
}

// ---------- paint and flooring textures ----------
const texCache = new Map()
export function paintTexture(tier) {
  const k = `p${tier}`
  if (!texCache.has(k)) {
    const t = wallTexture(tier)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / 2.4, 1 / 2.4)
    texCache.set(k, t)
  }
  return texCache.get(k)
}
export function floorTex(tier) {
  const k = `f${tier}`
  if (!texCache.has(k)) {
    const t = floorTexture(tier)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4.5, 3)
    texCache.set(k, t)
  }
  return texCache.get(k)
}

// ---------- the starter layouts ----------
let seed = 1
const uid = () => `d${(seed++).toString(36)}`

/** resolve DEFAULTS[areaId] (centres in metres) into grid entries with real cells */
export function resolveDefaults(areaId) {
  const area = areaOf(areaId)
  const out = []
  const ox = area.kind === 'garden' ? area.origin.x : -5.4
  const oz = area.kind === 'garden' ? area.origin.z : -3.6
  ;(DEFAULTS[areaId] || []).forEach(d => {
    const info = infoOf(d.id)
    const e = { uid: uid(), id: d.id }
    if (info.kind === 'wall') {
      const fp = footOf({ id: d.id })
      const len = d.wall === 'back' ? area.cols : area.rows
      const centre = d.wall === 'back' ? (d.at - ox) / CELL : (d.at - oz) / CELL
      e.wall = d.wall
      e.u = Math.min(len - fp.cw, Math.max(0, Math.round(centre - fp.cw / 2)))
      e.v = Math.round(d.v / CELL)
      e.rot = 0
    } else {
      e.rot = d.rot || 0
      const fp = footprint(info.size, e.rot)
      e.i = Math.min(area.cols - fp.cw, Math.max(0, Math.round((d.at[0] - ox) / CELL - fp.cw / 2)))
      e.j = Math.min(area.rows - fp.cd, Math.max(0, Math.round((d.at[1] - oz) / CELL - fp.cd / 2)))
      if (d.on != null) e.on = out[d.on].uid
    }
    out.push(e)
  })
  return out
}

export { cellsFor }
