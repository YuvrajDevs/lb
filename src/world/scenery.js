import * as THREE from 'three'
import { glow } from './fx.js'

/**
 * The world around the house: the plot sits on top of a sea cliff. In front (+z) the ground ends in a
 * rocky drop to a moonlit ocean; behind (-z) a low-poly magical land rises in terraces, with pine trees,
 * glowing crystals, mushrooms and grass, a shining stream that spills over the cliff as a waterfall,
 * floating islands and fireflies. Like the references: faceted shapes, flat shading, little lights.
 *
 * Everything static is a handful of meshes; the sky, ocean, waterfall and fireflies are tiny shaders
 * driven by update(t).
 */

export { SUN_DIR }
export const CLIFF_Z = 14.2 // where the ground ends in front of the house
export const SEA_Y = -15
const GROUND_Y = -0.55 // just under the garden lawn (whose top is at -0.5)
// Thick fog that closes in around the island: measured from the house (not from the camera), squashed so
// it reaches further over the sea in front and a little further over the land behind. Past FOG_FAR it is solid.
export const FOG_NEAR = 34
export const FOG_FAR = 72
export const FOG_COLOR = new THREE.Color().setRGB(0.035, 0.035, 0.09, THREE.LinearSRGBColorSpace) // night-blue haze
const FOG_GLSL = 'float fogDist(vec3 w){ vec2 q = w.xz - vec2(0.0, 2.0); q.y *= q.y > 0.0 ? 0.45 : 0.8; return length(q); }'
// every built-in material uses this instead of camera distance (sprites have no "transformed", so go via the view matrix)
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth;\n ' + FOG_GLSL + '\n#endif'
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = fogDist((inverse(viewMatrix) * mvPosition).xyz);\n#endif'
const SUN_DIR = new THREE.Vector3(0.22, 0.22, 1).normalize() // the moon (or the evening sun), over the sea in front

// the look of the sky and sea at each time of day (linear colours). `glow` is [colour, strength, tightness] x2,
// `disc` is [colour, strength, size]: the moon or the sun.
const C = (r, g, b) => new THREE.Vector3(r, g, b)
export const PALETTES = {
  night: {
    sun: [0.22, 0.22, 1], fog: [0.035, 0.035, 0.09],
    top: C(0.006, 0.008, 0.035), mid: C(0.02, 0.025, 0.08), low: C(0.05, 0.05, 0.13),
    cloudA: C(0.05, 0.05, 0.11), cloudB: C(0.32, 0.34, 0.45), stars: 1,
    glowA: C(0.063, 0.072, 0.108), glowAk: 10, glowB: C(0.35, 0.375, 0.45), glowBk: 200, disc: C(2.6, 2.52, 2.34), discEdge: [0.9993, 0.9996],
    deep: C(0.005, 0.012, 0.04), shallow: C(0.02, 0.04, 0.09), skyLo: C(0.05, 0.05, 0.13), skyHi: C(0.01, 0.015, 0.05),
    spec: C(0.85, 0.9, 1.0), crest: C(0.45, 0.5, 0.62), foam: C(0.55, 0.6, 0.75), mist: ['#6a74b8', '#5a6aa8'],
  },
  evening: {
    sun: [0.18, 0.07, 1], fog: [0.24, 0.09, 0.19],
    top: C(0.06, 0.03, 0.16), mid: C(0.30, 0.10, 0.32), low: C(0.85, 0.36, 0.30),
    cloudA: C(0.62, 0.24, 0.40), cloudB: C(1.0, 0.58, 0.32), stars: 0.25,
    glowA: C(0.45, 0.225, 0.1), glowAk: 6, glowB: C(0.9, 0.65, 0.38), glowBk: 90, disc: C(3.0, 2.58, 1.86), discEdge: [0.9988, 0.9993],
    deep: C(0.03, 0.03, 0.10), shallow: C(0.10, 0.07, 0.20), skyLo: C(0.70, 0.30, 0.32), skyHi: C(0.22, 0.08, 0.26),
    spec: C(1.0, 0.62, 0.32), crest: C(0.8, 0.7, 0.78), foam: C(0.85, 0.7, 0.75), mist: ['#d8a0bc', '#b89ad8'],
  },
}
const skyU = {
  uTop: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uLow: { value: new THREE.Vector3() },
  uCloudA: { value: new THREE.Vector3() }, uCloudB: { value: new THREE.Vector3() }, uStars: { value: 1 },
  uGlowA: { value: new THREE.Vector3() }, uGlowAk: { value: 10 }, uGlowB: { value: new THREE.Vector3() }, uGlowBk: { value: 200 },
  uDisc: { value: new THREE.Vector3() }, uDiscEdge: { value: new THREE.Vector2() },
}
const seaU = {
  uDeep: { value: new THREE.Vector3() }, uShallow: { value: new THREE.Vector3() }, uSkyLo: { value: new THREE.Vector3() }, uSkyHi: { value: new THREE.Vector3() },
  uSpec: { value: new THREE.Vector3() }, uCrest: { value: new THREE.Vector3() }, uFoam: { value: new THREE.Vector3() },
}
/** switch the sky, sea, fog and mist to a time of day ('night' | 'evening') */
export function applyPalette(name) {
  const p = PALETTES[name] || PALETTES.night
  SUN_DIR.set(...p.sun).normalize()
  FOG_COLOR.setRGB(...p.fog, THREE.LinearSRGBColorSpace)
  ;['top', 'mid', 'low', 'cloudA', 'cloudB', 'glowA', 'glowB', 'disc'].forEach(k => skyU['u' + k[0].toUpperCase() + k.slice(1)].value.copy(p[k]))
  skyU.uStars.value = p.stars; skyU.uGlowAk.value = p.glowAk; skyU.uGlowBk.value = p.glowBk; skyU.uDiscEdge.value.set(...p.discEdge)
  ;['deep', 'shallow', 'skyLo', 'skyHi', 'spec', 'crest', 'foam'].forEach(k => seaU['u' + k[0].toUpperCase() + k.slice(1)].value.copy(p[k]))
  mistMats.forEach((m, i) => m.color.set(p.mist[i % 3 ? 0 : 1]))
}
const mistMats = []

