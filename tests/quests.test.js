import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUESTS, pickLocal, advance, finished } from '../src/game/quests.js'

test('three quests a day, the same all day, different on another day, never online-only for guests', () => {
  const a = pickLocal('2026-10-24')
  assert.equal(a.length, 3)
  assert.deepEqual(a, pickLocal('2026-10-24'))
  assert.ok(a.every(id => !QUESTS[id].online))
  const days = new Set(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map(d => pickLocal(d).join()))
  assert.ok(days.size > 1)
})

test('progress counts up to the goal, and "best" quests keep the best score', () => {
  let q = { ids: ['lamp', 'stars', 'buy'], progress: {}, claimed: [] }
  q = advance(q, 'switch')
  assert.deepEqual(finished(q), [])
  q = advance(q, 'switch')
  assert.deepEqual(finished(q), ['lamp'])
  q = advance(q, 'stars', 9)
  q = advance(q, 'stars', 4)
  assert.equal(q.progress.stars, 9)
  q = advance(q, 'stars', 40)
  assert.equal(q.progress.stars, 15)
})

test('a quest that is claimed stops counting', () => {
  const q = { ids: ['buy'], progress: { buy: 1 }, claimed: ['buy'] }
  assert.equal(advance(q, 'buy'), q)
  assert.deepEqual(finished(q), [])
})

test('the quest ids match the server pool', async () => {
  const { readFile } = await import('node:fs/promises')
  const sql = await readFile(new URL('../supabase/migrations/0006_quests.sql', import.meta.url), 'utf8')
  const pool = sql.match(/unnest\(array\[([^\]]+)\]\)/)[1].split(',').map(s => s.trim().replace(/'/g, ''))
  assert.deepEqual(pool.sort(), Object.keys(QUESTS).sort())
})
