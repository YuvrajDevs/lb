import * as THREE from 'three'

// Fake lighting: cheap additive glows, light pools and beams. These give the "lamp in a dark room" look
// without paying for a real light + shadow per lamp.

let radial, beam
function radialTexture() {
  if (radial) return radial
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  gr.addColorStop(0.6, 'rgba(255,255,255,0.1)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  radial = new THREE.CanvasTexture(c)
  radial.colorSpace = THREE.SRGBColorSpace
  return radial
}
function beamTexture() {
  if (beam) return beam
  const c = document.createElement('canvas')
  c.width = 4; c.height = 128
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 128)
  gr.addColorStop(0, 'rgba(255,255,255,0.9)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 4, 128)
  beam = new THREE.CanvasTexture(c)
  beam.colorSpace = THREE.SRGBColorSpace
  return beam
}

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }

/** soft glow around a lamp (always faces the camera) */
export function glow(parent, pos, color, size = 2, opacity = 0.7) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color, opacity, ...additive }))
  s.position.set(...pos)
  s.scale.setScalar(size)
  parent.add(s)
  return s
}

/** warm pool of light lying on a floor (or any horizontal surface) */
export function pool(parent, pos, color, radius = 2, opacity = 0.45) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: radialTexture(), color, opacity, ...additive })
  )
  m.rotation.x = -Math.PI / 2
  m.position.set(pos[0], pos[1] + 0.012, pos[2])
  m.userData.keep = true
  m.renderOrder = 2
  parent.add(m)
  return m
}

/** cone of light falling from a lamp: apex at `pos`, spreading downward */
export function cone(parent, pos, color, height = 2, radius = 1.2, opacity = 0.22) {
  const geo = new THREE.CylinderGeometry(0.12, radius, height, 28, 1, true)
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: beamTexture(), color, opacity, side: THREE.DoubleSide, ...additive }))
  m.position.set(pos[0], pos[1] - height / 2, pos[2])
  m.userData.keep = true
  m.renderOrder = 3
  parent.add(m)
  return m
}

/** a lamp's full effect in one call */
export function lampFx(parent, shadePos, floorPos, color, { size = 2.2, poolR = 2.4, coneH = null, coneR = 1.2 } = {}) {
  glow(parent, shadePos, color, size)
  if (floorPos) pool(parent, floorPos, color, poolR)
  if (coneH) cone(parent, shadePos, color, coneH, coneR)
}