// ---------- small deterministic noise ----------
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s) }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, z) => noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.28 + noise(x * 4.3, z * 4.3) * 0.12
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

// the glowing stream: winds down from the hills, past the left of the garden, to the cliff
export const FRONT_FLAT = 7.5 // in front of this line (towards the sea) the land is level

export const streamX = z => -20 + Math.sin(z * 0.075) * 4.5 + Math.sin(z * 0.19) * 1.2
const STREAM_TOP = -58

/** height of the land above GROUND_Y */
function heightAt(x, z) {
  // the garden stays flat, and so does the whole strip along the front (the cliff walk runs its full width)
  // (and a level strip along the cliff top, either side, where the neighbours' plots are; the stream keeps its valley)
  const plot = (Math.abs(x) < 15 && z > -8) || z > FRONT_FLAT || (Math.abs(x) < 58 && z > -8 && Math.abs(x - streamX(z)) > 5)
  if (plot) return 0
  const back = smooth(-8, -42, z) // rises behind the house
  const side = smooth(16, 40, Math.abs(x)) * 0.45 // gentle mounds to the sides
  let h = (back + side) * (4 + fbm(x * 0.06, z * 0.06) * 12)
  h = Math.floor(h / 1.6) * 1.6 + (h % 1.6) * 0.35 // terraces, like a carved diorama
  // a valley where the stream runs
  const d = Math.abs(x - streamX(z))
  if (z > STREAM_TOP) h *= smooth(1.2, 6, d) * 0.85 + 0.15
  // soften the land right at the cliff edge so the stream meets the drop
  if (z > CLIFF_Z - 4) h *= smooth(CLIFF_Z, CLIFF_Z - 4, z)
  return Math.max(0, h)
}

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0, ...extra })
const shine = color => new THREE.MeshBasicMaterial({ color, toneMapped: false })

