import * as THREE from 'three'
import { buildRoom } from './room.js'
import { createCube } from './cube.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.8
const TURN = 2.2 // rad/s in eyes view
const EL = 0.62 // camera elevation (rad)
const DIST = 22
const DEFAULT_AZ = Math.PI / 4
const ZOOM_RANGE = { room: [0.7, 2.2], close: [1.8, 5.5] }
const WALL_NORMALS = {
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  front: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
}

const PARTNER_LINES = [
  'hi love ♥', 'come sit with me', 'the sun is so nice today',
  'i made tea for us', 'put on a record?', 'miss you even when you are in the next room',
  'this room is so cosy', 'cuddle time?', 'what should we eat later?', '♥',
]

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a))

function blocked(colliders, bound, x, z) {
  if (Math.abs(x) > bound - HALF || Math.abs(z) > bound - HALF) return true
  return colliders.some(c => x > c.minX - HALF && x < c.maxX + HALF && z > c.minZ - HALF && z < c.maxZ + HALF)
}

function step(colliders, bound, p, dx, dz) {
  let moved = false
  if (!blocked(colliders, bound, p.x + dx, p.z)) { p.x += dx; moved = moved || dx !== 0 }
  if (!blocked(colliders, bound, p.x, p.z + dz)) { p.z += dz; moved = moved || dz !== 0 }
  return moved
}

