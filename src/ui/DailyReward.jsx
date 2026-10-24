import { dailyReward, milestoneOf } from '../game/economy'
import { QUESTS, QUEST_PAY, QUEST_BONUS } from '../game/quests'
import { store } from '../game/store'
import { useStore } from './useStore'
import { Icon, Boxet } from './icons'
import Modal from './Modal'

const NEXT_MILESTONES = [7, 30, 100, 365]

export default function DailyReward({ onClose }) {
  const s = useStore()
  const day = store.day()
  const can = store.canClaim()
  const start = Math.max(1, day - 2)
  const days = Array.from({ length: 7 }, (_, i) => start + i)
  const nextMs = NEXT_MILESTONES.find(m => m >= day)

  const q = store.quests()
  const done = q.claimed.length
  return (
    <Modal title="Today" subtitle={`Day ${day} since you joined`} onClose={onClose}>
      <div className="daily">
        <section className="quests">
          <h4 className="sub" style={{ marginTop: 0 }}>Today's quests · {done} of {q.ids.length}</h4>
          {q.ids.map(id => {
            const quest = QUESTS[id]
            const n = q.progress[id] || 0
            const ok = q.claimed.includes(id)
            return (
              <div key={id} className={`quest ${ok ? 'done' : ''}`}>
                <i className="quest-mark">{ok ? <Icon name="check" size={14} /> : null}</i>
                <span><b>{quest.text}</b>{quest.goal > 1 && !ok && <small>{n} of {quest.goal}</small>}</span>
                <em><Boxet size={13} /> {QUEST_PAY}</em>
                {quest.goal > 1 && !ok && <i className="quest-bar"><i style={{ transform: `scaleX(${n / quest.goal})` }} /></i>}
              </div>
            )
          })}
          <p className="soft small">All three: {QUEST_BONUS} more. New quests every day.</p>
        </section>

        <h4 className="sub" style={{ marginTop: 6 }}>Daily gift</h4>
        <div className="days">
          {days.map(d => {
            const claimed = s.claimedDays.includes(d)
            const today = d === day
            const past = d < day
            const ms = milestoneOf(d)
            return (
              <div key={d} className={`day ${today ? 'today' : ''} ${claimed ? 'claimed' : ''} ${past && !claimed ? 'missed' : ''} ${d > day ? 'future' : ''}`}>
                <small>Day {d}</small>
                <div className="gift">{ms ? <Icon name="star" size={22} /> : <Icon name="gift" size={22} />}</div>
                <b><Boxet size={13} /> {dailyReward(d)}</b>
                <span className="state">
                  {claimed ? <><Icon name="check" size={12} /> Claimed</> : today ? 'Today' : past ? 'Missed' : <Icon name="lock" size={12} />}
                </span>
              </div>
            )
          })}
        </div>

        <button className="btn primary big" disabled={!can} onClick={() => store.claim()}>
          {can ? `Claim ${dailyReward(day)} Boxets` : 'Come back tomorrow'}
        </button>

        <div className="notes">
          <p><Icon name="info" size={14} /> Each day’s gift can only be claimed on that day. If you skip days 3 and 4 and return on day 5, you get day 5’s gift.</p>
          {nextMs && <p><Icon name="star" size={14} /> Day {nextMs}: {milestoneOf(nextMs)} · {nextMs - day === 0 ? 'today!' : `in ${nextMs - day} day${nextMs - day === 1 ? '' : 's'}`}</p>}
          <p><Icon name="bolt" size={14} /> The longer you’ve been around, the bigger the gift. Missing a day never resets anything.</p>
        </div>
      </div>
    </Modal>
  )
}