// ---------- sky dome: gradient, stars, the moon, faint aurora over the magical land ----------
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR }, uHor: { value: FOG_COLOR }, ...skyU },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; uniform vec3 uHor; varying vec3 vDir;
      uniform vec3 uTop, uMid, uLow, uCloudA, uCloudB, uGlowA, uGlowB, uDisc; uniform float uStars, uGlowAk, uGlowBk; uniform vec2 uDiscEdge;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        float s = max(dot(d, normalize(uSun)), 0.0); // towards the moon
        // three bands of sky colour (see PALETTES): overhead, the middle, and low down
        vec3 c = mix(uLow, uMid, smoothstep(0.03, 0.32, h));
        c = mix(c, uTop, smoothstep(0.3, 0.85, h));
        // long soft clouds, lit orange near the sun and pink away from it
        float cl = vn(vec2(atan(d.z, d.x) * 2.6 + uTime * 0.004, h * 16.0)) * vn(vec2(atan(d.z, d.x) * 7.0, h * 40.0 + 3.0));
        float band = smoothstep(0.03, 0.1, h) * smoothstep(0.4, 0.14, h);
        vec3 cloudCol = mix(uCloudA, uCloudB, pow(s, 3.0)); // lit by the moon (or sun) on the side nearest it
        c = mix(c, cloudCol, smoothstep(0.18, 0.5, cl) * band * 0.6);
        // a sky full of small twinkling stars
        vec2 g = vec2(atan(d.z, d.x) * 140.0, d.y * 200.0);
        float r = h21(floor(g));
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
        c += vec3(0.95, 0.95, 1.0) * step(0.982, r) * smoothstep(0.38, 0.0, length(fract(g) - 0.5)) * tw * smoothstep(0.06, 0.3, h) * (0.5 + r * 0.6) * uStars;
        // the fog bank: solid at the horizon and below
        c = mix(uHor, c, smoothstep(0.0, 0.12, h));
        // the moon (or the sun) over the sea, with its halo
        c += uGlowA * pow(s, uGlowAk);
        c += uGlowB * pow(s, uGlowBk);
        c += uDisc * smoothstep(uDiscEdge.x, uDiscEdge.y, s);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat)
  sky.renderOrder = -10
  sky.frustumCulled = false
  sky.userData.keep = true
  return sky
}

// height of the swell at p (x, z) and its slope: returns (height, d/dx, d/dz). Waves roll in from the open sea (+z)
// toward the cliff, a little from the side; they flatten out right at the foot of the cliff.
const SWELL_GLSL = `
  vec3 swell(vec2 p, float t){
    vec3 s = vec3(0.0);
    vec4 A = vec4(0.38, 0.24, 0.13, 0.07);       // heights
    vec4 L = vec4(24.0, 14.0, 8.0, 4.5);         // wavelengths
    vec2 D[4]; D[0] = normalize(vec2(0.15, -1.0)); D[1] = normalize(vec2(-0.35, -1.0)); D[2] = normalize(vec2(0.6, -1.0)); D[3] = normalize(vec2(-0.8, -1.0));
    for (int i = 0; i < 4; i++) {
      float k = 6.2832 / L[i];
      float w = sqrt(9.8 * k) * 0.7;               // deep-water speed, a touch slower for calm
      float ph = k * dot(D[i], p) - w * t + float(i) * 1.7;
      s.x += A[i] * sin(ph);
      s.yz += A[i] * k * cos(ph) * D[i];
    }
    float calm = smoothstep(${CLIFF_Z.toFixed(1)} + 1.0, ${CLIFF_Z.toFixed(1)} + 7.0, p.y);
    return s * calm;
  }`

