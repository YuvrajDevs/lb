import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windowEarning, dailyReward, nextSlotPrice, dayNumber, earnable, EARN_CAPS, DAILY_CAP, MILESTONES, MILESTONE_ITEMS } from '../src/game/economy.js'
import { ITEM_BY_ID } from '../src/game/catalog.js'

test('earning per 30 minutes: base, partnership capped at 3x, couple 3x on top', () => {
  assert.equal(windowEarning({ onlineActive: 1 }), 15)
  assert.equal(windowEarning({ onlineActive: 3 }), 45)
  assert.equal(windowEarning({ onlineActive: 5 }), 45)
  assert.equal(windowEarning({ onlineActive: 1, withPartner: true }), 45)
  assert.equal(windowEarning({ onlineActive: 3, withPartner: true }), 135)
})

test('daily gift grows with the days since joining, up to 150', () => {
  assert.equal(dailyReward(1), 22)
  assert.equal(dailyReward(10), 40)
  assert.equal(dailyReward(500), 150)
})

test('world slots: 4 free, then 500 and 1000, capped at 6', () => {
  assert.equal(nextSlotPrice(4), 500)
  assert.equal(nextSlotPrice(5), 1000)
  assert.equal(nextSlotPrice(6), null)
})

test('day numbers count calendar days from joining (day 1 = the day you joined)', () => {
  assert.equal(dayNumber('2026-10-23', '2026-10-23'), 1)
  assert.equal(dayNumber('2026-10-23', '2026-11-01'), 10)
})

test('every milestone gives a real catalogue item', () => {
  Object.keys(MILESTONES).forEach(d => assert.ok(ITEM_BY_ID[MILESTONE_ITEMS[d]], `day ${d}`))
})

test('games and visits pay up to their own cap and the overall daily cap', () => {
  const none = { total: 0, by: {} }
  assert.equal(earnable('stars', 500, none), EARN_CAPS.stars)
  assert.equal(earnable('stars', 10, { total: 0, by: { stars: EARN_CAPS.stars - 4 } }), 4)
  assert.equal(earnable('visit', 10, { total: DAILY_CAP - 3, by: {} }), 3)
  assert.equal(earnable('quiz', 30, { total: DAILY_CAP, by: {} }), 0)
})
