import { useState } from 'react'
import Modal from './Modal'
import { useStore } from './useStore'
import { store } from '../game/store'
import { sendMagicLink, signOut, deleteAccount } from '../net/account'
import { Icon } from './icons'

// Your account. As a guest: sign in with a link sent to your email (no password), which keeps your home safe and
// lets you play with friends. Signed in: who you are (your tag is how friends find you), sign out, or delete
// everything for good.

export default function Account({ onClose }) {
  const s = useStore()
  const signedIn = s.net?.status === 'online'
  return (
    <Modal title="Your account" subtitle={signedIn ? `Signed in as ${s.net.email}` : 'Playing as a guest on this device'} onClose={onClose}>
      {signedIn ? <SignedIn s={s} onClose={onClose} /> : <SignIn status={s.net?.status} error={s.net?.error} />}
    </Modal>
  )
}

function SignIn({ status, error }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const send = async e => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setErr(null)
    try { await sendMagicLink(email); setSent(email.trim()) } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  if (status === 'loading') return <p className="soft">Opening your account…</p>
  if (sent) {
    return (
      <div className="account">
        <div className="account-art"><Icon name="check" size={30} /></div>
        <h3>Check your email</h3>
        <p className="soft">We sent a sign-in link to <b>{sent}</b>. Open it on this device and you'll come straight back here, signed in. Your home comes with you.</p>
        <button className="link" onClick={() => setSent(null)}>Use a different email</button>
      </div>
    )
  }
  return (
    <form className="account" onSubmit={send}>
      <ul className="account-perks">
        <li><Icon name="world" /><span><b>Play together</b>Friends and your partner in your world, live.</span></li>
        <li><Icon name="heart" /><span><b>Keep your home safe</b>On every device you sign in on.</span></li>
        <li><Icon name="bolt" /><span><b>Earn more</b>Up to 3× with friends, 3× more with your partner.</span></li>
      </ul>
      <label className="field">
        <span>Your email</span>
        <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <small>No password: we email you a link that signs you in.</small>
      </label>
      {(err || error) && <p className="account-err">{err || error}</p>}
      <button className="btn primary big" disabled={!valid || busy}>{busy ? 'Sending…' : 'Send me a sign-in link'}</button>
      <p className="soft small">By signing in you agree to play kindly. You must be 13 or older.</p>
    </form>
  )
}

function SignedIn({ s, onClose }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const copy = () => navigator.clipboard?.writeText(s.profile.tag).then(() => store.notify('Your tag is copied: send it to a friend', 'good'))
  return (
    <div className="account">
      <div className="row">
        <span><b>{s.profile.name}</b><small>Your tag, how friends find you: <b className="tag">{s.profile.tag}</b></small></span>
        <button className="btn ghost" onClick={copy}>Copy tag</button>
      </div>
      <div className="row">
        <span><b>Sign out</b><small>Your home stays safe in your account. On this device you go back to the guest home.</small></span>
        <button className="btn ghost" onClick={() => { signOut(); onClose() }}>Sign out</button>
      </div>
      <details className="danger-zone">
        <summary>Delete my account</summary>
        <p className="soft">This deletes your home, your Boxets, everything you own and your messages, for good. You leave your worlds and any couple. It can't be undone.</p>
        <label className="field">
          <span>Type DELETE to confirm</span>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button className="btn ghost danger" disabled={confirm !== 'DELETE' || deleting}
          onClick={async () => { setDeleting(true); try { await deleteAccount(); store.notify('Your account is deleted', 'info'); onClose() } catch (e) { store.notify(e.message, 'warn'); setDeleting(false) } }}>
          {deleting ? 'Deleting…' : 'Delete everything'}
        </button>
      </details>
    </div>
  )
}
