import * as THREE from 'three'

// Interior is W x D x H; the front (+z) is open in the default view, like a dollhouse.
export const W = 10.8
export const D = 7.2
export const H = 4.8
const HX = W / 2
const HZ = D / 2
const T = 0.3 // wall thickness

const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra })

const pick = (a, b, c) => (a.isMaterial ? a : std(a, b || c))

// size [w,h,d], pos [x, bottomY, z]
function box(parent, size, pos, color, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), pick(color, extra))
  m.position.set(pos[0], pos[1] + size[1] / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function cyl(parent, r, h, pos, color, extra, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), pick(color, extra))
  m.position.set(pos[0], pos[1] + h / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function sphere(parent, r, pos, color, extra) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), pick(color, extra))
  m.position.set(...pos)
  m.castShadow = true
  parent.add(m)
  return m
}

// wall slab with rectangular holes; faces use `face`, cut edges use `edge`
function wall(w, h, thick, holes, face, edge) {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.closePath()
  holes.forEach(([x0, y0, x1, y1]) => {
    const p = new THREE.Path()
    p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath()
    s.holes.push(p)
  })
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  const m = new THREE.Mesh(geo, [std(face), std(edge)])
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// ---------- textures ----------
const clamp01 = v => Math.min(1, Math.max(0, v))

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')]
}

function finish(c, { pixel = false, repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// chunky pixel-art wood grain (voxel look)
function woodTexture(base, { dark = 0.07, vertical = true, size = 64 } = {}) {
  const [c, g] = canvas(size, size)
  const hsl = {}
  new THREE.Color(base).getHSL(hsl, THREE.SRGBColorSpace)
  const lines = Array.from({ length: size }, () => (Math.random() - 0.5) * dark * 2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = hsl.l + (vertical ? lines[x] : lines[y]) + (Math.random() - 0.5) * dark * 0.7
      g.fillStyle = `hsl(${hsl.h * 360},${hsl.s * 100}%,${clamp01(l) * 100}%)`
      g.fillRect(x, y, 1, 1)
    }
  }
  return finish(c, { pixel: true, repeat: true })
}

function woodMat(base, rx, ry, opts) {
  const t = woodTexture(base, opts)
  t.repeat.set(rx, ry)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
}

function tatamiTexture() {
  const PPU = 120
  const [c, g] = canvas(W * PPU, D * PPU)
  g.fillStyle = '#93ad5f'
  g.fillRect(0, 0, c.width, c.height)
  // woven straw lines
  for (let y = 0; y < c.height; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(255,255,220,0.035)' : 'rgba(40,70,20,0.035)'
    g.fillRect(0, y, c.width, 1)
  }
  // mats: 3.6 x 1.8 units, staggered
  const mw = 3.6 * PPU, mh = 1.8 * PPU
  g.lineWidth = 4
  for (let row = 0; row < D / 1.8; row++) {
    const off = (row % 2) * 1.8 * PPU
    for (let x = -off; x < c.width; x += mw) {
      g.strokeStyle = '#2f4a2c'
      g.strokeRect(x + 2, row * mh + 2, mw - 4, mh - 4)
      // dark cloth edging on the short ends
      g.fillStyle = '#365236'
      g.fillRect(x, row * mh, 7, mh)
      g.fillRect(x + mw - 7, row * mh, 7, mh)
    }
  }
  return finish(c, { repeat: false, aniso: 8 })
}

function gingham(c1, c2) {
  const [c, g] = canvas(128, 128)
  g.fillStyle = c2; g.fillRect(0, 0, 128, 128)
  g.fillStyle = c1; g.globalAlpha = 0.55
  for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 16, 128); g.fillRect(0, i, 128, 16) }
  g.globalAlpha = 1
  const t = finish(c, { repeat: true })
  t.repeat.set(2, 6)
  return t
}

