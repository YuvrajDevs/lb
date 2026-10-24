import * as THREE from 'three'
import { createCube, FLOAT } from '../world/cube.js'

// Starfall Bridge: the Star catch minigame, in its own little world. A wooden bridge hangs over a sea of
// clouds in a violet canyon of floating spires, under an eclipsed moon. Seen from the side: you float along the
// bridge left and right and catch the stars falling out of the sky. Gold stars are 1 point, pink wishing stars
// 3; dark meteors break your streak and stun you for a moment.
//
//   const game = createStarfall(container, { skin, hat, reduceMotion, onHud, onEnd, onSfx })
//                    the scene starts drawing at once, the camera drifting slowly over the canyon
//   game.play()      the camera glides in to the bridge, then 3-2-1 and the round (again for a replay)
//   game.dispose()
// The round's numbers go out through onHud (score, time, streak, count) and onEnd (the final stats).

export const ROUND = 45 // seconds
const HALF_BRIDGE = 10.5
const deckY = x => 0.55 * (1 - (x / (HALF_BRIDGE + 1)) ** 2) // a gentle arch
const CATCH_Y = FLOAT + 0.45 // the cube's middle, above the deck
const STAR = { gold: { pts: 1, color: '#ffd46b', glow: '#ffbf4a' }, wish: { pts: 3, color: '#ff9fd0', glow: '#ff6fb8' } }

// ---------- textures made on a canvas ----------
function radial(stops, size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([o, col]) => gr.addColorStop(o, col))
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const GLOW = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']])
const RING = radial([[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,0)'], [0.72, 'rgba(255,240,220,1)'], [0.8, 'rgba(255,180,120,0.5)'], [1, 'rgba(255,120,80,0)']], 256)
function trailTexture() {
  const c = document.createElement('canvas')
  c.width = 32; c.height = 256
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, 'rgba(255,255,255,0)')
  gr.addColorStop(1, 'rgba(255,255,255,0.9)')
  g.fillStyle = gr
  const lg = g.createLinearGradient(0, 0, 32, 0)
  g.fillRect(0, 0, 32, 256)
  g.globalCompositeOperation = 'destination-in'
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = lg
  g.fillRect(0, 0, 32, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const TRAIL = trailTexture()
function textTexture(text, color) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 128
  const g = c.getContext('2d')
  g.font = '600 84px Oswald, sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.shadowColor = color; g.shadowBlur = 18
  g.fillStyle = '#fff8ec'
  g.fillText(text, 128, 66)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
const sprite = (map, color, scale, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, opacity, ...additive }))
  s.scale.setScalar(scale)
  return s
}

function starGeometry(r = 0.34) {
  const sh = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const rr = i % 2 ? r * 0.46 : r
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr
    if (i) sh.lineTo(x, y); else sh.moveTo(x, y)
  }
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 })
  g.center()
  return g
}

// ---------- the world ----------
function buildSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vP; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float y = vP.y;
        vec3 top = vec3(0.07, 0.04, 0.18), mid = vec3(0.42, 0.13, 0.42), hor = vec3(0.86, 0.36, 0.58);
        vec3 c = mix(hor, mid, smoothstep(-0.05, 0.25, y));
        c = mix(c, top, smoothstep(0.2, 0.75, y));
        // stars, twinkling, only up high
        vec2 g = floor(vec2(atan(vP.z, vP.x) * 260.0, y * 260.0));
        float s = step(0.9965, h(g)) * smoothstep(0.1, 0.5, y);
        c += s * (0.6 + 0.4 * sin(uTime * 2.0 + h(g + 3.1) * 40.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }))
  scene.add(sky)
  return sky
}

function buildMoon(scene) {
  // an eclipse: a dark disc with a burning rim, low over the canyon on the left
  const g = new THREE.Group()
  g.position.set(-26, 22, -95)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: '#1a0e26', fog: false }))
  g.add(disc)
  const rim = sprite(RING, '#ffd2a0', 21, 1)
  rim.material.fog = false
  rim.position.z = -0.1
  g.add(rim)
  const halo = sprite(GLOW, '#ff7ab0', 46, 0.35)
  halo.material.fog = false
  halo.position.z = -0.2
  g.add(halo)
  scene.add(g)
  return g
}

