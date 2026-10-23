import { HZ, box, cyl } from '../kit.js'
import { makeShell } from '../shell.js'

const CAB = '#d9c9a6'

// Built in: the counter run with the sink under the window, and the fridge. Everything else is placed.
export function buildKitchen() {
  const sh = makeShell({
    name: 'kitchen', wall: '#efe6c9', wainscot: '#d4c48c', cove: '#ffd9a0',
    floorColor: '#d1b48a', doorR: [0.9, 2.9], win: [-3.2, -0.4], skyKind: 0, frameKinds: [4, 1, 3],
    ext: { storey: 'ground', color: '#eadfc6', batten: null, windows: [-3.2, 3.2], extLeft: true },
  })
  const { root } = sh
  box(root, [6.4, 1.75, 1.0], [-2.2, 0, -HZ + 0.5], CAB)
  box(root, [6.6, 0.12, 1.1], [-2.2, 1.75, -HZ + 0.55], '#f1eee6')
  box(root, [1.3, 0.05, 0.7], [-1.8, 1.86, -HZ + 0.55], '#a7b0b8')
  cyl(root, 0.04, 0.45, [-1.8, 1.87, -HZ + 0.2], '#b9c0c6', {}, 8)
  ;[-4.3, -4.0].forEach(x => cyl(root, 0.2, 0.03, [x, 1.88, -HZ + 0.55], '#33353e', {}, 16))
  ;[-4.9, -3.6, -2.3, -1.0, 0.3].forEach(x => {
    box(root, [1.1, 1.3, 0.04], [x, 0.2, -HZ + 1.02], '#eadbb6')
    box(root, [0.3, 0.05, 0.06], [x, 1.25, -HZ + 1.07], '#8a6a4a')
  })
  box(root, [1.3, 3.4, 1.0], [2.2, 0, -HZ + 0.5], '#e8eef0')
  box(root, [1.26, 0.04, 0.04], [2.2, 1.7, -HZ + 1.02], '#a9b4b8')
  box(root, [0.06, 0.8, 0.06], [2.7, 2.0, -HZ + 1.06], '#8f9a9e')
  sh.solid(-5.4, 1.15, -HZ, -HZ + 1.15)
  sh.solid(1.5, 2.9, -HZ, -HZ + 1.05)
  return sh
}
