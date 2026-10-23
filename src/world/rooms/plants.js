import { cyl, sphere, box } from '../kit.js'

// a potted plant: terracotta pot + a cluster of leaf blobs
export function plant(parent, x, z, scale = 1, potColor = '#c8683a') {
  cyl(parent, 0.3 * scale, 0.45 * scale, [x, 0, z], potColor, {}, 14)
  const leaf = ['#4f9a5a', '#5fae68', '#3f8a52']
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    sphere(parent, 0.2 * scale, [x + Math.cos(a) * 0.22 * scale, (0.8 + (i % 3) * 0.25) * scale, z + Math.sin(a) * 0.22 * scale], leaf[i % 3])
  }
  sphere(parent, 0.26 * scale, [x, 1.5 * scale, z], leaf[0])
  cyl(parent, 0.03 * scale, 0.9 * scale, [x, 0.4 * scale, z], '#4a7a4a', {}, 6)
}

// simple wooden railing between two points at a given height
export function railing(parent, x0, z0, x1, z1, y = 0, color = '#6a4630') {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const r = box(parent, [0.07, 0.07, len], [(x0 + x1) / 2, y + 0.95, (z0 + z1) / 2], color)
  r.rotation.y = Math.atan2(x1 - x0, z1 - z0)
  const n = Math.max(2, Math.round(len / 0.5))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    box(parent, [0.06, 0.95, 0.06], [x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t], color)
  }
}