function eveningSky() {
  const [c, g] = canvas(704, 512)
  const gr = g.createLinearGradient(0, 0, 0, c.height)
  gr.addColorStop(0, '#3b3f86'); gr.addColorStop(0.45, '#b4608f'); gr.addColorStop(0.8, '#ff9a62'); gr.addColorStop(1, '#ffd08a')
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height)
  const sun = g.createRadialGradient(240, 400, 4, 240, 400, 240)
  sun.addColorStop(0, 'rgba(255,240,190,1)'); sun.addColorStop(0.2, 'rgba(255,205,130,0.8)'); sun.addColorStop(1, 'rgba(255,170,100,0)')
  g.fillStyle = sun; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(255,170,190,0.55)'
  ;[[150, 140, 1.1], [430, 100, 0.9], [610, 200, 1], [330, 230, 0.7]].forEach(([x, y, k]) => {
    [[0, 0, 56], [52, 10, 44], [-52, 12, 40], [24, -16, 38]].forEach(([dx, dy, r]) => {
      g.beginPath(); g.ellipse(x + dx * k, y + dy * k, r * k * 1.5, r * k * 0.55, 0, 0, 7); g.fill()
    })
  })
  // neighbourhood silhouettes with lit windows
  g.fillStyle = '#2c2346'
  const bx = [-20, 90, 200, 320, 430, 560, 650]
  bx.forEach((x, i) => {
    const w = 110 + (i % 3) * 20, h = 90 + ((i * 53) % 70)
    g.fillRect(x, c.height - h, w, h)
    g.beginPath(); g.moveTo(x - 6, c.height - h); g.lineTo(x + w / 2, c.height - h - 40); g.lineTo(x + w + 6, c.height - h); g.fill()
  })
  g.fillStyle = '#ffd27a'
  bx.forEach((x, i) => {
    for (let k = 0; k < 3; k++) if ((i + k) % 2 === 0) g.fillRect(x + 20 + k * 30, c.height - 70 + (k % 2) * 14, 12, 14)
  })
  return finish(c)
}

function labelTexture(text) {
  const [c, g] = canvas(1024, 96)
  g.fillStyle = '#efe0bd'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#7a4f35'
  g.font = '600 50px Georgia, serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, c.height / 2 + 3)
  return finish(c)
}

function calendarTexture() {
  const [c, g] = canvas(128, 160)
  g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, 128, 160)
  g.fillStyle = '#d9483b'; g.fillRect(0, 0, 128, 34)
  g.fillStyle = '#d9483b'; g.font = '700 84px system-ui, sans-serif'
  g.textAlign = 'center'; g.fillText('21', 64, 128)
  return finish(c)
}

function heartPath(g, cx, cy, s) {
  g.beginPath()
  g.moveTo(cx, cy + s * 0.9)
  g.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.8, cy - s * 1.3, cx, cy - s * 0.4)
  g.bezierCurveTo(cx + s * 0.8, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9)
  g.closePath()
}

// placeholder art; swap any frame later with setFrameImage(i, url)
function artTexture(kind, aspect) {
  const Hh = 320, Ww = Math.round(Hh * aspect)
  const [c, g] = canvas(Ww, Hh)
  const grad = (a, b) => { const x = g.createLinearGradient(0, 0, 0, Hh); x.addColorStop(0, a); x.addColorStop(1, b); return x }
  if (kind === 0) {
    g.fillStyle = grad('#ffd6c4', '#ff9fb8'); g.fillRect(0, 0, Ww, Hh)
    g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(Ww * 0.62, Hh * 0.45, Hh * 0.16, 0, 7); g.fill()
    g.fillStyle = '#b57fb0'; g.beginPath(); g.ellipse(Ww * 0.3, Hh, Ww * 0.6, Hh * 0.34, 0, 0, 7); g.fill()
    g.fillStyle = '#7d5a9c'; g.beginPath(); g.ellipse(Ww * 0.85, Hh * 1.05, Ww * 0.6, Hh * 0.3, 0, 0, 7); g.fill()
  } else if (kind === 1) {
    g.fillStyle = '#fff1e8'; g.fillRect(0, 0, Ww, Hh)
    g.fillStyle = '#ff8fb8'; heartPath(g, Ww * 0.42, Hh * 0.46, Hh * 0.2); g.fill()
    g.fillStyle = 'rgba(179,150,255,0.85)'; heartPath(g, Ww * 0.6, Hh * 0.56, Hh * 0.2); g.fill()
  } else if (kind === 2) {
    g.fillStyle = '#f6ece0'; g.fillRect(0, 0, Ww, Hh)
    ;['#e8a89a', '#f2c9a0', '#b9c7a5', '#9fb8c9'].forEach((col, i) => {
      g.fillStyle = col
      g.beginPath(); g.arc(Ww / 2, Hh * 0.88, Ww * (0.42 - i * 0.09), Math.PI, 0); g.fill()
    })
  } else if (kind === 3) {
    g.fillStyle = grad('#bfe3ff', '#e9f6ff'); g.fillRect(0, 0, Ww, Hh * 0.55)
    g.fillStyle = grad('#6fb4e6', '#3f86c4'); g.fillRect(0, Hh * 0.55, Ww, Hh * 0.45)
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(Ww * 0.3, Hh * 0.32, Hh * 0.1, 0, 7); g.fill()
  } else {
    g.fillStyle = grad('#cfe6ff', '#fbeaf2'); g.fillRect(0, 0, Ww, Hh)
    g.fillStyle = '#ff8fb8'; heartPath(g, Ww / 2, Hh * 0.5, Hh * 0.17); g.fill()
  }
  return finish(c)
}

