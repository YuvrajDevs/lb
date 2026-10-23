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
  // bright along the top edge, fading downward, and soft at the two ends (no hard rectangle edges)
  const c = document.createElement('canvas')
  c.width = 128; c.height = 128
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 128)
  gr.addColorStop(0, 'rgba(255,255,255,0.9)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  g.globalCompositeOperation = 'destination-in'
  const side = g.createLinearGradient(0, 0, 128, 0)
  side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(0.15, 'rgba(0,0,0,1)'); side.addColorStop(0.85, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = side
  g.fillRect(0, 0, 128, 128)
  beam = new THREE.CanvasTexture(c)
  beam.colorSpace = THREE.SRGBColorSpace
  return beam
}

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }

/** soft glow around a lamp (always faces the camera) */
export function glow(parent, pos, color, size = 2, opacity = 0.7) {
  // halos are kept soft (0.6x) so lights read as cosy rather than glaring
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color, opacity: opacity * 0.6, ...additive }))
  s.position.set(...pos)
  s.scale.setScalar(size)
  parent.add(s)
  return s
}

/**
 * warm pool of light lying on a floor (or any horizontal surface).
 * `clip` ({ x0, x1, z0, z1 }, in the parent's coordinates) cuts it off at walls, so light never spills outside a room.
 */
export function pool(parent, pos, color, radius = 2, opacity = 0.45, clip = null) {
  const x0 = Math.max(pos[0] - radius, clip ? clip.x0 : -Infinity), x1 = Math.min(pos[0] + radius, clip ? clip.x1 : Infinity)
  const z0 = Math.max(pos[2] - radius, clip ? clip.z0 : -Infinity), z1 = Math.min(pos[2] + radius, clip ? clip.z1 : Infinity)
  if (x1 <= x0 || z1 <= z0) return null
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0)
  // keep the texture where it was: uv follows the cut edges
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    const x = x0 + u * (x1 - x0), z = z1 - v * (z1 - z0) // plane y+ becomes world -z after the rotation below
    uv.setXY(i, (x - pos[0] + radius) / (2 * radius), 1 - (z - pos[2] + radius) / (2 * radius))
  }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: radialTexture(), color, opacity, ...additive }))
  m.rotation.x = -Math.PI / 2
  m.position.set((x0 + x1) / 2, pos[1] + 0.012, (z0 + z1) / 2)
  m.userData.keep = true
  m.renderOrder = 2
  parent.add(m)
  return m
}

// a beam of light with no hard outline: brightest at the lamp, fading toward the floor, and fading out at its
// silhouette (where you look along the surface), so it reads as glowing air rather than a plastic cone
const beamVert = `varying float vY; varying float vRim;
  uniform float uH;
  void main(){
    vY = clamp(position.y / uH + 0.5, 0.0, 1.0); // pow() of a negative number is NaN, and the glow pass would smear it everywhere
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vRim = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`
const beamFrag = `uniform vec3 uColor; uniform float uOpacity; varying float vY; varying float vRim;
  void main(){
    float a = uOpacity * pow(max(vY, 0.0), 1.6) * smoothstep(0.0, 0.85, vRim) * smoothstep(0.0, 0.12, vY);
    gl_FragColor = vec4(uColor * a, 1.0);
  }`

/** cone of light falling from a lamp: apex at `pos`, spreading downward */
export function cone(parent, pos, color, height = 2, radius = 1.2, opacity = 0.22) {
  const geo = new THREE.CylinderGeometry(0.12, radius, height, 32, 1, true)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity * 1.6 }, uH: { value: height } },
    vertexShader: beamVert, fragmentShader: beamFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  // fading walls multiply `opacity`: keep the shader's own strength in step with it
  Object.defineProperty(mat, 'opacity', { get: () => mat.uniforms.uOpacity.value / 1.6 / opacity, set: v => { mat.uniforms.uOpacity.value = v * opacity * 1.6 } })
  const m = new THREE.Mesh(geo, mat)
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

/** light washing down a wall from a hidden cove strip near the ceiling (bright at the top, fading down) */
export function wash(parent, pos, w, h, color, opacity = 0.3, rotY = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: beamTexture(), color, opacity, side: THREE.DoubleSide, ...additive })
  )
  m.position.set(...pos)
  m.rotation.y = rotY
  m.userData.keep = true
  m.renderOrder = 2
  parent.add(m)
  return m
}
