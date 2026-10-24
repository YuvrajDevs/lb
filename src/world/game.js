import * as THREE from 'three'
import { buildHouse, FH, COL } from './house.js'
import { createCube, FLOAT } from './cube.js'
import { HX, HZ } from './kit.js'
import { resolveDefaults, footOf, infoOf } from './furnish.js'
import { createEditor } from './editor.js'
import { makeEnvironment } from './env.js'
import { buildScenery, applyPalette, setStreet, FOG_COLOR, FOG_NEAR, FOG_FAR, CLIFF_Z } from './scenery.js'
import { bake } from './bake.js'
import { setCurtain } from './switches.js'
import { buildNeighbours, neighbourSpan, neighbourPlots, streetPlots, NEIGHBOUR_PLOT_Z } from './neighbours.js'
import { createPeers } from './peers.js'
import { setSeaNear } from '../game/audio.js'
import { findZFighting, settleCoplanar } from './zfight.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { areaList, areaOf, getHomeKind, plot, PLAYGROUND } from '../game/areas.js'
import { CELL, TABLE_TOP, overlap, floorRect } from '../game/grid.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.6
const TURN = 2.2 // rad/s in eyes view
const DEFAULT_EL = 0.05
const CLOSE_EL = 0.2
const CLOSE_DIST = 6.5
const STREET_AZ = 0.14
const STREET_EL = 0.2 // from out over the sea, looking up the cliff at the house
const TITLE_AZ = -1.15, TITLE_EL = 0.08 // the title screen's camera: low along the cliff top, the sea to the right
const FOV = 35
const DOOR_Z = 1.9 // every doorway between side-by-side rooms sits here
const PLOT_FRONT = 3.6 + 0.3 + 5.2 // where the garden's front fence (and its gate) runs
const STAIR_LANE = 0.5 // how far off the middle of the staircase you can still step onto it
const STEP_UP = 0.6 // the biggest height change one step can make
const LOOK = 0.0024 // mouse look, radians per pixel
const EYE = 0.95 // first-person eye height above the cube's underside: about eye level with the windows

const OUT = { // outward wall normals
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  front: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
}
const OFFSET = { back: HZ, left: HX, front: HZ, right: HX }

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const levelOf = y => (y > FH * 0.5 ? 1 : 0)

