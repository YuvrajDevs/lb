import * as THREE from 'three'
import { W, H, T, HX, HZ, std, box, cyl, sphere } from './kit.js'
import { glow } from './fx.js'

const TRIM = '#f6f1e6'
const SHUTTER = '#3f6f78'
const DOOR = '#c8553d'
const FLOWERS = ['#f08ab0', '#f6d86a', '#ffffff', '#b896f0']

/** boxes covering [u0,u1] x [y0,y1] minus rectangular holes [[u0,u1,y0,y1]] */
function cover(u0, u1, y0, y1, holes, add) {
  const cuts = [u0, u1, ...holes.flatMap(h => [h[0], h[1]])].sort((a, b) => a - b)
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1]
    if (b - a < 1e-4) continue
    const mid = (a + b) / 2
    const h = holes.find(hh => mid > hh[0] && mid < hh[1])
    if (!h) add(a, b, y0, y1)
    else {
      if (h[2] > y0) add(a, b, y0, h[2])
      if (h[3] < y1) add(a, b, h[3], y1)
    }
  }
}

/** a lit window (glowing glass + frame + cross bars) on an outside face */
function litWindow(g, face, u, y0, w, h) {
  const cx = face.pos(u, 0.02)
  const glass = std('#ffe0a8', { emissive: '#ffc070', emissiveIntensity: 1.6 })
  const place = (sw, sh, sd, yy, off, mat) => {
    const m = box(g, face.axis === 'z' ? [sw, sh, sd] : [sd, sh, sw], [cx[0] + face.nx * off, yy, cx[1] + face.nz * off], mat)
    m.castShadow = false
    return m
  }
  place(w + 0.2, h + 0.2, 0.08, y0 - 0.1, 0.04, TRIM)
  place(w, h, 0.06, y0, 0.07, glass)
  place(0.06, h, 0.08, y0, 0.1, TRIM)
  place(w, 0.06, 0.08, y0 + h / 2 - 0.03, 0.1, TRIM)
}

/**
 * Dresses the outside of a room: coloured cladding with corner boards, windows with shutters and flower boxes,
 * a front door + porch for one room, a balcony for another. Everything is added to the room's own wall groups,
 * so it fades with them in the cutaway views.
 */
