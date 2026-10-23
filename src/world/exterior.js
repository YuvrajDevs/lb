import * as THREE from 'three'
import { W, H, T, HX, HZ, std, box, cyl, sphere } from './kit.js'
import { glow } from './fx.js'
import { FRONT_WIN, SIDE_WIN, BALCONY_DOOR } from '../game/areas.js'

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

/** the outside trim round a real window opening (the glass and inner frame belong to the room), plus shutters
    and a flower box. `u` is the opening's centre along the face. */
function windowTrim(g, face, u, w, y0, y1, { shutters = true, flowers = true } = {}) {
  const cx = face.pos(u, 0)
  const at = (along, off) => (face.axis === 'z' ? [cx[0] + along, cx[1] + face.nz * off] : [cx[0] + face.nx * off, cx[1] + along])
  const put = (sw, sh, sd, along, yy, off, color) => {
    const [x, z] = at(along, off)
    const m = box(g, face.axis === 'z' ? [sw, sh, sd] : [sd, sh, sw], [x, yy, z], color)
    m.castShadow = false
    return m
  }
  const h = y1 - y0
  ;[-1, 1].forEach(s => put(0.14, h + 0.28, 0.1, s * (w / 2 + 0.07), y0 - 0.14, 0.05, TRIM)) // side casings
  put(w + 0.42, 0.14, 0.1, 0, y1, 0.05, TRIM) // head
  if (y0 > 0.5) put(w + 0.5, 0.12, 0.22, 0, y0 - 0.12, 0.1, TRIM) // outside sill
  if (shutters) [-1, 1].forEach(s => put(0.5, h, 0.06, s * (w / 2 + 0.42), y0, 0.08, SHUTTER))
  if (flowers && y0 > 0.5) {
    put(w * 0.85, 0.3, 0.4, 0, y0 - 0.45, 0.25, '#7a5230')
    ;[-0.36, -0.12, 0.12, 0.36].forEach((k, i) => {
      const [x, z] = at(k * w, 0.25)
      sphere(g, 0.14, [x, y0 - 0.08, z], FLOWERS[i % 4])
    })
  }
}

/**
 * Dresses the outside of a room: coloured cladding with corner boards, windows with shutters and flower boxes,
 * a front door + porch for one room, a balcony for another. Everything is added to the room's own wall groups,
 * so it fades with them in the cutaway views.
 */
export function addExterior(walls, o) {
  let door = null
  const {
    storey, extLeft, extRight, doorFront = null, balcony = null, windows = [],
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
    // (every layer ends a slightly different distance past the corner, so their end faces never share a plane:
    //  cladding at the corner, plinth 1 cm past, top band 1.5 cm past, corner boards 2.5 cm past)
    [face.u0 + 0.14 - 0.0125, face.u1 - 0.14 + 0.0125].forEach(u => {
      box(g, face.axis === 'z' ? [0.305, H + 0.22, 0.12] : [0.12, H + 0.22, 0.305], face.axis === 'z' ? [u, -0.0, out(0.12, 0)] : [out(0.12, 0), -0.0, u], TRIM)
    })
    // top band + (ground floor) plinth
    box(g, face.axis === 'z' ? [face.u1 - face.u0 + 0.03, 0.3, 0.14] : [0.14, 0.3, face.u1 - face.u0 + 0.03], face.axis === 'z' ? [0, H - 0.1, out(0.14, 0)] : [out(0.14, 0), H - 0.1, 0], TRIM)
    if (!upper) {
      // the plinth stands out less than the corner boards (0.10 vs 0.12), so their faces never share a plane,
      // and it stops either side of a doorway instead of running across the threshold
      const doors = holes.filter(h => h[2] <= 0.1)
      const cuts = [face.u0 - 0.01, ...doors.flatMap(h => [h[0], h[1]]), face.u1 + 0.01]
      for (let k = 0; k < cuts.length; k += 2) {
        const a = cuts[k], b = cuts[k + 1], len = b - a, mid = (a + b) / 2
        if (len < 0.01) continue
        box(g, face.axis === 'z' ? [len, 0.6, 0.1] : [0.1, 0.6, len], face.axis === 'z' ? [mid, -0.05, out(0.1, 0)] : [out(0.1, 0), -0.05, mid], plinth)
      }
    }
  }

  // ---- front ----
  const fHoles = [
    ...(doorFront != null ? [[doorFront - 0.8, doorFront + 0.8, 0.02, 3.2]] : []),
    ...windows.map(x => [x - FRONT_WIN.w / 2, x + FRONT_WIN.w / 2, FRONT_WIN.y[0], FRONT_WIN.y[1]]),
    ...(balcony != null ? [[balcony - BALCONY_DOOR.w / 2, balcony + BALCONY_DOOR.w / 2, BALCONY_DOOR.y[0], BALCONY_DOOR.y[1]]] : []),
  ]
  clad(walls.front, faces.front, fHoles)
  // belt course hiding the floor-slab nameplate when the house is closed in
  box(walls.front, [W + 2 * T, 0.5, 0.09], [0, -0.5, HZ + T + 0.045], TRIM) // (0.09 deep: not flush with the plinth)

  windows.forEach(x => windowTrim(walls.front, faces.front, x, FRONT_WIN.w, FRONT_WIN.y[0], FRONT_WIN.y[1]))

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
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), std('#ffe2a8', { emissive: '#ffd27a', emissiveIntensity: 2 }))
    lamp.position.set(dx + 0.9, 3.1, HZ + T + 0.2)
    walls.front.add(lamp)
    glow(walls.front, [dx + 0.9, 3.1, HZ + T + 0.3], '#ffd27a', 2.0, 0.6)
    ;[-1.6, 1.6].forEach(s => {
      cyl(walls.front, 0.22, 0.4, [dx + s * 1.7, -0.3, HZ + T + 0.5], '#b9622f', {}, 12)
      sphere(walls.front, 0.3, [dx + s * 1.7, 0.4, HZ + T + 0.5], '#4f9a6a')
    })
  }

  // balcony with a glass door (bedroom)
  if (balcony != null) {
    const bx = balcony
    windowTrim(walls.front, faces.front, bx, BALCONY_DOOR.w, BALCONY_DOOR.y[0], BALCONY_DOOR.y[1], { shutters: false, flowers: false })
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
  box(walls.back, [W + 2 * T, 0.5, 0.09], [0, -0.5, -(HZ + T) - 0.045], TRIM)

  // ---- sides ----
  ;[['left', extLeft], ['right', extRight]].forEach(([name, on]) => {
    if (!on) return
    clad(walls[name], faces[name], SIDE_WIN.z.map(z => [z - SIDE_WIN.w / 2, z + SIDE_WIN.w / 2, SIDE_WIN.y[0], SIDE_WIN.y[1]]))
    box(walls[name], faces[name].axis === 'x' ? [0.09, 0.5, D2()] : [D2(), 0.5, 0.09], [faces[name].nx * (HX + T + 0.045), -0.5, 0], TRIM)
    SIDE_WIN.z.forEach(z => windowTrim(walls[name], faces[name], z, SIDE_WIN.w, SIDE_WIN.y[0], SIDE_WIN.y[1], { flowers: false }))
  })
  return { door }
}

function D2() { return 2 * (HZ + T) }
