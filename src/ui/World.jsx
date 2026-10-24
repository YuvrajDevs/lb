import { useState } from 'react'
import { store } from '../game/store'
import { useStore } from './useStore'
import { nextSlotPrice, windowEarning, WORLD_MAX_SLOTS, SLOT_PRICES } from '../game/economy'
import { Icon, Boxet } from './icons'
import Modal from './Modal'

// Your world, your friends and your couple.
//  World:   the homes on your street, inviting people (a link or a six-letter code), joining another world,
//           leaving, and, for the world's creator, removing someone. The world fund opens more house slots.
//  Friends: find people by their tag, answer requests, and block or report anyone who isn't kind.
//  Couple:  ask a friend to be your partner; your homes merge into one house. Ending it takes 24 hours.
// As a guest all of this needs an account first, so each tab says how to get one.

const REASONS = ['Mean or rude', 'Spam', 'Inappropriate', 'Pretending to be someone']

/** run a server action with a busy flag; the store shows any error */
function useAction() {
  const [busy, setBusy] = useState(null)
  const run = async (key, fn, done) => {
    if (busy) return
    setBusy(key)
    try { const r = await fn(); if (done) store.notify(typeof done === 'function' ? done(r) : done, 'good'); return r } catch (e) { store.notify(e.message, 'warn') } finally { setBusy(null) }
  }
  return [busy, run]
}

export default function World({ onClose, onAccount, onVisit, visitingId }) {
  const s = useStore()
  const [tab, setTab] = useState('world')
  const online = s.net?.status === 'online'
  const incoming = (s.friends || []).filter(f => f.incoming).length + (s.coupleRequests || []).filter(r => r.incoming).length
  return (
    <Modal title="Your world" subtitle={online ? s.world.name : 'Sign in to share it'} onClose={onClose} wide>
      <div className="chips">
        <button className={`chip ${tab === 'world' ? 'on' : ''}`} onClick={() => setTab('world')}><Icon name="world" size={15} /> Neighbours</button>
        <button className={`chip ${tab === 'friends' ? 'on' : ''}`} onClick={() => setTab('friends')}><Icon name="user" size={15} /> Friends{incoming > 0 && <i className="count">{incoming}</i>}</button>
        <button className={`chip ${tab === 'couple' ? 'on' : ''}`} onClick={() => setTab('couple')}><Icon name="heart" size={15} /> Couple</button>
      </div>
      {!online && <SignInFirst onAccount={onAccount} tab={tab} />}
      {online && tab === 'world' && <WorldTab s={s} onVisit={onVisit} visitingId={visitingId} />}
      {online && tab === 'friends' && <FriendsTab s={s} />}
      {online && tab === 'couple' && <CoupleTab s={s} onClose={onClose} />}
    </Modal>
  )
}

function SignInFirst({ onAccount, tab }) {
  const lines = {
    world: 'Your world is your street: up to six homes side by side on the cliff. Sign in, then invite friends with a link.',
    friends: 'Friends find you by your tag, like sera#2841. Sign in to get yours.',
    couple: 'As a couple your two homes become one four-room house, and you earn three times as much together. Sign in first.',
  }
  return (
    <div className="empty-state">
      <Icon name={tab === 'couple' ? 'heart' : 'world'} size={34} />
      <h3>Better together</h3>
      <p className="soft" style={{ maxWidth: 420 }}>{lines[tab]}</p>
      <button className="btn primary" onClick={onAccount}>Sign in</button>
    </div>
  )
}

// ---------------------------------------------------------------- world

