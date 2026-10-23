import * as THREE from 'three'

// Things in the home you can click to use: lamps switch off and on, curtains open and close.
// The state lives per placed item (its uid) in the store: { off: true } for a lamp, { closed: true } for curtains.

/** which shop categories can be clicked, and what clicking does */
export const INTERACTIVE = { lamps: 'lamp', pendants: 'lamp', gardenlights: 'lamp', curtains: 'curtain' }

/** a switched-off lamp: its glow and light pool go, and the shade or bulb stops shining */
export function dimLamp(obj) {
  obj.traverse(o => {
    // the glow fades out but stays clickable: it is the easiest part of a small lamp to hit
    if (o.isSprite) { o.material = o.material.clone(); o.material.opacity = 0; return }
    if (!o.isMesh) return
    if (o.material.blending === THREE.AdditiveBlending) { o.visible = false; return } // light pools built into garden lights
    if (o.material.emissiveIntensity > 0.3) {
      // materials are shared between items: give this one its own copy before dimming it
      o.material = o.material.clone()
      o.material.emissiveIntensity *= 0.04
    }
  })
}

// ---------- curtains ----------
// Every curtain model is about 2.9 wide with a rod on top. Open pushes the fabric together at both ends of the rod;
// closed spreads it until the two halves meet in the middle. `o` runs from 0 (closed) to 1 (open).
const HALF = 1.45
const OPEN_SQUEEZE = 0.32

/** remember where each piece of fabric started, once */
export function prepCurtain(obj) {
  const model = obj.children[0]?.children[0]
  if (!model) return
  const box = new THREE.Box3()
  const parts = []
  model.children.forEach(c => {
    if (c.isMesh) {
      // in the model's own space (it is not in the scene yet, so world matrices are not ready)
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox()
      c.updateMatrix()
      box.copy(c.geometry.boundingBox).applyMatrix4(c.matrix)
      const w = box.max.x - box.min.x
      if (w > 2.7 || c.position.y > 2.45) return // the rod and the finials stay where they are
      parts.push({ o: c, x: c.position.x, sx: c.scale.x, inner: Math.min(Math.abs(box.min.x), Math.abs(box.max.x)), spans: box.min.x < -0.05 && box.max.x > 0.05 })
    } else if (c.isSprite || c.isGroup) parts.push({ o: c, x: c.position.x, sx: c.scale.x, inner: Math.abs(c.position.x), spans: false, keepScale: true })
  })
  // how far the fabric must stretch to close the gap in the middle (1 if it already covers it)
  const gap = Math.min(...parts.filter(p => !p.keepScale).map(p => (p.spans ? 0 : p.inner)), HALF)
  obj.userData.curtain = { parts, closeK: gap > 0.01 ? HALF / (HALF - gap) : 1, o: 1 }
}

export function setCurtain(obj, o) {
  const c = obj.userData.curtain
  if (!c) return
  c.o = o
  const f = c.closeK + (OPEN_SQUEEZE - c.closeK) * o
  c.parts.forEach(p => {
    const edge = p.x > 0.001 ? HALF : -HALF
    p.o.position.x = edge + (p.x - edge) * f
    if (!p.keepScale) p.o.scale.x = p.sx * f
  })
}
