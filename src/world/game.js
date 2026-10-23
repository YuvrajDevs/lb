import * as THREE from 'three'
import { buildHouse, FH, COL } from './house.js'
import { createCube, FLOAT } from './cube.js'
import { HX, HZ } from './kit.js'
import { resolveDefaults, footOf, infoOf } from './furnish.js'
import { createEditor } from './editor.js'
import { makeEnvironment } from './env.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { AREA_LIST } from '../game/areas.js'
import { CELL } from '../game/grid.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.6
const TURN = 2.2 // rad/s in eyes view
const DEFAULT_EL = 0.05
const CLOSE_EL = 0.2
const CLOSE_DIST = 6.5
const STREET_AZ = 0.14
const STREET_EL = -0.02
const FOV = 35
const DOOR_Z = 1.9 // every doorway between side-by-side rooms sits here
const CLIMB_TIME = 3.2

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
  renderer.setPixelRatio(pr)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false // the moon only lights static geometry: render its shadows once
  let shadowFrames = 3
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
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
  const layout = opts.layout || Object.fromEntries(AREA_LIST.map(id => [id, resolveDefaults(id)]))
  if (!opts.layout) opts.onLayoutInit?.(layout)
  const house = buildHouse({ layout, style: opts.style, fence: opts.fence, sign: opts.sign })
  scene.add(house.group, house.lights)
  const { rooms, colliders, stairs: S } = house
  const houseCenter = new THREE.Vector3(0, (house.bounds.yMin + house.bounds.yMax) / 2, 0)
  const houseHalfH = (house.bounds.yMax - house.bounds.yMin) / 2

  let composer = null // the glow / grade pipeline, created below (resize() runs before it exists)

  // ---- cameras ----
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200)
  const eyeCam = new THREE.PerspectiveCamera(76, 1, 0.05, 100)
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
  scene.environment = makeEnvironment(renderer)
  scene.environmentIntensity = 0.3
  composer = new EffectComposer(renderer)
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
    return { cube, pos, path: [], yaw: 0, moving: false, climb: null }
  }
  const byId = id => rooms.find(r => r.id === id)
  const me = makeActor('#ff8fb8', byId('study'), 1.2, 1.6)
  const partner = makeActor('#9ad0ff', byId('bedroom'), 1.8, 0.4)

  const roomAt = a => rooms.find(r => r.col === (a.pos.x > 0 ? 1 : 0) && r.level === levelOf(a.pos.y)) || rooms[0]

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 28),
    new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 })
  )
  marker.rotation.x = -Math.PI / 2
  scene.add(marker)
  let markerLife = 0

  // ---- view control ----
  const stairPrompt = () => {
    if (me.climb) return null
    if (levelOf(me.pos.y) === 0 && Math.hypot(me.pos.x - S.x, me.pos.z - S.footZ) < 1.5) return 'up'
    if (levelOf(me.pos.y) === 1 && Math.hypot(me.pos.x - S.x, me.pos.z - S.landingZ) < 1.5) return 'down'
    return null
  }
  const shownMode = () => (view.mode === 'room' && view.mul.room > mulMax * 0.9 ? 'house' : view.mode)
  const editing = () => view.mode === 'edit'
  const closedIn = () => view.mode === 'eyes' || view.mode === 'street' || (editing() && view.editArea === 'garden') // outside or first person: the house is closed, no cutaway

  function report() {
    const info = { mode: shownMode(), az: view.az, room: roomAt(me).name, stairs: stairPrompt() }
    const key = `${info.mode}|${Math.round(info.az * 57.3)}|${info.room}|${info.stairs}`
    if (key === lastReported) return
    lastReported = key
    opts.onView?.(info)
  }

  function setView(name) {
    const eyes = name === 'eyes'
    const wasStreet = view.mode === 'street'
    view.override = null
    if (name === 'house') { view.mode = 'room'; view.mul.room = mulMax; view.elGoal = DEFAULT_EL }
    else if (name === 'room') { view.mode = 'room'; view.mul.room = 1; view.elGoal = DEFAULT_EL }
    else if (name === 'close') { view.mode = 'close'; view.elGoal = CLOSE_EL }
    else if (name === 'street') { view.mode = 'street'; view.mul.street = 1; view.azGoal = STREET_AZ; view.elGoal = STREET_EL }
    else if (eyes) view.mode = 'eyes'
    else return
    if (wasStreet && name !== 'street') { view.azGoal = 0 }
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
  const typingNow = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  const onKeyDown = e => {
    if (!inputOn || typingNow()) return
    keys.add(e.key.toLowerCase())
    if (e.key === ' ') { e.preventDefault(); takeStairs() }
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

  function clickMove(e) {
    if (me.climb) return
    const r = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -me.pos.y)
    if (!ray.ray.intersectPlane(plane, hit)) return
    const dest = new THREE.Vector3(
      THREE.MathUtils.clamp(hit.x, -COL + 0.6, COL - 0.6),
      me.pos.y,
      THREE.MathUtils.clamp(hit.z, -HZ + HALF, HZ - HALF)
    )
    me.path = routeTo(me, dest)
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
      me.yaw += dx * 0.005
      view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, -0.8, 0.8)
    } else {
      view.az = wrap(view.az - dx * 0.008)
      view.azGoal = view.az
      view.elGoal = THREE.MathUtils.clamp(view.elGoal + dy * 0.004, view.mode === 'street' ? -0.1 : 0.0, 1.3)
      view.el = view.elGoal
    }
  })
  const endDrag = e => {
    if (editing()) { drag = null; return }
    if (drag && !drag.moved && !closedIn() && e.type === 'pointerup') clickMove(e)
    drag = null
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('wheel', e => {
    e.preventDefault()
    if (view.mode === 'eyes') return
    const [lo, hi] = view.mode === 'room' ? [0.4, mulMax] : view.mode === 'street' ? [0.3, 1.4] : view.mode === 'edit' ? [0.5, 1.6] : [0.4, 2]
    view.mul[view.mode] = THREE.MathUtils.clamp(view.mul[view.mode] * (e.deltaY > 0 ? 1.1 : 0.9), lo, hi)
  }, { passive: false })

  // ---- movement ----
  // furniture the player has placed blocks walking too (rugs, lights, and things on tables do not)
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
    ;(layout.garden || []).forEach(e => {
      if (e.on || e.wall || infoOf(e.id).kind !== 'floor') return
      const fp = footOf(e)
      furnitureBlocks[0].push({ minX: -12.4 + e.i * CELL, maxX: -12.4 + (e.i + fp.cw) * CELL, minZ: 4.4 + e.j * CELL, maxZ: 4.4 + (e.j + fp.cd) * CELL })
    })
  }
  const hits = (list, x, z) => list.some(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF)
  function blocked(x, z, level) {
    return hits(colliders[level], x, z) || hits(furnitureBlocks[level], x, z)
  }
  /** if furniture was just placed on top of someone, step them to the nearest free spot */
  function unstick(a) {
    const lvl = levelOf(a.pos.y)
    if (!blocked(a.pos.x, a.pos.z, lvl)) return
    for (let r = 0.2; r < 4; r += 0.2) {
      for (let k = 0; k < 16; k++) {
        const x = a.pos.x + Math.cos((k / 16) * 6.283) * r, z = a.pos.z + Math.sin((k / 16) * 6.283) * r
        if (!blocked(x, z, lvl)) { a.pos.x = x; a.pos.z = z; return }
      }
    }
  }
  rebuildBlocks()
  function walk(a, dir, dt, speed, turnToward = true) {
    const lvl = levelOf(a.pos.y)
    let moved = false
    const dx = dir.x * speed * dt, dz = dir.z * speed * dt
    if (!blocked(a.pos.x + dx, a.pos.z, lvl)) { a.pos.x += dx; moved = moved || dx !== 0 }
    if (!blocked(a.pos.x, a.pos.z + dz, lvl)) { a.pos.z += dz; moved = moved || dz !== 0 }
    if (turnToward && dir.lengthSq() > 0) {
      a.yaw += wrap(Math.atan2(dir.x, dir.z) - a.yaw) * Math.min(1, dt * 14)
    }
    return moved
  }

  // the staircase: step on the foot (downstairs) or landing (upstairs), press Space
  const stairY = z => FH * THREE.MathUtils.clamp((S.startZ - z) / (S.startZ - S.topZ), 0, 1)
  function takeStairs() {
    const p = stairPrompt()
    if (!p) return
    me.path = []
    me.climb = { dir: p, s: 0 }
  }
  /** a way to the stairs that goes round to the front of them first, so it never cuts through the staircase */
  function stairRoute(a, dir) {
    const z = dir === 'up' ? S.footZ : S.landingZ
    return [
      ...routeTo(a, new THREE.Vector3(S.x - 1.5, a.pos.y, z)),
      new THREE.Vector3(S.x, a.pos.y, z),
    ]
  }
  function updateClimb(a, dt) {
    const c = a.climb
    c.s = Math.min(1, c.s + dt / CLIMB_TIME)
    const e = c.s * c.s * (3 - 2 * c.s)
    const up = c.dir === 'up'
    const z0 = up ? S.footZ : S.landingZ
    const z1 = up ? S.landingZ : S.footZ
    a.pos.x = S.x
    a.pos.z = z0 + (z1 - z0) * e
    a.pos.y = stairY(a.pos.z)
    a.yaw += wrap((up ? Math.PI : 0) - a.yaw) * Math.min(1, dt * 8)
    a.moving = true
    if (c.s >= 1) { a.pos.y = up ? FH : 0; a.climb = null }
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
  let avgMs = 16
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
    let v = cur + (goal - cur) * Math.min(1, dt * 10)
    if (Math.abs(v - goal) < 0.002) v = goal
    fade[key] = v
    if (applied[key] !== v) { applied[key] = v; setOpacity(group, v) }
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    const nowMs = performance.now()
    const dt = Math.min((nowMs - last) / 1000, 0.05)
    avgMs += ((nowMs - last) - avgMs) * 0.05
    last = nowMs
    elapsed += dt
    if (++frameCount % 45 === 0) {
      // adaptive resolution: back off when frames get slow, creep back up when there is headroom
      if (avgMs > 24 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight); composer.setPixelRatio(pr); composer.setSize(container.clientWidth, container.clientHeight) }
      else if (avgMs < 13 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight); composer.setPixelRatio(pr); composer.setSize(container.clientWidth, container.clientHeight) }
    }
    const t = elapsed
    const eyes = view.mode === 'eyes'

    // --- orbit: Q/E keys + smoothing toward goal ---
    if (!eyes) {
      if (keys.has('q')) { view.azGoal = wrap(view.azGoal + dt * 1.6); view.az = view.azGoal }
      if (keys.has('e')) { view.azGoal = wrap(view.azGoal - dt * 1.6); view.az = view.azGoal }
    }
    view.az = wrap(view.az + wrap(view.azGoal - view.az) * Math.min(1, dt * 8))
    view.el += (view.elGoal - view.el) * Math.min(1, dt * 6)

    // --- my movement ---
    if (me.climb) {
      updateClimb(me, dt)
    } else {
      dir.set(0, 0, 0)
      const fwd = keys.has('w') || keys.has('arrowup')
      const bck = keys.has('s') || keys.has('arrowdown')
      const rightK = keys.has('d') || keys.has('arrowright')
      const leftK = keys.has('a') || keys.has('arrowleft')
      let iMoved = false
      if (eyes) {
        me.yaw += ((leftK ? 1 : 0) - (rightK ? 1 : 0)) * TURN * dt
        const f = (fwd ? 1 : 0) - (bck ? 1 : 0)
        if (f) {
          dir.set(Math.sin(me.yaw) * f, 0, Math.cos(me.yaw) * f)
          iMoved = walk(me, dir, dt, SPEED * 0.8, false)
          // walking straight into the foot (or the top landing) of the stairs takes them
          const p = stairPrompt()
          if (p && f > 0) {
            const gx = S.x - me.pos.x
            const gz = (p === 'up' ? S.footZ : S.landingZ) - me.pos.z
            const toward = (p === 'up' ? -1 : 1) * Math.cos(me.yaw) // facing -z to go up, +z to go down
            if (Math.hypot(gx, gz) < 0.9 && toward > 0.5) takeStairs()
          }
        }
      } else {
        const up = new THREE.Vector3(-Math.sin(view.az), 0, -Math.cos(view.az))
        const rt = new THREE.Vector3(Math.cos(view.az), 0, -Math.sin(view.az))
        if (fwd) dir.add(up)
        if (bck) dir.sub(up)
        if (rightK) dir.add(rt)
        if (leftK) dir.sub(rt)
        if (dir.lengthSq() > 0) {
          me.path = []
          dir.normalize()
        } else if (me.path.length) {
          toTarget.subVectors(me.path[0], me.pos)
          toTarget.y = 0
          if (toTarget.length() < 0.15) me.path.shift()
          else dir.copy(toTarget).normalize()
        }
        iMoved = dir.lengthSq() > 0 && walk(me, dir, dt, SPEED)
        if (me.path.length && dir.lengthSq() > 0 && !iMoved) me.path = []
      }
      me.moving = iMoved
    }

    // --- partner wanders between the rooms on its storey ---
    if (partner.climb) {
      updateClimb(partner, dt)
      dir.set(0, 0, 0)
    } else if (partner.path.length) {
      toTarget.subVectors(partner.path[0], partner.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.18) partner.path.shift()
      else dir.copy(toTarget).normalize()
    } else {
      dir.set(0, 0, 0)
      if (partner.stairGoal) {
        // arrived at the foot (or the top) of the stairs: take them
        const gz = partner.stairGoal === 'up' ? S.footZ : S.landingZ
        if (Math.hypot(partner.pos.x - S.x, partner.pos.z - gz) < 1.0) partner.climb = { dir: partner.stairGoal, s: 0 }
        partner.stairGoal = null
      } else if (t > wanderAt && Math.random() < 0.3 && !partner.climb) {
        const goingUp = levelOf(partner.pos.y) === 0
        partner.stairGoal = goingUp ? 'up' : 'down'
        partner.path = stairRoute(partner, goingUp ? 'up' : 'down')
        wanderAt = t + 8 + Math.random() * 6
      } else if (t > wanderAt) {
        const lvl = levelOf(partner.pos.y)
        const pool = rooms.filter(r => r.level === lvl)
        const r = pool[Math.floor(Math.random() * pool.length)]
        const dest = new THREE.Vector3(r.ox + (Math.random() * 2 - 1) * (HX - 1.4), partner.pos.y, (Math.random() * 2 - 1) * (HZ - 1.2))
        partner.path = routeTo(partner, dest)
        wanderAt = t + 6 + Math.random() * 8
      }
    }
    const pMoved = !partner.climb && dir.lengthSq() > 0 && walk(partner, dir, dt, SPEED * 0.7)
    if (partner.path.length && dir.lengthSq() > 0 && !pMoved && !partner.climb) { partner.path = []; partner.stairGoal = null }
    if (!partner.climb) partner.moving = pMoved

    ;[me, partner].forEach(a => {
      a.cube.group.position.copy(a.pos)
      a.cube.group.rotation.y = a.yaw
      a.cube.update(t, dt, a.moving)
    })

    // --- cameras ---
    const k = 1 - Math.exp(-dt * 6)
    const myRoom = roomAt(me)
    if (eyes) {
      const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw)
      eyeCam.position.set(me.pos.x + fx * 0.3, me.pos.y + FLOAT + 0.52, me.pos.z + fz * 0.3)
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
      } else if (view.mode === 'street') {
        goalTarget.set(0, 4.6, 3.0)
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
        : view.mode === 'street' ? houseDist * 1.05 * view.mul.street
        : view.mode === 'edit' ? (view.editArea === 'garden' ? houseDist * 0.62 : roomDist * 0.98) * view.mul.edit
        : roomDist * view.mul.room
      view.dist += (goalDist - view.dist) * k
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
      if (r.row === 0 || editedHere) fadeTo(`${r.id}.ceil`, r.ceiling, !closedIn() && (cp.y > r.oy + 4.2 || editedHere) ? 0 : 1, dt)
    })
    const roofGoal = !closedIn() && cp.y > house.roofBase + 0.2 ? 0 : 1
    roofFade += (roofGoal - roofFade) * Math.min(1, dt * 10)
    if (Math.abs(roofFade - roofGoal) < 0.002) roofFade = roofGoal
    // the street appears when seen from the street view, or when you step out of the front door in first person
    const outside = me.pos.z > HZ + 0.6 && levelOf(me.pos.y) === 0
    fadeTo('street', house.streetProps, view.mode === 'street' || (eyes && outside) ? 1 : 0, dt)
    // front door swings open when you walk up to it
    const dd = Math.hypot(me.pos.x - house.door.x, me.pos.z - (HZ + 1.0))
    doorOpen += ((dd < 2.6 && levelOf(me.pos.y) === 0 ? 1 : 0) - doorOpen) * Math.min(1, dt * 5)
    house.door.pivot.rotation.y = -1.75 * doorOpen
    if (roofApplied !== roofFade) { roofApplied = roofFade; setOpacity(house.roof, roofFade) }

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
  frame()

  return {
    setView,
    takeStairs,
    /** lock the keyboard while a window (shop, settings...) is open */
    setInputEnabled(on) { inputOn = on; if (!on) keys.clear() },
    /** press or release a movement key from an on-screen button (touch) */
    setKey(k, on) { if (on && inputOn) keys.add(k); else keys.delete(k) },
    /** true while a window covers the world: render it at a quarter of the speed */
    setIdle(b) { idle = b },

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
      partner.cube.setVisible(true)
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
    setQuality(q) {
      const cap = { low: 1, medium: 1.5, high: 2 }[q] || 2
      maxPR = Math.min(window.devicePixelRatio, cap)
      pr = Math.min(pr, maxPR)
      bloomOn = q !== 'low' // the glow is the most expensive part: the battery-saver setting drops it
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
    // screenshot helpers (used with ?debug)
    debug: {
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
        partner.stairGoal = levelOf(partner.pos.y) === 0 ? 'up' : 'down'
        partner.path = stairRoute(partner, partner.stairGoal)
        wanderAt = 1e9
      },
      partnerWhere() { return { x: +partner.pos.x.toFixed(2), y: +partner.pos.y.toFixed(2), z: +partner.pos.z.toFixed(2), climbing: !!partner.climb } },
      where() { return { x: +me.pos.x.toFixed(2), y: +me.pos.y.toFixed(2), z: +me.pos.z.toFixed(2), room: roomAt(me).name, door: +doorOpen.toFixed(2) } },
      blockedAt(level, x, z) { return blocked(x, z, level) ? colliders[level].filter(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF) : false },
      // flood-fill the walkable floor of both storeys + garden and report what is connected
      reach() {
        const step = 0.2
        const cell = v => Math.round(v / step)
        const fill = (level, sx, sz) => {
          const seen = new Set()
          const q = [[cell(sx), cell(sz)]]
          seen.add(q[0].join())
          while (q.length) {
            const [i, j] = q.pop()
            ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => {
              const ni = i + di, nj = j + dj
              if (ni * step < -15 || ni * step > 15 || nj * step < -7 || nj * step > 12 || blocked(ni * step, nj * step, level)) return
              const k = `${ni},${nj}`
              if (!seen.has(k)) { seen.add(k); q.push([ni, nj]) }
            })
          }
          return p => seen.has(`${cell(p[0])},${cell(p[1])}`)
        }
        const up = fill(1, rooms[0].ox + 1.2, 1.6)
        const down = fill(0, house.door.x, HZ + 2.0) // start in the garden, in front of the door
        const at = (id, lx, lz) => { const r = byId(id); return [r.ox + lx, lz] }
        return {
          upper: {
            study: up(at('study', 1.2, 1.6)),
            bedroom: up(at('bedroom', 1.0, 2.0)),
            bedroomBed: up(at('bedroom', -0.2, 2.2)),
            landing: up([S.x, S.landingZ]),
            studyDeskSide: up(at('study', 2.6, -2.0)),
          },
          ground: {
            garden: down([house.door.x, HZ + 2.0]),
            livingViaDoor: down(at('living', -3.4, 2.4)),
            living: down(at('living', 2.0, 2.0)),
            livingTV: down(at('living', -3.5, 0.2)),
            stairFoot: down([S.x, S.footZ]),
            kitchen: down(at('kitchen', 0.5, 2.4)),
            kitchenTable: down(at('kitchen', -2.6, 1.0)),
            kitchenFridgeSide: down(at('kitchen', 3.8, 0.5)),
          },
        }
      },
      info() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: pr } },
      elevation(v) { view.elGoal = v; view.el = v },
      cam(px, py, pz, tx, ty, tz) { view.override = { pos: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) } },
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      composer.dispose()
      renderer.dispose()
      container.innerHTML = ''
    },
  }
}