function WorldTab({ s, onVisit, visitingId }) {
  const w = s.world
  const srv = store.server()
  const [busy, run] = useAction()
  const [invite, setInvite] = useState(null)
  const [code, setCode] = useState('')
  const [peek, setPeek] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const creator = w.creator === s.profile.id
  const price = nextSlotPrice(w.slots)
  const onlineCount = w.people?.filter(p => p.online).length || 1
  const rate = windowEarning({ onlineActive: onlineCount, withPartner: s.couple.state === 'active' })
  const link = invite && `${location.origin}${location.pathname}?join=${invite}`

  const slots = Array.from({ length: WORLD_MAX_SLOTS }, (_, i) => {
    const m = w.members[i]
    if (m) {
      return (
        <div className="slot filled" key={m.id}>
          <span className={`presence ${m.online ? 'on' : ''}`} title={m.online ? 'Online' : 'Offline'} />
          <div className="avatar"><Icon name={m.kind === 'couple' ? 'couple' : 'world'} size={20} /></div>
          <div><b>{m.you ? `${m.house} (you)` : m.house}</b><small>{m.kind === 'couple' ? 'a couple' : m.name}</small></div>
          {!m.you && m.id !== visitingId && <button className="link" onClick={() => onVisit(m)}>Visit</button>}
          {m.you && visitingId && <button className="link" onClick={() => onVisit(m)}>Go home</button>}
          {creator && !m.you && (
            <button className="link" onClick={() => run('rm' + m.id, async () => { for (const id of m.ids) await srv.removeMember(id) }, `${m.name} has left your world`)}>Remove</button>
          )}
        </div>
      )
    }
    if (i < w.slots) return <div className="slot empty" key={i}><div className="avatar"><Icon name="plus" size={18} /></div><div><b>Free slot</b><small>Send an invite link</small></div></div>
    return <div className="slot locked" key={i}><div className="avatar"><Icon name="lock" size={18} /></div><div><b>Slot {i + 1}</b><small>Opens for {SLOT_PRICES[i + 1]} from the world fund</small></div></div>
  })

  return (
    <div className="world-grid">
      <div className="world-main">
        {w.list?.length > 1 && (
          <div className="chips tight" style={{ marginBottom: 14 }}>
            {w.list.map(x => <button key={x.id} className={`chip ${x.id === w.id ? 'on' : ''}`} onClick={() => run('sw', () => srv.switchWorld(x.id))}>{x.name}</button>)}
          </div>
        )}
        <div className="slots">{slots}</div>

        <h4 className="sub">Invite someone</h4>
        {invite ? (
          <div className="invite-card">
            <p className="soft">Send this link (or the code). It works for 7 days.</p>
            <p className="invite-code">{invite}</p>
            <div className="btn-row">
              <button className="btn primary" onClick={() => (navigator.share ? navigator.share({ title: 'NeighBoxed', text: `Come live next door to me in ${w.name}`, url: link }).catch(() => {}) : navigator.clipboard?.writeText(link).then(() => store.notify('Invite link copied', 'good')))}>{navigator.share ? 'Share link' : 'Copy link'}</button>
              <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(invite).then(() => store.notify('Code copied', 'good'))}>Copy code</button>
            </div>
          </div>
        ) : (
          <button className="btn ghost" disabled={busy === 'inv' || w.members.length >= w.slots} onClick={() => run('inv', srv.invite).then(c => c && setInvite(c))}>
            {w.members.length >= w.slots ? 'No free slots' : 'Make an invite link'}
          </button>
        )}

        <h4 className="sub">Join a friend's world</h4>
        {peek ? (
          <div className="invite-card">
            <p className="soft"><b>{peek.from}</b> invited you to <b>{peek.name}</b> ({peek.members} of {peek.slots} homes).</p>
            <div className="btn-row">
              <button className="btn primary" disabled={busy === 'join'} onClick={() => run('join', () => srv.joinWorld(code), `Welcome to ${peek.name}!`).then(() => { setPeek(null); setCode('') })}>Join</button>
              <button className="btn ghost" onClick={() => setPeek(null)}>Not now</button>
            </div>
          </div>
        ) : (
          <form className="invite" onSubmit={e => { e.preventDefault(); run('peek', () => srv.peekInvite(code)).then(p => (p ? setPeek(p) : code && store.notify('That code has expired or doesn’t exist', 'warn'))) }}>
            <input placeholder="Six-letter code" value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} />
            <button className="btn ghost" disabled={code.trim().length !== 6}>Look it up</button>
          </form>
        )}

        <h4 className="sub">Leave</h4>
        {leaving ? (
          <div className="btn-row">
            <span className="soft">Leave {w.name}? Your home and everything in it comes with you.</span>
            <button className="btn ghost danger" onClick={() => run('leave', () => srv.leaveWorld(w.id), 'You left the world')}>Leave</button>
            <button className="btn ghost" onClick={() => setLeaving(false)}>Stay</button>
          </div>
        ) : <button className="link" onClick={() => setLeaving(true)}>Leave this world</button>}
      </div>

      <aside className="world-side">
        <div className="panel-card">
          <h4><Icon name="bolt" size={15} /> Earning together</h4>
          <p className="big-num">{rate}<small> Boxets / 30 min</small></p>
          <p className="soft">{onlineCount} online here, {Math.min(onlineCount, 3)}× each (at most 3×){s.couple.state === 'active' ? ', and 3× more while your partner is on too' : ''}.</p>
        </div>
        <div className="panel-card">
          <h4><Boxet size={15} /> World fund</h4>
          <p className="big-num">{w.fund.toLocaleString()}</p>
          <div className="btn-row">
            <button className="btn ghost" disabled={!!busy} onClick={() => run('f50', () => srv.addToFund(50), 'Added 50 to the fund')}>Add 50</button>
            <button className="btn ghost" disabled={!!busy} onClick={() => run('f100', () => srv.addToFund(100), 'Added 100 to the fund')}>Add 100</button>
          </div>
          {price != null ? (
            <>
              <div className="meter"><i style={{ width: `${Math.min(100, (w.fund / price) * 100)}%` }} /></div>
              <button className="btn primary" disabled={w.fund < price || !!busy} onClick={() => run('slot', srv.buySlot, 'A new house slot is open!')}>Open slot {w.slots + 1} · {price}</button>
            </>
          ) : <p className="soft">All {WORLD_MAX_SLOTS} slots are open.</p>}
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------- friends

