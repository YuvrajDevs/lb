import * as THREE from 'three'

// Interior is W x D x H; the front (+z) is open in the default view, like a dollhouse.
export const W = 10.8
export const D = 7.2
export const H = 4.8
export const HX = W / 2
export const HZ = D / 2
export const T = 0.3 // wall thickness

export const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra })

export const pick = (a, b, c) => (a.isMaterial ? a : std(a, b || c))

// size [w,h,d], pos [x, bottomY, z]
export function box(parent, size, pos, color, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), pick(color, extra))
  m.position.set(pos[0], pos[1] + size[1] / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

export function cyl(parent, r, h, pos, color, extra, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), pick(color, extra))
  m.position.set(pos[0], pos[1] + h / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

export function sphere(parent, r, pos, color, extra) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), pick(color, extra))
  m.position.set(...pos)
  m.castShadow = true
  parent.add(m)
  return m
}

// wall slab with rectangular holes; faces use `face`, cut edges use `edge`
export function wall(w, h, thick, holes, face, edge) {
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
export const clamp01 = v => Math.min(1, Math.max(0, v))

export function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')]
}

export function finish(c, { pixel = false, repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter }
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// chunky pixel-art wood grain (voxel look)
export function woodTexture(base, { dark = 0.07, vertical = true, size = 64 } = {}) {
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

export function woodMat(base, rx, ry, opts) {
  const t = woodTexture(base, opts)
  t.repeat.set(rx, ry)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
}

export function tatamiTexture() {
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

export function gingham(c1, c2) {
  const [c, g] = canvas(128, 128)
  g.fillStyle = c2; g.fillRect(0, 0, 128, 128)
  g.fillStyle = c1; g.globalAlpha = 0.55
  for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 16, 128); g.fillRect(0, i, 128, 16) }
  g.globalAlpha = 1
  const t = finish(c, { repeat: true })
  t.repeat.set(2, 6)
  return t
}

export function eveningSky(kind = 0) {
  const [c, g] = canvas(704, 512)
  const gr = g.createLinearGradient(0, 0, 0, c.height)
  if (kind === 1) { gr.addColorStop(0, '#2f3278'); gr.addColorStop(0.5, '#a0558f'); gr.addColorStop(0.85, '#ff8a6a'); gr.addColorStop(1, '#ffc27a') }
  else { gr.addColorStop(0, '#3b3f86'); gr.addColorStop(0.45, '#b4608f'); gr.addColorStop(0.8, '#ff9a62'); gr.addColorStop(1, '#ffd08a') }
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

export function labelTexture(text) {
  const [c, g] = canvas(1024, 96)
  g.fillStyle = '#efe0bd'; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#7a4f35'
  g.font = '600 50px Georgia, serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, c.height / 2 + 3)
  return finish(c)
}

export function calendarTexture() {
  const [c, g] = canvas(128, 160)
  g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, 128, 160)
  g.fillStyle = '#d9483b'; g.fillRect(0, 0, 128, 34)
  g.fillStyle = '#d9483b'; g.font = '700 84px system-ui, sans-serif'
  g.textAlign = 'center'; g.fillText('21', 64, 128)
  return finish(c)
}

export function heartPath(g, cx, cy, s) {
  g.beginPath()
  g.moveTo(cx, cy + s * 0.9)
  g.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.8, cy - s * 1.3, cx, cy - s * 0.4)
  g.bezierCurveTo(cx + s * 0.8, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9)
  g.closePath()
}

// placeholder art; swap any frame later with setFrameImage(i, url)
export function artTexture(kind, aspect) {
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

export function makeFrame(parent, w, h, pos, rotY, kind) {
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

export const BOOKS = ['#c0392b', '#e08a3c', '#e3cf72', '#4f9a74', '#3f78b8', '#8a5fa3', '#ece3d0', '#2f9db0']

// a row of standing books. axis 'x': runs along x, spines face +z. axis 'z': runs along z, spines face +x.
export function bookRow(parent, axis, from, to, y, fixed, seed = 1, maxH = 0.65) {
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


// ---------- extra textures / geometry for the multi-room house ----------
export function plankTexture(base = '#c89a5e') {
  const PPU = 100
  const [c, g] = canvas(W * PPU, D * PPU)
  const hsl = {}
  new THREE.Color(base).getHSL(hsl, THREE.SRGBColorSpace)
  const rows = Math.round(D / 0.55)
  for (let r = 0; r < rows; r++) {
    const y0 = (r * c.height) / rows
    let x = -Math.random() * 250
    while (x < c.width) {
      const len = 260 + Math.random() * 380
      const l = hsl.l + (Math.random() - 0.5) * 0.08
      g.fillStyle = `hsl(${hsl.h * 360},${hsl.s * 100}%,${clamp01(l) * 100}%)`
      g.fillRect(x, y0, len, c.height / rows)
      g.fillStyle = 'rgba(60,35,15,0.5)'
      g.fillRect(x, y0, 3, c.height / rows)
      x += len
    }
    g.fillStyle = 'rgba(60,35,15,0.55)'
    g.fillRect(0, y0, c.width, 3)
  }
  return finish(c, { aniso: 8 })
}

export function stripeRug(c1, c2) {
  const [c, g] = canvas(256, 128)
  g.fillStyle = c2; g.fillRect(0, 0, 256, 128)
  g.fillStyle = c1
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 16, 128)
  g.strokeStyle = c1; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120)
  return finish(c)
}

export function tvTexture() {
  const [c, g] = canvas(256, 144)
  const gr = g.createLinearGradient(0, 0, 256, 144)
  gr.addColorStop(0, '#5aa7e8'); gr.addColorStop(0.55, '#f0a1c0'); gr.addColorStop(1, '#ffd48a')
  g.fillStyle = gr; g.fillRect(0, 0, 256, 144)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath(); g.arc(70, 50, 22, 0, 7); g.fill()
  g.fillStyle = '#3a4f9a'
  g.beginPath(); g.moveTo(0, 144); g.lineTo(90, 80); g.lineTo(170, 144); g.fill()
  g.fillStyle = '#2f3a7a'
  g.beginPath(); g.moveTo(110, 144); g.lineTo(190, 70); g.lineTo(256, 144); g.fill()
  return finish(c)
}

/** floor rectangle (y = top surface) whose UVs line up with a texture covering the whole W x D room */
export function rectFloor(x0, x1, z0, z1, y, material) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0)
  geo.rotateX(-Math.PI / 2)
  geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
  const p = geo.attributes.position, uv = geo.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + HX) / W, (HZ - p.getZ(i)) / D)
  const m = new THREE.Mesh(geo, material)
  m.receiveShadow = true
  return m
}

/** splits the W x D rect into rectangles that avoid `hole` {x0,x1,z0,z1} (hole touches the x = HX edge) */
export function rectsAround(hole) {
  if (!hole) return [[-HX, HX, -HZ, HZ]]
  return [
    [-HX, hole.x0, -HZ, HZ],
    [hole.x0, HX, -HZ, hole.z0],
    [hole.x0, HX, hole.z1, HZ],
  ]
}
