import { useState } from 'react'
import { store } from '../game/store'
import { useStore } from './useStore'
import { nextSlotPrice, windowEarning, WORLD_MAX_SLOTS, SLOT_PRICES } from '../game/economy'
import { Icon, Boxet } from './icons'
import Modal from './Modal'

function Slot({ member, index, state }) {
  if (member) {
    return (
      <div className="slot filled">
        <span className={`presence ${member.online ? 'on' : ''}`} title={member.online ? 'Online' : 'Offline'} />
        <div className="avatar"><Icon name={member.kind === 'couple' ? 'couple' : 'world'} size={20} /></div>
        <div>
          <b>{member.you ? `${member.name} (you)` : member.name}</b>
          <small>{member.house}</small>
        </div>
        {member.kind === 'couple' && <span className="tag"><Icon name="heart" size={12} /> couple</span>}
      </div>
    )
  }
  if (state === 'pending') return <div className="slot pending"><div className="avatar"><Icon name="plus" size={18} /></div><div><b>Invite sent</b><small>Waiting for them to accept</small></div></div>
  if (state === 'locked') return <div className="slot locked"><div className="avatar"><Icon name="lock" size={18} /></div><div><b>Slot {index + 1}</b><small>Unlock for {SLOT_PRICES[index + 1]} Boxets</small></div></div>
  return <div className="slot empty"><div className="avatar"><Icon name="plus" size={18} /></div><div><b>Free slot</b><small>Invite a friend</small></div></div>
}

export default function World({ onClose }) {
  const s = useStore()
  const [tab, setTab] = useState('world')
  const [name, setName] = useState('')
  const [partner, setPartner] = useState('')
  const w = s.world
  const price = nextSlotPrice(w.slots)
  const onlineCount = w.members.filter(m => m.online).length
  const rate = windowEarning({ onlineActive: onlineCount, withPartner: s.couple.state === 'active' && true })
  const slots = Array.from({ length: WORLD_MAX_SLOTS }, (_, i) => {
    if (i < w.members.length) return <Slot key={i} member={w.members[i]} index={i} />
    if (i < w.members.length + w.invites.length) return <Slot key={i} index={i} state="pending" />
    if (i < w.slots) return <Slot key={i} index={i} state="empty" />
    return <Slot key={i} index={i} state="locked" />
  })

  return (
    <Modal title="Your world" subtitle={w.name} onClose={onClose} wide>
      <div className="chips">
        <button className={`chip ${tab === 'world' ? 'on' : ''}`} onClick={() => setTab('world')}><Icon name="world" size={15} /> Neighbours</button>
        <button className={`chip ${tab === 'couple' ? 'on' : ''}`} onClick={() => setTab('couple')}><Icon name="heart" size={15} /> Couple</button>
      </div>

      {tab === 'world' && (
        <div className="world-grid">
          <div className="world-main">
            <div className="slots">{slots}</div>

            <form className="invite" onSubmit={e => { e.preventDefault(); if (store.invite(name)) setName('') }}>
              <input placeholder="Invite someone by name" value={name} maxLength={16} onChange={e => setName(e.target.value)} />
              <button className="btn primary" disabled={!name.trim()}>Invite</button>
            </form>
            {w.invites.length > 0 && (
              <ul className="invites">
                {w.invites.map(i => (
                  <li key={i.id}><span>Invite to <b>{i.name}</b></span><button className="link" onClick={() => store.cancelInvite(i.id)}>Cancel</button></li>
                ))}
              </ul>
            )}
          </div>

          <aside className="world-side">
            <div className="panel-card">
              <h4><Icon name="bolt" size={15} /> Earning together</h4>
              <p className="big-num">{windowEarning({ onlineActive: onlineCount })}<small> Boxets / 30 min</small></p>
              <p className="soft">{onlineCount} online and active → <b>{Math.min(onlineCount, 3)}×</b> each (capped at 3×). With your partner as well: <b>{rate} per 30 min</b>.</p>
            </div>
            <div className="panel-card">
              <h4><Boxet size={15} /> World fund</h4>
              <p className="big-num">{w.fund.toLocaleString()}</p>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => store.addToFund(50)}>Add 50</button>
                <button className="btn ghost" onClick={() => store.addToFund(100)}>Add 100</button>
              </div>
              {price != null ? (
                <>
                  <div className="meter"><i style={{ width: `${Math.min(100, (w.fund / price) * 100)}%` }} /></div>
                  <button className="btn primary" disabled={w.fund < price} onClick={() => store.buySlot()}>Open slot {w.slots + 1} · {price}</button>
                </>
              ) : <p className="soft">This world has all {WORLD_MAX_SLOTS} slots open.</p>}
            </div>
          </aside>
        </div>
      )}

      {tab === 'couple' && (
        <div className="couple">
          <div className="couple-hero">
            <div className="cloud-art" aria-hidden="true"><Icon name="cloud" size={64} /><Icon name="heart" size={26} className="hrt" /></div>
            <div>
              <h3>{s.profile.house}</h3>
              {s.couple.state === 'active'
                ? <p className="soft">{s.profile.name} & {s.couple.partner} · together since {s.couple.since}</p>
                : <p className="soft">You&rsquo;re on your own for now, in your starter home. Becoming a couple turns your two homes into one four-room house.</p>}
            </div>
          </div>
          <div className="perks">
            <div className="perk"><Icon name="bolt" /><b>3× earning</b><small>Whenever you are both online and active for a full 30 minutes.</small></div>
            <div className="perk"><Icon name="world" /><b>One bigger home</b><small>Your two houses became one four-room house on one plot.</small></div>
            <div className="perk"><Icon name="gift" /><b>Shared inventory</b><small>Everything you each own can be placed. Auto-furnish picks matching pieces.</small></div>
          </div>
          <details className="how">
            <summary>How becoming a couple works</summary>
            <ol>
              <li>One of you sends a couple invite; the other accepts.</li>
              <li>A big cloud covers both plots. You pick either of your two locations to build on.</li>
              <li>The ground there grows and the shared house rises from the cloud. The other plot is freed for a new neighbour.</li>
              <li>Ending it needs a request and a 24-hour wait. Everyone gets their own items back.</li>
            </ol>
          </details>
          {s.couple.state === 'active' ? (
            <div className="btn-row">
              {s.couple.endsAt
                ? <><span className="soft">Your homes separate in {Math.max(0, Math.ceil((s.couple.endsAt - Date.now()) / 3600000))} h</span><button className="btn ghost" onClick={() => store.cancelBreakup()}>Cancel the request</button></>
                : <button className="btn ghost" onClick={() => store.requestBreakup()}>Request to end couple</button>}
            </div>
          ) : (
            <form className="invite" onSubmit={e => { e.preventDefault(); const n = partner; setPartner(''); store.notify(`Couple invite sent to ${n}`, 'info'); setTimeout(() => { store.becomeCouple(n); onClose() }, 1400) }}>
              <input placeholder="Your partner's name" value={partner} maxLength={16} onChange={e => setPartner(e.target.value)} />
              <button className="btn primary" disabled={!partner.trim()}>Send couple invite</button>
            </form>
          )}
        </div>
      )}
    </Modal>
  )
}