function makeFrame(parent, w, h, pos, rotY, kind) {
  const g = new THREE.Group()
  g.position.set(...pos)
  g.rotation.y = rotY
  const border = box(g, [w + 0.18, h + 0.18, 0.06], [0, -(h + 0.18) / 2, 0], '#f5ecd8')
  border.castShadow = false
  const pic = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: artTexture(kind, w / h), color: '#b8b0a4', roughness: 0.8 })
  )
  pic.position.z = 0.034
  g.add(pic)
  parent.add(g)
  return {
    setImage(url) {
      new THREE.TextureLoader().load(url, tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        pic.material.map?.dispose()
        pic.material.map = tex
        pic.material.needsUpdate = true
      })
    },
  }
}

const BOOKS = ['#c0392b', '#e08a3c', '#e3cf72', '#4f9a74', '#3f78b8', '#8a5fa3', '#ece3d0', '#2f9db0']

// a row of standing books. axis 'x': runs along x, spines face +z. axis 'z': runs along z, spines face +x.
function bookRow(parent, axis, from, to, y, fixed, seed = 1, maxH = 0.65) {
  let r = seed
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  let p = from
  while (p < to - 0.14) {
    const w = 0.1 + rnd() * 0.09
    const h = 0.42 + rnd() * (maxH - 0.42)
    const col = BOOKS[Math.floor(rnd() * BOOKS.length)]
    if (axis === 'x') box(parent, [w, h, 0.5], [p + w / 2, y, fixed], col)
    else box(parent, [0.5, h, w], [fixed, y, p + w / 2], col)
    p += w + 0.012
  }
}

