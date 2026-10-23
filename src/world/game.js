import * as THREE from 'three'
import { buildRoom, H } from './room.js'
import { createCube, FLOAT } from './cube.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.6
const TURN = 2.2 // rad/s in eyes view
const DEFAULT_EL = 0.05
const CLOSE_EL = 0.2
const CLOSE_DIST = 6.5
const FOV = 35
const WALL_PLANES = { // outward normal + plane offset from origin (filled in below)
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  front: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
}

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

export function createGame(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const room = buildRoom()
  scene.add(room.group, room.lights)
  const { halfX, halfZ } = room

  // distance from the wall plane to the origin (interior face)
  const planeOffset = { back: halfZ, left: halfX, front: halfZ, right: halfX }

  // ---- cameras ----
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120)
  const eyeCam = new THREE.PerspectiveCamera(76, 1, 0.05, 80)
  let active = camera
  const camTarget = new THREE.Vector3(0, 2.2, 0)
  const view = {
    mode: 'room', az: 0, azGoal: 0, el: DEFAULT_EL, elGoal: DEFAULT_EL,
    dist: 16, pitch: 0, mul: { room: 1, close: 1 },
  }
  let fitDist = 16
  let lastReported = ''

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    const aspect = w / h
    const t = Math.tan((FOV * Math.PI) / 360)
    // fit the whole open front of the box on screen, like a framed diorama
    const needH = 2.95 / 0.9 / t
    const needW = (halfX + 0.5) / 0.95 / (t * aspect)
    fitDist = Math.max(needH, needW) + halfZ + 0.3
    camera.aspect = aspect
    eyeCam.aspect = aspect
    camera.updateProjectionMatrix()
    eyeCam.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  view.dist = fitDist

  // ---- people ----
  function makeActor(color, x, z) {
    const cube = createCube(color)
    cube.group.position.set(x, 0, z)
    scene.add(cube.group)
    return { cube, pos: new THREE.Vector3(x, 0, z), target: null, yaw: 0, moving: false }
  }
  const me = makeActor('#ff8fb8', 1.2, 1.6)
  const partner = makeActor('#9ad0ff', 3.2, 0.4)

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 28),
    new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 })
  )
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.03
  scene.add(marker)
  let markerLife = 0

  // ---- view control ----
  function report() {
    const key = `${view.mode}|${Math.round(view.az * 57.3)}`
    if (key === lastReported) return
    lastReported = key
    opts.onView?.({ mode: view.mode, az: view.az })
  }

  function setMode(mode) {
    if (!['room', 'close', 'eyes'].includes(mode) || mode === view.mode) return
    view.mode = mode
    me.target = null
    const eyes = mode === 'eyes'
    active = eyes ? eyeCam : camera
    me.cube.setVisible(!eyes)
    room.ceiling.visible = true
    if (mode === 'room') view.elGoal = DEFAULT_EL
    if (mode === 'close') view.elGoal = CLOSE_EL
    report()
  }

  function setAzimuth(rad, instant = false) {
    view.azGoal = wrap(rad)
    if (instant) view.az = view.azGoal
    report()
  }

  // ---- input ----
  const keys = new Set()
  const onKeyDown = e => keys.add(e.key.toLowerCase())
  const onKeyUp = e => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  const ray = new THREE.Raycaster()
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const el = renderer.domElement
  let drag = null

  function clickMove(e) {
    const r = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(floorPlane, hit)) return
    me.target = new THREE.Vector3(
      THREE.MathUtils.clamp(hit.x, -halfX + HALF, halfX - HALF),
      0,
      THREE.MathUtils.clamp(hit.z, -halfZ + HALF, halfZ - HALF)
    )
    marker.position.set(me.target.x, 0.03, me.target.z)
    markerLife = 1
  }

  el.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, moved: false }
    el.setPointerCapture(e.pointerId)
  })
  el.addEventListener('pointermove', e => {
    if (!drag) return
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
      view.elGoal = THREE.MathUtils.clamp(view.elGoal + dy * 0.004, 0.0, 1.3)
      view.el = view.elGoal
    }
  })
  const endDrag = e => {
    if (drag && !drag.moved && view.mode !== 'eyes' && e.type === 'pointerup') clickMove(e)
    drag = null
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('wheel', e => {
    e.preventDefault()
    if (view.mode === 'eyes') return
    const [lo, hi] = view.mode === 'room' ? [0.4, 1.25] : [0.4, 2]
    view.mul[view.mode] = THREE.MathUtils.clamp(view.mul[view.mode] * (e.deltaY > 0 ? 1.08 : 0.92), lo, hi)
  }, { passive: false })

  // ---- movement ----
  function blocked(x, z) {
    if (Math.abs(x) > halfX - HALF || Math.abs(z) > halfZ - HALF) return true
    return room.colliders.some(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF)
  }
  function walk(a, dir, dt, speed, turnToward = true) {
    let moved = false
    const dx = dir.x * speed * dt, dz = dir.z * speed * dt
    if (!blocked(a.pos.x + dx, a.pos.z)) { a.pos.x += dx; moved = moved || dx !== 0 }
    if (!blocked(a.pos.x, a.pos.z + dz)) { a.pos.z += dz; moved = moved || dz !== 0 }
    if (turnToward && dir.lengthSq() > 0) {
      a.yaw += wrap(Math.atan2(dir.x, dir.z) - a.yaw) * Math.min(1, dt * 14)
    }
    return moved
  }

  // ---- loop ----
  let last = performance.now()
  let elapsed = 0
  let raf = 0
  let wanderAt = 2
  const dir = new THREE.Vector3()
  const toTarget = new THREE.Vector3()
  const goalTarget = new THREE.Vector3()
  const wallFade = { back: 1, left: 1, front: 1, right: 1 }
  const applied = { back: -1, left: -1, front: -1, right: -1 }
  let ceilFade = 1
  let ceilApplied = -1

  // fade a group by scaling each material's base opacity
  function setOpacity(group, k) {
    group.traverse(o => {
      if (!o.isMesh && !o.isPoints) return
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

  function frame() {
    raf = requestAnimationFrame(frame)
    const nowMs = performance.now()
    const dt = Math.min((nowMs - last) / 1000, 0.05)
    last = nowMs
    elapsed += dt
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
      }
    } else {
      const up = new THREE.Vector3(-Math.sin(view.az), 0, -Math.cos(view.az))
      const rt = new THREE.Vector3(Math.cos(view.az), 0, -Math.sin(view.az))
      if (fwd) dir.add(up)
      if (bck) dir.sub(up)
      if (rightK) dir.add(rt)
      if (leftK) dir.sub(rt)
      if (dir.lengthSq() > 0) {
        me.target = null
        dir.normalize()
      } else if (me.target) {
        toTarget.subVectors(me.target, me.pos)
        toTarget.y = 0
        if (toTarget.length() < 0.12) me.target = null
        else dir.copy(toTarget).normalize()
      }
      iMoved = dir.lengthSq() > 0 && walk(me, dir, dt, SPEED)
      if (me.target && dir.lengthSq() > 0 && !iMoved) me.target = null
    }
    me.moving = iMoved

    // --- partner wanders ---
    dir.set(0, 0, 0)
    if (partner.target) {
      toTarget.subVectors(partner.target, partner.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.15) partner.target = null
      else dir.copy(toTarget).normalize()
    } else if (t > wanderAt) {
      partner.target = new THREE.Vector3((Math.random() * 2 - 1) * (halfX - 1), 0, (Math.random() * 2 - 1) * (halfZ - 1))
      wanderAt = t + 5 + Math.random() * 7
    }
    const pMoved = dir.lengthSq() > 0 && walk(partner, dir, dt, SPEED * 0.7)
    if (partner.target && dir.lengthSq() > 0 && !pMoved) partner.target = null
    partner.moving = pMoved

    ;[me, partner].forEach(a => {
      a.cube.group.position.x = a.pos.x
      a.cube.group.position.z = a.pos.z
      a.cube.group.rotation.y = a.yaw
      a.cube.update(t, dt, a.moving)
    })

    // --- cameras ---
    const k = 1 - Math.exp(-dt * 6)
    if (eyes) {
      const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw)
      eyeCam.position.set(me.pos.x + fx * 0.3, FLOAT + 0.52, me.pos.z + fz * 0.3)
      eyeCam.lookAt(
        eyeCam.position.x + fx * Math.cos(view.pitch),
        eyeCam.position.y - Math.sin(view.pitch),
        eyeCam.position.z + fz * Math.cos(view.pitch)
      )
    } else {
      if (view.mode === 'close') goalTarget.set(me.pos.x, FLOAT + 0.4, me.pos.z)
      else goalTarget.set(0, 2.25, 0)
      camTarget.lerp(goalTarget, k)
      const goalDist = view.mode === 'close' ? CLOSE_DIST * view.mul.close : fitDist * view.mul.room
      view.dist += (goalDist - view.dist) * k
      camera.position.set(
        camTarget.x + Math.sin(view.az) * Math.cos(view.el) * view.dist,
        camTarget.y + Math.sin(view.el) * view.dist,
        camTarget.z + Math.cos(view.az) * Math.cos(view.el) * view.dist
      )
      camera.lookAt(camTarget)
    }

    // --- walls the camera is outside of fade away; the ceiling too when seen from above ---
    const cp = active.position
    Object.entries(room.walls).forEach(([name, g]) => {
      const n = WALL_PLANES[name]
      const outside = n.x * cp.x + n.y * cp.y + n.z * cp.z - planeOffset[name] // >0: camera is beyond the wall
      const goal = eyes ? 1 : 1 - smooth(-0.5, 1.5, outside)
      wallFade[name] += (goal - wallFade[name]) * Math.min(1, dt * 10)
      if (Math.abs(wallFade[name] - goal) < 0.002) wallFade[name] = goal
      if (applied[name] !== wallFade[name]) { applied[name] = wallFade[name]; setOpacity(g, wallFade[name]) }
    })
    const ceilGoal = cp.y > H - 0.6 ? 0 : 1
    ceilFade += (ceilGoal - ceilFade) * Math.min(1, dt * 10)
    if (Math.abs(ceilFade - ceilGoal) < 0.002) ceilFade = ceilGoal
    if (ceilApplied !== ceilFade) { ceilApplied = ceilFade; setOpacity(room.ceiling, ceilFade) }

    if (markerLife > 0) {
      markerLife = Math.max(0, markerLife - dt * 1.6)
      marker.material.opacity = markerLife * 0.9
      marker.scale.setScalar(1.4 - markerLife * 0.4)
    }

    report()
    renderer.render(scene, active)
  }
  frame()

  return {
    setMode,
    setAzimuth,
    rotateBy(rad) { setAzimuth(view.azGoal + rad) },
    resetAzimuth() { setAzimuth(0); view.elGoal = view.mode === 'close' ? CLOSE_EL : DEFAULT_EL },
    /** put your own pictures in the frames: setFrameImage(0, '/me-and-you.jpg') */
    setFrameImage(i, url) { room.frames[i]?.setImage(url) },
    frameCount: room.frames.length,
    // screenshot helpers (used with ?debug)
    debug: {
      place(x, z, yaw = me.yaw, pitch = 0) { me.pos.set(x, 0, z); me.yaw = yaw; view.pitch = pitch; me.target = null },
      partnerAt(x, z, yaw = 0) { partner.pos.set(x, 0, z); partner.yaw = yaw; partner.target = null; wanderAt = 1e9 },
      pause() { wanderAt = 1e9 },
      elevation(v) { view.elGoal = v; view.el = v },
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      renderer.dispose()
      container.innerHTML = ''
    },
  }
}
