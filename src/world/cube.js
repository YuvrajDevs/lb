import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { DEFAULT_SKIN, skinSpec, buildHat } from './skins.js'
import { faceTexture } from './faces.js'

const SIZE = 0.9
export const FLOAT = 1.3 // gap between floor and the cube's underside: it hovers a little above chair height
const bodyGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 5, 0.14)
const faceGeo = new THREE.PlaneGeometry(0.78, 0.78)

function blobTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  gr.addColorStop(0, 'rgba(30,15,30,0.55)')
  gr.addColorStop(1, 'rgba(30,15,30,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })

/** A blocky little person that floats. Origin is on the floor under it; it faces local +z. */
export function createCube(color) {
  const group = new THREE.Group()
  const floatNode = new THREE.Group()
  const pivot = new THREE.Group() // lean + squash happen here, anchored at the cube's underside
  group.add(floatNode)
  floatNode.add(pivot)

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: new THREE.Color(color).multiplyScalar(0.3) })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = SIZE / 2
  body.castShadow = false // shadows are baked once; the cube has its own soft contact shadow below
  body.receiveShadow = true
  pivot.add(body)

  // the face: soft white features on a see-through square just in front of the cube (see faces.js)
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture('neutral'), transparent: true, depthWrite: false, toneMapped: false })
  const face = new THREE.Mesh(faceGeo, faceMat)
  face.position.set(0, 0.02, SIZE / 2 + 0.012) // clear of the cube, or the two flicker from afar
  face.renderOrder = 2
  face.userData.keep = true
  body.add(face)
  let expression = null, expressionLeft = 0, spin = 0
  const showFace = kind => { const t = faceTexture(kind); if (faceMat.map !== t) { faceMat.map = t; faceMat.needsUpdate = true } }

  // hats sit on a little pivot on top of the body
  const hatPivot = new THREE.Group()
  hatPivot.position.set(0, SIZE / 2, 0)
  body.add(hatPivot)

  // soft contact shadow on the floor under the cube
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), blobMat)
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.025
  group.add(blob)

  let blinkAt = 2 + Math.random() * 3
  let phase = Math.random() * 6
  let lean = 0

  return {
    group,
    setVisible(v) { group.visible = v },
    /** skin: a tier number from the shop (1-10), or null for the default pink cube */
    setSkin(tier) {
      const spec = tier ? skinSpec(tier) : DEFAULT_SKIN
      bodyMat.map = spec.tex
      bodyMat.color.set(spec.color)
      bodyMat.emissive.set(spec.emissiveColor || spec.color).multiplyScalar(spec.glow)
      if (spec.tex) bodyMat.emissiveMap = spec.tex
      else bodyMat.emissiveMap = null
      bodyMat.needsUpdate = true
    },
    /** hat: a tier number from the shop (1-10), or null for none */
    setHat(tier) {
      hatPivot.clear()
      if (!tier) return
      const h = new THREE.Group()
      buildHat(tier, h)
      hatPivot.add(h)
    },
    /** show an expression for a few seconds (excited also spins) */
    express(kind) {
      expression = kind
      expressionLeft = kind === 'sleepy' ? 6 : 4
      if (kind === 'excited') spin = 1.1
    },
    update(t, dt, moving) {
      phase += dt * (moving ? 4.2 : 1.6)
      const bob = Math.sin(phase) * (moving ? 0.05 : 0.07)
      floatNode.position.y = FLOAT + bob
      lean += ((moving ? 0.14 : 0) - lean) * Math.min(1, dt * 8)
      pivot.rotation.x = lean
      const s = 1 - bob * 0.5
      blob.scale.setScalar(s)

      // an expression lasts a few seconds; otherwise the normal face, blinking now and then
      if (expression && (expressionLeft -= dt) <= 0) expression = null
      if (spin > 0) { spin = Math.max(0, spin - dt); pivot.rotation.y = (1 - spin / 1.1) ** 0.6 * Math.PI * 4 } else pivot.rotation.y = 0
      const k = t - blinkAt
      showFace(expression || (k > 0 && k < 0.12 ? 'blink' : 'neutral'))
      if (k > 0.12) blinkAt = t + 2 + Math.random() * 4
    },
  }
}