export function addExterior(walls, o) {
  let door = null
  const {
    storey, extLeft, extRight, doorFront = null, balcony = null, windows = [], sideWindows = [-1.4, 1.6],
    backHole = null, color, batten, plinth = '#8a7868',
  } = o
  const upper = storey === 'upper'
  const T2 = 0.05

  const faces = {
    front: { axis: 'z', nx: 0, nz: 1, plane: HZ + T, u0: -(HX + T), u1: HX + T, pos: (u, off) => [u, HZ + T + 0.05 + off] },
    back: { axis: 'z', nx: 0, nz: -1, plane: -(HZ + T), u0: -(HX + T), u1: HX + T, pos: (u, off) => [u, -(HZ + T) - 0.05 - off] },
    left: { axis: 'x', nx: -1, nz: 0, plane: -(HX + T), u0: -(HZ + T), u1: HZ + T, pos: (u, off) => [-(HX + T) - 0.05 - off, u] },
    right: { axis: 'x', nx: 1, nz: 0, plane: HX + T, u0: -(HZ + T), u1: HZ + T, pos: (u, off) => [HX + T + 0.05 + off, u] },
  }

  const clad = (g, face, holes) => {
    const out = (t, off) => face.plane + (face.nx + face.nz) * (off + t / 2)
    cover(face.u0, face.u1, 0, H, holes, (a, b, ya, yb) => {
      const len = b - a, mid = (a + b) / 2
      box(g, face.axis === 'z' ? [len, yb - ya, T2] : [T2, yb - ya, len], face.axis === 'z' ? [mid, ya, out(T2, 0)] : [out(T2, 0), ya, mid], color)
    })
    if (batten) {
      for (let u = face.u0 + 0.5; u < face.u1 - 0.3; u += 0.62) {
        if (holes.some(h => u > h[0] - 0.05 && u < h[1] + 0.05 && h[2] <= 0.1 && h[3] >= H - 0.1)) continue
        const hit = holes.find(h => u > h[0] - 0.05 && u < h[1] + 0.05)
        if (hit) continue
        box(g, face.axis === 'z' ? [0.07, H - 0.2, 0.025] : [0.025, H - 0.2, 0.07], face.axis === 'z' ? [u, 0.1, out(0.025, T2)] : [out(0.025, T2), 0.1, u], batten)
      }
    }
    // corner boards
    [face.u0 + 0.14, face.u1 - 0.14].forEach(u => {
      box(g, face.axis === 'z' ? [0.28, H + 0.22, 0.12] : [0.12, H + 0.22, 0.28], face.axis === 'z' ? [u, -0.0, out(0.12, 0)] : [out(0.12, 0), -0.0, u], TRIM)
    })
    // top band + (ground floor) plinth
    box(g, face.axis === 'z' ? [face.u1 - face.u0, 0.3, 0.14] : [0.14, 0.3, face.u1 - face.u0], face.axis === 'z' ? [0, H - 0.1, out(0.14, 0)] : [out(0.14, 0), H - 0.1, 0], TRIM)
    if (!upper) {
      box(g, face.axis === 'z' ? [face.u1 - face.u0, 0.6, 0.12] : [0.12, 0.6, face.u1 - face.u0], face.axis === 'z' ? [0, -0.05, out(0.12, 0)] : [out(0.12, 0), -0.05, 0], plinth)
    }
  }

  // ---- front ----
  const fHoles = doorFront != null ? [[doorFront - 0.8, doorFront + 0.8, 0.02, 3.2]] : []
  clad(walls.front, faces.front, fHoles)
  // belt course hiding the floor-slab nameplate when the house is closed in
  box(walls.front, [W + 2 * T, 0.5, 0.1], [0, -0.5, HZ + T + 0.05], TRIM)

  windows.forEach(x => {
    litWindow(walls.front, faces.front, x, 1.7, 1.3, 1.4)
    // shutters
    ;[-1, 1].forEach(s => box(walls.front, [0.4, 1.6, 0.06], [x + s * 0.95, 1.6, HZ + T + 0.12], SHUTTER))
    // flower box
    box(walls.front, [1.6, 0.3, 0.4], [x, 1.2, HZ + T + 0.25], '#7a5230')
    ;[-0.6, -0.2, 0.2, 0.6].forEach((dx, i) => sphere(walls.front, 0.14, [x + dx, 1.58, HZ + T + 0.25], FLOWERS[i % 4]))
  })

  if (doorFront != null) {
    const dx = doorFront
    ;[-1, 1].forEach(s => box(walls.front, [0.2, 3.4, 0.18], [dx + s * 0.9, 0, HZ + T + 0.06], TRIM))
    box(walls.front, [2.0, 0.22, 0.18], [dx, 3.2, HZ + T + 0.06], TRIM)
    // the door itself: hinged on its left edge, swings outward when someone walks up to it
    const pivot = new THREE.Group()
    pivot.position.set(dx - 0.75, 0, HZ + 0.15)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.1, 0.1), std(DOOR))
    panel.position.set(0.75, 1.55, 0)
    panel.castShadow = true
    panel.userData.keep = true
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.2), std('#e8c070'))
    knob.position.set(1.25, 1.5, 0)
    knob.userData.keep = true
    const inset = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.12), std('#a8432e'))
    inset.position.set(0.75, 2.2, 0)
    inset.userData.keep = true
    pivot.add(panel, knob, inset)
    walls.front.add(pivot)
    door = pivot
    // steps, a canopy on two posts, and a porch lamp
    box(walls.front, [2.2, 0.2, 1.0], [dx, -0.5, HZ + T + 0.6], '#cfc8b8')
    box(walls.front, [1.8, 0.2, 0.55], [dx, -0.3, HZ + T + 0.35], '#d8d2c2')
    ;[-1, 1].forEach(s => box(walls.front, [0.16, 3.4, 0.16], [dx + s * 1.25, -0.3, HZ + T + 1.3], TRIM))
    box(walls.front, [3.0, 0.2, 1.7], [dx, 3.45, HZ + T + 0.85], TRIM)
    box(walls.front, [3.2, 0.12, 1.9], [dx, 3.65, HZ + T + 0.85], '#9a5a50')
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), std('#ffe2a8', { emissive: '#ffbe70', emissiveIntensity: 2 }))
    lamp.position.set(dx + 0.9, 3.1, HZ + T + 0.2)
    walls.front.add(lamp)
    glow(walls.front, [dx + 0.9, 3.1, HZ + T + 0.3], '#ffbe70', 2.0, 0.6)
    ;[-1.6, 1.6].forEach(s => {
      cyl(walls.front, 0.22, 0.4, [dx + s * 1.7, -0.3, HZ + T + 0.5], '#b9622f', {}, 12)
      sphere(walls.front, 0.3, [dx + s * 1.7, 0.4, HZ + T + 0.5], '#4f9a6a')
    })
  }

  // balcony with a glass door (bedroom)
  if (balcony != null) {
    const bx = balcony
    box(walls.front, [1.7, 2.9, 0.1], [bx, 0.25, HZ + T + 0.08], TRIM)
    box(walls.front, [1.4, 2.7, 0.06], [bx, 0.3, HZ + T + 0.12], std('#ffe0a8', { emissive: '#ffc070', emissiveIntensity: 1.5 }))
    box(walls.front, [0.06, 2.7, 0.08], [bx, 0.3, HZ + T + 0.15], TRIM)
    box(walls.front, [3.4, 0.2, 1.3], [bx, -0.18, HZ + T + 0.65], '#b9a07a')
    const zr = HZ + T + 1.25
    box(walls.front, [3.4, 0.08, 0.08], [bx, 1.0, zr], TRIM)
    ;[-1, 1].forEach(s => box(walls.front, [0.08, 0.08, 1.2], [bx + s * 1.66, 1.0, HZ + T + 0.65], TRIM))
    for (let i = 0; i <= 8; i++) box(walls.front, [0.06, 0.95, 0.06], [bx - 1.66 + (3.32 * i) / 8, 0.02, zr], TRIM)
    ;[-1, 1].forEach(s => {
      cyl(walls.front, 0.18, 0.3, [bx + s * 1.2, 0.02, HZ + T + 0.85], '#b9622f', {}, 10)
      sphere(walls.front, 0.22, [bx + s * 1.2, 0.5, HZ + T + 0.85], FLOWERS[s > 0 ? 0 : 1])
    })
  }

  // ---- back (with the real window) ----
  clad(walls.back, faces.back, backHole ? [[backHole[0], backHole[1], backHole[2], backHole[3]]] : [])
  box(walls.back, [W + 2 * T, 0.5, 0.1], [0, -0.5, -(HZ + T) - 0.05], TRIM)

  // ---- sides ----
  ;[['left', extLeft], ['right', extRight]].forEach(([name, on]) => {
    if (!on) return
    clad(walls[name], faces[name], [])
    box(walls[name], faces[name].axis === 'x' ? [0.1, 0.5, D2()] : [D2(), 0.5, 0.1], [faces[name].nx * (HX + T + 0.05), -0.5, 0], TRIM)
    sideWindows.forEach(z => litWindow(walls[name], faces[name], z, 1.7, 1.3, 1.4))
  })
  return { door }
}

function D2() { return 2 * (HZ + T) }