// ---------- the ocean: moving waves, the moon's glitter path, foam at the foot of the cliff ----------
function makeOcean() {
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR }, uCliff: { value: CLIFF_Z }, uFog: { value: FOG_COLOR }, uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR }, ...seaU },
    // rolling swells: a few long waves travelling in toward the cliff lift the surface itself; finer ripples
    // (below) only tilt the light. The swell's height and slope come from one shared function.
    vertexShader: `uniform float uTime; varying vec3 vW;
      ${SWELL_GLSL}
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += swell(w.xz, uTime).x;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; uniform float uCliff; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; varying vec3 vW;
      uniform vec3 uDeep, uShallow, uSkyLo, uSkyHi, uSpec, uCrest, uFoam;
      ${FOG_GLSL}
      ${SWELL_GLSL}
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float waves(vec2 p){
        float t = uTime;
        return vn(p * 0.18 + vec2(t * 0.09, -t * 0.16)) * 0.55 + vn(p * 0.45 - vec2(t * 0.22, t * 0.1)) * 0.3 + vn(p * 1.1 + vec2(t * 0.4, -t * 0.3)) * 0.15;
      }
      void main(){
        vec2 p = vW.xz;
        float e = 0.35;
        float hc = waves(p);
        vec3 sw = swell(p, uTime);
        vec3 n = normalize(vec3((hc - waves(p + vec2(e, 0.0))) * 3.2 - sw.y, 1.0, (hc - waves(p + vec2(0.0, e))) * 3.2 - sw.z));
        vec3 v = normalize(cameraPosition - vW);
        vec3 r = reflect(-v, n);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 deep = uDeep;
        vec3 shallow = uShallow;
        vec3 skyR = mix(uSkyLo, uSkyHi, smoothstep(0.0, 0.5, r.y));
        vec3 c = mix(deep, shallow, hc * 0.6);
        c = mix(c, skyR, 0.1 + fres * 0.6);
        // the moon's path of glitter on the water
        float spec = pow(max(dot(r, normalize(uSun)), 0.0), 260.0);
        float glints = pow(max(dot(r, normalize(uSun)), 0.0), 40.0) * smoothstep(0.88, 0.95, vn(p * 2.0 + uTime * 0.4));
        c += uSpec * (spec * 2.0 + glints * 0.8); // the moon's (or sun's) path of light on the water
        // a little white on the tops of the bigger swells
        c += uCrest * smoothstep(0.45, 0.7, sw.x) * smoothstep(0.6, 0.9, vn(p * 0.9 + uTime * 0.3)) * 0.18;
        // white foam lapping at the foot of the cliff
        float d = vW.z - uCliff;
        float foam = smoothstep(3.5, 0.0, d + vn(vec2(vW.x * 0.6, uTime * 0.5)) * 2.0) * (0.55 + 0.45 * sin(d * 3.0 - uTime * 2.0));
        c += uFoam * max(foam, 0.0) * 0.45;
        // melt into the horizon haze
        c = mix(c, uFog, smoothstep(uFogNear, uFogFar, fogDist(vW)));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  // finely divided near the island so the swells can lift it; the fog hides the far edge
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 280, 280), mat)
  sea.rotation.x = -Math.PI / 2
  sea.position.set(0, SEA_Y, 0)
  sea.userData.keep = true
  return sea
}

// ---------- the land: one faceted terrain with vertex colours ----------
function makeLand() {
  const X0 = -110, X1 = 110, Z0 = -95, Z1 = CLIFF_Z
  const nx = 88, nz = 56
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz)
  geo.rotateX(-Math.PI / 2)
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    // jitter the inner vertices a little so the facets look hand-cut (not on the edges, not on the plot)
    const edge = Math.abs(z - Z1) < 0.01 || Math.abs(z - Z0) < 0.01 || Math.abs(x - X0) < 0.01 || Math.abs(x - X1) < 0.01
    const inPlot = Math.abs(x) < 60 && z > -9
    const jx = edge || inPlot ? 0 : (hash(x, z) - 0.5) * 1.6
    const jz = edge || inPlot ? 0 : (hash(z, x) - 0.5) * 1.6
    pos.setXYZ(i, x + jx, GROUND_Y + heightAt(x + jx, z + jz), z + jz)
  }
  const g2 = geo.toNonIndexed()
  geo.dispose()
  const p2 = g2.attributes.position
  const col = new Float32Array(p2.count * 3)
  const lawn = new THREE.Color('#2f5550'), moss = new THREE.Color('#3b4f6e'), lilac = new THREE.Color('#7a63b0'), snow = new THREE.Color('#d9d0f4'), earth = new THREE.Color('#4a3a6e')
  const c = new THREE.Color()
  for (let i = 0; i < p2.count; i += 3) {
    // colour each triangle by its average height and slope
    const ys = [p2.getY(i), p2.getY(i + 1), p2.getY(i + 2)]
    const y = (ys[0] + ys[1] + ys[2]) / 3 - GROUND_Y
    const slope = Math.max(...ys) - Math.min(...ys)
    const x = (p2.getX(i) + p2.getX(i + 1) + p2.getX(i + 2)) / 3
    const z = (p2.getZ(i) + p2.getZ(i + 1) + p2.getZ(i + 2)) / 3
    if (y < 0.3) c.copy(lawn).lerp(moss, smooth(10, 30, Math.abs(x)) * 0.6 + smooth(-6, -20, z) * 0.6)
    else if (slope > 1.1) c.copy(earth)
    else c.copy(lilac).lerp(snow, smooth(3, 11, y))
    c.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.04)
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3)
  }
  g2.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g2.computeVertexNormals()
  const land = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, emissive: '#1a1036', emissiveIntensity: 0.6 }))
  land.receiveShadow = true
  land.userData.keep = true // vertex colours: keep it out of the merge
  return land
}

// ---------- the cliff face: stacked faceted rocks from the lawn down into the sea ----------
function makeCliff(parent) {
  const rockMats = [flat('#4b3c6e'), flat('#5a4a80'), flat('#3a2e58'), flat('#6a5890')]
  // a solid wall behind the rocks so there are never gaps to see through
  const wallMat = flat('#2c2346')
  const top = GROUND_Y - 0.2, bottom = SEA_Y - 2 // below the lip, so no two faces share a height
  const wall = new THREE.Mesh(new THREE.BoxGeometry(220, top - bottom, 6), wallMat)
  wall.position.set(0, (top + bottom) / 2, CLIFF_Z - 3)
  parent.add(wall)
  const ico = new THREE.IcosahedronGeometry(1, 0)
  const rockBox = new THREE.Box3()
  const fallX = streamX(CLIFF_Z)
  for (let x = -110; x <= 110; x += 2.6) {
    if (Math.abs(x - fallX) < 2.6) continue // leave a clear chute for the waterfall
    for (let y = GROUND_Y - 2.0; y > SEA_Y - 2; y -= 2.2) {
      const s = 1.3 + rnd() * 1.3
      const m = new THREE.Mesh(ico, rockMats[Math.floor(rnd() * rockMats.length)])
      m.scale.set(s * (1 + rnd() * 0.6), s * (0.6 + rnd() * 0.35), s)
      const bulge = 0.4 + (1 - (y - SEA_Y) / (GROUND_Y - SEA_Y)) * 1.6 // the foot of the cliff sticks out further
      m.position.set(x + (rnd() - 0.5) * 1.2, y, CLIFF_Z - 0.6 + bulge * rnd())
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
      // never let a rock poke up through the lawn at the top of the cliff
      m.updateMatrixWorld(true)
      const over = rockBox.setFromObject(m, true).max.y - (GROUND_Y - 0.06)
      if (over > 0) m.position.y -= over
      parent.add(m)
    }
  }
  // a lip of grass along the top edge
  const lip = new THREE.Mesh(new THREE.BoxGeometry(220.4, 0.5, 1.2), flat('#2f5550'))
  lip.position.set(0, GROUND_Y - 0.33, CLIFF_Z - 0.5) // its top sits just under the lawn, never level with it
  parent.add(lip)
  // rocks standing in the surf
  ;[[-34, 22], [-12, 26], [9, 21], [26, 29], [45, 24], [-52, 30]].forEach(([x, z]) => {
    const s = 1.2 + rnd() * 2.5
    const m = new THREE.Mesh(ico, rockMats[Math.floor(rnd() * 4)])
    m.scale.set(s, s * (1.2 + rnd()), s)
    m.position.set(x, SEA_Y + s * 0.4, z)
    m.rotation.set(rnd(), rnd() * 3, rnd())
    parent.add(m)
  })
}

// ---------- low-poly pines, rocks, crystals, mushrooms, glowing grass ----------
function pine(parent, x, z, s, mats) {
  const y = GROUND_Y + heightAt(x, z)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 0.9 * s, 6), mats.trunk)
  trunk.position.set(x, y + 0.45 * s, z)
  parent.add(trunk)
  ;[[1.6, 1.9, 0.7], [1.25, 1.7, 1.8], [0.85, 1.5, 2.8]].forEach(([r, h, yy], i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 7), i % 2 ? mats.leafB : mats.leafA)
    cone.position.set(x, y + yy * s, z)
    cone.rotation.y = rnd() * 3
    cone.castShadow = true
    parent.add(cone)
  })
}

function crystal(parent, x, z, s, color) {
  const y = GROUND_Y + heightAt(x, z)
  const g = new THREE.OctahedronGeometry(1, 0)
  ;[[0, 0, 1], [0.5, 0.3, 0.6], [-0.45, -0.25, 0.7]].forEach(([dx, dz, k]) => {
    const m = new THREE.Mesh(g, shine(color))
    m.scale.set(0.35 * s * k, 1.3 * s * k, 0.35 * s * k)
    m.position.set(x + dx * s, y + 1.1 * s * k, z + dz * s)
    m.rotation.z = dx * 0.5
    parent.add(m)
  })
}

function mushroom(parent, x, z, s) {
  const y = GROUND_Y + heightAt(x, z)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 0.6 * s, 7), flat('#e8dcf0'))
  stem.position.set(x, y + 0.3 * s, z)
  parent.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), flat('#b0285a', { emissive: '#6a0f34', emissiveIntensity: 0.6 }))
  cap.position.set(x, y + 0.55 * s, z)
  parent.add(cap)
  const dot = new THREE.SphereGeometry(0.07 * s, 5, 4)
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, el = 0.3 + rnd() * 0.9
    const d = new THREE.Mesh(dot, shine('#ffe6f0'))
    d.position.set(x + Math.cos(a) * Math.cos(el) * 0.6 * s, y + 0.55 * s + Math.sin(el) * 0.6 * s, z + Math.sin(a) * Math.cos(el) * 0.6 * s)
    parent.add(d)
  }
}

function stone(parent, x, z, s, mat) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat)
  m.scale.set(s, s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.4))
  m.position.set(x, GROUND_Y + heightAt(x, z) + s * 0.25, z)
  m.rotation.set(rnd(), rnd() * 3, rnd())
  m.castShadow = true
  parent.add(m)
}

// ---------- mist: big, faint, camera-facing puffs that drift slowly ----------
function mistTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,0.9)')
  gr.addColorStop(0.45, 'rgba(255,255,255,0.35)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function makeMist() {
  const group = new THREE.Group()
  const map = mistTexture()
  const puffs = []
  const spots = []
  // two walls of mist down the sides, a band behind the forest, and wisps along the cliff ends
  for (let z = -60; z <= 12; z += 9) { spots.push([-58 - rnd() * 14, z]); spots.push([58 + rnd() * 14, z]) }
  for (let x = -60; x <= 60; x += 14) spots.push([x, -48 - rnd() * 14])
  ;[[-62, 8], [62, 8], [-80, 10], [80, 10]].forEach(p => spots.push(p))
  spots.forEach(([x, z], i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: i % 3 ? '#6a74b8' : '#5a6aa8', opacity: 0.18, transparent: true, depthWrite: false, fog: false }))
    mistMats.push(s.material)
    const size = 22 + rnd() * 16
    s.scale.set(size * 1.8, size * 0.55, 1)
    s.position.set(x, GROUND_Y + heightAt(x, z) + size * 0.12, z)
    s.userData.base = s.position.clone()
    s.userData.phase = rnd() * 6
    group.add(s)
    puffs.push(s)
  })
  return {
    group,
    update(t) { puffs.forEach(p => { p.position.x = p.userData.base.x + Math.sin(t * 0.05 + p.userData.phase) * 3 }) },
  }
}

// ---------- the stream and its waterfall ----------
function makeStream() {
  const pts = []
  for (let z = STREAM_TOP; z < CLIFF_Z + 1.0; z += 0.8) pts.push(z)
  pts.push(CLIFF_Z + 1.0) // ends exactly where the waterfall begins
  const w = 1.5
  const verts = [], uvs = [], idx = []
  pts.forEach((z, i) => {
    const x = streamX(z)
    const dx = streamX(z + 0.5) - streamX(z - 0.5)
    const len = Math.hypot(dx, 1)
    const nx = 1 / len, nz = -dx / len // sideways
    // a little above the ground (the faceted land must never poke through the water), dipping over the lip
    const y = GROUND_Y + Math.max(heightAt(x, z), 0) + 0.18 - Math.max(0, z - CLIFF_Z) * 0.28
    verts.push(x - nx * w, y, z - nz * w, x + nx * w, y, z + nz * w)
    uvs.push(0, i * 0.12, 1, i * 0.12)
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(idx)
  const mat = flowMaterial('#9fe6ff', '#4a7dff', 1)
  const m = new THREE.Mesh(geo, mat)
  m.userData.keep = true
  m.renderOrder = 1
  return m
}

function flowMaterial(hi, lo, dir) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // pulled a touch toward the camera, so the land under the water can never show through it
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { uTime: { value: 0 }, uHi: { value: new THREE.Color(hi) }, uLo: { value: new THREE.Color(lo) }, uDir: { value: dir } },
    vertexShader: `varying vec2 vUv; varying float vFog; ${FOG_GLSL}
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vFog = smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, fogDist(w.xyz)); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uHi; uniform vec3 uLo; uniform float uDir; varying vec2 vUv; varying float vFog;
      void main(){
        float s = sin(vUv.y * 18.0 - uTime * 3.0 * uDir + sin(vUv.x * 9.0) * 0.8) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 c = mix(uLo, uHi, s * 0.7 + 0.3) * 1.6;
        gl_FragColor = vec4(c, edge * 0.92 * (1.0 - vFog));
      }`,
  })
}

function makeWaterfall(parent, glows) {
  const x = streamX(CLIFF_Z)
  const h = GROUND_Y - SEA_Y + 0.4
  const geo = new THREE.PlaneGeometry(3.2, h, 1, 12)
  // bow it outward a little as it falls
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) { const t = 0.5 - p.getY(i) / h; p.setZ(i, Math.sin(t * Math.PI * 0.5) * 2.2) }
  const mat = flowMaterial('#d8f6ff', '#5a8cff', 1.6)
  mat.side = THREE.DoubleSide
  // the falling stripes run along the height, so rotate the uv frame: use y as the flow direction
  const fall = new THREE.Mesh(geo, mat)
  // its top edge meets the end of the stream: one unbroken sheet of water over the lip
  fall.position.set(x, GROUND_Y + 0.18 - 0.28 - h / 2, CLIFF_Z + 1.0)
  fall.userData.keep = true
  fall.renderOrder = 1
  parent.add(fall)
  glows.push(glow(parent, [x, SEA_Y + 0.6, CLIFF_Z + 3.4], '#9fd8ff', 9, 0.55))
  glows.push(glow(parent, [x, GROUND_Y + 0.4, CLIFF_Z + 0.6], '#9fe6ff', 4, 0.4))
  return mat
}

// ---------- fireflies: drifting, twinkling motes ----------
function makeFireflies() {
  const n = 420
  const pos = new Float32Array(n * 3), seedA = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let x, z
    do { x = (rnd() - 0.5) * 120; z = -70 + rnd() * 84 } while (Math.abs(x) < 14 && z > -7 && z < 11) // not inside the garden
    pos.set([x, GROUND_Y + heightAt(x, z) + 0.6 + rnd() * 5, z], i * 3)
    seedA[i] = rnd() * 100
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `
      attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA; varying float vHue;
      ${FOG_GLSL}
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.3 + aSeed) * 0.8;
        p.y += sin(uTime * 0.5 + aSeed * 1.7) * 0.5;
        p.z += cos(uTime * 0.27 + aSeed * 0.6) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 3.0))) * (1.0 - smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, fogDist((modelMatrix * vec4(p, 1.0)).xyz)));
        vHue = fract(aSeed * 0.37);
        gl_PointSize = uScale * 0.09 / -mv.z;
      }`,
    fragmentShader: `
      varying float vA; varying float vHue;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(vec3(1.0, 0.75, 0.95), vec3(0.75, 0.9, 1.0), vHue);
        gl_FragColor = vec4(c * a * vA, 1.0);
      }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  pts.userData.keep = true
  return pts
}