function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

function buildSpires(scene) {
  // tall rock spires at many depths, fading into the violet haze; one merged mesh per colour band
  // (a clear window is kept in the middle and up to the left, so the sky and the eclipse show over the bridge)
  const r = rand(7)
  const geos = { near: [], mid: [], far: [] }
  for (let i = 0; i < 90; i++) {
    const far = r()
    const z = -38 - far * 120
    const x = (r() - 0.5) * (90 + far * 260)
    const clear = 14 + far * 40 // the open middle, wider further back
    if (Math.abs(x) < clear) continue
    const h = 12 + r() * 26 + far * 26
    const rad = 1.6 + r() * 3.2 + far * 4
    const geo = new THREE.CylinderGeometry(rad * (0.3 + r() * 0.3), rad, h, 5 + Math.floor(r() * 3), 1)
    geo.translate(0, -12 + h / 2 - r() * 6, 0)
    geo.rotateY(r() * 6)
    geo.translate(x, 0, z)
    ;(far < 0.3 ? geos.near : far < 0.65 ? geos.mid : geos.far).push(geo)
  }
  // near ones dark, the far ones lighter and lost in the pink haze: depth without any lights
  const mats = { near: '#24112f', mid: '#45204f', far: '#6a2e66' }
  Object.entries(geos).forEach(([k, list]) => {
    if (!list.length) return
    const merged = mergeAll(list)
    const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: mats[k], flatShading: true, roughness: 0.9 }))
    scene.add(m)
  })
}
function mergeAll(list) {
  // a small merge (positions + normals only), so the spires are three draw calls
  let count = 0
  const parts = list.map(g => { const n = g.toNonIndexed(); count += n.attributes.position.count; return n })
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3)
  let o = 0
  parts.forEach(g => {
    pos.set(g.attributes.position.array, o * 3)
    nor.set(g.attributes.normal.array, o * 3)
    o += g.attributes.position.count
    g.dispose()
  })
  list.forEach(g => g.dispose())
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.computeVertexNormals()
  return out
}

