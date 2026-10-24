import { Icon } from './icons'

const ITEMS = [
  ['shop', 'shop', 'Shop'],
  ['wardrobe', 'wardrobe', 'Wardrobe'],
  ['edit', 'edit', 'Edit home'],
  ['world', 'world', 'World'],
  ['daily', 'gift', 'Today'],
  ['settings', 'settings', 'Settings'],
]

export default function Dock({ open, onOpen, giftReady }) {
  return (
    <nav className="dock" aria-label="Menu">
      {ITEMS.map(([id, icon, label]) => (
        <button key={id} className={`dock-btn ${open === id ? 'on' : ''}`} onClick={() => onOpen(open === id ? null : id)} aria-label={label}>
          <Icon name={icon} size={22} />
          <span>{label}</span>
          {id === 'daily' && giftReady && <i className="badge" />}
        </button>
      ))}
    </nav>
  )
}