export function createGame(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  container.appendChild(renderer.domElement)

  const overlay = document.createElement('div')
  overlay.className = 'world-overlay'
  container.appendChild(overlay)

  const scene = new THREE.Scene()
  const room = buildRoom()
  scene.add(room.group, room.lights)

  // ---- cameras ----
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100)
  const eyeCam = new THREE.PerspectiveCamera(78, 1, 0.05, 60)
  let active = camera
  const camTarget = new THREE.Vector3(0, 1.7, 0)
  const view = { mode: 'room', az: DEFAULT_AZ, azGoal: DEFAULT_AZ, pitch: 0, zoom: { room: 1, close: 3.2 } }
  let lastReported = ''

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    const aspect = w / h
    const halfH = Math.max(8.4, 10.5 / aspect)
    camera.left = -halfH * aspect
    camera.right = halfH * aspect
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
    eyeCam.aspect = aspect
    eyeCam.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  // ---- people ----
  function makeActor(name, color, x, z) {
    const cube = createCube(color)
    cube.group.position.set(x, 0, z)
    scene.add(cube.group)
    const tag = document.createElement('div')
    tag.className = 'name-tag'
    tag.textContent = name
    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    overlay.append(tag, bubble)
    return { cube, name, pos: new THREE.Vector3(x, 0, z), target: null, yaw: 0, tag, bubble, bubbleUntil: 0, moving: false }
  }
  const me = makeActor(opts.name || 'you', opts.color || '#ff8fb8', 1.5, 2.2)
  const partner = makeActor('mochi', '#9ad0ff', 3.6, 0.4)

  // click marker
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 28),
    new THREE.MeshBasicMaterial({ color: '#ff8fb8', transparent: true, opacity: 0 })
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
    room.ceiling.visible = eyes
    me.tag.style.display = eyes ? 'none' : ''
    me.bubble.style.display = eyes ? 'none' : ''
    report()
  }

  function setAzimuth(rad, instant = false) {
    view.azGoal = wrap(rad)
    if (instant) view.az = view.azGoal
    report()
  }

  // ---- input ----
  const keys = new Set()
  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
  const onKeyDown = e => { if (!typing()) keys.add(e.key.toLowerCase()) }
  const onKeyUp = e => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  const ray = new THREE.Raycaster()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const el = renderer.domElement
  let drag = null

  function clickMove(e) {
    const r = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(floor, hit)) return
    const b = room.bounds - HALF
    me.target = new THREE.Vector3(THREE.MathUtils.clamp(hit.x, -b, b), 0, THREE.MathUtils.clamp(hit.z, -b, b))
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
      view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, -0.7, 0.7)
    } else {
      view.az = wrap(view.az - dx * 0.008)
      view.azGoal = view.az
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
    const [lo, hi] = ZOOM_RANGE[view.mode]
    view.zoom[view.mode] = THREE.MathUtils.clamp(view.zoom[view.mode] * (e.deltaY > 0 ? 0.92 : 1.08), lo, hi)
  }, { passive: false })

  // ---- helpers ----
  function project(actor, lift) {
    const v = new THREE.Vector3(actor.pos.x, lift, actor.pos.z).project(active)
    return {
      x: (v.x * 0.5 + 0.5) * container.clientWidth,
      y: (-v.y * 0.5 + 0.5) * container.clientHeight,
      visible: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
    }
  }

  function say(who, text) {
    const a = who === 'me' ? me : partner
    a.bubble.textContent = text
    a.bubble.classList.add('show')
    a.bubbleUntil = performance.now() + 4500 + text.length * 40
    opts.onChat?.({ from: a.name, who, text, at: Date.now() })
  }

  function heart(who = 'me') {
    const a = who === 'me' ? me : partner
    const p = project(a, 2.2)
    if (!p.visible) return
    for (let i = 0; i < 5; i++) {
      const h = document.createElement('div')
      h.className = 'float-heart'
      h.textContent = '♥'
      h.style.left = `${p.x + (Math.random() - 0.5) * 36}px`
      h.style.top = `${p.y}px`
      h.style.animationDelay = `${i * 90}ms`
      overlay.appendChild(h)
      setTimeout(() => h.remove(), 1800 + i * 90)
    }
  }

  // ---- partner brain (placeholder until real multiplayer) ----
  let wanderAt = 2
  let replyTimer = null
  function partnerReply() {
    clearTimeout(replyTimer)
    replyTimer = setTimeout(() => {
      const b = room.bounds - 1
      partner.target = new THREE.Vector3(
        THREE.MathUtils.clamp(me.pos.x + Math.sin(me.yaw) * 1.5, -b, b),
        0,
        THREE.MathUtils.clamp(me.pos.z + Math.cos(me.yaw) * 1.5, -b, b)
      )
      say('partner', PARTNER_LINES[Math.floor(Math.random() * PARTNER_LINES.length)])
    }, 1200 + Math.random() * 1600)
  }

  function walk(a, dir, dt, speed, turnToward = true) {
    const moved = step(room.colliders, room.bounds, a.pos, dir.x * speed * dt, dir.z * speed * dt)
    if (turnToward && dir.lengthSq() > 0) {
      const d = wrap(Math.atan2(dir.x, dir.z) - a.yaw)
      a.yaw += d * Math.min(1, dt * 14)
    }
    return moved
  }

  // ---- loop ----
  let last = performance.now()
  let elapsed = 0
  let raf = 0
  const dir = new THREE.Vector3()
  const toTarget = new THREE.Vector3()
  const goalTarget = new THREE.Vector3()
  const wallFade = { back: 1, left: 1, front: 1, right: 1 }
  const applied = { back: -1, left: -1, front: -1, right: -1 }

  // fade/unfade a wall group by scaling each material's base opacity
  function setWallOpacity(group, k) {
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

    // --- my movement ---
    dir.set(0, 0, 0)
    const fwd = keys.has('w') || keys.has('arrowup')
    const back = keys.has('s') || keys.has('arrowdown')
    const rightK = keys.has('d') || keys.has('arrowright')
    const leftK = keys.has('a') || keys.has('arrowleft')
    let iMoved = false
    if (eyes) {
      me.yaw += ((leftK ? 1 : 0) - (rightK ? 1 : 0)) * TURN * dt
      const f = (fwd ? 1 : 0) - (back ? 1 : 0)
      if (f) {
        dir.set(Math.sin(me.yaw) * f, 0, Math.cos(me.yaw) * f)
        iMoved = walk(me, dir, dt, SPEED * 0.8, false)
      }
    } else {
      // screen-relative directions follow the compass
      const up = new THREE.Vector3(-Math.sin(view.az), 0, -Math.cos(view.az))
      const rt = new THREE.Vector3(Math.cos(view.az), 0, -Math.sin(view.az))
      if (fwd) dir.add(up)
      if (back) dir.sub(up)
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

    // --- partner wander / follow ---
    dir.set(0, 0, 0)
    if (partner.target) {
      toTarget.subVectors(partner.target, partner.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.15) partner.target = null
      else dir.copy(toTarget).normalize()
    } else if (t > wanderAt) {
      const b = room.bounds - 1
      partner.target = new THREE.Vector3((Math.random() * 2 - 1) * b, 0, (Math.random() * 2 - 1) * b)
      wanderAt = t + 5 + Math.random() * 7
    }
    const pMoved = dir.lengthSq() > 0 && walk(partner, dir, dt, SPEED * 0.8)
    if (partner.target && dir.lengthSq() > 0 && !pMoved) partner.target = null
    partner.moving = pMoved

    // --- apply to meshes ---
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
      eyeCam.position.set(me.pos.x + fx * 0.3, 0.56 + me.cube.group.position.y * 0.5, me.pos.z + fz * 0.3)
      eyeCam.lookAt(
        eyeCam.position.x + fx * Math.cos(view.pitch),
        eyeCam.position.y - Math.sin(view.pitch),
        eyeCam.position.z + fz * Math.cos(view.pitch)
      )
    } else {
      if (view.mode === 'close') goalTarget.set(me.pos.x, 0.6, me.pos.z)
      else goalTarget.set(0, 1.7, 0)
      camTarget.lerp(goalTarget, k)
      const z = view.zoom[view.mode]
      if (Math.abs(camera.zoom - z) > 0.0005) {
        camera.zoom += (z - camera.zoom) * k
        camera.updateProjectionMatrix()
      }
      camera.position.set(
        camTarget.x + Math.sin(view.az) * Math.cos(EL) * DIST,
        camTarget.y + Math.sin(EL) * DIST,
        camTarget.z + Math.cos(view.az) * Math.cos(EL) * DIST
      )
      camera.lookAt(camTarget)
    }

    // --- walls that face the camera fade out (always all there in eyes view) ---
    const toCam = new THREE.Vector3(Math.sin(view.az), 0, Math.cos(view.az))
    Object.entries(room.walls).forEach(([name, g]) => {
      const facing = WALL_NORMALS[name].dot(toCam)
      const goal = eyes ? 1 : THREE.MathUtils.clamp((0.25 - facing) / 0.35, 0, 1)
      wallFade[name] += (goal - wallFade[name]) * Math.min(1, dt * 10)
      if (Math.abs(wallFade[name] - goal) < 0.002) wallFade[name] = goal
      if (applied[name] !== wallFade[name]) {
        applied[name] = wallFade[name]
        setWallOpacity(g, wallFade[name])
      }
    })

    // --- overlay (name tags & bubbles) ---
    const now = performance.now()
    ;[me, partner].forEach(a => {
      if (a === me && eyes) return
      const p = project(a, 1.35)
      const pb = project(a, 1.95)
      a.tag.style.opacity = p.visible ? '' : '0'
      a.tag.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y}px)`
      a.bubble.style.transform = `translate(-50%, -100%) translate(${pb.x}px, ${pb.y}px)`
      a.bubble.style.visibility = pb.visible ? '' : 'hidden'
      if (a.bubbleUntil && now > a.bubbleUntil) { a.bubble.classList.remove('show'); a.bubbleUntil = 0 }
    })

    if (markerLife > 0) {
      markerLife = Math.max(0, markerLife - dt * 1.6)
      marker.material.opacity = markerLife * 0.9
      marker.scale.setScalar(1.4 - markerLife * 0.4)
    }

    report()
    renderer.render(scene, active)
  }
  frame()

  const api = {
    say(text) { say('me', text); partnerReply() },
    heart() { heart('me'); setTimeout(() => heart('partner'), 350) },
    setColor(c) { me.cube.setColor(c) },
    setName(n) { me.name = n; me.tag.textContent = n },
    setMode,
    setAzimuth,
    rotateBy(rad) { setAzimuth(view.azGoal + rad) },
    resetAzimuth() { setAzimuth(DEFAULT_AZ) },
    /** put your own pictures in the frames on the two inner walls: setFrameImage(0, '/me-and-you.jpg') */
    setFrameImage(i, url) { room.frames[i]?.setImage(url) },
    frameCount: room.frames.length,
    // screenshot helpers (used with ?debug)
    debug: {
      place(x, z, yaw = me.yaw, pitch = 0) { me.pos.set(x, 0, z); me.yaw = yaw; view.pitch = pitch; me.target = null },
      partnerAt(x, z) { partner.pos.set(x, 0, z); partner.target = null; wanderAt = 1e9 },
      pause() { wanderAt = 1e9 },
      walls() { return Object.fromEntries(Object.entries(room.walls).map(([n, g]) => [n, { fade: wallFade[n], mats: g.children.filter(o => o.isMesh).map(o => (Array.isArray(o.material) ? o.material : [o.material]).map(m => [m.opacity, m.transparent, m.depthWrite])) }])) },
    },
    dispose() {
      cancelAnimationFrame(raf)
      clearTimeout(replyTimer)
      ro.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      renderer.dispose()
      container.innerHTML = ''
    },
  }
  return api
}