export function createGame(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  let maxPR = Math.min(window.devicePixelRatio, 2)
  let pr = maxPR
  // adaptive resolution never drops below the screen's own pixels (on a sharp screen, not below 1.5x): that is what looked blurry
  const MIN_PR = Math.max(1, window.devicePixelRatio >= 2 ? 1.25 : window.devicePixelRatio)
  let minPR = Math.min(maxPR, MIN_PR)
  renderer.setPixelRatio(pr)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false // the moon only lights static geometry: render its shadows once
  let shadowFrames = 3
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // a soft blue night backdrop (the bloom pass needs an opaque background to blend with)
  {
    const c = document.createElement('canvas')
    c.width = 4; c.height = 256
    const g = c.getContext('2d')
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#05071b'); gr.addColorStop(0.55, '#10164a'); gr.addColorStop(1, '#2a2a72')
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    scene.background = t
  }
  // the layout of every room: the player's saved one, or the standard furnishing for a new home
  const layout = opts.layout ? { ...opts.layout } : Object.fromEntries(areaList().map(id => [id, resolveDefaults(id)]))
  // a saved home that has never had this kind of house (a couple moving to their starter home, or back) gets its
  // standard furnishing for the rooms it is missing
  const missing = opts.layout ? areaList().filter(id => !layout[id]) : []
  missing.forEach(id => { layout[id] = resolveDefaults(id); opts.onLayoutFix?.(id, layout[id]) })
  // repairs for saved homes (and, for pictures, the standard furnishing too):
  // - furniture standing where the rules now say nothing may go (doorways, the path) is taken out, with anything on it
  // - wall pieces over a window (windows grew) or a doorway are taken down
  // - pictures are hung at eye level once (they used to hang far too high), or just above the furniture under them
  areaList().forEach(id => {
    const area = areaOf(id)
    const list = layout[id] || []
    const blockedFloor = e => !e.wall && !e.on && infoOf(e.id).kind === 'floor' &&
      area.fixtures.some(f => f.blocks.includes('floor') && overlap(floorRect(e, footOf(e)), f))
    const wallRectOf = e => { const fp = footOf(e); return { x0: e.u, x1: e.u + fp.cw, z0: e.v, z1: e.v + fp.cd } }
    const blockedWall = e => {
      if (!e.wall) return false
      const sub = infoOf(e.id).sub
      return (area.wallFixtures?.[e.wall] || []).some(f => f.blocks.includes(sub) && overlap(wallRectOf(e), { x0: f.u0, x1: f.u1, z0: f.v0, z1: f.v1 }))
    }
    // the top (in cells) of the tallest floor piece standing against `wall` under the cells [u0, u1)
    const furnitureTop = (wall, u0, u1) => {
      let top = 0
      list.forEach(o => {
        if (o.wall || infoOf(o.id).kind !== 'floor') return
        const fp = footOf(o)
        const along = wall === 'back' ? [o.i, o.i + fp.cw] : [o.j, o.j + fp.cd]
        const gap = wall === 'back' ? o.j : wall === 'left' ? o.i : area.cols - (o.i + fp.cw)
        if (gap > 10 || along[1] <= u0 || along[0] >= u1) return
        top = Math.max(top, Math.ceil((infoOf(o.id).size.h + (o.on ? TABLE_TOP : 0)) / CELL))
      })
      return top
    }
    let changed = false
    const placed = list.map(e => {
      if (!opts.lowerArt || !e.wall || infoOf(e.id).sub !== 'art') return e
      const r = wallRectOf(e)
      const w = r.x1 - r.x0, h = r.z1 - r.z0
      const eye = Math.max(13, Math.round((2.3 - (h * CELL) / 2) / CELL))
      const lenOf = wall => (wall === 'back' ? area.cols : area.rows)
      const fits = next => next.u >= 0 && next.u + w <= lenOf(next.wall) && next.v + h <= 46 && !blockedWall(next) &&
        !list.some(o => o !== e && o.wall === next.wall && o.wall && infoOf(o.id).kind === 'wall' && overlap(wallRectOf(next), wallRectOf(o)))
      // eye level where it hangs, or the nearest spot clear of tall furniture: first along the same wall, then the others
      let next = null
      for (const wall of [e.wall, ...['back', 'left', 'right'].filter(k => k !== e.wall)]) {
        const from = wall === e.wall ? e.u : Math.round((lenOf(wall) - w) / 2)
        for (let d = 0; d <= lenOf(wall) && !next; d += 3) {
          for (const u of d ? [from - d, from + d] : [from]) {
            const cand = { ...e, wall, u, v: eye }
            if (furnitureTop(wall, u, u + w) < eye - 1 && fits(cand)) { next = cand; break }
          }
        }
        if (next) break
      }
      // nowhere clear: just above the furniture beneath it
      if (!next) next = { ...e, v: Math.max(eye, furnitureTop(e.wall, r.x0, r.x1) + 2) }
      if (Math.abs(next.v - e.v) < 3 && next.u === e.u && next.wall === e.wall) return e
      if (!fits(next)) return e
      changed = true
      return next
    })
    const bad = new Set(opts.layout ? placed.filter(e => blockedFloor(e) || blockedWall(e)).map(e => e.uid) : [])
    if (!bad.size && !changed) return
    layout[id] = placed.filter(e => !bad.has(e.uid) && !bad.has(e.on))
    if (opts.layout) opts.onLayoutFix?.(id, layout[id])
  })
  if (!opts.layout) opts.onLayoutInit?.(layout)
  // the street: every home in the world, yours included (opts.neighbours lists them all, yours marked `you`)
  const street = opts.neighbours || []
  const walkSpan = neighbourSpan(street, plot().x) // how far the street reaches either side
  setStreet(walkSpan[0], walkSpan[1]) // (the stream runs past its left end; the land is level along it)
  const house = buildHouse({ layout, style: opts.style, fence: opts.fence, sign: opts.sign, switches: opts.switches, walk: walkSpan, plots: neighbourPlots(street, plot().x) })
  scene.add(house.group, house.lights)
  // the cliff, the sea in front and the magical land behind
  // the time of day: 'night', 'evening', or 'auto' (evening from 5 to 8 pm on your own clock, night otherwise)
  const resolveTime = t => (t === 'auto' ? ((h => (h >= 17 && h < 20 ? 'evening' : 'night'))(new Date().getHours())) : t || 'night')
  let timeSetting = opts.time || 'night'
  let timeNow = resolveTime(timeSetting)
  const scenery = buildScenery(timeNow)
  bake(scenery.statics)
  scene.add(scenery.group)
  // two homes merging into one: a big cloud covers the plot, the house rises out of it, then the cloud drifts away
  const merge = opts.intro === 'merge' ? { t: 0, puffs: [] } : null
  if (merge) {
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128
      const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, r = 4 + Math.random() * 11
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: i % 3 ? '#f4eefc' : '#e2d8f6', transparent: true, depthWrite: false, opacity: 0.95 }))
      const size = 7 + Math.random() * 7
      s.scale.set(size, size * 0.8, 1)
      s.position.set(Math.cos(a) * r, 1 + Math.random() * 9, Math.sin(a) * r * 0.6 + 1)
      s.userData.drift = new THREE.Vector3(Math.cos(a), 0.4 + Math.random() * 0.4, Math.sin(a)).multiplyScalar(2 + Math.random() * 2)
      scene.add(s)
      merge.puffs.push(s)
    }
    house.group.position.y = -12
  }

  // the other homes in your world, along the cliff either side (simple versions, so they cost little)
  const neighbours = buildNeighbours(street, plot().x)
  scene.add(neighbours)
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR) // the island sits in a thick bank of fog (see scenery.js)
  const { rooms, colliders, stairs: S } = house
  const houseCenter = new THREE.Vector3(0, (house.bounds.yMin + house.bounds.yMax) / 2, 0)
  const houseHalfH = (house.bounds.yMax - house.bounds.yMin) / 2

  let composer = null // the glow / grade pipeline, created below (resize() runs before it exists)

  // ---- cameras ----
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 1200) // a near plane this far out keeps depth precise: no flicker on distant surfaces
  const eyeCam = new THREE.PerspectiveCamera(76, 1, 0.1, 1200)
  let active = camera
  const camTarget = new THREE.Vector3().copy(rooms[0].center)
  const view = {
    mode: 'room', az: 0, azGoal: 0, el: DEFAULT_EL, elGoal: DEFAULT_EL,
    dist: 16, pitch: 0, mul: { room: 1, close: 1, street: 1, edit: 1 }, override: null, editArea: null, inset: 0,
  }
  let roomDist = 16
  let houseDist = 30
  let mulMax = 1.9
  let lastReported = ''

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return // hidden (a minimised window or a closed pane): keep the last good size, never divide by 0
    const aspect = w / h
    const t = Math.tan((FOV * Math.PI) / 360)
    roomDist = Math.max(2.95 / 0.9 / t, (HX + 0.5) / 0.95 / (t * aspect)) + HZ + 0.3
    houseDist = Math.max(houseHalfH / 0.88 / t, house.bounds.halfW / 0.95 / (t * aspect)) + HZ + 1.2
    mulMax = houseDist / roomDist
    camera.aspect = aspect
    eyeCam.aspect = aspect
    camera.updateProjectionMatrix()
    eyeCam.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer?.setPixelRatio(pr)
    composer?.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  view.dist = roomDist

  // ---- the look: glow around lit windows and lamps, a soft vignette and cooler shadows ----
  const GRADE = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb += vec3(0.002, 0.006, 0.02) * (1.0 - smoothstep(0.0, 0.5, l)); // shadows lean blue
        float d = distance(vUv, vec2(0.5));
        c.rgb *= 1.0 - smoothstep(0.38, 0.95, d) * 0.45;                     // vignette
        gl_FragColor = c;
      }`,
  }
  let bloomOn = true
  scene.environment = makeEnvironment(renderer, timeNow)
  scene.environmentIntensity = 0.3
  // the glow pipeline renders off-screen, where the canvas's own antialiasing doesn't apply: give it 4x MSAA
  // and half-float colour so edges stay crisp and the dark gradients don't band
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
  composer.setPixelRatio(pr)
  composer.setSize(container.clientWidth, container.clientHeight)
  const renderPass = new RenderPass(scene, camera)
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.4, 1.4)
  composer.addPass(renderPass)
  composer.addPass(bloom)
  composer.addPass(new ShaderPass(GRADE))
  composer.addPass(new OutputPass())

  // ---- people ----
  function makeActor(color, room, lx, lz) {
    const cube = createCube(color)
    const pos = new THREE.Vector3(room.ox + lx, room.oy, lz)
    cube.group.position.copy(pos)
    scene.add(cube.group)
    return { cube, pos, path: [], yaw: 0, moving: false }
  }
  const byId = id => rooms.find(r => r.id === id)
  const solo = getHomeKind() === 'solo'
  const me = makeActor('#ff8fb8', byId('study') || rooms[0], 1.2, 1.6)
  const partner = makeActor('#9ad0ff', byId('bedroom') || rooms[0], 1.8, 0.4)
  // the stand-in partner who wanders about the couple house; online, your real partner comes instead (a peer)
  const noPartner = solo || opts.partnerAI === false
  if (noPartner) partner.cube.setVisible(false)

  // ---- the other people in your world, live (see peers.js and net/live.js) ----
  // Positions travel relative to the nearest home on the street (its plot id), so the same spot maps to the
  // same place on every screen, whoever's home sits in the middle there. The playground is shared: everyone's
  // playground is the one behind the home in the middle of their own screen.
  const peers = createPeers(scene)
  peers.attachMe(me.cube)
  const plotX = new Map(streetPlots(street, plot().x).map(p => [p.member.id ?? 'me', p.x]))
  const inPlayground = (x, z) => z < PLAYGROUND.zNear - 0.6 && Math.abs(x) < PLAYGROUND.x + 1
  function encode(a) {
    const { x, y, z } = a.pos
    if (inPlayground(x, z)) return { r: 'pg', x, y, z }
    let best = null, bx = 0
    plotX.forEach((px, id) => { if (best === null || Math.abs(x - px) < Math.abs(x - bx)) { best = id; bx = px } })
    return { r: best, x: x - bx, y, z }
  }
  function decode(m) {
    if (m.r === 'pg') return [m.x, m.y, m.z]
    const px = plotX.get(m.r)
    return px == null ? null : [px + m.x, m.y, m.z]
  }
  let sentAt = 0, sent = null
  // standing at another home's front gate (to visit it, or, while visiting, to go home): its plot id
  const gates = streetPlots(street, plot().x).filter(p => !p.member.you).map(p => ({ id: p.member.id, x: p.x }))
  let atGate = null
  // arriving somewhere you are visiting: you start outside its garden gate, facing the house
  if (opts.spawn === 'gate') { me.pos.set(0, 0, PLOT_FRONT + 1.6); me.yaw = Math.PI }

  // the room someone is in (or nearest to, out in the garden) on their storey
  const roomAt = a => {
    const lvl = levelOf(a.pos.y)
    const same = rooms.filter(r => r.level === lvl)
    return (same.length ? same : rooms).reduce((b, r) => (Math.abs(r.ox - a.pos.x) < Math.abs(b.ox - a.pos.x) ? r : b))
  }

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 28),
    new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 })
  )
  marker.rotation.x = -Math.PI / 2
  scene.add(marker)
  let markerLife = 0

  // ---- view control ----
  const stairPrompt = () => {
    if (!S) return null
    if (onStair(me.pos.x, me.pos.z)) return null
    if (levelOf(me.pos.y) === 0 && Math.hypot(me.pos.x - S.x, me.pos.z - S.footZ) < 1.5) return 'up'
    if (levelOf(me.pos.y) === 1 && Math.hypot(me.pos.x - S.x, me.pos.z - S.landingZ) < 1.5) return 'down'
    return null
  }
  const shownMode = () => (view.mode === 'room' && view.mul.room > mulMax * 0.9 ? 'house' : view.mode === 'street' && view.focusZ != null ? 'playground' : view.mode)
  const editing = () => view.mode === 'edit'
  const closedIn = () => view.mode === 'eyes' || view.mode === 'street' || view.mode === 'title' || (editing() && view.editArea === 'garden') // outside or first person: the house is closed, no cutaway

  function report() {
    const info = { mode: shownMode(), az: view.az, room: roomAt(me).name, stairs: stairPrompt() }
    const key = `${info.mode}|${Math.round(info.az * 57.3)}|${info.room}|${info.stairs}`
    if (key === lastReported) return
    lastReported = key
    opts.onView?.(info)
  }

  function setView(name) {
    // the playground: the street camera, looking over the back garden at the playground behind the house
    if (name === 'playground') {
      setView('street')
      view.azGoal = 0
      view.elGoal = 0.85 // high enough to look over the roof
      view.focusZ = (PLAYGROUND.zNear + PLAYGROUND.zFar) / 2 - 3.5
      report()
      return
    }
    // the title screen: a slow cinematic drift past the house from out over the sea, the house on the left
    // (the menu sits on the right); leaving it, the camera flies in from there to wherever you go next
    if (name === 'title') {
      view.mode = 'title'
      neighbours.visible = false // just your home against the night for the title shot
      view.override = null
      view.focusX = 0; view.focusZ = null
      me.path = []
      active = camera
      me.cube.setVisible(true)
      report()
      return
    }
    const eyes = name === 'eyes'
    const wasStreet = view.mode === 'street' || view.mode === 'title'
    neighbours.visible = true
    view.override = null
    if (name === 'house') { view.mode = 'room'; view.mul.room = mulMax; view.elGoal = DEFAULT_EL }
    else if (name === 'room') { view.mode = 'room'; view.mul.room = 1; view.elGoal = DEFAULT_EL }
    else if (name === 'close') { view.mode = 'close'; view.elGoal = CLOSE_EL }
    else if (name === 'street') { view.mode = 'street'; view.mul.street = 1; view.azGoal = STREET_AZ; view.elGoal = STREET_EL }
    else if (eyes) view.mode = 'eyes'
    else return
    if (wasStreet && name !== 'street') { view.azGoal = 0 }
    view.focusX = 0
    view.focusZ = null
    me.path = []
    active = eyes ? eyeCam : camera
    me.cube.setVisible(!eyes)
    report()
  }

  function setAzimuth(rad, instant = false) {
    view.azGoal = wrap(rad)
    if (instant) view.az = view.azGoal
    report()
  }

  // ---- input ----
  const keys = new Set()
  let inputOn = true
  let idle = false
  let paused = false
  const typingNow = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  const onKeyDown = e => {
    if (!inputOn || typingNow()) return
    keys.add(e.key.toLowerCase())
    if (e.key === ' ') e.preventDefault() // Space is held to run (see the movement below); don't scroll the page
  }
  const onKeyUp = e => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  const ray = new THREE.Raycaster()
  const hit = new THREE.Vector3()
  const el = renderer.domElement
  let drag = null

  // straight-line route inside a room, or through the doorway between side-by-side rooms
  function routeTo(a, dest) {
    if (rooms.length === 1) return [dest]
    const from = roomAt(a)
    const toCol = dest.x > 0 ? 1 : 0
    if (toCol === from.col) return [dest]
    const dir = toCol > from.col ? 1 : -1
    return [
      new THREE.Vector3(-dir * 1.6, a.pos.y, DOOR_Z),
      new THREE.Vector3(dir * 1.6, a.pos.y, DOOR_Z),
      dest,
    ]
  }

  // ---- pathfinding: a shortest walk around walls, furniture and fences, on a 25 cm grid of one storey ----
  const GRID = 0.25
  function findPath(fromV, toV, level) {
    const P = plot()
    const minX = Math.min(-P.x, walkSpan[0], -PLAYGROUND.x) - 3, maxX = Math.max(P.x, walkSpan[1], PLAYGROUND.x) + 3, minZ = level === 0 ? PLAYGROUND.zFar - 1 : -HZ - 1, maxZ = level === 0 ? CLIFF_Z : HZ + 2
    const nx = Math.ceil((maxX - minX) / GRID), nz = Math.ceil((maxZ - minZ) / GRID)
    const idx = (i, j) => j * nx + i
    const cx = x => Math.round((x - minX) / GRID), cz = z => Math.round((z - minZ) / GRID)
    const wx = i => minX + i * GRID, wz = j => minZ + j * GRID
    const free = new Map()
    const ok = (i, j) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return false
      const k = idx(i, j)
      if (!free.has(k)) free.set(k, !blocked(wx(i), wz(j), level) && !onStair(wx(i), wz(j)))
      return free.get(k)
    }
    const si = cx(fromV.x), sj = cz(fromV.z)
    let ti = cx(toV.x), tj = cz(toV.z)
    // if the goal itself is taken (clicked on a sofa), aim for the nearest free spot next to it
    if (!ok(ti, tj)) {
      let best = null
      for (let r = 1; r < 12 && !best; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) if (!best && ok(ti + di, tj + dj)) best = [ti + di, tj + dj]
      if (!best) return null
      ;[ti, tj] = best
    }
    // A* with diagonal steps
    const open = [[0, si, sj]], g = new Map([[idx(si, sj), 0]]), came = new Map()
    const h = (i, j) => Math.hypot(i - ti, j - tj)
    let found = false, guard = 0
    while (open.length && guard++ < 40000) {
      let bi = 0
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k
      const [, i, j] = open.splice(bi, 1)[0]
      if (i === ti && j === tj) { found = true; break }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nj = j + dj
        if (!ok(ni, nj) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue
        const cost = g.get(idx(i, j)) + (di && dj ? 1.414 : 1)
        const k = idx(ni, nj)
        if (cost < (g.get(k) ?? Infinity)) { g.set(k, cost); came.set(k, idx(i, j)); open.push([cost + h(ni, nj), ni, nj]) }
      }
    }
    if (!found) return null
    // walk back, then keep only the corners (drop points you can see past)
    const cells = []
    for (let k = idx(ti, tj); k !== undefined; k = came.get(k)) cells.push([k % nx, Math.floor(k / nx)])
    cells.reverse()
    // (a straight line is only taken if every point along it, every 8 cm, is clear: rounding to the grid could
    //  otherwise shave a fence post's corner and leave you pushing against it)
    const clear = (a, b) => {
      const x0 = wx(a[0]), z0 = wz(a[1]), x1 = wx(b[0]), z1 = wz(b[1])
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.08)
      for (let t = 1; t < n; t++) {
        const x = x0 + (x1 - x0) * t / n, z = z0 + (z1 - z0) * t / n
        if (blocked(x, z, level) || onStair(x, z)) return false
      }
      return true
    }
    const pts = [cells[0]]
    for (let k = 2; k < cells.length; k++) if (!clear(pts[pts.length - 1], cells[k])) pts.push(cells[k - 1])
    pts.push(cells[cells.length - 1])
    return pts.slice(1).map(([i, j]) => new THREE.Vector3(wx(i), fromV.y, wz(j)))
  }

  // a walk on the ground floor between the house, the garden and the cliff walk: through the front door and the
  // garden gate as needed (zones: 0 inside, 1 garden, 2 outside the fence)
  function groundRoute(a, dest) {
    const zoneOf = z => (z < HZ + 0.3 ? 0 : z < PLOT_FRONT ? 1 : 2)
    const y = a.pos.y
    const door = house.door
    const inDoor = new THREE.Vector3(door.x, y, HZ - 0.9), outDoor = new THREE.Vector3(door.x, y, HZ + 1.4)
    const gateIn = new THREE.Vector3(0, y, PLOT_FRONT - 1.0), gateOut = new THREE.Vector3(0, y, PLOT_FRONT + 1.0)
    const from = zoneOf(a.pos.z), to = zoneOf(dest.z)
    if (from === to) return from === 0 ? routeTo(a, dest) : [dest]
    const path = []
    if (from === 0) path.push(...routeTo(a, inDoor), outDoor) // out of the front door
    if (from === 2) path.push(gateOut, gateIn) // in through the gate
    if (to === 2 && from !== 2) path.push(gateIn, gateOut) // out through the gate
    if (to === 0) return [...path, outDoor, inDoor, ...routeTo({ pos: inDoor }, dest)] // in at the front door
    return [...path, dest]
  }

  function clickMove(e) {
    const r = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -me.pos.y)
    if (!ray.ray.intersectPlane(plane, hit)) return
    // on the ground floor you can click out in the garden or on the cliff walk too
    const ground = levelOf(me.pos.y) === 0
    const houseHalf = solo ? HX + 0.3 : COL
    const outsideClick = ground && (hit.z > HZ + 0.6 || hit.z < -HZ - 0.6 || Math.abs(hit.x) > houseHalf)
    // outside: as far as that part of the world reaches (the cliff walk, the garden, or the playground)
    // (anywhere on the open ground: the path finder goes round whatever is in the way)
    const span = [Math.min(walkSpan[0] - 2, -PLAYGROUND.x - 1), Math.max(walkSpan[1] + 2, PLAYGROUND.x + 1)]
    const dest = outsideClick
      ? new THREE.Vector3(THREE.MathUtils.clamp(hit.x, span[0] + 0.6, span[1] - 0.6), me.pos.y, THREE.MathUtils.clamp(hit.z, PLAYGROUND.zFar + 0.8, CLIFF_Z - 1.4))
      : new THREE.Vector3(
        THREE.MathUtils.clamp(hit.x, (solo ? -HX : -COL) + 0.6, (solo ? HX : COL) - 0.6),
        me.pos.y,
        THREE.MathUtils.clamp(hit.z, -HZ + HALF, HZ - HALF)
      )
    me.path = findPath(me.pos, dest, levelOf(me.pos.y)) || (ground ? groundRoute(me, dest) : routeTo(me, dest))
    marker.position.set(dest.x, me.pos.y + 0.03, dest.z)
    markerLife = 1
  }

  el.addEventListener('pointerdown', e => {
    if (editing()) return
    drag = { x: e.clientX, y: e.clientY, moved: false }
    el.setPointerCapture(e.pointerId)
  })
  el.addEventListener('pointermove', e => {
    if (editing() || !drag) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true
    drag.x = e.clientX; drag.y = e.clientY
    if (view.mode === 'eyes') {
      // first person works like the other views: hold anywhere and drag to turn and look up or down
      me.yaw -= dx * LOOK * 2 // drag right, turn right
      view.pitch = THREE.MathUtils.clamp(view.pitch + dy * LOOK * 1.7, -1.1, 1.1)
    } else {
      view.az = wrap(view.az - dx * 0.008)
      view.azGoal = view.az
      view.elGoal = THREE.MathUtils.clamp(view.elGoal + dy * 0.004, view.mode === 'street' ? -0.1 : 0.0, 1.3)
      view.el = view.elGoal
    }
  })
  const endDrag = e => {
    if (editing()) { drag = null; return }
    // a plain click uses a lamp or curtain if there is one under the pointer; otherwise it walks there
    // (outside views keep the house closed, but from the playground view you can still walk around the playground)
    if (drag && !drag.moved && e.type === 'pointerup' && !interactAt(e) && !stationAt(e) && (!closedIn() || shownMode() === 'playground')) clickMove(e)
    drag = null
  }

  // ---- the playground's game stations: click one to walk up to it; standing at it starts its game ----
  let pendingStation = null
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5)
  function stationAt(e) {
    const r = el.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), active)
    // the glowing ring, the floating gem or the board above it, or the ground right around the pad
    const stations = house.playground.stations
    const hit = house.playground.group.visible && ray.intersectObjects(stations.flatMap(s => s.hits), false)[0]
    const p = new THREE.Vector3()
    const st = hit ? stations.find(s => s.hits.includes(hit.object))
      : ray.ray.intersectPlane(groundPlane, p) && stations.find(s => Math.hypot(s.x - p.x, s.z - p.z) < 1.6)
    if (!st) return false
    opts.onSfx?.('click')
    if (nearStation(st)) { opts.onStation?.(st.id); return true }
    if (levelOf(me.pos.y) !== 0) { opts.onNotice?.('Head downstairs and out of the back gate to reach the playground'); return true }
    // walk up to the front of its pad, then start it on arrival
    const spot = new THREE.Vector3(st.x, me.pos.y, st.z + 1.9)
    me.path = findPath(me.pos, spot, 0) || groundRoute(me, spot)
    marker.position.set(spot.x, me.pos.y + 0.03, spot.z)
    markerLife = 1
    pendingStation = st
    return true
  }
  const nearStation = st => levelOf(me.pos.y) === 0 && Math.hypot(st.x - me.pos.x, st.z - me.pos.z) < 2.8

  // ---- things you can click: lamps switch off and on, curtains open and close ----
  let switches = { ...(opts.switches || {}) }
  house.setSwitches(switches)
  const curtainAnims = new Map() // obj -> goal openness
  const tmpV = new THREE.Vector3()
  const usable = () => [...rooms.map(r => r.placed), house.gardenPlaced]
  /** what interactive thing (if any) is under the pointer: the first solid surface hit decides */
  function pick(e) {
    const r = el.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), active)
    ray.camera = active
    for (const h of ray.intersectObjects(usable(), true)) {
      if (!h.object.visible) continue
      let o = h.object
      while (o && !o.userData.interactive && !o.userData.uid) o = o.parent
      // a glow or light pool only counts when it belongs to something clickable (a lamp's halo); otherwise look past it
      const airy = h.object.isSprite || h.object.material?.blending === THREE.AdditiveBlending
      if (airy && !o?.userData.interactive) continue
      // only the bright middle of a lamp's halo counts, so its soft edge doesn't steal clicks meant for things nearby
      if (h.object.isSprite && h.point.distanceTo(h.object.getWorldPosition(tmpV)) > h.object.scale.x * 0.16) continue
      if (airy && !h.object.isSprite) continue
      return o?.userData.interactive ? o : null
    }
    return null
  }
  const areaOfObj = o => {
    for (let a = o; a; a = a.parent) {
      if (a === house.gardenPlaced) return 'garden'
      const r = rooms.find(rr => rr.placed === a)
      if (r) return r.id
    }
    return null
  }
  function interactAt(e) {
    const o = pick(e)
    if (!o) return false
    const uid = o.userData.uid
    const cur = switches[uid] || {}
    if (o.userData.interactive === 'curtain') {
      const closed = !cur.closed
      switches = { ...switches, [uid]: { ...cur, closed } }
      curtainAnims.set(o, closed ? 0 : 1)
      opts.onSfx?.('curtain')
    } else {
      switches = { ...switches, [uid]: { ...cur, off: !cur.off } }
      const id = areaOfObj(o)
      house.setSwitches(switches)
      if (id) house.furnish(id, layout[id], { bakeIt: true })
      shadowFrames = 3
      opts.onSfx?.('switch')
    }
    house.setSwitches(switches)
    opts.onSwitch?.(uid, switches[uid])
    return true
  }
  // the pointer turns into a hand over things you can use
  let hoverAt = 0
  el.addEventListener('pointermove', e => {
    if (editing() || drag?.moved || e.pointerType !== 'mouse') return
    const now = performance.now()
    if (now - hoverAt < 90) return
    hoverAt = now
    el.style.cursor = pick(e) ? 'pointer' : ''
  })
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  // zooming: keep scrolling in past the closest view and you drop into your cube's eyes; scroll out to come back
  let pushIn = 0
  el.addEventListener('wheel', e => {
    e.preventDefault()
    if (Math.abs(e.deltaY) < 1) return
    const zoomIn = e.deltaY < 0
    if (view.mode === 'eyes') {
      if (!zoomIn) { view.mul.close = 0.4; setView('close') }
      return
    }
    const [lo, hi] = view.mode === 'room' ? [0.4, mulMax] : view.mode === 'street' ? [0.3, 1.4] : view.mode === 'edit' ? [0.5, 1.6] : [0.4, 2]
    const at = view.mul[view.mode]
    // at either end of a view's zoom, a couple more notches hand over to the next view:
    // out: close-up -> room -> whole house (the room view zoomed right out) -> street; in: the same way back, then your eyes
    const atEnd = zoomIn ? at <= lo + 1e-3 : at >= hi - 1e-3
    if (atEnd && view.mode !== 'edit') {
      if (zoomIn !== (pushIn > 0)) pushIn = 0
      pushIn += zoomIn ? 1 : -1
      if (Math.abs(pushIn) < 3) return
      pushIn = 0
      if (zoomIn) {
        if (view.mode === 'street') { setView('house') }
        else if (view.mode === 'room') { setView('close'); view.mul.close = 2 }
        else if (view.mode === 'close') {
          me.yaw = view.az + Math.PI // look the way the camera was looking
          view.pitch = 0.05
          setView('eyes')
        }
      } else {
        if (view.mode === 'close') { setView('room'); view.mul.room = 0.6 }
        else if (view.mode === 'room') setView('street')
      }
      return
    }
    pushIn = 0
    view.mul[view.mode] = THREE.MathUtils.clamp(at * (zoomIn ? 0.9 : 1.1), lo, hi)
  }, { passive: false })

  // ---- movement ----
  // furniture the player has placed indoors blocks walking too (rugs, lights, and things on tables do not)
  const furnitureBlocks = [[], []]
  function rebuildBlocks() {
    furnitureBlocks[0] = []; furnitureBlocks[1] = []
    rooms.forEach(r => {
      (layout[r.id] || []).forEach(e => {
        if (e.on || e.wall) return
        const info = infoOf(e.id)
        if (info.kind !== 'floor') return
        const fp = footOf(e)
        furnitureBlocks[r.level].push({ minX: r.ox - 5.4 + e.i * CELL, maxX: r.ox - 5.4 + (e.i + fp.cw) * CELL, minZ: -3.6 + e.j * CELL, maxZ: -3.6 + (e.j + fp.cd) * CELL })
      })
    })
    // (things in the garden don't block: you float over them)
  }
  const hits = (list, x, z, skipStair = false) => list.some(c => !(skipStair && c.stair) && x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF)
  // standing in line with the staircase: its side colliders step aside so you can walk onto it from either end
  const inStairColumn = x => !!S && Math.abs(x - S.x) < STAIR_LANE
  const onStair = (x, z) => inStairColumn(x) && z >= S.topZ && z <= S.startZ
  function blocked(x, z, level) {
    return hits(colliders[level], x, z, inStairColumn(x)) || hits(furnitureBlocks[level], x, z)
  }
  /** the height someone at (x, z) would stand at, coming from height y; null if they can't step there */
  function standY(x, z, y) {
    if (onStair(x, z)) {
      const sy = stairY(z)
      return Math.abs(sy - y) < STEP_UP ? sy : null
    }
    const lvl = levelOf(y)
    const floor = lvl * FH
    if (Math.abs(floor - y) > STEP_UP) return null // no stepping off the side halfway up
    return blocked(x, z, lvl) ? null : floor
  }
  /** if furniture was just placed on top of someone, step them to the nearest free spot */
  function unstick(a) {
    const lvl = levelOf(a.pos.y)
    if (onStair(a.pos.x, a.pos.z) || !blocked(a.pos.x, a.pos.z, lvl)) return
    for (let r = 0.2; r < 4; r += 0.2) {
      for (let k = 0; k < 16; k++) {
        const x = a.pos.x + Math.cos((k / 16) * 6.283) * r, z = a.pos.z + Math.sin((k / 16) * 6.283) * r
        if (!blocked(x, z, lvl)) { a.pos.x = x; a.pos.z = z; return }
      }
    }
  }
  rebuildBlocks()
  function walk(a, dir, dt, speed, turnToward = true) {
    let moved = false
    if (onStair(a.pos.x, a.pos.z)) speed *= 0.6 // the steps are steep: climb at a calmer pace
    const dx = dir.x * speed * dt, dz = dir.z * speed * dt
    let y = dx && standY(a.pos.x + dx, a.pos.z, a.pos.y)
    if (dx && y !== null) { a.pos.x += dx; a.pos.y = y; moved = true }
    y = dz && standY(a.pos.x, a.pos.z + dz, a.pos.y)
    if (dz && y !== null) { a.pos.z += dz; a.pos.y = y; moved = true }
    if (turnToward && dir.lengthSq() > 0) {
      a.yaw += wrap(Math.atan2(dir.x, dir.z) - a.yaw) * Math.min(1, dt * 14)
    }
    return moved
  }

  // the staircase is a ramp you walk up and down; Space (or the button) just walks you there and over it
  const stairY = z => (S ? FH * THREE.MathUtils.clamp((S.startZ - z) / (S.startZ - S.topZ), 0, 1) : 0)
  function takeStairs() {
    const p = stairPrompt()
    if (!p) return
    me.path = stairRoute(me, p)
  }
  /** a way over the stairs that lines up in front of them first, so it never cuts through the staircase */
  function stairRoute(a, dir) {
    const from = dir === 'up' ? S.footZ : S.landingZ
    const to = dir === 'up' ? S.landingZ : S.footZ
    return [
      ...routeTo(a, new THREE.Vector3(S.x - 1.5, a.pos.y, from)),
      new THREE.Vector3(S.x, a.pos.y, from),
      new THREE.Vector3(S.x, a.pos.y, to),
    ]
  }

  // ---- the room editor ----
  const editor = createEditor({
    canvas: renderer.domElement,
    house,
    getCamera: () => active,
    getLayout: id => layout[id],
    commit: (id, list, label) => { layout[id] = list; rebuildBlocks(); opts.onLayoutChange?.(id, list, label) },
    onState: s => opts.onEditor?.(s),
    onBlocked: r => opts.onBlocked?.(r),
    requestShadow: () => { shadowFrames = 3 },
    sfx: n => opts.onSfx?.(n),
  })
  const EDIT_EL = { top: 1.2, angle: 0.8, front: 0.3 }

  // ---- loop ----
  let last = performance.now()
  let elapsed = 0
  let avgMs = 1 // frame time relative to the budget
  let fpsCap = 60
  let lastInput = performance.now()
  const touched = () => { lastInput = performance.now() }
  ;['pointerdown', 'pointermove', 'wheel'].forEach(n => renderer.domElement.addEventListener(n, touched, { passive: true }))
  window.addEventListener('keydown', touched)
  let frameCount = 0
  let raf = 0
  let wanderAt = 3
  const dir = new THREE.Vector3()
  const toTarget = new THREE.Vector3()
  const goalTarget = new THREE.Vector3()
  const fade = {} // `${room}.${wall}` -> current opacity factor
  const applied = {}
  let roofFade = 1, roofApplied = -1
  let doorOpen = 0
  let calmMotion = false
  let sceneryT = 0
  let doorWas = 0, stepT = 0

  function setOpacity(group, k) {
    group.traverse(o => {
      if (!o.isMesh && !o.isPoints && !o.isSprite) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach(m => {
        if (m.userData.base === undefined) m.userData.base = m.opacity
        m.opacity = m.userData.base * k
        const wantT = m.userData.base < 1 || k < 0.999
        if (m.transparent !== wantT) { m.transparent = wantT; m.needsUpdate = true } // shader has an OPAQUE define
        m.depthWrite = k > 0.98
      })
    })
  }
  function fadeTo(key, group, goal, dt) {
    const cur = fade[key] ?? 1
    let v = frameCount < 3 ? goal : cur + (goal - cur) * Math.min(1, dt * 10) // start already faded: no ghost wall on load
    if (Math.abs(v - goal) < 0.002) v = goal
    fade[key] = v
    if (applied[key] !== v) { applied[key] = v; setOpacity(group, v) }
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    const nowMs = performance.now()
    // a minigame has the screen: the world stops drawing altogether, so the GPU is all the game's
    if (paused) { last = nowMs; return }
    // frame budget: never faster than the cap (a 120 Hz screen would otherwise draw everything twice as often),
    // half speed once nobody has touched anything for a few seconds, and barely at all in a background window
    const calm = nowMs - lastInput > 4000 && !keys.size && !me.path.length
    const targetMs = document.hidden ? 1000 / 4 : !document.hasFocus() ? 1000 / 20 : calm ? 1000 / 30 : 1000 / fpsCap
    if (nowMs - last < targetMs - 2) return
    const dt = Math.min((nowMs - last) / 1000, 0.05)
    const slowness = (nowMs - last) / targetMs // 1 = on budget
    avgMs += (slowness - avgMs) * 0.05
    last = nowMs
    elapsed += dt
    if (frameCount % 120 === 0) settleCoplanar(scene)
    if (frameCount % 3600 === 0 && timeSetting === 'auto' && resolveTime('auto') !== timeNow) api.setTimeOfDay('auto') // new furniture, lamps switched: settle their materials too
    if (++frameCount % 45 === 0) {
      // adaptive resolution: back off when frames can't keep to the budget, creep back up when there is headroom
      if (avgMs > 1.45 && pr > minPR) { pr = Math.max(minPR, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight); composer.setPixelRatio(pr); composer.setSize(container.clientWidth, container.clientHeight) }
      else if (avgMs < 1.08 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight); composer.setPixelRatio(pr); composer.setSize(container.clientWidth, container.clientHeight) }
    }
    const t = elapsed
    const eyes = view.mode === 'eyes'

    // --- orbit: Q/E keys + smoothing toward goal ---
    if (!eyes) {
      if (keys.has('q')) { view.azGoal = wrap(view.azGoal + dt * 1.6); view.az = view.azGoal }
      if (keys.has('e')) { view.azGoal = wrap(view.azGoal - dt * 1.6); view.az = view.azGoal }
    }
    // reduce motion: the camera jumps to where it is going instead of swooping, and the scenery drifts slowly
    const ease = rate => (calmMotion ? 1 : Math.min(1, dt * rate))
    view.az = wrap(view.az + wrap(view.azGoal - view.az) * ease(8))
    view.el += (view.elGoal - view.el) * ease(6)

    // --- my movement ---
    dir.set(0, 0, 0)
    const fwd = keys.has('w') || keys.has('arrowup')
    const bck = keys.has('s') || keys.has('arrowdown')
    const rightK = keys.has('d') || keys.has('arrowright')
    const leftK = keys.has('a') || keys.has('arrowleft')
    if (eyes) {
      // first person: W/S walk, A/D step sideways, the arrow keys (or the mouse) turn
      me.yaw += ((keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0)) * TURN * dt
      const f = (fwd ? 1 : 0) - (bck ? 1 : 0)
      const side = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
      dir.set(Math.sin(me.yaw) * f - Math.cos(me.yaw) * side, 0, Math.cos(me.yaw) * f + Math.sin(me.yaw) * side)
    } else {
      const up = new THREE.Vector3(-Math.sin(view.az), 0, -Math.cos(view.az))
      const rt = new THREE.Vector3(Math.cos(view.az), 0, -Math.sin(view.az))
      if (fwd) dir.add(up)
      if (bck) dir.sub(up)
      if (rightK) dir.add(rt)
      if (leftK) dir.sub(rt)
    }
    const steering = dir.lengthSq() > 0
    if (steering) {
      me.path = []
      dir.normalize()
    } else if (me.path.length) {
      toTarget.subVectors(me.path[0], me.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.15) me.path.shift()
      else dir.copy(toTarget).normalize()
    }
    const run = keys.has('shift') ? 2 : keys.has(' ') ? 1.8 : 1 // hold Shift (2x) or Space to run
    const iMoved = dir.lengthSq() > 0 && walk(me, dir, dt, (eyes ? SPEED * 0.8 : SPEED) * run, !eyes || !steering)
    if (me.path.length && dir.lengthSq() > 0 && !iMoved) me.path = []
    me.moving = iMoved
    // walked up to a game station you clicked: start its game
    if (pendingStation && !me.path.length) {
      if (steering || nearStation(pendingStation)) { if (!steering) opts.onStation?.(pendingStation.id); pendingStation = null }
      else pendingStation = null
    }
    // soft footsteps while you walk (quicker when running), and the sea louder the nearer you are to it
    stepT = iMoved ? stepT + dt * run : 0.3
    if (stepT > 0.42) { stepT = 0; opts.onSfx?.('step') }
    if (frameCount % 30 === 0) setSeaNear(me.pos.z > HZ ? 0.55 + (me.pos.z - HZ) / 12 : eyes ? 0.2 : 0.35)

    // --- partner wanders between the rooms, takes the stairs, and now and then steps out into the garden ---
    if (noPartner) { /* nobody else here: a starter home, or online, where your real partner is a peer */ } else if (partner.path.length) {
      toTarget.subVectors(partner.path[0], partner.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.18) partner.path.shift()
      else dir.copy(toTarget).normalize()
    } else {
      dir.set(0, 0, 0)
      const outside = partner.pos.z > HZ + 0.4
      const door = house.door, inDoor = new THREE.Vector3(door.x, 0, HZ - 0.9), outDoor = new THREE.Vector3(door.x, 0, HZ + 1.4)
      if (t > wanderAt && outside) {
        // back in through the front door
        const home = new THREE.Vector3(door.x + (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)
        partner.path = findPath(partner.pos, home, 0) || [outDoor, inDoor, home]
        wanderAt = t + 8 + Math.random() * 6
      } else if (t > wanderAt && levelOf(partner.pos.y) === 0 && Math.random() < 0.2) {
        // out into the garden for a bit
        const spot = new THREE.Vector3(door.x + (Math.random() - 0.5) * 8, 0, HZ + 2.2 + Math.random() * 2.5)
        partner.path = findPath(partner.pos, spot, 0) || [...routeTo(partner, inDoor), outDoor, spot]
        wanderAt = t + 10 + Math.random() * 8
      } else if (t > wanderAt && Math.random() < 0.3) {
        partner.path = stairRoute(partner, levelOf(partner.pos.y) === 0 ? 'up' : 'down')
        wanderAt = t + 8 + Math.random() * 6
      } else if (t > wanderAt) {
        const lvl = levelOf(partner.pos.y)
        const pool = rooms.filter(r => r.level === lvl)
        const r = pool[Math.floor(Math.random() * pool.length)]
        const dest = new THREE.Vector3(r.ox + (Math.random() * 2 - 1) * (HX - 1.4), partner.pos.y, (Math.random() * 2 - 1) * (HZ - 1.2))
        partner.path = findPath(partner.pos, dest, lvl) || routeTo(partner, dest)
        wanderAt = t + 6 + Math.random() * 8
      }
    }
    const pMoved = dir.lengthSq() > 0 && walk(partner, dir, dt, SPEED * 0.7)
    if (partner.path.length && dir.lengthSq() > 0 && !pMoved) partner.path = []
    partner.moving = pMoved

    ;[me, partner].forEach(a => {
      a.cube.group.position.copy(a.pos)
      a.cube.group.rotation.y = a.yaw
      a.cube.update(t, dt, a.moving)
    })
    peers.update(t, dt)
    {
      const z = NEIGHBOUR_PLOT_Z[1] + 0.9
      const g = levelOf(me.pos.y) === 0 && Math.abs(me.pos.z - z) < 2.2 ? gates.find(q => Math.abs(q.x - me.pos.x) < 2.4) : null
      if ((g?.id ?? null) !== atGate) { atGate = g?.id ?? null; opts.onGate?.(atGate) }
    }
    // tell the others where you are: 8 times a second while moving, every 3 seconds when still
    if (opts.onMove) {
      const moved = !sent || Math.abs(sent.x - me.pos.x) + Math.abs(sent.z - me.pos.z) + Math.abs(sent.y - me.pos.y) > 0.02 || Math.abs(sent.yaw - me.yaw) > 0.05
      if (nowMs - sentAt > (moved ? 125 : 3000)) {
        sentAt = nowMs
        sent = { x: me.pos.x, y: me.pos.y, z: me.pos.z, yaw: me.yaw }
        opts.onMove({ ...encode(me), yaw: +me.yaw.toFixed(2), mv: me.moving ? 1 : 0 })
      }
    }

    // --- cameras ---
    const k = calmMotion ? 1 : 1 - Math.exp(-dt * 6)
    const myRoom = roomAt(me)
    if (eyes) {
      const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw)
      eyeCam.position.set(me.pos.x + fx * 0.3, me.pos.y + FLOAT + EYE, me.pos.z + fz * 0.3)
      eyeCam.lookAt(
        eyeCam.position.x + fx * Math.cos(view.pitch),
        eyeCam.position.y - Math.sin(view.pitch),
        eyeCam.position.z + fz * Math.cos(view.pitch)
      )
    } else if (view.override) {
      camera.position.copy(view.override.pos)
      camera.lookAt(view.override.target)
    } else {
      if (view.mode === 'close') {
        goalTarget.set(me.pos.x, me.pos.y + FLOAT + 0.4, me.pos.z)
      } else if (view.mode === 'title') {
        view.azGoal = TITLE_AZ + Math.sin(t * 0.05) * 0.16
        view.elGoal = TITLE_EL + Math.sin(t * 0.07) * 0.025
        goalTarget.set(2, houseCenter.y + 2.2, 7)
      } else if (view.mode === 'street') {
        goalTarget.set(view.focusX || 0, view.focusZ != null ? 0 : 4.6, view.focusZ ?? 3.0)
      } else if (view.mode === 'edit') {
        if (view.editArea === 'garden') goalTarget.set(0, 0.4, 6.4)
        else { const er = rooms.find(r => r.id === view.editArea); goalTarget.set(er.ox, er.oy + 1.1, 0.2) }
      } else {
        // zooming out slides the framing from this room to the middle of the whole house
        const blend = smooth(1, mulMax, view.mul.room)
        goalTarget.lerpVectors(myRoom.center, houseCenter, blend)
      }
      camTarget.lerp(goalTarget, k)
      const goalDist = view.mode === 'close' ? CLOSE_DIST * view.mul.close
        : view.mode === 'title' ? houseDist * 1.15
        : view.mode === 'street' ? (view.focusZ != null ? 30 : houseDist * 1.05) * view.mul.street
        : view.mode === 'edit' ? (view.editArea === 'garden' ? houseDist * 0.62 : roomDist * 0.98) * view.mul.edit
        : roomDist * view.mul.room
      view.dist = Number.isFinite(view.dist) ? view.dist + (goalDist - view.dist) * k : goalDist
      camera.position.set(
        camTarget.x + Math.sin(view.az) * Math.cos(view.el) * view.dist,
        camTarget.y + Math.sin(view.el) * view.dist,
        camTarget.z + Math.cos(view.az) * Math.cos(view.el) * view.dist
      )
      camera.lookAt(camTarget)
    }
    // the editor panel covers part of the screen: slide the picture into the space that is left
    {
      const w = container.clientWidth, h = container.clientHeight
      const shift = editing() ? view.inset : 0
      const want = view.insetNow ?? 0
      view.insetNow = want + (shift - want) * Math.min(1, dt * 8)
      if (Math.abs(view.insetNow) > 0.5) {
        const portrait = window.innerWidth < window.innerHeight
        const sx = portrait ? 0 : view.insetNow / 2
        const sy = portrait ? -view.insetNow / 2 : 0
        camera.setViewOffset(w, h, -sx, -sy, w, h)
      } else if (camera.view?.enabled) camera.clearViewOffset()
    }

    // --- outside walls the camera is beyond fade away; roof and top ceilings too when seen from above ---
    const cp = active.position
    rooms.forEach(r => {
      const exterior = { back: true, front: true, left: r.col === 0, right: r.col === 1 }
      Object.entries(r.walls).forEach(([name, g]) => {
        let goal = 1
        if (!closedIn() && exterior[name]) {
          const n = OUT[name]
          const outside = n.x * (cp.x - r.ox) + n.z * cp.z - OFFSET[name] // >0: camera is beyond that wall
          goal = 1 - smooth(-0.5, 1.5, outside)
        }
        fadeTo(`${r.id}.${name}`, g, goal, dt)
      })
      const editedHere = editing() && view.editArea === r.id
      if (r.top || editedHere) fadeTo(`${r.id}.ceil`, r.ceiling, !closedIn() && (cp.y > r.oy + 4.2 || editedHere) ? 0 : 1, dt)
    })
    const roofGoal = !closedIn() && cp.y > house.roofBase + 0.2 ? 0 : 1
    roofFade += (roofGoal - roofFade) * (frameCount < 3 ? 1 : Math.min(1, dt * 10))
    if (Math.abs(roofFade - roofGoal) < 0.002) roofFade = roofGoal
    sceneryT += calmMotion ? dt * 0.25 : dt
    scenery.update(sceneryT, pr, container.clientHeight)
    // front door swings open when you walk up to it
    const dd = Math.hypot(me.pos.x - house.door.x, me.pos.z - (HZ + 1.0))
    const doorWant = dd < 2.6 && levelOf(me.pos.y) === 0 ? 1 : 0
    if (doorWant !== doorWas) { doorWas = doorWant; opts.onSfx?.('door') }
    doorOpen += (doorWant - doorOpen) * Math.min(1, dt * 5)
    house.door.pivot.rotation.y = -1.75 * doorOpen
    // the garden gate swings outward the same way when you come near it, from either side
    // the garden gates (front and back) swing outward the same way when you come near, from either side
    house.gates.forEach(g => {
      const want = Math.hypot(me.pos.x, me.pos.z - g.z) < 2.4 && levelOf(me.pos.y) === 0 ? 1 : 0
      if (want !== (g.was || 0)) { g.was = want; opts.onSfx?.('gate') }
      g.open = (g.open || 0) + (want - (g.open || 0)) * Math.min(1, dt * 5)
      g.leaves.forEach(l => { l.pivot.rotation.y = l.side * 1.6 * g.open })
    })
    // the playground's game stations: their gems turn slowly and bob
    house.playground.stations.forEach((st, k) => { st.gem.rotation.y = t * 0.8 + k; st.gem.position.y = -0.5 + 1.6 + Math.sin(t * 1.5 + k) * 0.12 })
    if (roofApplied !== roofFade) { roofApplied = roofFade; setOpacity(house.roof, roofFade) }

    // the merge: the house rises (after the cloud has gathered), then the cloud thins and drifts apart
    if (merge && merge.t < 6) {
      merge.t += dt
      const rise = THREE.MathUtils.clamp((merge.t - 1.0) / 2.6, 0, 1)
      house.group.position.y = -12 * Math.pow(1 - rise, 3)
      const fade = THREE.MathUtils.clamp((merge.t - 3.2) / 2.6, 0, 1)
      merge.puffs.forEach(p => { p.material.opacity = 0.95 * (1 - fade); if (fade > 0) p.position.addScaledVector(p.userData.drift, dt) })
      if (merge.t >= 6) { merge.puffs.forEach(p => { scene.remove(p); p.material.dispose() }); house.group.position.y = 0; shadowFrames = 3 }
    }

    // curtains glide open or shut
    curtainAnims.forEach((goal, obj) => {
      const c = obj.userData.curtain
      if (!c) { curtainAnims.delete(obj); return }
      const o = c.o + (goal - c.o) * Math.min(1, dt * 6)
      setCurtain(obj, Math.abs(o - goal) < 0.002 ? goal : o)
      if (c.o === goal) curtainAnims.delete(obj)
    })

    if (markerLife > 0) {
      markerLife = Math.max(0, markerLife - dt * 1.6)
      marker.material.opacity = markerLife * 0.9
      marker.scale.setScalar(1.4 - markerLife * 0.4)
    }

    editor.frame()
    report()
    // while a window is open the world only needs to stay alive, not smooth
    if (idle && (frameCount % 4)) return
    if (shadowFrames > 0) { renderer.shadowMap.needsUpdate = true; shadowFrames-- }
    if (bloomOn) { renderPass.camera = active; composer.render() } else renderer.render(scene, active)
  }
  // textures seen at a slant (floors, roads, signs) stay sharp instead of smearing
  const aniso = renderer.capabilities.getMaxAnisotropy()
  scene.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
    mats.forEach(m => ['map', 'emissiveMap', 'roughnessMap'].forEach(k => { if (m[k] && m[k].anisotropy < aniso) { m[k].anisotropy = aniso; m[k].needsUpdate = true } }))
  })

  settleCoplanar(scene)
  frame()

  const api = {
    setView,
    takeStairs,
    /** lock the keyboard while a window (shop, settings...) is open */
    setInputEnabled(on) { inputOn = on; if (!on) keys.clear() },
    /** press or release a movement key from an on-screen button (touch) */
    setKey(k, on) { if (on && inputOn) keys.add(k); else keys.delete(k) },
    /** true while a window covers the world: render it at a quarter of the speed */
    setIdle(b) { idle = b },
    // ---- other people, live ----
    peerSet: (id, info) => peers.set(id, info),
    /** a position message from someone (as sent by onMove); hidden if it refers to a home not on this street */
    peerMove(id, m) {
      const at = decode(m)
      if (!at) { peers.hide(id); return }
      peers.move(id, at[0], at[1], at[2], m.yaw || 0, !!m.mv)
    },
    peerRemove: id => peers.remove(id),
    /** a speech bubble over someone ('me' for yourself) */
    say: (id, text) => peers.say(id, text),
    emote: (id, kind) => peers.emote(id, kind),
    /** stop drawing the world entirely (while a minigame runs in its own scene) */
    setPaused(b) { paused = !!b },

    // ---- editing the home ----
    editor,
    enterEdit(areaId, inset = 0) {
      if (!editing()) view.prevMode = view.mode
      view.mode = 'edit'
      view.editArea = areaId
      view.inset = inset
      view.az = 0; view.azGoal = 0
      view.elGoal = areaId === 'garden' ? 0.75 : EDIT_EL.angle
      view.mul.edit = 1
      me.path = []
      active = camera
      me.cube.setVisible(false)
      partner.cube.setVisible(false)
      house.isolate(areaId)
      editor.enter(areaId)
      report()
    },
    exitEdit() {
      if (!editing()) return
      editor.exit()
      house.isolate(null)
      view.mode = view.prevMode && view.prevMode !== 'edit' ? view.prevMode : 'room'
      view.editArea = null
      view.elGoal = view.mode === 'close' ? CLOSE_EL : DEFAULT_EL
      me.cube.setVisible(view.mode !== 'eyes')
      partner.cube.setVisible(!solo)
      report()
    },
    setEditInset(px) { view.inset = px },
    setEditView(name) { view.elGoal = EDIT_EL[name] ?? EDIT_EL.angle },
    /** the saved layouts changed (undo, redo, reset): redraw whatever differs */
    setLayout(next) {
      Object.keys(next).forEach(id => {
        if (layout[id] === next[id]) return
        layout[id] = next[id]
        house.furnish(id, next[id], { bakeIt: !(editor.active && editor.areaId === id) })
      })
      rebuildBlocks()
      unstick(me)
      unstick(partner)
      editor.refresh()
      shadowFrames = 3
    },
    setStyle(roomId, st) { house.setStyle(roomId, st) },
    setFence(tier) { house.setFence(tier); shadowFrames = 3 },
    setSign(tier) { house.setSign(tier) },
    /** 'low' | 'medium' | 'high': caps the render sharpness */
    /** the Reduce motion setting */
    setReduceMotion(b) { calmMotion = !!b },
    /** fly over to a neighbour's home (k: their place in the world's member list, not counting you) */
    visit(k) {
      const x = neighbours.userData.spots?.[k]
      if (x == null) return
      setView('street')
      view.focusX = x
    },
    /** 'night' | 'evening' | 'auto' */
    setTimeOfDay(t) {
      timeSetting = t
      const next = resolveTime(t)
      if (next === timeNow && house.daylightSet) return
      timeNow = next
      house.daylightSet = true
      applyPalette(timeNow)
      scene.fog.color.copy(FOG_COLOR) // (the fog keeps its own copy of the colour)
      house.setDaylight(timeNow)
      scene.environment?.dispose?.()
      scene.environment = makeEnvironment(renderer, timeNow)
      shadowFrames = 3
    },
    setQuality(q) {
      const cap = { low: 1, medium: 1.5, high: 2 }[q] || 2
      maxPR = Math.min(window.devicePixelRatio, cap)
      minPR = Math.min(MIN_PR, maxPR)
      pr = q === 'high' ? maxPR : Math.min(pr, maxPR)
      bloomOn = q !== 'low' // the glow is the most expensive part: the battery-saver setting drops it
      fpsCap = q === 'low' ? 30 : 60
      // edge smoothing for the glow pipeline: 4x is lovely but heavy, 2x is plenty at 1.5x sharpness
      const samples = { low: 0, medium: 2, high: 4 }[q] ?? 2
      ;[composer.renderTarget1, composer.renderTarget2].forEach(rt => { if (rt.samples !== samples) { rt.samples = samples; rt.dispose() } })
      avgMs = 1
      renderer.setPixelRatio(pr)
      renderer.setSize(container.clientWidth, container.clientHeight)
      composer.setPixelRatio(pr)
      composer.setSize(container.clientWidth, container.clientHeight)
    },
    /** tier numbers from the shop (1-10) or null */
    setSkin(tier) { me.cube.setSkin(tier) },
    setHat(tier) { me.cube.setHat(tier) },
    setAzimuth,
    rotateBy(rad) { setAzimuth(view.azGoal + rad) },
    resetAzimuth() {
      const street = view.mode === 'street'
      setAzimuth(street ? STREET_AZ : 0)
      view.elGoal = street ? STREET_EL : view.mode === 'close' ? CLOSE_EL : DEFAULT_EL
    },
    /** put your own pictures in the frames: setFrameImage(0, '/me-and-you.jpg'); see frameCount */
    setFrameImage(i, url) { house.frames[i]?.setImage(url) },
    frameCount: house.frames.length,
    /** name on the garden sign, e.g. setName('Alex & Sam') */
    setName: house.setName,
    roomNames: rooms.map(r => r.name),
    roomIds: rooms.map(r => r.id),
    // screenshot helpers (used with ?debug)
    debug: {
      scene, house, three: THREE, camera: () => active, canvas: renderer.domElement,
      /** list every spot where two surfaces would flicker against each other (see zfight.js) */
      zfight(o) { return findZFighting(scene, o) },
      pickAt(clientX, clientY) { const o = pick({ clientX, clientY }); return o ? { id: o.userData.itemId, kind: o.userData.interactive } : null },
      useAt(clientX, clientY) { return interactAt({ clientX, clientY }) },
      /** run frames by hand (a hidden browser tab barely runs them) */
      tick(n = 1) { for (let i = 0; i < n; i++) { last -= 1000; frame() } },
      placeIn(id, lx, lz, yaw = me.yaw, pitch = 0) {
        const r = byId(id)
        me.pos.set(r.ox + lx, r.oy, lz); me.yaw = yaw; view.pitch = pitch; me.path = []
      },
      partnerIn(id, lx, lz, yaw = 0) {
        const r = byId(id)
        partner.pos.set(r.ox + lx, r.oy, lz); partner.yaw = yaw; partner.path = []; wanderAt = 1e9
      },
      pause() { wanderAt = 1e9 },
      forceStairs() {
        wanderAt = 0
        partner.path = stairRoute(partner, levelOf(partner.pos.y) === 0 ? 'up' : 'down')
        wanderAt = 1e9
      },
      partnerWhere() { return { x: +partner.pos.x.toFixed(2), y: +partner.pos.y.toFixed(2), z: +partner.pos.z.toFixed(2), climbing: onStair(partner.pos.x, partner.pos.z) } },
      where() { return { x: +me.pos.x.toFixed(2), y: +me.pos.y.toFixed(2), z: +me.pos.z.toFixed(2), room: roomAt(me).name, door: +doorOpen.toFixed(2), path: me.path.map(p => [+p.x.toFixed(1), +p.z.toFixed(1)]) } },
      blockedAt(level, x, z) { return blocked(x, z, level) ? colliders[level].filter(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF) : false },
      // flood-fill the walkable floor of both storeys + garden and report what is connected
      // flood-fill the walkable floor (both storeys of the couple house, or the starter home) and the outside, and
      // report which places can be reached: every room, both gates, the cliff walk and each playground station
      reach() {
        const step = 0.2
        const cell = v => Math.round(v / step)
        const P = plot()
        const bx = Math.max(P.x, PLAYGROUND.x, -walkSpan[0], walkSpan[1]) + 1
        const fill = (level, sx, sz) => {
          const seen = new Set()
          const q = [[cell(sx), cell(sz)]]
          seen.add(q[0].join())
          while (q.length) {
            const [i, j] = q.pop()
            ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => {
              const ni = i + di, nj = j + dj
              const x = ni * step, z = nj * step
              if (Math.abs(x) > bx || z < PLAYGROUND.zFar - 1 || z > CLIFF_Z || blocked(x, z, level)) return
              const k = `${ni},${nj}`
              if (!seen.has(k)) { seen.add(k); q.push([ni, nj]) }
            })
          }
          return p => seen.has(`${cell(p[0])},${cell(p[1])}`)
        }
        const down = fill(0, house.door.x, HZ + 2.0) // start in the garden, in front of the door
        const out = {
          ground: {
            garden: down([house.door.x, HZ + 2.0]),
            frontGate: down([0, PLOT_FRONT + 1.0]),
            backGate: down([0, house.gates[1].z - 1.0]),
            playground: down([0, (PLAYGROUND.zNear + PLAYGROUND.zFar) / 2]),
            ...Object.fromEntries(house.playground.stations.map(st => [`station:${st.id}`, down([st.x, st.z + 1.9])])),
          },
        }
        // a room counts as reachable if any spot on its floor is (the probe can't land on a table by chance)
        const inRoom = (r, can) => { for (let x = -HX + 0.6; x < HX - 0.5; x += 0.4) for (let z = -HZ + 0.6; z < HZ - 0.5; z += 0.4) if (can([r.ox + x, z])) return true; return false }
        rooms.filter(r => levelOf(r.oy) === 0).forEach(r => { out.ground[r.id] = inRoom(r, down) })
        if (!solo) {
          const up = fill(1, rooms[0].ox + 1.2, 1.6)
          out.upper = { landing: up([S.x, S.landingZ]) }
          rooms.filter(r => levelOf(r.oy) === 1).forEach(r => { out.upper[r.id] = inRoom(r, up) })
          out.ground.stairFoot = down([S.x, S.footZ])
        }
        const bad = [...Object.entries(out.ground), ...Object.entries(out.upper || {})].filter(([, ok]) => !ok).map(([k]) => k)
        return { ok: !bad.length, bad, ...out }
      },
      info() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: pr } },
      elevation(v) { view.elGoal = v; view.el = v },
      cam(px, py, pz, tx, ty, tz) { view.override = { pos: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) } },
    },
    dispose() {
      cancelAnimationFrame(raf)
      peers.dispose()
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', touched)
      composer.dispose()
      renderer.dispose()
      container.innerHTML = ''
    },
  }
  return api
}
