import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellsFor, footprint, rectAt, overlap, placeAround, check } from '../src/game/grid.js'
import { areaOf, setHomeKind } from '../src/game/areas.js'

// a stand-in for the item sizes the 3D models report: everything here is 1 x 1 m, on the floor
const info = () => ({ kind: 'floor', size: { w: 1, d: 1, h: 1 } })
const foot = () => ({ cw: 10, cd: 10 })
const at = (x, z) => ({ kind: 'floor', rect: rectAt(Math.round((x + 5.4) / 0.1) - 5, Math.round((z + 3.6) / 0.1) - 5, { cw: 10, cd: 10 }) })

test('sizes round up to whole 10 cm cells, and turning swaps width and depth', () => {
  assert.equal(cellsFor(0.3), 3)
  assert.equal(cellsFor(0.31), 4)
  assert.deepEqual(footprint({ w: 2, d: 1 }, 1), { cw: 10, cd: 20 })
})

test('placing follows the pointer, snapped, and stays inside the room', () => {
  assert.deepEqual(placeAround(50, 30, { cw: 10, cd: 10 }, 3, 108, 72), { i: 45, j: 24 })
  assert.deepEqual(placeAround(-20, 200, { cw: 10, cd: 10 }, 3, 108, 72), { i: 0, j: 62 })
})

test('overlapping rectangles are detected, touching ones are not', () => {
  assert.ok(overlap({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 5, z0: 5, x1: 15, z1: 15 }))
  assert.ok(!overlap({ x0: 0, z0: 0, x1: 10, z1: 10 }, { x0: 10, z0: 0, x1: 20, z1: 10 }))
})

test('nothing may stand in a doorway, on the stairs, or on top of something else', () => {
  setHomeKind('couple')
  const living = areaOf('living')
  assert.equal(check(living, at(-3.4, 3.0), [], info, foot).ok, false) // the front door
  assert.equal(check(living, at(4.6, 1.0), [], info, foot).ok, false) // the stairs
  assert.equal(check(living, at(0.5, 0.5), [], info, foot).ok, true)
  const other = { uid: 'x', id: 'x', i: 54, j: 36, rot: 0 }
  assert.equal(check(living, at(0.5, 0.5), [other], info, foot).ok, false)
})

test('the starter home keeps its front door clear too', () => {
  setHomeKind('solo')
  assert.equal(check(areaOf('home'), at(0, 3.0), [], info, foot).ok, false)
  assert.equal(check(areaOf('home'), at(-3, -1), [], info, foot).ok, true)
  setHomeKind('couple')
})
