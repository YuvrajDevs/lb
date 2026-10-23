// The editable places and what is built into them. Pure data, no Three.js.
// Rooms are 10.8 x 7.2 units (108 x 72 cells); coordinates in metres are room-local, origin at the floor centre.
import { CELL, COLS, ROWS, WALL_ROWS } from './grid.js'

export const HX = 5.4
export const HZ = 3.6
const cx = x => Math.round((x + HX) / CELL) // metre -> cell column
const cz = z => Math.round((z + HZ) / CELL) // metre -> cell row
const box = (x0, z0, x1, z1, blocks, label) => ({ x0: cx(x0), z0: cz(z0), x1: cx(x1), z1: cz(z1), blocks, label })
const wallBox = (u0, u1, v0, v1, blocks, label) => ({ u0, u1, v0, v1, blocks, label })
const uBack = x => cx(x)
const uSide = z => cz(z)

const DOOR_Z = [0.9, 2.9]
// the real window in each room's back wall: x range and height range (metres). Low and wide, so a cube standing
// in the room looks straight out at the land behind the house. The kitchen's sits above the counter and taps.
// the windows on the open front wall and on the outer side walls: real openings, low and big
export const FRONT_WIN = { w: 1.9, y: [1.25, 3.85] }
export const SIDE_WIN = { w: 1.7, z: [-1.4, 1.6], y: [1.25, 3.85] }
export const BALCONY_DOOR = { w: 1.4, y: [0.02, 3.0] } // an open doorway you can walk through
const sideWindowWalls = () => SIDE_WIN.z.map(z => wallBox(uSide(z - SIDE_WIN.w / 2 - 0.5), uSide(z + SIDE_WIN.w / 2 + 0.5), Math.round(SIDE_WIN.y[0] / CELL), Math.round(SIDE_WIN.y[1] / CELL), ['art'], 'window'))
export const WINDOWS = {
  study: { x: [-2.6, 1.0], y: [1.25, 4.25] },
  bedroom: { x: [-0.9, 2.1], y: [1.25, 4.25] },
  kitchen: { x: [-3.7, 0.1], y: [1.75, 4.25] }, // above the counter and its tap
  living: { x: [-1.4, 2.4], y: [1.25, 4.25] },
}
const doorFloor = side => (side === 'left' ? box(-HX, DOOR_Z[0], -HX + 1.2, DOOR_Z[1], ['floor'], 'doorway') : box(HX - 1.2, DOOR_Z[0], HX, DOOR_Z[1], ['floor'], 'doorway'))
const doorWall = () => wallBox(uSide(DOOR_Z[0]), uSide(DOOR_Z[1]), 0, 34, ['art', 'curtain'], 'door')
// (art keeps half a metre clear either side of a window, where its curtains hang)
const windowWall = id => wallBox(uBack(WINDOWS[id].x[0] - 0.5), uBack(WINDOWS[id].x[1] + 0.5), Math.round(WINDOWS[id].y[0] / CELL), Math.round(WINDOWS[id].y[1] / CELL), ['art'], 'window')

function room(id, label, o) {
  return {
    id, label, kind: 'room', cols: COLS, rows: ROWS, walls: true,
    fixtures: o.fixtures, wallFixtures: { back: o.back || [], left: o.left || [], right: o.right || [] },
    window: o.window,
  }
}

export const AREAS = {
  study: room('study', 'Study', {
    window: WINDOWS.study.x,
    fixtures: [doorFloor('right')],
    back: [windowWall('study')],
    right: [doorWall()],
    left: sideWindowWalls(),
  }),
  bedroom: room('bedroom', 'Bedroom', {
    window: WINDOWS.bedroom.x,
    fixtures: [doorFloor('left'), box(3.7, -1.2, HX, 1.6, ['floor', 'flat'], 'stairwell')],
    back: [windowWall('bedroom')],
    left: [doorWall()],
    right: sideWindowWalls(),
  }),
  kitchen: room('kitchen', 'Kitchen', {
    window: WINDOWS.kitchen.x,
    fixtures: [doorFloor('right'), box(-HX, -HZ, 1.15, -HZ + 1.15, ['floor', 'flat'], 'counter'), box(1.5, -HZ, 2.9, -HZ + 1.05, ['floor', 'flat'], 'fridge')],
    back: [windowWall('kitchen'), wallBox(0, uBack(1.15), 0, 14, ['art', 'curtain'], 'counter'), wallBox(uBack(1.5), uBack(2.9), 0, 35, ['art', 'curtain'], 'fridge')],
    right: [doorWall()],
    left: sideWindowWalls(),
  }),
  living: room('living', 'Living room', {
    window: WINDOWS.living.x,
    fixtures: [
      doorFloor('left'), box(3.7, -1.1, HX, 3.3, ['floor', 'flat'], 'stairs'),
      box(-HX, -2.95, -HX + 0.9, -0.45, ['floor'], 'TV stand'),
      box(-4.5, 1.8, -2.3, HZ, ['floor', 'flat'], 'front door'), // keep the way in and out clear
      box(3.9, -1.0, HX, 1.4, ['ceiling'], 'stairwell'), // the stairwell opens the ceiling too
    ],
    back: [windowWall('living')],
    left: [doorWall(), wallBox(uSide(-2.95), uSide(-0.45), 0, 25, ['art', 'curtain'], 'TV')],
    right: [wallBox(uSide(-1.0), uSide(2.45), 0, WALL_ROWS, ['art', 'curtain'], 'stairs')],
  }),
}

// ---- the garden: a strip in front of the house, from the fence on the left to the fence on the right ----
export const GARDEN = {
  id: 'garden', label: 'Garden', kind: 'garden', walls: false,
  origin: { x: -12.4, z: 4.4 },
  cols: 248, rows: 45,
  fixtures: (() => {
    const g = (x0, z0, x1, z1, label) => ({ x0: Math.round((x0 + 12.4) / CELL), z0: Math.round((z0 - 4.4) / CELL), x1: Math.round((x1 + 12.4) / CELL), z1: Math.round((z1 - 4.4) / CELL), blocks: ['floor'], label })
    return [
      g(-1.6, 4.4, 3.6, 8.9, 'garden path'), // from the front door to the gate
      g(-7.2, 7.9, -2.8, 8.9, 'name sign'),
      g(-8.3, 8.0, -7.6, 8.9, 'sign lamp'),
      g(-11.3, 4.4, -9.5, 6.2, 'bush'),
      g(9.5, 4.7, 11.3, 6.5, 'bush'),
    ]
  })(),
  wallFixtures: { back: [], left: [], right: [] },
}

export const AREA_LIST = ['study', 'bedroom', 'kitchen', 'living', 'garden']
export const areaOf = id => (id === 'garden' ? GARDEN : AREAS[id])
