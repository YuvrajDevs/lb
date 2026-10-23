import { dailyReward, milestoneOf } from '../game/economy'
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

  return (
    <Modal title="Daily gift" subtitle={`Day ${day} since you joined`} onClose={onClose}>
      <div className="daily">
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
