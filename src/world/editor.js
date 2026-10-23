import * as THREE from 'three'
import { CELL, WALL_ROWS, SNAPS, TABLE_TOP, rectAt, placeAround, check, carryChild, newUid, wallLen, clamp, snapTo } from '../game/grid.js'
import { areaOf } from '../game/areas.js'
import { canStandOnTable } from '../game/catalog.js'
import { infoOf, footOf, instantiate } from './furnish.js'

const GOOD = '#6fe8a0'
const BAD = '#ff6a6a'
const SEL = '#ffc15a'
const HX = 5.4
const HZ = 3.6
const H = 4.8

// ---- grid overlay textures ----
function gridTexture(area, step, rects, cols, rows, vertical) {
  const px = 8
  const c = document.createElement('canvas')
  c.width = cols * px
  c.height = rows * px
  const g = c.getContext('2d')
  // blocked zones
  rects.forEach(r => {
    const x0 = r.x0 * px, y0 = r.z0 * px, w = (r.x1 - r.x0) * px, h = (r.z1 - r.z0) * px
    g.fillStyle = 'rgba(255, 96, 96, 0.22)'
    g.fillRect(x0, y0, w, h)
    g.save()
    g.beginPath(); g.rect(x0, y0, w, h); g.clip()
    g.strokeStyle = 'rgba(255, 120, 120, 0.4)'
    g.lineWidth = 2
    for (let k = -h; k < w; k += 18) { g.beginPath(); g.moveTo(x0 + k, y0 + h); g.lineTo(x0 + k + h, y0); g.stroke() }
    g.restore()
    g.fillStyle = 'rgba(255, 220, 220, 0.9)'
    g.font = '600 13px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(r.label, x0 + w / 2, y0 + h / 2 + 4, w - 6)
  })
  // lines
  for (let i = 0; i <= cols; i += step) {
    g.strokeStyle = i % 10 === 0 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.13)'
    g.lineWidth = i % 10 === 0 ? 1.5 : 1
    g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, rows * px); g.stroke()
  }
  for (let j = 0; j <= rows; j += step) {
    g.strokeStyle = j % 10 === 0 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.13)'
    g.lineWidth = j % 10 === 0 ? 1.5 : 1
    g.beginPath(); g.moveTo(0, j * px); g.lineTo(cols * px, j * px); g.stroke()
  }
  g.strokeStyle = 'rgba(255, 220, 160, 0.7)'
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, cols * px - 3, rows * px - 3)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (vertical) { t.wrapT = THREE.ClampToEdgeWrapping }
  return t
}

const overlayMat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })

