import * as THREE from 'three'
import { buildHouse, FH, COL } from './house.js'
import { createCube, FLOAT } from './cube.js'
import { HX, HZ } from './kit.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.6
const TURN = 2.2 // rad/s in eyes view
const DEFAULT_EL = 0.05
const CLOSE_EL = 0.2
const CLOSE_DIST = 6.5
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
  const maxPR = Math.min(window.devicePixelRatio, 2)
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
  const house = buildHouse()
  scene.add(house.group, house.lights)
  const { rooms, colliders, stairs: S } = house
  const houseCenter = new THREE.Vector3(0, (house.bounds.yMin + house.bounds.yMax) / 2, 0)
  const houseHalfH = (house.bounds.yMax - house.bounds.yMin) / 2

  // ---- cameras ----
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200)
  const eyeCam = new THREE.PerspectiveCamera(76, 1, 0.05, 100)
  let active = camera
  const camTarget = new THREE.Vector3().copy(rooms[0].center)
  const view = {
    mode: 'room', az: 0, azGoal: 0, el: DEFAULT_EL, elGoal: DEFAULT_EL,
    dist: 16, pitch: 0, mul: { room: 1, close: 1 },
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
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  view.dist = roomDist

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

  function report() {
    const info = { mode: shownMode(), az: view.az, room: roomAt(me).name, stairs: stairPrompt() }
    const key = `${info.mode}|${Math.round(info.az * 57.3)}|${info.room}|${info.stairs}`
    if (key === lastReported) return
    lastReported = key
    opts.onView?.(info)
  }

  function setView(name) {
    const eyes = name === 'eyes'
    if (name === 'house') { view.mode = 'room'; view.mul.room = mulMax; view.elGoal = DEFAULT_EL }
    else if (name === 'room') { view.mode = 'room'; view.mul.room = 1; view.elGoal = DEFAULT_EL }
    else if (name === 'close') { view.mode = 'close'; view.elGoal = CLOSE_EL }
    else if (eyes) view.mode = 'eyes'
    else return
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
  const onKeyDown = e => {
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
    const [lo, hi] = view.mode === 'room' ? [0.4, mulMax] : [0.4, 2]
    view.mul[view.mode] = THREE.MathUtils.clamp(view.mul[view.mode] * (e.deltaY > 0 ? 1.1 : 0.9), lo, hi)
  }, { passive: false })

  // ---- movement ----
  function blocked(x, z, level) {
    return colliders[level].some(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF)
  }
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
      if (avgMs > 24 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight) }
      else if (avgMs < 13 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.25); renderer.setPixelRatio(pr); renderer.setSize(container.clientWidth, container.clientHeight) }
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
    if (partner.path.length) {
      toTarget.subVectors(partner.path[0], partner.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.18) partner.path.shift()
      else dir.copy(toTarget).normalize()
    } else {
      dir.set(0, 0, 0)
      if (t > wanderAt) {
        const lvl = levelOf(partner.pos.y)
        const pool = rooms.filter(r => r.level === lvl)
        const r = pool[Math.floor(Math.random() * pool.length)]
        const dest = new THREE.Vector3(r.ox + (Math.random() * 2 - 1) * (HX - 1.4), partner.pos.y, (Math.random() * 2 - 1) * (HZ - 1.2))
        partner.path = routeTo(partner, dest)
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
    } else {
      if (view.mode === 'close') {
        goalTarget.set(me.pos.x, me.pos.y + FLOAT + 0.4, me.pos.z)
      } else {
        // zooming out slides the framing from this room to the middle of the whole house
        const blend = smooth(1, mulMax, view.mul.room)
        goalTarget.lerpVectors(myRoom.center, houseCenter, blend)
      }
      camTarget.lerp(goalTarget, k)
      const goalDist = view.mode === 'close' ? CLOSE_DIST * view.mul.close : roomDist * view.mul.room
      view.dist += (goalDist - view.dist) * k
      camera.position.set(
        camTarget.x + Math.sin(view.az) * Math.cos(view.el) * view.dist,
        camTarget.y + Math.sin(view.el) * view.dist,
        camTarget.z + Math.cos(view.az) * Math.cos(view.el) * view.dist
      )
      camera.lookAt(camTarget)
    }

    // --- outside walls the camera is beyond fade away; roof and top ceilings too when seen from above ---
    const cp = active.position
    rooms.forEach(r => {
      const exterior = { back: true, front: true, left: r.col === 0, right: r.col === 1 }
      Object.entries(r.walls).forEach(([name, g]) => {
        let goal = 1
        if (!eyes && exterior[name]) {
          const n = OUT[name]
          const outside = n.x * (cp.x - r.ox) + n.z * cp.z - OFFSET[name] // >0: camera is beyond that wall
          goal = 1 - smooth(-0.5, 1.5, outside)
        }
        fadeTo(`${r.id}.${name}`, g, goal, dt)
      })
      if (r.row === 0) fadeTo(`${r.id}.ceil`, r.ceiling, !eyes && cp.y > r.oy + 4.2 ? 0 : 1, dt)
    })
    const roofGoal = !eyes && cp.y > house.roofBase + 0.2 ? 0 : 1
    roofFade += (roofGoal - roofFade) * Math.min(1, dt * 10)
    if (Math.abs(roofFade - roofGoal) < 0.002) roofFade = roofGoal
    if (roofApplied !== roofFade) { roofApplied = roofFade; setOpacity(house.roof, roofFade) }

    if (markerLife > 0) {
      markerLife = Math.max(0, markerLife - dt * 1.6)
      marker.material.opacity = markerLife * 0.9
      marker.scale.setScalar(1.4 - markerLife * 0.4)
    }

    report()
    if (shadowFrames > 0) { renderer.shadowMap.needsUpdate = true; shadowFrames-- }
    renderer.render(scene, active)
  }
  frame()

  return {
    setView,
    takeStairs,
    setAzimuth,
    rotateBy(rad) { setAzimuth(view.azGoal + rad) },
    resetAzimuth() { setAzimuth(0); view.elGoal = view.mode === 'close' ? CLOSE_EL : DEFAULT_EL },
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
      info() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: pr } },
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