/** Builds the diorama. Returns { group, lights, colliders, bounds, walls, ceiling, frames, glows } */
export function buildRoom() {
  const group = new THREE.Group()
  const colliders = []
  const solid = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ })

  const wood = '#d9a763'
  const darkWood = '#6a4630'
  const cream = '#e9d9a4'
  const edge = '#efe3bf'

  // ---------- base ----------
  box(group, [W + 2 * T, 0.5, D + 2 * T], [0, -0.5, 0], edge, { emissive: '#8a6a3c', emissiveIntensity: 0.55 })
  const floorMat = new THREE.MeshStandardMaterial({ map: tatamiTexture(), roughness: 0.95 })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), floorMat)
  floor.position.y = -0.01
  floor.receiveShadow = true
  group.add(floor)

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.36),
    new THREE.MeshStandardMaterial({ map: labelTexture('our little room  ♥'), roughness: 0.8, emissive: '#c9a46a', emissiveMap: labelTexture('our little room  ♥'), emissiveIntensity: 0.5 })
  )
  label.position.set(0, -0.26, D / 2 + T + 0.005)
  group.add(label)

  // ---------- walls (each its own group so they can fade) ----------
  const walls = { back: new THREE.Group(), left: new THREE.Group(), front: new THREE.Group(), right: new THREE.Group() }
  Object.values(walls).forEach(w => group.add(w))

  // window on the back wall
  const WX0 = -2.2, WX1 = 0.6, WY0 = 2.0, WY1 = 4.2
  const back = wall(W + 2 * T, H, T, [[WX0 + HX + T, WY0, WX1 + HX + T, WY1]], cream, edge)
  back.position.set(-HX - T, 0, -HZ - T)
  walls.back.add(back)

  const left = wall(D + T, H, T, [], cream, edge)
  left.rotation.y = -Math.PI / 2
  left.position.set(-HX, 0, -HZ)
  walls.left.add(left)

  const right = wall(D + T, H, T, [], cream, edge)
  right.rotation.y = -Math.PI / 2
  right.position.set(HX + T, 0, -HZ)
  walls.right.add(right)

  const front = wall(W, H, T, [], cream, edge)
  front.position.set(-HX, 0, HZ)
  walls.front.add(front)

  // wood trim: rails + skirting + posts on every wall
  const trim = (parent, len, axis, fixed, y, h, d) => {
    if (axis === 'x') box(parent, [len, h, d], [0, y, fixed], darkWood)
    else box(parent, [d, h, len], [fixed, y, 0], darkWood)
  }
  trim(walls.back, W, 'x', -HZ + 0.07, 3.95, 0.2, 0.14)
  trim(walls.back, W, 'x', -HZ + 0.07, 0, 0.3, 0.14)
  trim(walls.front, W, 'x', HZ - 0.07, 3.95, 0.2, 0.14)
  trim(walls.front, W, 'x', HZ - 0.07, 0, 0.3, 0.14)
  trim(walls.left, D, 'z', -HX + 0.07, 3.95, 0.2, 0.14)
  trim(walls.left, D, 'z', -HX + 0.07, 0, 0.3, 0.14)
  trim(walls.right, D, 'z', HX - 0.07, 3.95, 0.2, 0.14)
  trim(walls.right, D, 'z', HX - 0.07, 0, 0.3, 0.14)
  ;[-HX + 0.1, -3.4, 2.4, HX - 0.1].forEach(x => box(walls.back, [0.2, H - 0.3, 0.14], [x, 0.3, -HZ + 0.07], darkWood))
  ;[-HX + 0.1, -2.2, 2.2, HX - 0.1].forEach(x => box(walls.front, [0.2, H - 0.3, 0.14], [x, 0.3, HZ - 0.07], darkWood))
  ;[-HZ + 0.1, 0.2, HZ - 0.1].forEach(z => box(walls.left, [0.14, H - 0.3, 0.2], [-HX + 0.07, 0.3, z], darkWood))
  ;[-HZ + 0.1, HZ - 0.1].forEach(z => box(walls.right, [0.14, H - 0.3, 0.2], [HX - 0.07, 0.3, z], darkWood))

  // ---------- window ----------
  const wz = -HZ - T / 2
  const frameC = '#f6f0e2'
  const wxm = (WX0 + WX1) / 2
  box(walls.back, [WX1 - WX0 + 0.4, 0.14, 0.4], [wxm, WY0 - 0.14, wz], frameC)
  box(walls.back, [WX1 - WX0 + 0.3, 0.14, 0.34], [wxm, WY1, wz], frameC)
  box(walls.back, [0.14, WY1 - WY0, 0.34], [WX0 - 0.07, WY0, wz], frameC)
  box(walls.back, [0.14, WY1 - WY0, 0.34], [WX1 + 0.07, WY0, wz], frameC)
  box(walls.back, [0.1, WY1 - WY0, 0.2], [wxm, WY0, wz], frameC)
  box(walls.back, [WX1 - WX0, 0.08, 0.2], [wxm, (WY0 + WY1) / 2 - 0.04, wz], frameC)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0),
    new THREE.MeshStandardMaterial({ color: '#ffe6c4', transparent: true, opacity: 0.1, roughness: 0.1 })
  )
  glass.position.set(wxm, (WY0 + WY1) / 2, wz + 0.02)
  walls.back.add(glass)

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.3),
    new THREE.MeshBasicMaterial({ map: eveningSky(), toneMapped: false })
  )
  sky.position.set(wxm, 2.85, -HZ - T - 0.3)
  walls.back.add(sky)

  // curtains with soft folds
  const curtainTex = gingham('#2f9a52', '#bfe3b8')
  const makeCurtain = (cx, w) => {
    const geo = new THREE.PlaneGeometry(w, 2.6, 24, 1)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * Math.PI * 6) * 0.05)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.95, side: THREE.DoubleSide }))
    m.position.set(cx, 4.3 - 1.3, -HZ + 0.22)
    m.castShadow = true
    m.receiveShadow = true
    walls.back.add(m)
  }
  makeCurtain(WX0 - 0.15, 1.0)
  makeCurtain(WX1 + 0.15, 1.0)
  const rod = cyl(walls.back, 0.04, 3.9, [wxm, 4.35, -HZ + 0.2], '#8a6a4a', {}, 8)
  rod.rotation.z = Math.PI / 2
  rod.position.y = 4.4

  // posters / frames on the back wall, right of the window
  const frames = [
    makeFrame(walls.back, 0.95, 1.3, [2.6, 3.9, -HZ + 0.03], 0, 1),
    makeFrame(walls.back, 0.95, 1.3, [3.8, 3.9, -HZ + 0.03], 0, 4),
    // inside face of the front wall (shown from inside / eyes view)
    makeFrame(walls.front, 1.8, 2.2, [-3.4, 3.7, HZ - 0.03], Math.PI, 0),
    makeFrame(walls.front, 2.6, 1.8, [0.1, 3.6, HZ - 0.03], Math.PI, 3),
    makeFrame(walls.front, 1.8, 2.2, [3.6, 3.7, HZ - 0.03], Math.PI, 2),
  ]
  const cal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.75),
    new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.8 })
  )
  cal.position.set(4.9, 3.0, -HZ + 0.04)
  walls.back.add(cal)

  // fairy lights along the back wall rail
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffc864', emissiveIntensity: 2.2 })
  for (let i = 0; i <= 18; i++) {
    const x = -5.0 + i * (10 / 18)
    const sag = Math.sin((i / 18) * Math.PI * 3) * 0.12
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), bulbMat)
    b.position.set(x, 4.5 - Math.abs(sag), -HZ + 0.2)
    walls.back.add(b)
  }

  // ---------- right wall: sliding closet doors ----------
  const doorFrame = darkWood
  box(walls.right, [0.14, 3.7, 6.3], [HX - 0.09, 0.3, -0.1], doorFrame)
  ;[[-1.55, 0], [1.45, 0.06]].forEach(([z, off], i) => {
    const x = HX - 0.2 - off
    box(walls.right, [0.07, 3.35, 2.95], [x, 0.4, z], '#f4ead3')
    box(walls.right, [0.08, 0.55, 2.95], [x - 0.005, 1.6, z], '#dd6a30') // orange band
    box(walls.right, [0.09, 3.35, 0.1], [x - 0.005, 0.4, z + (i ? -1.42 : 1.42)], darkWood)
    cyl(walls.right, 0.12, 0.05, [x - 0.04, 1.3, z + (i ? -1.1 : 1.1)], '#3a2a22', {}, 16).rotation.z = Math.PI / 2
  })
  // wall organiser (teal pocket) + coat hook
  box(walls.right, [0.3, 0.95, 0.75], [HX - 0.17, 2.4, 2.6], '#3bb6cc')
  box(walls.right, [0.32, 0.4, 0.77], [HX - 0.18, 2.4, 2.6], '#2a97ad')
  box(walls.right, [0.2, 0.2, 0.55], [HX - 0.13, 3.35, 2.6], '#2c2c36')

  // ---------- ceiling ----------
  const ceiling = new THREE.Group()
  const planks = woodMat('#b98a50', W / 3, D / 3, { dark: 0.07, vertical: true })
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * T, 0.22, D + 2 * T), planks)
  slab.position.y = H + 0.11
  slab.receiveShadow = true
  ceiling.add(slab)
  ;[-HX + 0.15, -3.5, 0, 3.5, HX - 0.15].forEach(x => box(ceiling, [0.22, 0.2, D], [x, H - 0.2, 0], darkWood))
  ;[-HZ + 0.15, HZ - 0.15].forEach(z => box(ceiling, [W, 0.2, 0.22], [0, H - 0.2, z], darkWood))
  group.add(ceiling)

  // pendant lamp (rectangular, like the reference); lives in the ceiling group so it hides with it
  const pend = new THREE.Group()
  pend.position.set(0.4, 0, -0.3)
  cyl(pend, 0.015, 0.9, [0, H - 0.9, 0], '#3a3a3a', {}, 6)
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd38a', emissiveIntensity: 1.6, roughness: 0.6 })
  const shade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.9), shadeMat)
  shade.position.y = H - 1.1
  pend.add(shade)
  box(pend, [1.5, 0.08, 1.0], [0, H - 0.92, 0], '#e9dcba')
  ceiling.add(pend)

  // ---------- back-wall furniture ----------
  // orange cabinet (back-left)
  const cabMat = woodMat('#c8683a', 1, 2, { dark: 0.035, vertical: false })
  box(group, [1.5, 2.7, 1.0], [-4.55, 0, -HZ + 0.5], cabMat)
  ;[0.35, 1.05, 1.75].forEach(y => box(group, [1.3, 0.55, 0.04], [-4.55, y + 0.2, -HZ + 1.02], '#d9835a'))
  box(group, [1.2, 0.2, 0.7], [-4.55, 2.7, -HZ + 0.5], '#5ec4d6') // blue box on top
  box(group, [0.8, 0.5, 0.6], [-4.45, 2.9, -HZ + 0.5], '#e8e0d0')
  solid(-5.35, -3.8, -HZ, -HZ + 1.05)

  // desk under the window
  const deskTop = woodMat('#dcab62', 2, 1, { dark: 0.04, vertical: false })
  box(group, [4.0, 0.14, 1.5], [-0.7, 1.7, -HZ + 0.75], deskTop)
  box(group, [0.12, 1.7, 1.4], [-2.58, 0, -HZ + 0.75], wood)
  box(group, [1.5, 1.7, 1.45], [0.58, 0, -HZ + 0.75], wood)
  ;[0.2, 0.7, 1.2].forEach(y => {
    box(group, [1.3, 0.44, 0.04], [0.58, y + 0.05, -HZ + 1.5], '#ecc787')
    box(group, [0.4, 0.07, 0.07], [0.58, y + 0.23, -HZ + 1.55], '#6b4a30')
  })
  box(group, [3.3, 1.2, 0.1], [-1.15, 0.2, -HZ + 0.07], '#b9894b') // back panel
  solid(-2.7, 1.35, -HZ, -HZ + 1.55)

  // desk items: lamp, books, pencil cup, mug, paper
  cyl(group, 0.2, 0.05, [-2.0, 1.84, -HZ + 0.6], '#3a3a42')
  const arm = box(group, [0.05, 0.9, 0.05], [-2.0, 1.88, -HZ + 0.6], '#3a3a42')
  arm.rotation.z = -0.25
  const lampShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#e8561e', emissive: '#ff8a2e', emissiveIntensity: 1.6, roughness: 0.5 })
  )
  lampShade.position.set(-1.78, 2.72, -HZ + 0.6)
  lampShade.rotation.z = 0.3
  group.add(lampShade)
  box(group, [0.55, 0.28, 0.4], [-1.25, 1.84, -HZ + 0.55], '#3f78b8')
  box(group, [0.5, 0.2, 0.38], [-1.25, 2.12, -HZ + 0.55], '#c0392b')
  cyl(group, 0.14, 0.32, [-0.3, 1.84, -HZ + 0.5], '#5ec4d6', {}, 14)
  ;[0, 1, 2].forEach(i => cyl(group, 0.012, 0.28 + i * 0.05, [-0.34 + i * 0.05, 2.1, -HZ + 0.5], ['#e8561e', '#f2d14a', '#3f78b8'][i], {}, 5))
  cyl(group, 0.13, 0.22, [0.2, 1.84, -HZ + 0.5], '#e9e4d6', {}, 14)
  sphere(group, 0.1, [0.62, 1.99, -HZ + 0.55], '#b96a3b') // teapot lid-ish
  cyl(group, 0.2, 0.28, [0.62, 1.84, -HZ + 0.55], '#a9552c', {}, 14)
  box(group, [0.6, 0.02, 0.42], [-0.7, 1.84, -HZ + 1.05], '#f2efe6').rotation.y = 0.2
  box(group, [0.5, 0.02, 0.36], [-0.2, 1.86, -HZ + 1.15], '#fff6d8').rotation.y = -0.35
  cyl(group, 0.05, 0.1, [-0.9, 1.84, -HZ + 0.4], '#2c2c36', {}, 10)

  // chair (teal), faces the desk
  const chair = new THREE.Group()
  chair.position.set(-0.7, 0, -1.7)
  chair.rotation.y = 0.12
  const teal = '#2a9fb0'
  cyl(chair, 0.07, 0.85, [0, 0.1, 0], '#33353e', {}, 10)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const arm5 = box(chair, [0.62, 0.06, 0.08], [Math.sin(a) * 0.3, 0.08, Math.cos(a) * 0.3], '#33353e')
    arm5.rotation.y = a + Math.PI / 2
    sphere(chair, 0.07, [Math.sin(a) * 0.6, 0.07, Math.cos(a) * 0.6], '#222228')
  }
  box(chair, [1.0, 0.16, 0.95], [0, 0.88, 0], teal)
  box(chair, [0.9, 0.7, 0.12], [0, 1.1, 0.5], teal)
  box(chair, [0.1, 0.4, 0.1], [0, 0.95, 0.38], '#33353e')
  group.add(chair)
  solid(-1.3, -0.1, -2.35, -1.0)

  // green bin + wall: right of desk
  cyl(group, 0.3, 0.75, [1.95, 0, -HZ + 0.5], '#5ea079', {}, 18)
  cyl(group, 0.31, 0.08, [1.95, 0.5, -HZ + 0.5], '#e9efe4', {}, 18)
  solid(1.6, 2.3, -HZ, -HZ + 0.85)

  // standing lamp in the back-right corner
  cyl(group, 0.28, 0.08, [4.7, 0, -HZ + 0.6], '#3a3a42', {}, 16)
  cyl(group, 0.04, 2.9, [4.7, 0.05, -HZ + 0.6], '#3a3a42', {}, 8)
  const standShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.5, 0.7, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc46a', emissiveIntensity: 1.7, side: THREE.DoubleSide })
  )
  standShade.position.set(4.7, 3.3, -HZ + 0.6)
  group.add(standShade)
  solid(4.35, 5.05, -HZ, -HZ + 0.95)

  // ---------- left wall: tall bookshelf ----------
  const shelfMat = woodMat('#d9a763', 2, 3, { dark: 0.045, vertical: true })
  const sx0 = -HX, sd = 1.45, z0 = 0.3, z1 = 3.45
  const sx = sx0 + sd / 2
  box(group, [sd, 4.5, 0.15], [sx, 0, z0 + 0.075], shelfMat)
  box(group, [sd, 4.5, 0.15], [sx, 0, z1 - 0.075], shelfMat)
  box(group, [0.08, 4.5, z1 - z0], [sx0 + 0.04, 0, (z0 + z1) / 2], shelfMat)
  ;[0.95, 1.85, 2.75, 3.65, 4.5].forEach(y => box(group, [sd, 0.12, z1 - z0], [sx, y - 0.06, (z0 + z1) / 2], shelfMat))
  ;[1.85, 2.75, 3.65].forEach((y, i) => {
    bookRow(group, 'z', z0 + 0.2, z1 - 0.2, y, sx0 + 0.6, 5 + i * 7)
  })
  // chunky toy boxes on top
  box(group, [0.9, 0.5, 1.1], [sx, 4.5, 1.0], '#3f78b8')
  box(group, [0.8, 0.4, 0.9], [sx, 4.5, 2.3], '#d9483b')
  box(group, [0.6, 0.35, 0.7], [sx + 0.1, 4.9, 1.0], '#f0e6d0')
  // lower cabinet doors
  ;[z0 + 0.8, z1 - 0.8].forEach(z => {
    box(group, [0.06, 0.78, 1.25], [sx0 + sd - 0.04, 0.08, z], '#e6bd7c')
    sphere(group, 0.05, [sx0 + sd + 0.02, 0.5, z + (z < 2 ? 0.45 : -0.45)], '#5b3a22')
  })
  // folded stuff on the middle shelf: a teal box + cartoon-ish lunch box
  box(group, [0.5, 0.35, 0.6], [sx0 + 0.55, 0.95, 1.0], '#2fb0c4')
  box(group, [0.5, 0.3, 0.5], [sx0 + 0.55, 0.95, 2.6], '#e8d9a0')
  solid(-HX, -HX + sd + 0.05, z0 - 0.05, z1 + 0.05)

  // ---------- floor decor ----------
  const cushion1 = box(group, [1.15, 0.16, 1.15], [-2.7, 0, 1.7], '#2fb0c4')
  cushion1.rotation.y = 0.45
  const cushion2 = box(group, [1.15, 0.16, 1.15], [2.0, 0, 2.2], '#2fb0c4')
  cushion2.rotation.y = -0.3
  const tray = box(group, [1.7, 0.1, 1.15], [3.2, 0, 0.7], '#3aa3d9')
  tray.rotation.y = 0.5
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
    const stud = cyl(group, 0.07, 0.05, [3.2 + (i - 1.5) * 0.3 * Math.cos(0.5) - (j - 2.5) * 0.24 * Math.sin(0.5), 0.1, 0.7 + (i - 1.5) * 0.3 * Math.sin(0.5) + (j - 2.5) * 0.24 * Math.cos(0.5)], '#52b8e6', {}, 8)
    stud.castShadow = false
  }
  [[-1.6, 2.4], [-0.2, 2.9], [0.9, 1.5], [1.4, 0.4], [-3.4, 0.4]].forEach(([x, z], i) => {
    sphere(group, 0.1, [x, 0.1, z], i % 2 ? '#f2efe6' : '#e9e4d6')
  })
  box(group, [0.5, 0.03, 0.38], [-1.9, 0.01, 3.0], '#f4c7a3').rotation.y = 0.8
  box(group, [0.45, 0.03, 0.34], [0.5, 0.01, 3.05], '#9fd0e8').rotation.y = -0.4
  box(group, [0.4, 0.03, 0.3], [3.8, 0.01, 2.6], '#f7f0dc').rotation.y = 0.3
  const bat = cyl(group, 0.05, 1.4, [4.9, 0.1, -0.6], '#d9b36a', {}, 8)
  bat.rotation.x = 0.08

  // ---------- lights (evening) ----------
  const lights = new THREE.Group()
  lights.add(new THREE.HemisphereLight('#ffcb9a', '#5b4a78', 0.5))

  const sun = new THREE.DirectionalLight('#ff9650', 2.6)
  sun.position.set(-3, 6.5, -16)
  sun.target.position.set(0, 0, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 40
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  lights.add(sun, sun.target)

  const pendant = new THREE.PointLight('#ffc57a', 62, 24, 2)
  pendant.position.set(0.4, H - 1.5, -0.3)
  pendant.castShadow = true
  pendant.shadow.mapSize.set(1024, 1024)
  pendant.shadow.bias = -0.002
  lights.add(pendant)

  const deskLamp = new THREE.PointLight('#ff9a3c', 26, 9, 2)
  deskLamp.position.set(-1.8, 2.6, -HZ + 0.9)
  lights.add(deskLamp)

  const standLamp = new THREE.PointLight('#ffb25a', 32, 12, 2)
  standLamp.position.set(4.4, 3.2, -HZ + 1.0)
  lights.add(standLamp)

  const frontFill = new THREE.PointLight('#ffd9a0', 7, 18, 2) // so the front half doesn't fall into shadow
  frontFill.position.set(-1.5, 3.4, 2.8)
  lights.add(frontFill)

  return { group, lights, colliders, bounds: Math.min(HX, HZ), halfX: HX, halfZ: HZ, walls, ceiling, frames }
}