export function createEditor(ctx) {
  const { canvas, house, getCamera, getLayout, commit, onState, onBlocked } = ctx
  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()

  const st = {
    active: false, areaId: null, snapName: 'normal', grid: true,
    selected: null, ghost: null, armedItem: null, drag: null, hover: null,
  }
  let area = null
  let root = null // the group that holds the area's furnished group and the overlays
  let y0 = 0
  let ox = -HX
  let oz = -HZ
  let wallOverlays = []
  let floorOverlay = null
  let ghostObj = null
  let ghostPlane = null
  let ghostKey = ''
  let selPlane = null
  let hiddenObj = null

  const step = () => SNAPS[st.snapName]
  const entries = () => getLayout(st.areaId)

  function emit() {
    const sel = st.selected ? entries().find(e => e.uid === st.selected) : null
    onState?.({
      active: st.active, areaId: st.areaId, snap: st.snapName, grid: st.grid, armed: st.armedItem,
      ghost: st.ghost ? { itemId: st.ghost.entry.id, valid: st.ghost.valid, reason: st.ghost.reason } : null,
      selection: sel ? { uid: sel.uid, itemId: sel.id, screen: screenOf(sel), canRotate: infoOf(sel.id).kind !== 'wall' } : null,
    })
  }

  // ---------- geometry helpers ----------
  const worldRoot = () => (st.areaId === 'garden' ? house.group : house.roomById(st.areaId).sh.root)

  function setRay(ev) {
    const r = canvas.getBoundingClientRect()
    v2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, getCamera())
    // into room-local space
    const inv = new THREE.Matrix4().copy(worldRoot().matrixWorld).invert()
    return { o: ray.ray.origin.clone().applyMatrix4(inv), d: ray.ray.direction.clone().transformDirection(inv) }
  }

  /** where the pointer is on the floor plane (area-local metres), optionally at a table-top height */
  function floorPoint(ev, h = 0) {
    const { o, d } = setRay(ev)
    const planeY = y0 + h
    if (Math.abs(d.y) < 1e-6) return null
    const t = (planeY - o.y) / d.y
    if (t < 0) return null
    return { x: o.x + d.x * t, z: o.z + d.z * t }
  }

  /** where the pointer is on the walls: { wall, u, v } in cells */
  function wallPoint(ev) {
    const { o, d } = setRay(ev)
    let best = null
    const tryPlane = (wall, axis, coord) => {
      const dd = axis === 'x' ? d.x : d.z
      if (Math.abs(dd) < 1e-6) return
      const t = ((coord - (axis === 'x' ? o.x : o.z))) / dd
      if (t < 0) return
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t
      const yy = y - y0
      if (yy < 0 || yy > H) return
      if (wall === 'back' && Math.abs(x) > HX) return
      if (wall !== 'back' && Math.abs(z) > HZ) return
      if (!best || t < best.t) best = { t, wall, u: wall === 'back' ? (x + HX) / CELL : (z + HZ) / CELL, v: yy / CELL }
    }
    tryPlane('back', 'z', -HZ)
    tryPlane('left', 'x', -HX)
    tryPlane('right', 'x', HX)
    return best
  }

  // ---------- candidates ----------
  const others = (ignore = []) => entries().filter(e => !ignore.includes(e.uid))

  function kindOf(entry) {
    const info = infoOf(entry.id)
    if (info.kind === 'wall') return { kind: 'wall', sub: info.sub }
    if (entry.on) return { kind: 'top' }
    return { kind: info.kind }
  }

  function rectFor(entry) {
    const fp = footOf(entry)
    if (infoOf(entry.id).kind === 'wall') return { x0: entry.u, x1: entry.u + fp.cw, z0: entry.v, z1: entry.v + fp.cd }
    return rectAt(entry.i, entry.j, fp)
  }

  /** is this entry allowed where it is? `ignore` = uids that don't count (the item itself and what stands on it) */
  function validate(entry, ignore = []) {
    const k = kindOf(entry)
    const cand = { ...k, rect: rectFor(entry), wall: entry.wall, parent: entry.on }
    return check(area, cand, others(ignore), id => infoOf(id), footOf)
  }

  /** build the entry for an item following the pointer */
  function candidate(itemId, ev, rot, ignore = []) {
    const info = infoOf(itemId)
    if (info.kind === 'wall') {
      const wp = wallPoint(ev)
      if (!wp) return null
      const fp = footOf({ id: itemId })
      const len = wallLen(wp.wall)
      const u = clamp(snapTo(wp.u - fp.cw / 2, step()), 0, len - fp.cw)
      const v = clamp(snapTo(wp.v - fp.cd / 2, step()), 0, WALL_ROWS - fp.cd)
      return { id: itemId, wall: wp.wall, u, v, rot: 0 }
    }
    const fp = footOf({ id: itemId, rot })
    // small things can stand on a table: is the pointer over one?
    if (canStandOnTable(info.item)) {
      const tp = floorPoint(ev, TABLE_TOP)
      if (tp) {
        const cx = (tp.x - ox) / CELL, cz = (tp.z - oz) / CELL
        for (const t of entries()) {
          if (ignore.includes(t.uid) || t.on || infoOf(t.id).item.cat !== 'tables') continue
          const tr = rectAt(t.i, t.j, footOf(t))
          if (cx >= tr.x0 && cx <= tr.x1 && cz >= tr.z0 && cz <= tr.z1) {
            const i = clamp(snapTo(cx - fp.cw / 2, step()), tr.x0, Math.max(tr.x0, tr.x1 - fp.cw))
            const j = clamp(snapTo(cz - fp.cd / 2, step()), tr.z0, Math.max(tr.z0, tr.z1 - fp.cd))
            return { id: itemId, i, j, rot, on: t.uid }
          }
        }
      }
    }
    const p = floorPoint(ev, 0)
    if (!p) return null
    const { i, j } = placeAround((p.x - ox) / CELL, (p.z - oz) / CELL, fp, step(), area.cols, area.rows)
    return { id: itemId, i, j, rot }
  }

  // ---------- drawing the ghost, the selection and the grid ----------
  function planeFor(entry, color, opacity = 0.35) {
    const info = infoOf(entry.id)
    const fp = footOf(entry)
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(fp.cw * CELL, fp.cd * CELL),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    )
    g.renderOrder = 6
    if (info.kind === 'wall') {
      const u = (entry.u + fp.cw / 2) * CELL, v = (entry.v + fp.cd / 2) * CELL
      if (entry.wall === 'back') g.position.set(ox + u, y0 + v, oz + 0.04)
      if (entry.wall === 'left') { g.position.set(ox + 0.04, y0 + v, oz + u); g.rotation.y = Math.PI / 2 }
      if (entry.wall === 'right') { g.position.set(-ox - 0.04, y0 + v, oz + u); g.rotation.y = -Math.PI / 2 }
    } else {
      g.rotation.x = -Math.PI / 2
      g.position.set(ox + (entry.i + fp.cw / 2) * CELL, y0 + (entry.on ? TABLE_TOP : 0) + 0.04, oz + (entry.j + fp.cd / 2) * CELL)
    }
    return g
  }

  function clearGhost() {
    if (ghostObj) { root.remove(ghostObj); ghostObj = null }
    if (ghostPlane) { root.remove(ghostPlane); ghostPlane = null }
    ghostKey = ''
    if (hiddenObj) { hiddenObj.visible = true; hiddenObj = null }
  }

  function showGhost(entry, res) {
    const key = `${entry.id}|${entry.i}|${entry.j}|${entry.rot}|${entry.wall}|${entry.u}|${entry.v}|${entry.on}|${res.ok}`
    if (key === ghostKey) return
    ghostKey = key
    if (ghostObj) root.remove(ghostObj)
    if (ghostPlane) root.remove(ghostPlane)
    ghostObj = instantiate(area, entry, y0)
    ghostPlane = planeFor(entry, res.ok ? GOOD : BAD, res.ok ? 0.38 : 0.5)
    root.add(ghostObj, ghostPlane)
  }

  function updateSelPlane() {
    if (selPlane) { root.remove(selPlane); selPlane.geometry.dispose(); selPlane = null }
    const sel = st.selected ? entries().find(e => e.uid === st.selected) : null
    if (sel && !(st.drag && st.drag.started)) {
      selPlane = planeFor(sel, SEL, 0.3)
      root.add(selPlane)
    }
  }

  function showWallOverlays(on) {
    wallOverlays.forEach(w => { w.visible = on && st.grid })
  }

  function buildOverlays() {
    // floor grid
    if (floorOverlay) { root.remove(floorOverlay); floorOverlay.material.map.dispose(); floorOverlay = null }
    wallOverlays.forEach(w => { root.remove(w); w.material.map.dispose() })
    wallOverlays = []
    const w = area.cols * CELL, d = area.rows * CELL
    const floorTex = gridTexture(area, step(), area.fixtures.map(f => ({ ...f })), area.cols, area.rows, false)
    floorOverlay = new THREE.Mesh(new THREE.PlaneGeometry(w, d), overlayMat(floorTex))
    floorOverlay.rotation.x = -Math.PI / 2
    floorOverlay.position.set(ox + w / 2, y0 + 0.02, oz + d / 2)
    floorOverlay.renderOrder = 5
    floorOverlay.visible = st.grid
    root.add(floorOverlay)
    if (area.walls) {
      ['back', 'left', 'right'].forEach(wall => {
        const len = wallLen(wall)
        const rects = (area.wallFixtures[wall] || []).map(f => ({ x0: f.u0, x1: f.u1, z0: f.v0, z1: f.v1, label: f.label }))
        const tex = gridTexture(area, step(), rects, len, WALL_ROWS, true)
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len * CELL, WALL_ROWS * CELL), overlayMat(tex))
        // texture row 0 is the top of the canvas; our v counts up from the floor, so flip
        m.scale.y = -1
        m.renderOrder = 5
        m.visible = false
        if (wall === 'back') m.position.set(ox + (len * CELL) / 2, y0 + (WALL_ROWS * CELL) / 2, oz + 0.025)
        if (wall === 'left') { m.rotation.y = Math.PI / 2; m.position.set(ox + 0.025, y0 + (WALL_ROWS * CELL) / 2, oz + (len * CELL) / 2) }
        if (wall === 'right') { m.rotation.y = -Math.PI / 2; m.position.set(-ox - 0.025, y0 + (WALL_ROWS * CELL) / 2, oz + (len * CELL) / 2) }
        root.add(m)
        wallOverlays.push(m)
      })
    }
  }

  function wallMode() {
    const id = st.ghost?.entry.id || st.armedItem || (st.selected && entries().find(e => e.uid === st.selected)?.id)
    return !!id && infoOf(id).kind === 'wall'
  }
  function refreshOverlays() {
    if (floorOverlay) floorOverlay.visible = st.grid
    showWallOverlays(wallMode())
  }

  function screenOf(entry) {
    const cam = getCamera()
    const fp = footOf(entry)
    const info = infoOf(entry.id)
    let x, y, z
    if (info.kind === 'wall') {
      const u = (entry.u + fp.cw / 2) * CELL
      const v = (entry.v + fp.cd) * CELL
      if (entry.wall === 'back') { x = ox + u; z = oz }
      if (entry.wall === 'left') { x = ox; z = oz + u }
      if (entry.wall === 'right') { x = -ox; z = oz + u }
      y = y0 + v + 0.1
    } else {
      x = ox + (entry.i + fp.cw / 2) * CELL
      z = oz + (entry.j + fp.cd / 2) * CELL
      y = y0 + (entry.on ? TABLE_TOP : 0) + Math.min(info.size.h, 2.6) + 0.2
    }
    const v = new THREE.Vector3(x, y, z)
    worldRoot().localToWorld(v)
    v.project(cam)
    const r = canvas.getBoundingClientRect()
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height }
  }

  // ---------- changing the layout ----------
  function apply(list, label) {
    commit(st.areaId, list, label)
    house.furnish(st.areaId, list, { bakeIt: false })
    updateSelPlane()
    ctx.requestShadow?.()
    emit()
  }

  function childrenOf(uid, list = entries()) { return list.filter(e => e.on === uid) }

  function place(entry) {
    const e = { uid: newUid(), ...entry }
    apply([...entries(), e], 'Place')
    st.selected = e.uid
    updateSelPlane()
    ctx.sfx?.('place')
    emit()
    return e
  }

  /** move an existing entry (and carry what stands on it) */
  function moveTo(uid, next) {
    const list = entries()
    const old = list.find(e => e.uid === uid)
    const oldRect = rectAt(old.i ?? 0, old.j ?? 0, footOf(old))
    const turns = ((next.rot || 0) - (old.rot || 0) + 4) % 4
    const merged = { ...old, ...next }
    const newRect = infoOf(old.id).kind === 'wall' ? null : rectAt(merged.i, merged.j, footOf(merged))
    const out = list.map(e => {
      if (e.uid === uid) return merged
      if (e.on === uid && newRect) {
        const c = carryChild(e, footOf(e), footOf(e), oldRect, newRect, turns)
        return { ...e, ...c }
      }
      return e
    })
    apply(out, 'Move')
  }

  function removeUid(uid) {
    const list = entries().filter(e => e.uid !== uid && e.on !== uid)
    st.selected = null
    apply(list, 'Pick up')
    ctx.sfx?.('pick')
  }

  // ---------- pointer interaction ----------
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect()
    v2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, getCamera())
    const holder = st.areaId === 'garden' ? house.gardenPlaced : house.roomById(st.areaId).placed
    if (!holder) return null
    const hits = ray.intersectObjects(holder.children, true)
    for (const h of hits) {
      let o = h.object
      while (o && !o.userData.uid) o = o.parent
      if (o?.userData.uid) return { uid: o.userData.uid, obj: o }
    }
    return null
  }

  function setGhostFor(entry, ignore) {
    const res = validate(entry, ignore)
    st.ghost = { entry, valid: res.ok, reason: res.reason }
    showGhost(entry, res)
    refreshOverlays()
    emit()
  }

  function onDown(ev) {
    if (!st.active || ev.button > 0) return
    ev.preventDefault()
    ev.stopPropagation()
    canvas.setPointerCapture?.(ev.pointerId)
    if (st.armedItem) { // click-to-place after picking an item in the drawer
      placeArmed(ev)
      return
    }
    const hit = pickAt(ev)
    if (hit) {
      st.selected = hit.uid
      const e = entries().find(x => x.uid === hit.uid)
      st.drag = { uid: hit.uid, x: ev.clientX, y: ev.clientY, started: false, rot: e.rot || 0, obj: hit.obj }
      updateSelPlane()
      refreshOverlays()
    } else {
      st.selected = null
      updateSelPlane()
      refreshOverlays()
    }
    emit()
  }

  function onMove(ev) {
    if (!st.active) return
    if (st.armedItem) { hoverArmed(ev); return }
    const d = st.drag
    if (!d) return
    if (!d.started && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return
    if (!d.started) {
      d.started = true
      hiddenObj = d.obj
      d.obj.visible = false
      updateSelPlane()
    }
    const e = entries().find(x => x.uid === d.uid)
    const next = candidate(e.id, ev, d.rot, [d.uid, ...childrenOf(d.uid).map(c => c.uid)])
    if (!next) return
    setGhostFor({ ...e, ...next, uid: d.uid }, [d.uid, ...childrenOf(d.uid).map(c => c.uid)])
  }

  function onUp(ev) {
    if (!st.active) return
    const d = st.drag
    st.drag = null
    if (!d || !d.started) { if (d) emit(); return }
    const g = st.ghost
    const uid = d.uid
    clearGhost()
    st.ghost = null
    if (g && g.valid) {
      const { uid: _u, ...rest } = g.entry
      void _u
      moveTo(uid, rest)
      ctx.sfx?.('place')
    } else {
      if (g) onBlocked?.(g.reason)
      house.furnish(st.areaId, entries(), { bakeIt: false }) // put it back
      ctx.sfx?.('error')
    }
    updateSelPlane()
    refreshOverlays()
    emit()
    void ev
  }

  // ---------- the drawer: picking an item and dropping it ----------
  function hoverArmed(ev) {
    const ent = candidate(st.armedItem, ev, st.armedRot || 0)
    if (!ent) { clearGhost(); st.ghost = null; emit(); return }
    setGhostFor(ent, [])
  }
  function placeArmed(ev) {
    const ent = candidate(st.armedItem, ev, st.armedRot || 0)
    if (!ent) return
    const res = validate(ent)
    if (!res.ok) { onBlocked?.(res.reason); ctx.sfx?.('error'); return }
    clearGhost()
    st.ghost = null
    place(ent)
    st.armedItem = null
    refreshOverlays()
    emit()
  }

  const insideCanvas = ev => {
    const r = canvas.getBoundingClientRect()
    return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
  }

  function onKey(ev) {
    if (!st.active) return
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const k = ev.key.toLowerCase()
    if (k === 'r') { api.rotate(); ev.preventDefault() }
    else if (k === 'delete' || k === 'backspace') { api.pickUp(); ev.preventDefault() }
    else if (k === 'escape') { api.cancel() }
    else if (k.startsWith('arrow') && st.selected) {
      const sel = entries().find(e => e.uid === st.selected)
      const s = step()
      const dI = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0
      const dJ = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0
      if (infoOf(sel.id).kind === 'wall') { nudge(sel, { u: sel.u + dI, v: sel.v - dJ }) } else nudge(sel, { i: sel.i + dI, j: sel.j + dJ })
      ev.preventDefault()
    }
  }
  function nudge(sel, change) {
    const next = { ...sel, ...change }
    const res = validate(next, [sel.uid, ...childrenOf(sel.uid).map(c => c.uid)])
    if (!res.ok) { onBlocked?.(res.reason); ctx.sfx?.('error'); return }
    moveTo(sel.uid, change)
  }

  canvas.addEventListener('pointerdown', onDown, true)
  canvas.addEventListener('pointermove', onMove, true)
  canvas.addEventListener('pointerup', onUp, true)
  canvas.addEventListener('pointercancel', onUp, true)
  window.addEventListener('keydown', onKey)

  // ---------- public API ----------
  const api = {
    get active() { return st.active },
    get areaId() { return st.areaId },
    state: st,

    enter(areaId) {
      if (st.active) api.exit()
      st.areaId = areaId
      area = areaOf(areaId)
      st.active = true
      st.selected = null
      st.ghost = null
      st.armedItem = null
      if (areaId === 'garden') { root = house.group; y0 = -0.5; ox = area.origin.x; oz = area.origin.z } else { const r = house.roomById(areaId); root = r.sh.root; y0 = 0; ox = -HX; oz = -HZ }
      house.furnish(areaId, entries(), { bakeIt: false })
      buildOverlays()
      refreshOverlays()
      emit()
    },

    exit() {
      if (!st.active) return
      clearGhost()
      if (selPlane) { root.remove(selPlane); selPlane = null }
      if (floorOverlay) { root.remove(floorOverlay); floorOverlay = null }
      wallOverlays.forEach(w => root.remove(w))
      wallOverlays = []
      house.furnish(st.areaId, entries(), { bakeIt: true })
      ctx.requestShadow?.()
      st.active = false
      st.areaId = null
      st.selected = null
      st.ghost = null
      st.armedItem = null
      emit()
    },

    setSnap(name) { st.snapName = name; buildOverlays(); refreshOverlays(); emit() },
    setGrid(on) { st.grid = on; refreshOverlays(); emit() },

    /** the drawer picked an item: show it under the pointer until it is placed or cancelled */
    arm(itemId, rot = 0) { st.armedItem = itemId; st.armedRot = rot; st.selected = null; updateSelPlane(); refreshOverlays(); emit() },
    hover(ev) { if (st.armedItem && insideCanvas(ev)) hoverArmed(ev); else if (st.armedItem) { clearGhost(); st.ghost = null; emit() } },
    /** released over the canvas: place it (a drop). Returns true if the pointer was over the world. */
    drop(ev) {
      if (!st.armedItem) return false
      if (insideCanvas(ev)) { placeArmed(ev); return true }
      return false
    },
    cancel() {
      if (st.armedItem) { st.armedItem = null; clearGhost(); st.ghost = null }
      else if (st.selected) st.selected = null
      updateSelPlane()
      refreshOverlays()
      emit()
    },

    rotate() {
      if (st.armedItem) {
        st.armedRot = ((st.armedRot || 0) + 1) % 4
        if (st.ghost) { const e = { ...st.ghost.entry, rot: st.armedRot }; setGhostFor(e, []) }
        return
      }
      if (!st.selected) return
      const sel = entries().find(e => e.uid === st.selected)
      if (!sel || infoOf(sel.id).kind === 'wall') return
      const before = footOf(sel)
      const rot = ((sel.rot || 0) + 1) % 4
      const after = footOf({ ...sel, rot })
      // keep the centre where it was
      const i = Math.round(sel.i + before.cw / 2 - after.cw / 2)
      const j = Math.round(sel.j + before.cd / 2 - after.cd / 2)
      const clampedI = clamp(i, 0, area.cols - after.cw)
      const clampedJ = clamp(j, 0, area.rows - after.cd)
      const next = { ...sel, rot, i: clampedI, j: clampedJ }
      const res = validate(next, [sel.uid, ...childrenOf(sel.uid).map(c => c.uid)])
      if (!res.ok) { onBlocked?.(`Can't turn here: ${res.reason.toLowerCase()}`); ctx.sfx?.('error'); return }
      moveTo(sel.uid, { rot, i: clampedI, j: clampedJ })
      ctx.sfx?.('place')
    },
    pickUp() { if (st.selected) removeUid(st.selected) },
    /** place another copy of the selected item (if there is one left) */
    duplicate() { const sel = entries().find(e => e.uid === st.selected); if (sel) api.arm(sel.id, sel.rot || 0) },

    /** after an undo/redo/reset the store hands us a new list: redraw */
    refresh() {
      if (!st.active) return
      if (st.selected && !entries().find(e => e.uid === st.selected)) st.selected = null
      house.furnish(st.areaId, entries(), { bakeIt: false })
      updateSelPlane()
      ctx.requestShadow?.()
      emit()
    },

    /** called every frame: keeps the selection's toolbar glued to the item */
    frame() {
      if (!st.active || !st.selected) return
      const sel = entries().find(e => e.uid === st.selected)
      if (!sel) return
      const s = screenOf(sel)
      const last = st._last
      if (!last || Math.abs(last.x - s.x) > 1 || Math.abs(last.y - s.y) > 1) { st._last = s; emit() }
    },

    dispose() {
      canvas.removeEventListener('pointerdown', onDown, true)
      canvas.removeEventListener('pointermove', onMove, true)
      canvas.removeEventListener('pointerup', onUp, true)
      canvas.removeEventListener('pointercancel', onUp, true)
      window.removeEventListener('keydown', onKey)
    },
  }
  return api
}
