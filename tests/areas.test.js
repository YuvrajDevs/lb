import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areaOf, areaList, setHomeKind, PLOTS, WINDOWS, roomIds } from '../src/game/areas.js'
import { DEFAULTS, starterOwned } from '../src/game/defaults.js'
import { ITEM_BY_ID } from '../src/game/catalog.js'

test('a couple has four rooms and a garden; a solo player one room and a garden', () => {
  setHomeKind('couple')
  assert.deepEqual(roomIds(), ['study', 'bedroom', 'kitchen', 'living'])
  setHomeKind('solo')
  assert.deepEqual(areaList(), ['home', 'garden'])
  setHomeKind('couple')
})

test('the garden fits inside each plot', () => {
  for (const kind of ['couple', 'solo']) {
    setHomeKind(kind)
    const g = areaOf('garden')
    assert.ok(Math.abs(g.origin.x) < PLOTS[kind].x, kind)
    assert.ok(g.origin.x + g.cols * 0.1 <= PLOTS[kind].x + 1e-6, kind)
  }
  setHomeKind('couple')
})

test('every room has a back window inside its walls', () => {
  Object.entries(WINDOWS).forEach(([id, w]) => {
    assert.ok(w.x[0] > -5.4 && w.x[1] < 5.4, id)
    assert.ok(w.y[0] > 1.18 && w.y[1] < 4.8, id) // above the panelling, below the ceiling
  })
})

test('the standard furnishing only uses real items, and a new player owns all of it', () => {
  const owned = starterOwned()
  Object.values(DEFAULTS).flat().forEach(e => {
    assert.ok(ITEM_BY_ID[e.id], e.id)
    assert.ok(owned[e.id] > 0, e.id)
  })
})
