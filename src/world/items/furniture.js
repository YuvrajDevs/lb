import * as THREE from 'three'
import { std, box, cyl, sphere, BOOKS } from '../kit.js'
import { glow } from '../fx.js'

// Every builder: (tier 1..10, parent group). Origin = centre of the floor footprint, y = 0 is the floor, faces +z.
const em = (c, i = 1.8) => ({ emissive: c, emissiveIntensity: i })
const at = (arr, t) => arr[t - 1]
const GOLD = '#d4a838'
const METAL = { metalness: 0.6, roughness: 0.3 }
const sheer = { transparent: true, opacity: 0.35 }

export function bed(t, g) {
  const frame = at(['#c9b79c', '#c9985a', '#d8c4a0', '#8a5a3a', '#39406a', '#e0b8a8', '#5a2a4a', '#f2f2fa', GOLD, '#2a3050'], t)
  const duvet = at(['#cfd8e8', '#e8cfcf', '#9ab8d8', '#c9d6a8', '#6a7fd8', '#f2a9c8', '#8a2f7a', '#ffffff', '#b02f3f', '#4a6aff'], t)
  const y0 = t === 10 ? 0.55 : 0
  const fh = 0.3 + t * 0.02
  box(g, [2.1, fh, 3.3], [0, y0, 0], frame)
  box(g, [1.9, 0.26, 3.1], [0, y0 + fh, 0], '#f4efe8')
  box(g, [1.95, 0.16, 2.0], [0, y0 + fh + 0.26, 0.55], duvet)
  box(g, [0.8, 0.16, 0.5], [-0.46, y0 + fh + 0.26, -1.2], '#fffaf2')
  box(g, [0.8, 0.16, 0.5], [0.46, y0 + fh + 0.26, -1.2], t >= 5 ? duvet : '#fffaf2')
  if (t >= 2) box(g, [2.1, 0.5 + t * 0.07, 0.14], [0, y0, -1.58], frame)
  if (t >= 3) [0.1, 0.75].forEach(z => box(g, [1.97, 0.02, 0.2], [0, y0 + fh + 0.42, z], '#ffffff', { transparent: true, opacity: 0.45 }))
  if (t >= 5) {
    box(g, [2.0, 0.05, 3.2], [0, y0 + 0.02, 0], '#bff7ff', em('#5fe0ff', 2.4))
    glow(g, [0, y0 + 0.05, 0], '#5fe0ff', 4.2, 0.5)
  }
  if (t >= 6) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      box(g, [0.1, 2.0, 0.1], [sx * 1.0, y0, sz * 1.55], frame)
      if (t >= 9) sphere(g, 0.1, [sx * 1.0, y0 + 2.06, sz * 1.55], GOLD, em('#ffcf5a', 1.2))
    })
    box(g, [2.1, 0.08, 3.3], [0, y0 + 2.0, 0], frame)
    box(g, [2.0, 0.04, 3.2], [0, y0 + 1.96, 0], '#ffffff', sheer)
  }
  if (t >= 7) for (let i = -2; i <= 2; i++) for (let j = 0; j < 3; j++) box(g, [0.3, 0.3, 0.1], [i * 0.38, y0 + 0.4 + j * 0.33, -1.5], frame, { roughness: 0.5 })
  if (t >= 8) for (let i = 0; i < 7; i++) {
    sphere(g, 0.32, [-1.05, y0 + 0.2, -1.4 + i * 0.47], '#ffffff', em('#cfe0ff', 0.4))
    sphere(g, 0.32, [1.05, y0 + 0.2, -1.4 + i * 0.47], '#ffffff', em('#cfe0ff', 0.4))
  }
  if (t >= 9) box(g, [2.3, 0.12, 0.2], [0, y0 + 1.3, -1.6], GOLD, METAL)
  if (t === 10) {
    glow(g, [0, 0.1, 0], '#8bffd0', 5.2, 0.65)
    glow(g, [0, 0.1, 0.4], '#b48cff', 4.0, 0.5)
  }
}