function buildClouds(scene) {
  // a sea of soft clouds below the bridge, slowly drifting
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      varying vec2 vUv; varying vec3 vW; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec2 p = vW.xz * 0.045 + vec2(uTime * 0.012, 0.0);
        float c = fbm(p) * 0.8 + fbm(p * 2.7 - uTime * 0.02) * 0.4;
        float dist = length(vW.xz) / 160.0;
        vec3 lo = vec3(0.30, 0.10, 0.36), hi = vec3(0.98, 0.62, 0.80);
        vec3 col = mix(lo, hi, smoothstep(0.35, 0.95, c));
        col = mix(col, vec3(0.86, 0.36, 0.58), smoothstep(0.2, 1.0, dist));
        gl_FragColor = vec4(col, smoothstep(0.25, 0.6, c) * (1.0 - smoothstep(0.7, 1.0, dist)) * 0.95 + 0.05);
      }`,
  })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat)
  m.rotation.x = -Math.PI / 2
  m.position.y = -7
  scene.add(m)
  return mat
}

function buildBridge(scene) {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.85 })
  const woodDark = new THREE.MeshStandardMaterial({ color: '#5a3628', roughness: 0.9 })
  const stone = new THREE.MeshStandardMaterial({ color: '#4a3458', roughness: 0.95, flatShading: true })
  // planks along the arch
  const plank = new THREE.BoxGeometry(0.34, 0.12, 2.2)
  const planks = new THREE.InstancedMesh(plank, wood, 64)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1)
  let n = 0
  for (let x = -HALF_BRIDGE; x <= HALF_BRIDGE + 0.01; x += 0.36) {
    const slope = Math.atan2(deckY(x + 0.05) - deckY(x - 0.05), 0.1)
    q.setFromEuler(new THREE.Euler(0, 0, slope + (n % 3 - 1) * 0.015))
    m4.compose(new THREE.Vector3(x, deckY(x) - 0.06 - (n % 2) * 0.01, 0), q, s)
    planks.setMatrixAt(n++, m4)
  }
  planks.count = n
  g.add(planks)
  // side beams following the arch, railing posts, and two rails
  const beamPts = z => Array.from({ length: 25 }, (_, i) => { const x = -HALF_BRIDGE - 0.3 + (i / 24) * (HALF_BRIDGE * 2 + 0.6); return new THREE.Vector3(x, deckY(x) - 0.22, z) })
  ;[-1.12, 1.12].forEach(z => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beamPts(z)), 40, 0.1, 6), woodDark)))
  const postGeo = new THREE.BoxGeometry(0.14, 1.25, 0.14)
  const posts = new THREE.InstancedMesh(postGeo, woodDark, 30)
  let p = 0
  const lanterns = []
  for (let x = -HALF_BRIDGE; x <= HALF_BRIDGE + 0.01; x += 1.75) {
    m4.makeTranslation(x, deckY(x) + 0.55, -1.05)
    posts.setMatrixAt(p++, m4)
    if (p % 2) lanterns.push(new THREE.Vector3(x, deckY(x) + 1.35, -1.05))
  }
  posts.count = p
  g.add(posts)
  const railPts = (y, z) => Array.from({ length: 25 }, (_, i) => { const x = -HALF_BRIDGE + (i / 24) * HALF_BRIDGE * 2; return new THREE.Vector3(x, deckY(x) + y, z) })
  ;[0.62, 1.12].forEach(y => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts(y, -1.05)), 48, 0.035, 5), woodDark)))
  // lanterns: warm cubes of light on every other post, with soft halos
  const lampGeo = new THREE.BoxGeometry(0.2, 0.26, 0.2)
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffe0a8', toneMapped: false })
  lanterns.forEach(v => {
    const l = new THREE.Mesh(lampGeo, lampMat)
    l.position.copy(v)
    g.add(l)
    const h = sprite(GLOW, '#ffb86b', 2.2, 0.75)
    h.position.copy(v)
    g.add(h)
  })
  // stone piers at both ends, dropping into the clouds
  ;[-1, 1].forEach(side => {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.6, 12, 6), stone)
    pier.position.set(side * (HALF_BRIDGE + 1.4), -5.6, 0)
    g.add(pier)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.6, 0.6, 6), stone)
    cap.position.set(side * (HALF_BRIDGE + 1.4), 0.2, 0)
    g.add(cap)
    const torch = sprite(GLOW, '#ff8fc0', 3.4, 0.7)
    torch.position.set(side * (HALF_BRIDGE + 1.4), 1.6, 0)
    g.add(torch)
  })
  scene.add(g)
  return g
}

function buildMotes(scene, count) {
  // pink motes drifting up through the canyon
  const pos = new Float32Array(count * 3)
  const r = rand(11)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 90
    pos[i * 3 + 1] = -8 + r() * 30
    pos[i * 3 + 2] = -4 - r() * 60
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: GLOW, color: '#ff9fd8', size: 0.55, sizeAttenuation: true, ...additive }))
  scene.add(pts)
  return pts
}

// ---------- the game ----------
export function createStarfall(container, opts = {}) {
  const calm = !!opts.reduceMotion
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  container.appendChild(renderer.domElement)
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#a8457e', 45, 190)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900)
  const CAM_PLAY = new THREE.Vector3(0, 3.3, 14), LOOK_PLAY = new THREE.Vector3(0, 3.0, 0) // z is set to fit the screen
  const CAM_INTRO = new THREE.Vector3(-9, 9, 34), LOOK_INTRO = new THREE.Vector3(0, 2, -10)
  camera.position.copy(CAM_INTRO)
  camera.lookAt(LOOK_INTRO)

  scene.add(new THREE.HemisphereLight('#ffb0d8', '#2a1440', 1.15))
  const key = new THREE.DirectionalLight('#ffc8a0', 1.6)
  key.position.set(-8, 10, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#ff5fb0', 1.2)
  rim.position.set(10, 4, -10)
  scene.add(rim)

  const sky = buildSky(scene)
  buildMoon(scene)
  buildSpires(scene)
  const clouds = buildClouds(scene)
  buildBridge(scene)
  const motes = buildMotes(scene, calm ? 120 : 420)

  // the player: the same cube you are at home
  const me = createCube('#ff8fb8')
  if (opts.skin != null) me.setSkin(opts.skin)
  if (opts.hat != null) me.setHat(opts.hat)
  me.group.position.set(0, deckY(0), 0.3)
  scene.add(me.group)
  const meLight = sprite(GLOW, '#ffd0e8', 3.2, 0.35)
  scene.add(meLight)

  // falling things: pooled stars and meteors
  const starGeo = starGeometry()
  const rockGeo = new THREE.DodecahedronGeometry(0.36, 0)
  const mats = {
    gold: new THREE.MeshStandardMaterial({ color: STAR.gold.color, emissive: STAR.gold.color, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.2 }),
    wish: new THREE.MeshStandardMaterial({ color: STAR.wish.color, emissive: STAR.wish.color, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.2 }),
    rock: new THREE.MeshStandardMaterial({ color: '#2a1a2e', emissive: '#ff4a2a', emissiveIntensity: 0.25, roughness: 0.8, flatShading: true }),
  }
  const trailGeo = new THREE.PlaneGeometry(0.42, 3.2)
  trailGeo.translate(0, 1.6, -0.05)
  const falling = []
  function makeFaller(kind) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(kind === 'rock' ? rockGeo : starGeo, mats[kind])
    g.add(body)
    const col = kind === 'rock' ? '#ff6a3a' : STAR[kind].glow
    const halo = sprite(GLOW, col, kind === 'rock' ? 1.6 : 2.1, kind === 'rock' ? 0.6 : 0.9)
    g.add(halo)
    const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ map: TRAIL, color: col, opacity: 0.55, ...additive }))
    g.add(trail)
    scene.add(g)
    return { g, body, halo, trail, kind, live: false }
  }
  function spawn(kind) {
    let f = falling.find(o => !o.live && o.kind === kind)
    if (!f) { f = makeFaller(kind); falling.push(f) }
    f.live = true
    f.g.visible = true
    f.x = (Math.random() * 2 - 1) * playHalf
    f.y = 13.5
    f.vy = (kind === 'wish' ? 6.2 : kind === 'rock' ? 5.4 : 3.3 + Math.random() * 1.2) * (1 + (t / ROUND) * 0.55)
    f.sway = kind === 'wish' ? 1.3 : 0
    f.phase = Math.random() * 6
    f.spin = (Math.random() - 0.5) * 4
    f.missed = false
    f.fade = 1
    f.g.scale.setScalar(1)
    f.trail.material.opacity = 0.55
    f.halo.material.opacity = kind === 'rock' ? 0.6 : 0.9
    if (kind !== 'rock') stats.spawned++
  }

  // bursts of sparks and floating "+1"s, pooled
  const sparks = Array.from({ length: calm ? 40 : 120 }, () => { const s = sprite(GLOW, '#fff', 0.3, 0); s.visible = false; scene.add(s); return { s, life: 0, v: new THREE.Vector3() } })
  const pops = ['+1', '+3', '+5', 'ouch'].reduce((o, k) => { o[k] = textTexture(k === 'ouch' ? '×' : k, k === '+3' ? '#ff6fb8' : k === 'ouch' ? '#ff5a3a' : '#ffbf4a'); return o }, {})
  const popPool = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(1.4, 0.7, 1); s.visible = false; scene.add(s); return { s, life: 0 } })
  const ringGeo = new THREE.RingGeometry(0.4, 0.5, 40)
  const rings = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', ...additive, opacity: 0, side: THREE.DoubleSide })); m.visible = false; scene.add(m); return { m, life: 0 } })
  function burst(pos, color, n) {
    let k = 0
    for (const sp of sparks) {
      if (sp.life > 0) continue
      sp.life = 1
      sp.s.visible = true
      sp.s.position.copy(pos)
      sp.s.material.color.set(color)
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.4
      sp.v.set(Math.cos(a) * 3.2, 2 + e * 3, Math.sin(a) * 1.2).multiplyScalar(0.6 + Math.random() * 0.8)
      if (++k >= n) break
    }
    const r = rings.find(o => o.life <= 0)
    if (r) { r.life = 1; r.m.visible = true; r.m.position.copy(pos); r.m.material.color.set(color) }
  }
  function pop(pos, key) {
    const p = popPool.find(o => o.life <= 0)
    if (!p) return
    p.life = 1
    p.s.visible = true
    p.s.material.map = pops[key]
    p.s.material.needsUpdate = true
    p.s.position.copy(pos)
  }

  // ---- input: arrow keys or A/D, or drag/tap: the cube heads for where you point ----
  const keys = new Set()
  let aimX = null
  const onKey = (e, down) => {
    const k = e.key.toLowerCase()
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { e.preventDefault(); if (down) keys.add(k); else keys.delete(k); aimX = null }
  }
  const kd = e => onKey(e, true), ku = e => onKey(e, false)
  window.addEventListener('keydown', kd)
  window.addEventListener('keyup', ku)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3), hitP = new THREE.Vector3()
  let pointerDown = false
  const aim = e => {
    const r = renderer.domElement.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    if (ray.ray.intersectPlane(plane, hitP)) aimX = THREE.MathUtils.clamp(hitP.x, -playHalf, playHalf)
  }
  const pd = e => { pointerDown = true; aim(e) }
  const pm = e => { if (pointerDown || e.pointerType === 'mouse') aim(e) }
  const pu = () => { pointerDown = false }
  renderer.domElement.addEventListener('pointerdown', pd)
  renderer.domElement.addEventListener('pointermove', pm)
  window.addEventListener('pointerup', pu)

  // ---- size: the play area is as wide as the screen shows of the bridge ----
  let playHalf = 7
  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // stand back just far enough to see 8.5 m either side of the middle (more on a phone held upright)
    camera.fov = w / h < 1 ? 50 : 36
    camera.updateProjectionMatrix()
    const tan = Math.tan((camera.fov * Math.PI) / 360)
    CAM_PLAY.z = THREE.MathUtils.clamp(8.5 / (tan * camera.aspect), 12, 32)
    LOOK_PLAY.y = 3.0 + (CAM_PLAY.z - 14) * 0.05
    const halfW = tan * CAM_PLAY.z * camera.aspect
    playHalf = Math.min(HALF_BRIDGE - 0.8, halfW - 1.5)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  // ---- the round ----
  const stats = { score: 0, gold: 0, wish: 0, spawned: 0, rocks: 0, streak: 0, best: 0 }
  let state = 'wait' // wait -> intro -> count -> play -> outro -> done
  let t = 0, stateT = 0, spawnIn = 0.6, stun = 0, vx = 0, shake = 0, lastCount = 4
  const camPos = new THREE.Vector3().copy(CAM_INTRO), camLook = new THREE.Vector3().copy(LOOK_INTRO)

  function hud() { opts.onHud?.({ score: stats.score, time: Math.max(0, ROUND - t), streak: stats.streak, state, count: lastCount }) }

  function catchIt(f) {
    const pts = STAR[f.kind].pts
    stats.streak++
    stats.best = Math.max(stats.best, stats.streak)
    const bonus = stats.streak % 10 === 0 ? 2 : 0 // every 10 in a row: a little extra
    stats.score += pts + bonus
    stats[f.kind]++
    f.live = false
    f.g.visible = false
    const at = new THREE.Vector3(f.x, f.y, 0.3)
    burst(at, STAR[f.kind].color, calm ? 8 : 22)
    pop(at.clone().add(new THREE.Vector3(0, 0.8, 0)), bonus ? '+5' : pts === 3 ? '+3' : '+1')
    opts.onSfx?.('star')
    hud()
  }
  function hitRock(f) {
    f.live = false
    f.g.visible = false
    stats.rocks++
    stats.streak = 0
    stun = 0.7
    shake = calm ? 0 : 0.35
    burst(new THREE.Vector3(f.x, f.y, 0.3), '#ff6a3a', calm ? 6 : 18)
    pop(new THREE.Vector3(f.x, f.y + 0.9, 0.3), 'ouch')
    opts.onSfx?.('error')
    hud()
  }

  let raf = 0, last = performance.now(), clock = 0
  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    if (document.hidden) return
    clock += dt
    stateT += dt

    // ---- the camera: drift over the canyon while waiting, glide in to the bridge, then hold the side view ----
    const intro = state === 'intro'
    if (state === 'wait') {
      camPos.set(CAM_INTRO.x + Math.sin(clock * 0.12) * 4, CAM_INTRO.y + Math.sin(clock * 0.2) * 0.6, CAM_INTRO.z)
      camLook.copy(LOOK_INTRO)
    } else {
      const k = intro ? 1 - Math.exp(-dt * 1.8) : 1 - Math.exp(-dt * 5)
      camPos.lerp(CAM_PLAY, k)
      camLook.lerp(LOOK_PLAY, k)
    }
    camera.position.copy(camPos)
    if (shake > 0) { shake = Math.max(0, shake - dt); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake }
    camera.lookAt(camLook)
    if (intro && stateT > 1.6) { state = 'count'; stateT = 0; lastCount = 3; opts.onSfx?.('tick'); hud() }
    if (state === 'count') {
      const c = 3 - Math.floor(stateT / 0.7)
      if (c !== lastCount) { lastCount = c; if (c > 0) opts.onSfx?.('tick'); hud() }
      if (stateT >= 2.1) { state = 'play'; stateT = 0; lastCount = 0; opts.onSfx?.('open'); hud() }
    }

    // ---- moving: keys accelerate, a pointer pulls you towards it; stunned for a moment after a meteor ----
    const px = me.group.position.x
    let want = 0
    if (keys.has('arrowleft') || keys.has('a')) want -= 1
    if (keys.has('arrowright') || keys.has('d')) want += 1
    if (aimX != null && !want) want = THREE.MathUtils.clamp((aimX - px) * 1.6, -1, 1)
    if (state !== 'play' && state !== 'count') want = 0
    if (stun > 0) { stun -= dt; want = 0 }
    vx += (want * 9.5 - vx) * Math.min(1, dt * 10)
    let nx = THREE.MathUtils.clamp(px + vx * dt, -playHalf, playHalf)
    if (nx === -playHalf || nx === playHalf) vx = 0
    me.group.position.set(nx, deckY(nx), 0.3)
    // face the way you move, lean into it, and squash a little when you turn
    const face = Math.abs(vx) > 0.4 ? Math.sign(vx) * Math.PI / 2 : 0
    me.group.rotation.y += (face - me.group.rotation.y) * Math.min(1, dt * 10)
    me.group.rotation.z = -vx * 0.025
    me.update(clock, dt, Math.abs(vx) > 0.5)
    if (stun > 0) me.group.visible = Math.floor(stun * 16) % 2 === 0
    else me.group.visible = true
    meLight.position.set(nx, deckY(nx) + CATCH_Y, 0.2)

    // ---- the round's clock and the falling things ----
    if (state === 'play') {
      t += dt
      spawnIn -= dt
      if (spawnIn <= 0) {
        const r = Math.random()
        const kind = t > 6 && r < 0.13 ? 'rock' : r < 0.25 ? 'wish' : 'gold'
        spawn(kind)
        spawnIn = 0.85 - (t / ROUND) * 0.45 + Math.random() * 0.25
      }
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) hud()
      if (t >= ROUND) { state = 'outro'; stateT = 0; hud() }
    }
    const cx = me.group.position.x, cy = me.group.position.y + CATCH_Y
    for (const f of falling) {
      if (!f.live) continue
      f.y -= f.vy * dt
      f.phase += dt * 2.4
      const x = f.x + Math.sin(f.phase) * f.sway
      f.g.position.set(x, f.y, 0.3)
      f.body.rotation.y += f.spin * dt
      f.body.rotation.z += f.spin * 0.3 * dt
      // caught? (anything still falling when the round ends just drifts on down)
      if (!f.missed && state === 'play' && Math.abs(x - cx) < 0.82 && f.y < cy + 0.75 && f.y > cy - 0.85) {
        if (f.kind === 'rock') hitRock(f); else catchIt(f)
        continue
      }
      // past the deck: it sinks into the clouds and fades away
      if (f.y < deckY(x) + 0.2) {
        f.missed = true
        f.fade -= dt * 1.5
        f.g.scale.setScalar(Math.max(0.01, f.fade))
        f.trail.material.opacity = 0.55 * Math.max(0, f.fade)
        f.halo.material.opacity = 0.9 * Math.max(0, f.fade)
        if (f.fade <= 0) { f.live = false; f.g.visible = false }
      }
    }
    if (state === 'outro' && stateT > 1.4 && !falling.some(f => f.live && !f.missed)) {
      state = 'done'
      opts.onEnd?.({ ...stats, caught: stats.gold + stats.wish })
    }
    if (state === 'done') me.group.rotation.y += dt * 6 // a little happy spin to finish

    // ---- effects ----
    for (const sp of sparks) {
      if (sp.life <= 0) continue
      sp.life -= dt * 1.6
      sp.v.y -= dt * 5
      sp.s.position.addScaledVector(sp.v, dt)
      sp.s.material.opacity = Math.max(0, sp.life)
      sp.s.scale.setScalar(0.12 + sp.life * 0.32)
      if (sp.life <= 0) sp.s.visible = false
    }
    for (const p of popPool) {
      if (p.life <= 0) continue
      p.life -= dt * 1.1
      p.s.position.y += dt * 1.4
      p.s.material.opacity = Math.min(1, p.life * 2)
      if (p.life <= 0) p.s.visible = false
    }
    for (const r of rings) {
      if (r.life <= 0) continue
      r.life -= dt * 2.2
      r.m.scale.setScalar(1 + (1 - r.life) * 3.2)
      r.m.material.opacity = Math.max(0, r.life) * 0.8
      if (r.life <= 0) r.m.visible = false
    }
    sky.material.uniforms.uTime.value = clock
    clouds.uniforms.uTime.value = clock
    if (!calm) {
      const a = motes.geometry.attributes.position
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * (0.25 + (i % 7) * 0.05)
        if (y > 22) y = -8
        a.setY(i, y)
      }
      a.needsUpdate = true
    }
    renderer.render(scene, camera)
  }

  last = performance.now()
  raf = requestAnimationFrame(frame)

  return {
    /** start a round (or another one): everything resets, the camera glides in, 3-2-1, go */
    play() {
      Object.assign(stats, { score: 0, gold: 0, wish: 0, spawned: 0, rocks: 0, streak: 0, best: 0 })
      falling.forEach(f => { f.live = false; f.g.visible = false })
      t = 0; stateT = 0; spawnIn = 0.6; stun = 0; vx = 0; lastCount = 4
      me.group.position.x = 0
      me.group.rotation.set(0, 0, 0)
      if (state === 'done') camPos.copy(CAM_PLAY).add(new THREE.Vector3(0, 1.5, 6)) // a replay: a short glide in
      state = 'intro'
      hud()
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('pointerup', pu)
      scene.traverse(o => {
        o.geometry?.dispose()
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        ms.forEach(m => { m.map?.dispose?.(); m.dispose() })
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
