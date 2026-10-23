import { cyl, sphere, box } from '../kit.js'

// a potted plant: pot + three leaf blobs (kept tiny on purpose)
export function plant(parent, x, z, scale = 1, potColor = '#d9d2c4') {
  cyl(parent, 0.28 * scale, 0.42 * scale, [x, 0, z], potColor, {}, 14)
  const leaf = ['#4f9a6a', '#5fae7a', '#3f8a5c']
  sphere(parent, 0.34 * scale, [x, 0.8 * scale, z], leaf[0])
  sphere(parent, 0.24 * scale, [x + 0.18 * scale, 1.15 * scale, z + 0.05 * scale], leaf[1])
  sphere(parent, 0.22 * scale, [x - 0.15 * scale, 1.05 * scale, z - 0.1 * scale], leaf[2])
}

// simple wooden railing between two points
export function railing(parent, x0, z0, x1, z1, y = 0, color = '#8a6a4a') {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const r = box(parent, [0.07, 0.07, len], [(x0 + x1) / 2, y + 0.95, (z0 + z1) / 2], color)
  r.rotation.y = Math.atan2(x1 - x0, z1 - z0)
  const n = Math.max(1, Math.round(len / 0.9))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    box(parent, [0.06, 0.95, 0.06], [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t], color)
  }
}