export function wardrobe(t, g) {
  const body = at(['#b99a6a', '#d4a86a', '#e0c9a0', '#f1ece0', '#cfd8e0', '#9a6a4a', '#6a2f5a', '#8fb0c0', GOLD, '#2a3a5a'], t)
  const door = at(['#c9ab7a', '#e6c08a', '#f0dcb0', '#ffffff', '#e8f0f8', '#b98a6a', '#8a4a7a', '#b9d4e0', '#f3d98a', '#3a4f7a'], t)
  const w = 1.0 + Math.min(t, 6) * 0.2
  const tall = 2.7 + t * 0.05
  box(g, [w, tall, 0.75], [0, 0, 0], body)
  const half = w / 2
  box(g, [half - 0.06, 2.4, 0.05], [-half / 2, 0.15, 0.4], door)
  box(g, [half - 0.06, 2.4, 0.05], [half / 2, 0.15, t === 4 ? 0.44 : 0.4], door)
  box(g, [0.05, 0.4, 0.07], [-0.09, 1.3, 0.46], t >= 9 ? GOLD : '#4a3a2a')
  box(g, [0.05, 0.4, 0.07], [0.09, 1.3, 0.46], t >= 9 ? GOLD : '#4a3a2a')
  if (t >= 3) box(g, [w + 0.1, 0.12, 0.8], [0, tall, 0], body)
  if (t >= 5) box(g, [half - 0.2, 1.8, 0.03], [-half / 2, 0.45, 0.43], '#dff0ff', { metalness: 0.7, roughness: 0.1, emissive: '#7fb0d0', emissiveIntensity: 0.3 })
  if (t >= 6) box(g, [w - 0.2, 0.16, 0.06], [0, tall - 0.2, 0.41], door)
  if (t >= 7) for (let j = 0; j < 4; j++) box(g, [0.12, 0.12, 0.05], [-half / 2 - 0.2 + (j % 2) * 0.4, 0.6 + Math.floor(j / 2) * 1.2, 0.47], '#e8c86a')
  if (t === 8) {
    box(g, [w - 0.3, 2.3, 0.03], [0, 0.2, 0.46], '#dff0ff', { transparent: true, opacity: 0.35, metalness: 0.4 })
    ;[0.6, 1.2, 1.8].forEach(y => box(g, [w - 0.35, 0.04, 0.5], [0, y, 0.15], '#9fb0c0'))
    sphere(g, 0.18, [-0.2, 0.75, 0.15], '#e8566e')
    sphere(g, 0.15, [0.25, 1.35, 0.15], '#f2d14a')
  }
  if (t >= 9) box(g, [w + 0.14, 0.1, 0.84], [0, tall, 0], GOLD, METAL)
  if (t === 10) {
    box(g, [w - 0.3, 2.3, 0.03], [0, 0.2, 0.46], '#9fffe8', em('#5fe0c0', 1.4))
    glow(g, [0, 1.4, 0.6], '#6fffe0', 3.6, 0.5)
  }
}

