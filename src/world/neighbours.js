import * as THREE from 'three'
import { box } from './kit.js'
import { glow } from './fx.js'
import { bake } from './bake.js'

// The neighbours: the other homes in your world, each on its own plot along the cliff top. They are drawn
// simply (a few boxes, lit windows, a roof, a fence and a name board) so a whole street costs very little.

const CLAD = ['#eadfc6', '#c9d6c0', '#d9c8e0', '#e8d0c0', '#c8d8e8']
const ROOF = ['#9a5a50', '#5a6a8a', '#6a8a5a', '#8a5a7a', '#7a6a50']

function nameBoard(text) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#6b4f36'; g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#fff1d0'; g.font = '600 64px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 256, 66, 470)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** one neighbour's home at x (its plot's centre); couple homes are two storeys and wider */
function home(group, x, member, k) {
  const couple = member.kind === 'couple'
  const w = couple ? 22.8 : 11.4, d = 7.8, storeys = couple ? 2 : 1, fh = 5.52
  const half = couple ? 12.8 : 9.3
  const g = new THREE.Group()
  g.position.x = x
  const clad = CLAD[k % CLAD.length]
  // lawn, house body, slab lines
  box(g, [half * 2 + 0.6, 0.5, 15.0], [0, -1.0, 1.9], '#35564f')
  box(g, [w, storeys * fh - 0.72 + 0.2, d], [0, -0.2, 0], clad)
  // windows: warm and lit when they are home (online), dark otherwise
  const lit = new THREE.MeshStandardMaterial({ color: member.online ? '#ffe2a8' : '#2a2c3e', emissive: member.online ? '#ffcc66' : '#000000', emissiveIntensity: member.online ? 1.1 : 0 })
  for (let s = 0; s < storeys; s++) {
    const cols = couple ? [-8.6, -3.4, 3.4, 8.6] : [-3.4, 3.4]
    cols.forEach(cx => {
      box(g, [1.9, 2.6, 0.06], [cx, s * fh + 1.25, d / 2 + 0.01], lit)
      box(g, [2.2, 0.12, 0.16], [cx, s * fh + 1.13, d / 2 + 0.04], '#f6f1e6')
    })
  }
  box(g, [1.6, 3.1, 0.08], [couple ? 2.3 : 0, 0, d / 2 + 0.02], '#c8553d') // front door
  // a simple gable roof
  const rw = w / 2 + 0.6, rh = couple ? 3.6 : 2.6, top = storeys * fh - 0.72 + 0.22
  const tri = new THREE.Shape()
  tri.moveTo(-rw, 0); tri.lineTo(rw, 0); tri.lineTo(0, rh); tri.closePath()
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: d + 1, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: ROOF[k % ROOF.length], roughness: 0.6 }))
  roof.position.set(0, top, -(d + 1) / 2)
  roof.castShadow = true
  roof.userData.keep = true
  g.add(roof)
  // a low fence round the plot, with a gap for the gate, and a lantern either side of it
  const [zb, zf] = NEIGHBOUR_PLOT_Z
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    ;[0.2, 0.45].forEach(y => { const r = box(g, [0.05, 0.07, len], [(x0 + x1) / 2, -0.5 + y, (z0 + z1) / 2], '#f2eadb'); r.rotation.y = Math.atan2(x1 - x0, z1 - z0) })
  }
  rail(-half, zb, half, zb); rail(-half, zb, -half, zf); rail(half, zb, half, zf); rail(-half, zf, -1.3, zf); rail(1.3, zf, half, zf)
  ;[-1.3, 1.3].forEach(gx => glow(g, [gx, 0.55, zf], '#ffcc66', 1.4, 0.6))
  // the name board by the gate
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.1), new THREE.MeshStandardMaterial({ map: nameBoard(member.house), emissive: '#5a4030', emissiveMap: null, emissiveIntensity: 0.3 }))
  board.material.emissiveMap = board.material.map
  board.position.set(-4, 0.6, zf - 0.5)
  board.userData.keep = true
  g.add(board)
  group.add(g)
  return half
}

/** NEIGHBOUR_PLOT_Z: the back and front of every neighbour's fenced plot (the same depth as yours) */
export const NEIGHBOUR_PLOT_Z = [-(7.8 / 2 + 1.4), 7.8 / 2 + 5.2]

const GAP = 3 // between neighbouring fences: room to walk between the homes

/**
 * The street: every home in the world in one row, in the order people joined, the same for everyone, so a walk
 * from one home to the next looks the same on every screen. Yours is at x = 0. Returns [{ x, half, member }] in
 * the order of `members` (which includes you, marked `you`).
 */
export function streetPlots(members, myHalf) {
  const halfOf = m => (m.you ? myHalf : m.kind === 'couple' ? 12.8 : 9.3)
  let me = members.findIndex(m => m.you)
  const list = me < 0 ? [{ you: true }, ...members] : members
  if (me < 0) me = 0
  const out = list.map(m => ({ x: 0, half: halfOf(m), member: m }))
  let r = myHalf
  for (let i = me + 1; i < out.length; i++) { out[i].x = r + GAP + out[i].half; r = out[i].x + out[i].half }
  let l = -myHalf
  for (let i = me - 1; i >= 0; i--) { out[i].x = l - GAP - out[i].half; l = out[i].x - out[i].half }
  return out
}

/** the other homes' plots ([{ x, half, member }]), in street order */
export const neighbourPlots = (members, myHalf) => streetPlots(members, myHalf).filter(p => !p.member.you)

/** how far the street reaches to the left and right ([left, right] x) */
export function neighbourSpan(members, myHalf) {
  let left = -myHalf, right = myHalf
  streetPlots(members, myHalf).forEach(p => { left = Math.min(left, p.x - p.half); right = Math.max(right, p.x + p.half) })
  return [left, right]
}

/**
 * Builds the other homes along the street (see streetPlots).
 *   members: every home in the world [{ house, kind, online, you }], myHalf: half-width of your own plot
 */
export function buildNeighbours(members, myHalf) {
  const group = new THREE.Group()
  const spots = []
  neighbourPlots(members, myHalf).forEach(({ x, member }, k) => { home(group, x, member, k); spots.push(x) })
  group.userData.spots = spots // each neighbour's plot centre (x), in the same order as `members`
  bake(group)
  return group
}