// ---------- floating islands far behind, bobbing slowly ----------
function floatingIsland(parent, x, y, z, s, mats) {
  const g = new THREE.Group()
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * s, 2.0 * s, 0.7 * s, 7), mats.lawn)
  g.add(top)
  const under = new THREE.Mesh(new THREE.ConeGeometry(2.0 * s, 3.4 * s, 7), mats.rock)
  under.rotation.x = Math.PI
  under.position.y = -2.05 * s
  g.add(under)
  const t = { trunk: mats.trunk, leafA: mats.leafA, leafB: mats.leafB }
  const tree = new THREE.Group()
  pine(tree, 0, 0, s * 0.8, t)
  tree.position.set(-0.6 * s, 0.35 * s - GROUND_Y, 0.2 * s)
  g.add(tree)
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), shine('#b48cff'))
  cr.scale.set(0.3 * s, 0.9 * s, 0.3 * s)
  cr.position.set(0.9 * s, 1.0 * s, -0.3 * s)
  g.add(cr)
  glow(g, [0.9 * s, 1.0 * s, -0.3 * s], '#b48cff', 3 * s, 0.5)
  glow(g, [0, -3.8 * s, 0], '#7f6cff', 4 * s, 0.25)
  g.position.set(x, y, z)
  parent.add(g)
  return g
}