export function table(t, g) {
  const top = at(['#b99a6a', '#d4a86a', '#e0b87a', '#c9985a', '#dff0ff', '#2f3138', '#f2f2f2', '#6a3f2a', GOLD, '#1d1f2a'], t)
  const leg = at(['#8a6a4a', '#b9894b', '#b9894b', '#7a5230', '#cfd8e0', '#47495a', '#d9d9d9', '#4a2a1a', '#a8842a', '#2f3350'], t)
  const round = t === 3 || t === 7 || t === 8
  const w = 1.6 + (t > 6 ? 0.6 : 0.3)
  const topMat = t === 5 ? { transparent: true, opacity: 0.55, metalness: 0.3 } : t >= 9 ? METAL : {}
  if (round) {
    cyl(g, w / 2, 0.1, [0, 0.95, 0], top, topMat, 36)
    cyl(g, 0.12, 0.95, [0, 0, 0], leg, {}, 10)
    cyl(g, 0.5, 0.06, [0, 0, 0], leg, {}, 18)
  } else {
    box(g, [w, 0.1, w * 0.62], [0, 0.95, 0], top, topMat)
    ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(g, [0.12, 0.95, 0.12], [sx * (w / 2 - 0.12), 0, sz * (w * 0.31 - 0.12)], leg))
  }
  if (t === 1) box(g, [w - 0.3, 0.06, 0.4], [0, 0.3, 0], leg)
  if (t === 4) {
    box(g, [0.5, 0.06, 0.38], [-0.3, 1.05, 0], '#cfd3d9')
    box(g, [0.45, 0.5, 0.03], [-0.3, 1.1, -0.15], '#2c2f38')
  }
  if (t === 6) {
    box(g, [0.9, 0.5, 0.05], [0, 1.35, -0.25], '#14151c')
    box(g, [0.84, 0.44, 0.03], [0, 1.38, -0.22], '#6fa8ff', em('#6fa8ff', 1.3))
    box(g, [0.1, 0.3, 0.1], [0, 1.05, -0.25], '#14151c')
    box(g, [0.7, 0.04, 0.22], [0, 1.05, 0.2], '#14151c')
    glow(g, [0, 1.4, -0.1], '#6fa8ff', 2.4, 0.45)
  }
  if (t === 8) {
    [-0.4, 0.4].forEach(x => {
      cyl(g, 0.05, 0.28, [x, 1.05, 0], '#f2efe6', {}, 8)
      sphere(g, 0.06, [x, 1.38, 0], '#ffcf6a', em('#ffb040', 2.2))
      glow(g, [x, 1.4, 0], '#ffb040', 0.9, 0.7)
    })
  }
  if (t === 7) cyl(g, 0.12, 0.3, [0.3, 1.05, 0.05], '#e8566e', {}, 12)
  if (t >= 9) box(g, [w + 0.06, 0.05, w * 0.62 + 0.06], [0, 0.92, 0], GOLD, METAL)
  if (t === 10) {
    box(g, [w, 0.03, w * 0.62], [0, 0.89, 0], '#ff5fd0', em('#ff5fd0', 2.4))
    glow(g, [0, 0.8, 0], '#ff5fd0', 4, 0.55)
    glow(g, [0, 0.9, 0], '#5fe0ff', 3, 0.4)
  }
}

export function shelf(t, g) {
  const wood = at(['#b99a6a', '#d4a86a', '#c9985a', '#f0ece0', '#9a6a4a', '#b0724a', '#6a3f2a', '#1d1f2a', '#8a5a3a', '#2a3050'], t)
  const w = 1.1 + Math.min(t, 6) * 0.18
  const h = 1.6 + t * 0.26
  const shelves = Math.min(2 + Math.floor(t / 2), 5)
  box(g, [0.1, h, 0.5], [-w / 2, 0, 0], wood)
  box(g, [0.1, h, 0.5], [w / 2, 0, 0], wood)
  box(g, [w, h, 0.05], [0, 0, -0.22], wood)
  for (let s = 0; s <= shelves; s++) {
    const y = (h - 0.08) * (s / shelves)
    box(g, [w, 0.08, 0.5], [0, y, 0], wood)
    if (s < shelves) {
      let x = -w / 2 + 0.15
      let r = t * 31 + s * 7
      const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
      while (x < w / 2 - 0.2) {
        const bw = 0.08 + rnd() * 0.07
        const bh = 0.35 + rnd() * 0.3
        if (rnd() > 0.2) box(g, [bw, Math.min(bh, h / shelves - 0.15), 0.3], [x + bw / 2, y + 0.08, 0.02], BOOKS[Math.floor(rnd() * BOOKS.length)])
        x += bw + 0.015
      }
    }
  }
  if (t === 3) {
    const lad = box(g, [0.06, h + 0.2, 0.05], [w / 2 + 0.2, 0, 0.35], '#8a6a4a')
    lad.rotation.x = -0.12
    for (let i = 0; i < 6; i++) box(g, [0.3, 0.04, 0.05], [w / 2 + 0.2, 0.3 + i * 0.4, 0.3 - i * 0.02], '#8a6a4a')
  }
  if (t >= 5) box(g, [w + 0.1, 0.1, 0.56], [0, h, 0], wood)
  if (t === 8) {
    for (let s = 0; s <= shelves; s++) box(g, [w - 0.2, 0.03, 0.04], [0, (h - 0.08) * (s / shelves) + 0.06, 0.2], '#fff4d0', em('#ffd27a', 2.2))
    glow(g, [0, h / 2, 0.3], '#ffd27a', 3.2, 0.4)
  }
  if (t >= 9) {
    box(g, [w + 0.14, 0.12, 0.6], [0, h + 0.05, 0], GOLD, METAL)
    sphere(g, 0.12, [-w / 2, h + 0.2, 0], GOLD, METAL)
    sphere(g, 0.12, [w / 2, h + 0.2, 0], GOLD, METAL)
  }
  if (t === 10) {
    box(g, [w, 0.03, 0.5], [0, h * 0.5, 0], '#9fffe8', em('#5fe0c0', 2.4))
    glow(g, [0, h * 0.5, 0.2], '#6fffe0', 3.6, 0.55)
  }
}

