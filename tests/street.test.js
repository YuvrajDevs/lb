import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streetPlots, neighbourSpan } from '../src/game/street.js'

const street = [
  { id: 'a', kind: 'solo' },
  { id: 'b', kind: 'couple' },
  { id: 'me', kind: 'solo', you: true },
  { id: 'c', kind: 'solo' },
]

test('your home is in the middle of your street, the others in join order either side', () => {
  const p = streetPlots(street, 9.3)
  assert.equal(p[2].x, 0)
  assert.ok(p[0].x < p[1].x && p[1].x < p[2].x && p[2].x < p[3].x)
})

test('plots never overlap and leave room to walk between the fences', () => {
  const p = streetPlots(street, 9.3)
  for (let i = 1; i < p.length; i++) {
    const gap = (p[i].x - p[i].half) - (p[i - 1].x + p[i - 1].half)
    assert.ok(gap >= 3 - 1e-9, `gap ${gap}`)
  }
})

test('every screen sees the same street, only shifted', () => {
  // the same world seen from c's screen: the distances between homes are the same
  const mine = streetPlots(street, 9.3)
  const theirs = streetPlots(street.map(m => ({ ...m, you: m.id === 'c' })), 9.3)
  const d = (ps, i, j) => ps[j].x - ps[i].x
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(d(mine, i, i + 1) - d(theirs, i, i + 1)) < 1e-9)
})

test('the street span covers every plot', () => {
  const [l, r] = neighbourSpan(street, 9.3)
  streetPlots(street, 9.3).forEach(p => { assert.ok(p.x - p.half >= l - 1e-9 && p.x + p.half <= r + 1e-9) })
})