export function buildScenery(palette = 'night') {
  seed = 7
  mistMats.length = 0
  const group = new THREE.Group()
  const statics = new THREE.Group() // merged into a few meshes by the caller (bake)
  const glows = []

  const sky = makeSky()
  const sea = makeOcean()
  const land = makeLand()
  group.add(sky, sea, land, statics)
  makeCliff(statics)

  const mats = {
    trunk: flat('#4a3448'), leafA: flat('#24485a'), leafB: flat('#2d5a66'),
    lawn: flat('#3b4f6e'), rock: flat('#4b3c6e'),
  }
  const stoneMats = [flat('#6c5a9a'), flat('#8a78bc'), flat('#54467e')]
  const free = (x, z) => !(Math.abs(x) < 60 && z > -9) && Math.abs(x - streamX(z)) > 2.4 && z < FRONT_FLAT - 1.5 // nothing grows on the cliff walk

  // a forest that thickens toward the hills behind
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 150
    const z = -80 + rnd() * 92
    if (!free(x, z)) continue
    if (z > -12 && rnd() < 0.6) continue // keep the sides near the house fairly open
    pine(statics, x, z, 1.1 + rnd() * 1.4, mats)
  }
  // a frame of trees right behind the house, so the roofline has a backdrop
  [[-17, -11, 2.2], [-12, -13, 1.8], [-6, -12.5, 2.5], [5, -13, 2.1], [11, -11.5, 2.6], [17.5, -12, 2.0]].forEach(([x, z, s]) => pine(statics, x, z, s, mats))
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 120, z = -70 + rnd() * 80
    if (free(x, z)) stone(statics, x, z, 0.5 + rnd() * 1.4, stoneMats[i % 3])
  }
  // crystals and their glow
  [[-26, -18, 1.6, '#9a7bff'], [24, -20, 1.9, '#7fe0ff'], [-9, -24, 2.2, '#c08bff'], [36, -9, 1.4, '#ff8fd0'], [-38, -8, 1.5, '#7fe0ff'], [14, -32, 2.6, '#b48cff'], [-30, -36, 2.4, '#ff8fd0']].forEach(([x, z, s, c]) => {
    crystal(statics, x, z, s, c)
    glows.push(glow(group, [x, GROUND_Y + heightAt(x, z) + 1.2 * s, z], c, 5 * s, 0.5))
  })
  // glowing mushrooms near the stream
  ;[[-16.5, -9], [-25, -2], [-24.5, 6], [-14, 2], [-28, -14]].forEach(([x, z], i) => {
    mushroom(statics, x, z, 0.9 + (i % 3) * 0.35)
    glows.push(glow(group, [x, GROUND_Y + heightAt(x, z) + 0.8, z], '#ff6fae', 2.6, 0.35))
  })
  // soft banks of mist lying in the hollows to the sides and behind, so the land melts away instead of ending
  const mist = makeMist()
  group.add(mist.group)

  const stream = makeStream()
  group.add(stream)
  glows.push(glow(group, [streamX(-10), GROUND_Y + 0.6, -10], '#8fd8ff', 7, 0.3))
  glows.push(glow(group, [streamX(4), GROUND_Y + 0.6, 4], '#8fd8ff', 7, 0.3))
  const fallMat = makeWaterfall(group, glows)
  const flies = makeFireflies()
  group.add(flies)

  const islands = [
    floatingIsland(group, -34, 18, -58, 2.2, mats),
    floatingIsland(group, 30, 24, -66, 2.8, mats),
    floatingIsland(group, 4, 30, -80, 1.8, mats),
  ]
  const baseY = islands.map(g => g.position.y)

  applyPalette(palette)

  return {
    group,
    statics,
    /** per frame: animate the sky, sea, water and fireflies */
    update(t, pixelRatio = 1, height = 800) {
      sky.material.uniforms.uTime.value = t
      sea.material.uniforms.uTime.value = t
      stream.material.uniforms.uTime.value = t
      fallMat.uniforms.uTime.value = t
      flies.material.uniforms.uTime.value = t
      flies.material.uniforms.uScale.value = height * pixelRatio
      mist.update(t)
      islands.forEach((g, i) => { g.position.y = baseY[i] + Math.sin(t * 0.35 + i * 2) * 0.8; g.rotation.y = t * 0.02 * (i % 2 ? 1 : -1) })
    },
  }
}