export function seating(t, g) {
  const col = at(['#b9894b', '#c9985a', '#e8a63c', '#4a8f96', '#e08a68', '#6f84a8', '#8a2f4a', '#f4f6ff', GOLD, '#4a6aff'], t)
  const cush = at(['#d9b27a', '#f2e8d0', '#f0b86a', '#6fb0b6', '#ea9a78', '#8fa4c8', '#a8445f', '#ffffff', '#b02f3f', '#7f9bff'], t)
  if (t === 1) {
    cyl(g, 0.4, 0.65, [0, 0, 0], col, {}, 16)
    cyl(g, 0.44, 0.08, [0, 0.62, 0], cush, {}, 16)
    return
  }
  if (t === 2) {
    box(g, [1.8, 0.45, 0.7], [0, 0, 0], col)
    box(g, [1.7, 0.16, 0.62], [0, 0.45, 0], cush)
    return
  }
  if (t === 3) {
    const b = sphere(g, 0.75, [0, 0.62, 0], col, { roughness: 1 })
    b.scale.set(1, 0.85, 1)
    box(g, [0.6, 0.05, 0.6], [0, 1.1, 0], cush)
    return
  }
  if (t === 8) {
    // "Cloud Sofa": a calm cream sofa with two seat cushions, two back cushions and a soft glow underneath
    const body = '#efe4d0', soft = '#fbf4e6', pillow = '#cfe3f6'
    box(g, [2.6, 0.32, 1.2], [0, 0.14, 0], body)                 // base
    box(g, [2.6, 0.95, 0.3], [0, 0.46, -0.45], body)             // back
    ;[-1, 1].forEach(x => box(g, [0.3, 0.7, 1.2], [x * 1.15, 0.46, 0], body)) // arms
    ;[-0.5, 0.5].forEach(x => {
      box(g, [0.96, 0.2, 0.86], [x, 0.46, 0.1], soft)            // seat cushions
      box(g, [0.94, 0.52, 0.2], [x, 0.66, -0.22], soft)          // back cushions
    })
    box(g, [0.34, 0.34, 0.1], [-0.95, 0.72, 0.0], pillow).rotation.z = 0.2
    box(g, [0.34, 0.34, 0.1], [0.95, 0.72, 0.0], pillow).rotation.z = -0.2
    box(g, [2.4, 0.04, 1.0], [0, 0.0, 0.0], '#bfe4ff', em('#8fc8ff', 1.4))
    glow(g, [0, 0.08, 0.1], '#9fd0ff', 3.2, 0.35)
    return
  }
  const w = t === 4 ? 1.3 : t === 6 ? 3.0 : 2.4
  box(g, [w, 0.5, 1.2], [0, 0, 0], col)
  box(g, [w, 0.85, 0.3], [0, 0.5, -0.45], t >= 7 ? cush : col)
  ;[-1, 1].forEach(s => box(g, [0.28, 0.75, 1.2], [s * (w / 2 - 0.14), 0, 0], t >= 7 ? cush : col))
  const n = Math.max(1, Math.round((w - 0.5) / 0.9))
  for (let i = 0; i < n; i++) box(g, [(w - 0.6) / n - 0.02, 0.16, 0.95], [-((w - 0.6) / 2) + ((w - 0.6) / n) * (i + 0.5), 0.5, 0.08], cush)
  if (t >= 5) box(g, [0.5, 0.45, 0.15], [-w / 2 + 0.55, 0.86, -0.05], '#f2c36b').rotation.z = 0.15
  if (t === 6) {
    box(g, [1.2, 0.5, 1.0], [-w / 2 + 0.6, 0, 1.1], col)
    box(g, [1.0, 0.16, 0.9], [-w / 2 + 0.6, 0.5, 1.1], cush)
  }
  if (t === 7) for (let i = -1; i <= 1; i++) for (let j = 0; j < 2; j++) box(g, [0.14, 0.14, 0.06], [i * 0.5, 0.95 + j * 0.2, -0.28], '#e8c86a')
  if (t >= 9) [-1, 1].forEach(s => box(g, [0.08, 0.1, 1.3], [s * (w / 2 - 0.02), 0.78, 0], GOLD, METAL))
  if (t === 10) {
    box(g, [w + 0.4, 0.05, 1.4], [0, 0, 0], '#7f9bff', em('#7f9bff', 2.4))
    glow(g, [0, 0.05, 0], '#7f9bff', 4.4, 0.6)
  }
}