function FriendsTab({ s }) {
  const srv = store.server()
  const [busy, run] = useAction()
  const [tag, setTag] = useState('')
  const [reporting, setReporting] = useState(null)
  const friends = s.friends || []
  const incoming = friends.filter(f => f.incoming)
  const outgoing = friends.filter(f => f.status === 'pending' && !f.incoming)
  const accepted = friends.filter(f => f.status === 'accepted')
  const inWorld = id => s.world.people?.some(p => p.id === id)
  const coupled = s.couple.state === 'active'

  return (
    <div className="friends">
      <div className="row">
        <span><b>Your tag</b><small>Give it to a friend so they can add you</small></span>
        <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(s.profile.tag).then(() => store.notify('Tag copied', 'good'))}><span className="tag">{s.profile.tag}</span> Copy</button>
      </div>
      <form className="invite" onSubmit={e => { e.preventDefault(); run('add', () => srv.addFriend(tag), 'Friend request sent').then(() => setTag('')) }}>
        <input placeholder="Their tag, like mochi#1234" value={tag} maxLength={24} onChange={e => setTag(e.target.value)} />
        <button className="btn primary" disabled={!/#\d{4}$/.test(tag.trim()) || busy === 'add'}>Add friend</button>
      </form>

      {incoming.length > 0 && <h4 className="sub">Wants to be friends</h4>}
      {incoming.map(f => (
        <div className="row" key={f.id}>
          <span><b>{f.name}</b><small className="tag">{f.tag}</small></span>
          <div className="btn-row">
            <button className="btn primary" onClick={() => run('a' + f.id, () => srv.answerFriend(f.id, true), `You and ${f.name} are friends`)}>Accept</button>
            <button className="btn ghost" onClick={() => run('d' + f.id, () => srv.answerFriend(f.id, false))}>Decline</button>
          </div>
        </div>
      ))}

      <h4 className="sub">Friends</h4>
      {!accepted.length && <p className="soft">No friends yet. Share your tag, or an invite link from the Neighbours tab.</p>}
      {accepted.map(f => (
        <div className="row" key={f.id}>
          <span><b><i className={`dot ${f.online ? 'on' : ''}`} /> {f.name}</b><small className="tag">{f.tag}{inWorld(f.id) ? ' · in your world' : ''}</small></span>
          {reporting === f.id ? (
            <div className="btn-row">
              {REASONS.map(r => <button key={r} className="chip" onClick={() => run('r', () => srv.report(f.id, r), 'Thanks. We’ll look into it.').then(() => setReporting(null))}>{r}</button>)}
              <button className="link" onClick={() => setReporting(null)}>Cancel</button>
            </div>
          ) : (
            <div className="btn-row">
              {!coupled && inWorld(f.id) && <button className="btn ghost rose" onClick={() => run('p' + f.id, () => srv.askPartner(f.id), `Asked ${f.name} to be your partner`)}><Icon name="heart" size={14} /> Ask to be partners</button>}
              <button className="link" onClick={() => run('x' + f.id, () => srv.removeFriend(f.id), `Removed ${f.name}`)}>Remove</button>
              <button className="link" onClick={() => run('b' + f.id, () => srv.block(f.id), `Blocked ${f.name}`)}>Block</button>
              <button className="link" onClick={() => setReporting(f.id)}>Report</button>
            </div>
          )}
        </div>
      ))}

      {outgoing.length > 0 && <h4 className="sub">Waiting for them</h4>}
      {outgoing.map(f => (
        <div className="row" key={f.id}>
          <span><b>{f.name}</b><small className="tag">{f.tag}</small></span>
          <button className="link" onClick={() => run('c' + f.id, () => srv.removeFriend(f.id))}>Cancel</button>
        </div>
      ))}

      {s.blocked?.length > 0 && <h4 className="sub">Blocked</h4>}
      {(s.blocked || []).map(b => (
        <div className="row" key={b.id}>
          <span><b>{b.name}</b><small>They can't message you, add you or join your worlds</small></span>
          <button className="link" onClick={() => run('u' + b.id, () => srv.unblock(b.id), `Unblocked ${b.name}`)}>Unblock</button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- couple

function CoupleTab({ s }) {
  const srv = store.server()
  const [, run] = useAction()
  const active = s.couple.state === 'active'
  const reqs = s.coupleRequests || []
  const incoming = reqs.filter(r => r.incoming)
  const outgoing = reqs.filter(r => !r.incoming)
  return (
    <div className="couple">
      <div className="couple-hero">
        <div className="cloud-art" aria-hidden="true"><Icon name="cloud" size={64} /><Icon name="heart" size={26} className="hrt" /></div>
        <div>
          <h3>{active ? `${s.profile.name} & ${s.couple.partner}` : 'Just you, for now'}</h3>
          {active
            ? <p className="soft">Together since {s.couple.since}, in one shared house.</p>
            : <p className="soft">Ask a friend in your world to be your partner (from the Friends tab). When they say yes, your two homes become one four-room house.</p>}
        </div>
      </div>

      {incoming.map(r => (
        <div className="row" key={r.from}>
          <span><b><Icon name="heart" size={14} /> {r.name} asked you to be partners</b><small>Your homes would merge into one bigger house. You can end it later (it takes 24 hours).</small></span>
          <div className="btn-row">
            <button className="btn primary" onClick={() => run('yes', () => srv.answerPartner(r.from, true), `You and ${r.name} are a couple!`)}>Say yes</button>
            <button className="btn ghost" onClick={() => run('no', () => srv.answerPartner(r.from, false))}>Not now</button>
          </div>
        </div>
      ))}
      {outgoing.map(r => (
        <div className="row" key={r.to}><span><b>Waiting for {r.name}</b><small>They'll see your request next time they open the game</small></span></div>
      ))}

      <div className="perks">
        <div className="perk"><Icon name="bolt" /><b>3× earning</b><small>Whenever you are both online and active for a full 30 minutes.</small></div>
        <div className="perk"><Icon name="world" /><b>One bigger home</b><small>Four rooms over two floors, with stairs and a balcony.</small></div>
        <div className="perk"><Icon name="gift" /><b>Shared things</b><small>Everything you each own can be placed. Auto-furnish picks matching pieces.</small></div>
      </div>

      {active && (
        <div className="btn-row">
          {s.couple.endsAt
            ? <><span className="soft">Your homes separate in {Math.max(0, Math.ceil((s.couple.endsAt - Date.now()) / 3600000))} h. Either of you can cancel.</span><button className="btn ghost" onClick={() => store.cancelBreakup()}>Cancel the request</button></>
            : <button className="link" onClick={() => store.requestBreakup()}>Ask to end the couple</button>}
        </div>
      )}
    </div>
  )
}
