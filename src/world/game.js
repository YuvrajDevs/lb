import * as THREE from 'three'
import { buildRoom } from './room.js'
import { createCube } from './cube.js'

const HALF = 0.42 // cube collision half-extent
const SPEED = 3.8

const PARTNER_LINES = [
  'hi love ♥', 'come sit with me', 'look at the stars tonight',
  'i made tea for us', 'put on a record?', 'miss you even when you are in the next room',
  'this room is so cosy', 'cuddle time?', 'what should we eat later?', '♥',
]

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
  renderer.toneMappingExposure = 1.05
  container.appendChild(renderer.domElement)

  const overlay = document.createElement('div')
  overlay.className = 'world-overlay'
  container.appendChild(overlay)

  const scene = new THREE.Scene()
  const room = buildRoom()
  scene.add(room.group, room.lights)

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100)
  const camTarget = new THREE.Vector3(0, 1.7, 0)
  camera.position.set(15, 14, 15)
  camera.lookAt(camTarget)

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    const aspect = w / h
    const halfH = Math.max(8.4, 10.5 / aspect)
    camera.left = -halfH * aspect
    camera.right = halfH * aspect
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
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
    return { cube, name, pos: new THREE.Vector3(x, 0, z), target: null, yaw: 0, stuck: 0, tag, bubble, bubbleUntil: 0, moving: false }
  }
  const me = makeActor(opts.name || 'you', opts.color || '#ff8fb8', 1.5, 2.2)
  const partner = makeActor('mochi', '#9ad0ff', 3.6, 0.4)

  // click marker
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 28),
    new THREE.MeshBasicMaterial({ color: '#ffd1e3', transparent: true, opacity: 0 })
  )
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.03
  scene.add(marker)
  let markerLife = 0

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
  const onPointer = e => {
    const r = renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(floor, hit)) return
    const b = room.bounds - HALF
    me.target = new THREE.Vector3(THREE.MathUtils.clamp(hit.x, -b, b), 0, THREE.MathUtils.clamp(hit.z, -b, b))
    marker.position.set(me.target.x, 0.03, me.target.z)
    markerLife = 1
  }
  renderer.domElement.addEventListener('pointerdown', onPointer)

  const onWheel = e => {
    e.preventDefault()
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.7, 2.2)
    camera.updateProjectionMatrix()
  }
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

  // ---- helpers ----
  const iso = { // screen-relative directions in world space
    up: new THREE.Vector3(-1, 0, -1).normalize(),
    right: new THREE.Vector3(1, 0, -1).normalize(),
  }

  function advance(a, dir, dt) {
    const moved = step(room.colliders, room.bounds, a.pos, dir.x * SPEED * dt, dir.z * SPEED * dt)
    if (dir.lengthSq() > 0) {
      const want = Math.atan2(dir.x, dir.z)
      let d = want - a.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      a.yaw += d * Math.min(1, dt * 14)
    }
    return moved
  }

  function project(actor, lift) {
    const v = new THREE.Vector3(actor.pos.x, lift, actor.pos.z).project(camera)
    return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight }
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
      partner.target = new THREE.Vector3(me.pos.x + 1.1, 0, me.pos.z + 0.6)
      say('partner', PARTNER_LINES[Math.floor(Math.random() * PARTNER_LINES.length)])
    }, 1200 + Math.random() * 1600)
  }

  // ---- loop ----
  let last = performance.now()
  let elapsed = 0
  let raf = 0
  const dir = new THREE.Vector3()
  const toTarget = new THREE.Vector3()
  const { deskLamp, lampDome } = room.flicker

  function frame() {
    raf = requestAnimationFrame(frame)
    const nowMs = performance.now()
    const dt = Math.min((nowMs - last) / 1000, 0.05)
    last = nowMs
    elapsed += dt
    const t = elapsed

    // my movement: keys override click target
    dir.set(0, 0, 0)
    if (keys.has('w') || keys.has('arrowup')) dir.add(iso.up)
    if (keys.has('s') || keys.has('arrowdown')) dir.sub(iso.up)
    if (keys.has('d') || keys.has('arrowright')) dir.add(iso.right)
    if (keys.has('a') || keys.has('arrowleft')) dir.sub(iso.right)
    if (dir.lengthSq() > 0) {
      me.target = null
      dir.normalize()
    } else if (me.target) {
      toTarget.subVectors(me.target, me.pos)
      toTarget.y = 0
      if (toTarget.length() < 0.12) me.target = null
      else dir.copy(toTarget).normalize()
    }
    const iMoved = dir.lengthSq() > 0 && advance(me, dir, dt)
    if (me.target && dir.lengthSq() > 0 && !iMoved) me.target = null
    me.moving = iMoved

    // partner wander / follow
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
    const pMoved = dir.lengthSq() > 0 && advance(partner, dir, dt * 0.8)
    if (partner.target && dir.lengthSq() > 0 && !pMoved) partner.target = null
    partner.moving = pMoved

    // apply to meshes + overlay
    const now = performance.now()
    ;[me, partner].forEach(a => {
      a.cube.group.position.x = a.pos.x
      a.cube.group.position.z = a.pos.z
      a.cube.group.rotation.y = a.yaw
      a.cube.update(t, dt, a.moving)
      const p = project(a, 1.35)
      a.tag.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y}px)`
      const pb = project(a, 1.95)
      a.bubble.style.transform = `translate(-50%, -100%) translate(${pb.x}px, ${pb.y}px)`
      if (a.bubbleUntil && now > a.bubbleUntil) { a.bubble.classList.remove('show'); a.bubbleUntil = 0 }
    })

    // marker + lamp
    if (markerLife > 0) {
      markerLife = Math.max(0, markerLife - dt * 1.6)
      marker.material.opacity = markerLife * 0.9
      marker.scale.setScalar(1.4 - markerLife * 0.4)
    }
    deskLamp.intensity = 26 + Math.sin(t * 1.3) * 0.8 + Math.sin(t * 7.1) * 0.25
    lampDome.material.emissiveIntensity = 0.8 + Math.sin(t * 1.3) * 0.05

    renderer.render(scene, camera)
  }
  frame()

  return {
    say(text) { say('me', text); partnerReply() },
    heart() { heart('me'); setTimeout(() => heart('partner'), 350) },
    setColor(c) { me.cube.setColor(c) },
    setName(n) { me.name = n; me.tag.textContent = n },
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
}