// ---------- lighting ----------
export function lamp(t, g) {
  const shade = at(['#fff0c8', '#e8561e', '#ff9ec8', '#fff0c8', '#f4f4ff', '#ff7a7a', '#ff5fd0', '#bfe4ff', '#e8a63c', '#7f6aff'], t)
  const lit = at(['#ffe29a', '#ffa040', '#ff80b0', '#ffbe70', '#ffe9c0', '#ffb070', '#ff8ae0', '#9fe0ff', '#ffc060', '#b8a0ff'], t)
  const shadeMat = em(lit, 1.8)
  const metal = '#2f3138'
  if (t === 1) {
    cyl(g, 0.15, 0.05, [0, 0, 0], metal, {}, 12)
    cyl(g, 0.02, 0.6, [0, 0.05, 0], metal, {}, 6)
    sphere(g, 0.14, [0, 0.8, 0], '#fff3c8', em(lit, 2.4))
    glow(g, [0, 0.8, 0], lit, 1.6, 0.7)
  } else if (t === 2) {
    cyl(g, 0.22, 0.05, [0, 0, 0], metal, {}, 16)
    box(g, [0.05, 0.85, 0.05], [0, 0.03, 0], metal).rotation.z = -0.2
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(shade, shadeMat))
    d.position.set(0.17, 0.9, 0)
    g.add(d)
    glow(g, [0.17, 0.86, 0], lit, 2, 0.6)
  } else if (t === 3) {
    cyl(g, 0.1, 0.4, [0, 0, 0], '#f2efe6', {}, 12)
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(shade, shadeMat))
    m.position.y = 0.4
    g.add(m)
    glow(g, [0, 0.55, 0], lit, 2.4, 0.6)
  } else if (t === 4 || t === 5) {
    cyl(g, 0.25, 0.06, [0, 0, 0], metal, {}, 16)
    cyl(g, 0.035, 2.4, [0, 0.05, 0], metal, {}, 8)
    if (t === 5) box(g, [1.0, 0.05, 0.05], [0.5, 2.4, 0], metal)
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.65, 20, 1, true), std(shade, { ...shadeMat, side: THREE.DoubleSide }))
    sh.position.set(t === 5 ? 1.0 : 0, 2.55, 0)
    g.add(sh)
    glow(g, [sh.position.x, 2.5, 0], lit, 3, 0.6)
  } else if (t === 6) {
    cyl(g, 0.05, 0.7, [0, 0, 0], '#8a6a4a', {}, 8)
    const l = sphere(g, 0.5, [0, 1.1, 0], shade, { ...shadeMat, roughness: 0.7 })
    l.scale.y = 1.2
    glow(g, [0, 1.1, 0], lit, 3, 0.6)
  } else if (t === 7) {
    cyl(g, 0.22, 0.2, [0, 0, 0], metal, {}, 14)
    const body = cyl(g, 0.2, 0.9, [0, 0.2, 0], '#ffd0f0', { transparent: true, opacity: 0.7, ...em(lit, 1.6) }, 14)
    body.scale.x = 0.8
    sphere(g, 0.12, [0, 0.6, 0], '#ff5fd0', em('#ff5fd0', 2))
    sphere(g, 0.09, [0.05, 0.95, 0], '#ff8ae0', em('#ff8ae0', 2))
    cyl(g, 0.12, 0.1, [0, 1.1, 0], metal, {}, 14)
    glow(g, [0, 0.7, 0], lit, 2.6, 0.7)
  } else if (t === 8) {
    cyl(g, 0.2, 0.1, [0, 0, 0], metal, {}, 12)
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), std('#bfe4ff', { ...shadeMat, transparent: true, opacity: 0.85 }))
    c.position.y = 0.7
    c.scale.y = 1.5
    g.add(c)
    glow(g, [0, 0.7, 0], lit, 3.4, 0.7)
  } else if (t === 9) {
    cyl(g, 0.22, 0.06, [0, 0, 0], GOLD, METAL, 16)
    cyl(g, 0.04, 0.9, [0, 0.05, 0], GOLD, METAL, 8)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), std('#e8a63c', { ...shadeMat, side: THREE.DoubleSide }))
    dome.position.y = 0.95
    g.add(dome)
    ;['#2fb0c4', '#d9483b', '#4a8f6a'].forEach((c, i) => box(g, [0.18, 0.18, 0.04], [Math.sin(i * 2.1) * 0.35, 1.1 + (i % 2) * 0.1, Math.cos(i * 2.1) * 0.35], c, em(c, 0.8)))
    glow(g, [0, 1.0, 0], lit, 3.4, 0.6)
  } else {
    sphere(g, 0.5, [0, 1.3, 0], '#d8d0ff', { transparent: true, opacity: 0.75, ...em(lit, 1.8) })
    sphere(g, 0.3, [0.1, 1.35, 0.1], '#ffffff', em('#ffffff', 2))
    for (let i = 0; i < 5; i++) sphere(g, 0.04, [Math.sin(i * 1.7) * 0.8, 1.3 + Math.cos(i * 2.3) * 0.6, Math.cos(i * 1.7) * 0.8], '#ffffff', em('#ffffff', 2))
    glow(g, [0, 1.3, 0], lit, 4.4, 0.7)
    glow(g, [0, 1.3, 0], '#ff80d0', 3.2, 0.4)
  }
}

