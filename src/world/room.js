import * as THREE from 'three'

const std = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra })

// size [w,h,d], pos [x, bottomY, z]
function box(parent, size, pos, color, extra) {
  const mat = color.isMaterial ? color : std(color, extra)
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
  m.position.set(pos[0], pos[1] + size[1] / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function cyl(parent, r, h, pos, color, extra, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), std(color, extra))
  m.position.set(pos[0], pos[1] + h / 2, pos[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

// wall slab with rectangular holes; faces use `face`, cut edges use `edge`
function wall(w, h, thick, holes, face, edge) {
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

function labelTexture(text) {
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = '#efe6dc'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#4a4560'
  g.font = '600 52px Georgia, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, c.height / 2 + 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const BOOKS = ['#c0392b', '#e08a3c', '#d9c36a', '#5b8f6b', '#4d7bb5', '#8a5fa3', '#e8e0d0']

function books(parent, x0, x1, y, z, seed = 1) {
  let r = seed
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  let x = x0
  while (x < x1 - 0.12) {
    const w = 0.1 + rnd() * 0.08
    const h = 0.4 + rnd() * 0.25
    box(parent, [w, h, 0.42], [x + w / 2, y, z], BOOKS[Math.floor(rnd() * BOOKS.length)])
    x += w + 0.01
  }
}

/** Builds the diorama. Returns { group, lights, colliders, bounds } */
export function buildRoom() {
  const group = new THREE.Group()
  const colliders = []
  const solid = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ })

  // ---- base ----
  box(group, [10.6, 0.4, 10.6], [0, -0.5, 0], '#363a50')
  box(group, [10, 0.1, 10], [0, -0.1, 0], '#586179')

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.3),
    new THREE.MeshStandardMaterial({ map: labelTexture('our little room  ♥'), roughness: 0.8 })
  )
  label.position.set(5.31, -0.3, 1.2)
  label.rotation.y = Math.PI / 2
  group.add(label)

  // ---- walls ----
  const WIN = [3.9, 2.7, 8.3, 4.4] // back-wall local coords (x offset by +5.3)
  const back = wall(10.6, 5, 0.3, [WIN], '#56627f', '#cfd4de')
  back.position.set(-5.3, 0, -5.3)
  group.add(back)

  const left = wall(10.3, 5, 0.3, [], '#a9bdd0', '#cfd4de')
  left.rotation.y = -Math.PI / 2
  left.position.set(-5, 0, -5)
  group.add(left)

  // ---- window ----
  const frame = '#2d313c'
  const wx0 = -1.4, wx1 = 3.0, wy0 = 2.7, wy1 = 4.4, wz = -5.15
  const wxm = (wx0 + wx1) / 2
  box(group, [wx1 - wx0 + 0.3, 0.12, 0.34], [wxm, wy0 - 0.12, wz], frame)
  box(group, [wx1 - wx0 + 0.3, 0.12, 0.34], [wxm, wy1, wz], frame)
  box(group, [0.12, wy1 - wy0, 0.34], [wx0 - 0.06, wy0, wz], frame)
  box(group, [0.12, wy1 - wy0, 0.34], [wx1 + 0.06, wy0, wz], frame)
  box(group, [0.1, wy1 - wy0, 0.2], [wxm, wy0, wz], frame)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0),
    new THREE.MeshStandardMaterial({
      color: '#bcd6ff', emissive: '#7fa6ff', emissiveIntensity: 0.25,
      transparent: true, opacity: 0.18, roughness: 0.1,
    })
  )
  glass.position.set(wxm, (wy0 + wy1) / 2, wz + 0.02)
  group.add(glass)

  // night sky behind the window
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 2.4),
    new THREE.MeshBasicMaterial({ color: '#17254a' })
  )
  sky.position.set(0.8, 3.4, -5.9)
  group.add(sky)
  const starPos = []
  for (let i = 0; i < 36; i++) {
    starPos.push(-2.2 + Math.random() * 6, 2.3 + Math.random() * 2.1, -5.88)
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: '#fff4dc', size: 0.07, sizeAttenuation: true })
  )
  group.add(stars)
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({ color: '#fff1cf' })
  )
  moon.position.set(1.9, 3.7, -5.85)
  group.add(moon)

  // ---- bed corner (left wall) ----
  box(group, [4.2, 0.06, 5.2], [-2.9, 0, -0.8], '#8497ad') // rug platform
  box(group, [2.8, 0.55, 4.2], [-3.55, 0.06, -1], '#23242c') // frame
  box(group, [2.6, 0.3, 3.7], [-3.55, 0.61, -1.25], '#2c4fa3') // mattress
  box(group, [2.62, 0.1, 1.5], [-3.55, 0.91, -2.2], '#3a62bd') // folded blanket
  box(group, [2.8, 1.2, 0.35], [-3.55, 0.06, 1.0], '#1b1c23') // headboard
  box(group, [1.0, 0.26, 0.7], [-4.2, 0.91, 0.45], '#1f2129') // pillows
  box(group, [1.0, 0.26, 0.7], [-2.95, 0.91, 0.45], '#2a2c36')
  solid(-5, -2.1, -3.1, 1.2)

  box(group, [1.3, 1.2, 1.3], [-1.4, 0.06, 0.7], '#8a7766') // cardboard box
  box(group, [0.8, 0.08, 0.6], [-1.4, 1.26, 0.7], '#b8a6e6')
  const paper = box(group, [0.6, 0.03, 0.45], [-1.25, 1.34, 0.75], '#f2efe8')
  paper.rotation.y = 0.35
  solid(-2.05, -0.75, 0.05, 1.35)

  const bag = box(group, [0.35, 1.7, 1.5], [-4.75, 0, -4.1], '#16161b')
  bag.rotation.z = -0.1
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.035, 8, 20, Math.PI),
    std('#101014')
  )
  handle.position.set(-4.62, 1.72, -4.1)
  handle.rotation.y = Math.PI / 2
  handle.castShadow = true
  group.add(handle)
  solid(-5, -4.4, -4.9, -3.3)

  // records + posters on the left wall
  const rec = [
    [-3.0, 3.05, '#e86f9a'], [-2.0, 3.65, '#7a8cff'], [-1.2, 3.1, '#f0c36b'],
    [-2.6, 2.45, '#6fd0c0'], [-0.2, 3.7, '#e86f9a'],
  ]
  rec.forEach(([z, y, c]) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 32), std('#121217', { roughness: 0.4 }))
    disc.rotation.z = Math.PI / 2
    disc.position.set(-4.97, y, z)
    disc.castShadow = true
    group.add(disc)
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.045, 24), std(c))
    lab.rotation.z = Math.PI / 2
    lab.position.set(-4.95, y, z)
    group.add(lab)
  })
  box(group, [0.02, 0.28, 1.2], [-4.99, 2.2, -1.8], '#d7dbe2')
  box(group, [0.02, 0.28, 1.0], [-4.99, 1.85, -2.3], '#c8ccd4')
  box(group, [0.02, 0.5, 0.45], [-4.99, 3.0, -4.0], '#8ec9d4')
  box(group, [0.02, 0.3, 0.3], [-4.99, 2.3, -3.2], '#a68be0')

  // ---- desk wall (back wall) ----
  const wood = '#c9a06a', card = '#b58e5c'
  box(group, [0.25, 4.4, 1.7], [-3.4, 0, -4.15], card) // left tower
  box(group, [0.25, 4.4, 1.7], [4.75, 0, -4.15], card) // right tower
  solid(-3.55, -3.25, -5, -3.3)
  solid(4.6, 4.9, -5, -3.3)

  box(group, [8.0, 0.14, 1.5], [0.7, 1.8, -4.25], wood) // desk top
  solid(-3.3, 4.7, -5, -3.45)

  // shelves — left tower
  ;[2.7, 3.4, 4.1].forEach((y, i) => {
    box(group, [1.7, 0.1, 1.3], [-2.4, y, -4.35], wood)
    books(group, -3.2, -1.7, y + 0.1, -4.4, 3 + i)
  })
  // shelves — right tower
  ;[2.7, 3.4, 4.1].forEach((y, i) => {
    box(group, [1.4, 0.1, 1.3], [3.9, y, -4.35], wood)
    books(group, 3.25, 4.55, y + 0.1, -4.4, 11 + i)
  })
  // diagonal shelf braces
  ;[[-3.0, 2.15], [4.3, 2.15]].forEach(([x, y]) => {
    const b = box(group, [0.07, 0.7, 0.07], [x, y, -4.0], card)
    b.rotation.z = x < 0 ? 0.8 : -0.8
  })

  // desk items
  box(group, [0.55, 0.06, 0.42], [0.1, 1.94, -3.95], '#7fb6d6').rotation.y = 0.15
  box(group, [0.6, 0.02, 0.45], [1.5, 1.94, -3.9], '#f2efe8').rotation.y = -0.25
  box(group, [0.55, 0.02, 0.42], [1.95, 1.96, -4.05], '#e8f0f5').rotation.y = 0.45
  box(group, [0.35, 0.3, 0.3], [3.45, 1.94, -4.5], '#17171c')
  cyl(group, 0.07, 0.12, [3.45, 2.24, -4.5], '#2a2a31', {}, 12)
  box(group, [0.5, 0.05, 0.38], [2.65, 1.94, -3.85], '#e9d8c0').rotation.y = 0.9

  ;[[2.1, -4.7], [2.5, -4.6]].forEach(([x, z], i) => {
    cyl(group, 0.12, 0.5, [x, 1.94, z], '#f4f0ea', { roughness: 0.4 })
    const st = cyl(group, 0.012, 0.5, [x, 2.44, z], '#6f9a6b', {}, 6)
    st.rotation.z = i ? -0.15 : 0.12
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), std(i ? '#e87a9d' : '#f19fb8'))
    fl.position.set(x + (i ? -0.07 : 0.06), 2.97, z)
    fl.castShadow = true
    group.add(fl)
  })

  // desk lamp
  cyl(group, 0.16, 0.05, [-2.55, 2.04, -4.3], '#2a2a31')
  const lampDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#d9482b', emissive: '#ff8a3c', emissiveIntensity: 0.8, roughness: 0.5 })
  )
  lampDome.position.set(-2.55, 2.09, -4.3)
  group.add(lampDome)

  // chair
  const chair = new THREE.Group()
  chair.position.set(1.0, 0, -2.85)
  chair.rotation.y = 0.35
  const grey = '#727889'
  cyl(chair, 0.06, 0.8, [0, 0.08, 0], '#3b3f4a', {}, 10)
  ;[0, Math.PI / 2].forEach(a => {
    const arm = box(chair, [0.9, 0.06, 0.08], [0, 0.04, 0], '#3b3f4a')
    arm.rotation.y = a + 0.4
  })
  box(chair, [0.85, 0.1, 0.85], [0, 0.88, 0], grey)
  box(chair, [0.85, 0.7, 0.1], [0, 0.95, 0.42], grey)
  group.add(chair)
  solid(0.55, 1.45, -3.45, -2.4)

  // soft round rug in the open area
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.03, 48), std('#7a6a8c'))
  rug.position.set(2.0, 0.015, 1.6)
  rug.receiveShadow = true
  group.add(rug)

  // ---- lights ----
  const lights = new THREE.Group()
  const hemi = new THREE.HemisphereLight('#a9b6e8', '#4a3f5e', 1.5)
  lights.add(hemi)

  const moonlight = new THREE.DirectionalLight('#9db8ff', 2.2)
  moonlight.position.set(2.5, 9, -15)
  moonlight.target.position.set(1.0, 0, 0)
  moonlight.castShadow = true
  moonlight.shadow.mapSize.set(4096, 4096)
  const sc = moonlight.shadow.camera
  sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40
  moonlight.shadow.bias = -0.0004
  moonlight.shadow.normalBias = 0.03
  lights.add(moonlight, moonlight.target)

  const deskLamp = new THREE.PointLight('#ffb36b', 26, 13, 2)
  deskLamp.position.set(-2.55, 2.6, -3.9)
  deskLamp.castShadow = true
  deskLamp.shadow.mapSize.set(1024, 1024)
  deskLamp.shadow.bias = -0.002
  lights.add(deskLamp)

  const bedGlow = new THREE.PointLight('#ff8ab8', 14, 9, 2)
  bedGlow.position.set(-3.2, 3.6, -1.2)
  lights.add(bedGlow)

  const fill = new THREE.PointLight('#ffd9b0', 34, 18, 2)
  fill.position.set(1.5, 5.5, 2.5)
  lights.add(fill)

  return { group, lights, colliders, bounds: 5, flicker: { deskLamp, lampDome } }
}