export function pendant(t, g) {
  const lit = at(['#ffe29a', '#ffbe70', '#ffe9c0', '#ffd38a', '#ffbe70', '#bff7ff', '#ffd9a0', '#d8f0ff', '#ffe29a', '#b8a0ff'], t)
  const top = 3.2
  const cord = (len, x = 0, z = 0) => cyl(g, 0.012, len, [x, top - len, z], '#2f3138', {}, 6)
  const bulb = (x, y, z, r = 0.12) => {
    sphere(g, r, [x, y, z], '#fff6dc', em(lit, 2.4))
    glow(g, [x, y, z], lit, r * 14, 0.6)
  }
  const cone = (x, y, r0, r1, h) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 16, 1, true), std('#fff0c8', { ...em(lit, 1.6), side: THREE.DoubleSide }))
    s.position.set(x, y, 0)
    g.add(s)
  }
  if (t === 1) {
    cord(0.8)
    bulb(0, top - 0.9, 0)
  } else if (t === 2) {
    cord(0.8)
    cone(0, top - 1.0, 0.15, 0.55, 0.4)
    bulb(0, top - 1.05, 0, 0.1)
  } else if (t === 3) {
    cord(0.7)
    sphere(g, 0.55, [0, top - 1.2, 0], '#fff3dc', em(lit, 1.5))
    glow(g, [0, top - 1.2, 0], lit, 3.4, 0.55)
  } else if (t === 4) {
    cord(0.8)
    box(g, [1.4, 0.4, 0.9], [0, top - 1.4, 0], '#fff0c8', em(lit, 1.6))
    box(g, [1.5, 0.08, 1.0], [0, top - 0.95, 0], '#e9dcba')
    glow(g, [0, top - 1.2, 0], lit, 3.2, 0.5)
  } else if (t === 5) {
    [-0.7, 0, 0.7].forEach((x, i) => {
      cord(0.5 + (i % 2) * 0.4, x)
      cone(x, top - 0.85 - (i % 2) * 0.4, 0.1, 0.32, 0.35)
      glow(g, [x, top - 0.9 - (i % 2) * 0.4, 0], lit, 1.8, 0.6)
    })
    box(g, [2.2, 0.06, 0.2], [0, top - 0.02, 0], '#2f3138')
  } else if (t === 6) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 40), std('#e8fcff', em(lit, 2.2)))
    r.rotation.x = Math.PI / 2
    r.position.y = top - 1.0
    g.add(r)
    ;[0, 1.6, 3.2, 4.7].forEach(a => cyl(g, 0.008, 0.9, [Math.sin(a) * 0.8, top - 0.9, Math.cos(a) * 0.8], '#2f3138', {}, 4))
    glow(g, [0, top - 1.0, 0], lit, 4.2, 0.45)
  } else if (t === 7) {
    cord(0.5)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      box(g, [0.06, 0.06, 0.6], [Math.sin(a) * 0.3, top - 0.8, Math.cos(a) * 0.3], '#6a4630').rotation.y = a
      cyl(g, 0.012, 0.35, [Math.sin(a) * 0.6, top - 1.15, Math.cos(a) * 0.6], '#fff6dc', em(lit, 1.5), 6)
      bulb(Math.sin(a) * 0.6, top - 1.2, Math.cos(a) * 0.6, 0.07)
    }
  } else if (t === 8) {
    cord(0.4)
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ring
      const r = 0.25 + ring * 0.28
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), std('#e8f4ff', { ...em(lit, 1.2), transparent: true, opacity: 0.9 }))
      c.position.set(Math.sin(a) * r, top - 0.7 - ring * 0.33, Math.cos(a) * r)
      c.scale.y = 1.8
      g.add(c)
    }
    glow(g, [0, top - 1.1, 0], lit, 5, 0.6)
  } else if (t === 9) {
    cord(0.4)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), std('#ffe9a0', { ...em('#ffe29a', 2.2), metalness: 0.3 }))
      s.position.set(Math.sin(a) * 0.7, top - 0.9 + Math.sin(i * 2) * 0.35, Math.cos(a) * 0.7)
      g.add(s)
      glow(g, [s.position.x, s.position.y, s.position.z], lit, 1.4, 0.6)
    }
    glow(g, [0, top - 0.9, 0], lit, 4.6, 0.5)
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 * 1.7
      const r = 0.3 + (i % 3) * 0.3
      const y = top - 0.5 - (i % 4) * 0.35
      const c = i % 2 ? '#b8a0ff' : '#8fe0ff'
      sphere(g, 0.12 + (i % 2) * 0.05, [Math.sin(a) * r, y, Math.cos(a) * r], '#ffffff', em(c, 2.2))
      glow(g, [Math.sin(a) * r, y, Math.cos(a) * r], c, 1.6, 0.6)
    }
  }
}
