import { useMemo, useState } from 'react'
import { GROUPS, CATEGORIES, categoriesOf, itemsOf, rarityOf, CAT_BY_ID } from '../game/catalog'
import { store } from '../game/store'
import { useStore } from './useStore'
import { Icon, Boxet } from './icons'
import Modal from './Modal'
import Preview from './Preview'

const SLOT_FOR_CAT = { skins: 'skin', hats: 'hat' }

function Pips({ tier }) {
  return (
    <div className="pips" aria-label={`Tier ${tier} of 10`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < tier ? 'on' : ''} />)}
    </div>
  )
}

export function ItemCard({ item, mode = 'shop', onTry }) {
  const s = useStore()
  const cat = CAT_BY_ID[item.cat]
  const r = rarityOf(item.tier)
  const count = s.owned[item.id] || 0
  const owned = count > 0
  const slot = SLOT_FOR_CAT[item.cat]
  const equipped = slot && s.equipped[slot] === item.id
  const afford = s.boxets >= item.price
  const buyable = !(cat.kind === 'unique' && owned)

  return (
    <article className={`card r-${r.id} ${owned ? 'owned' : ''}`} style={{ '--rc': r.color }}>
      <div className="card-top">
        <span className="rarity">{r.label}</span>
        {owned && <span className="owned-tag"><Icon name="check" size={12} /> {cat.kind === 'placeable' && count > 1 ? `×${count}` : 'Owned'}</span>}
      </div>
      <Preview id={item.id} size={132} />
      <h3>{item.name}</h3>
      <Pips tier={item.tier} />
      <div className="card-foot">
        {mode === 'shop' && buyable && (
          <>
            <span className={`price ${afford ? '' : 'short'}`}><Boxet /> {item.price.toLocaleString()}</span>
            <button className="btn primary" disabled={!afford} onClick={() => store.buy(item.id)}>{owned ? 'Buy another' : 'Buy'}</button>
          </>
        )}
        {mode === 'shop' && !buyable && slot && (
          <button className={`btn ${equipped ? 'ghost' : 'primary'}`} onClick={() => store.equip(slot, equipped ? null : item.id)}>{equipped ? 'Equipped' : 'Equip'}</button>
        )}
        {mode === 'shop' && !buyable && !slot && <span className="applied"><Icon name="check" size={14} /> In your collection</span>}
        {mode === 'inventory' && <span className="applied">{cat.kind === 'placeable' ? `${count} owned` : 'Owned'}</span>}
      </div>
      {mode === 'shop' && slot && !owned && (
        <button className="try" onMouseEnter={() => onTry?.(slot, item.tier)} onFocus={() => onTry?.(slot, item.tier)} onClick={() => onTry?.(slot, item.tier)}>
          <Icon name="eye" size={13} /> Try on
        </button>
      )}
    </article>
  )
}

export default function Shop({ onClose, onTry, initial = 'beds' }) {
  const s = useStore()
  const [cat, setCat] = useState(initial)
  const [onlyAfford, setOnlyAfford] = useState(false)
  const items = useMemo(() => itemsOf(cat), [cat])
  const shown = onlyAfford ? items.filter(i => i.price <= s.boxets) : items
  const ownedCount = items.filter(i => s.owned[i.id]).length
  const c = CAT_BY_ID[cat]

  return (
    <Modal
      title="Shop"
      subtitle="Spend your Boxets on things for your home and your cube."
      onClose={onClose}
      wide
      right={<div className="bal"><Boxet size={18} /> <b>{s.boxets.toLocaleString()}</b></div>}
    >
      <div className="shop">
        <nav className="rail" aria-label="Categories">
          {GROUPS.map(g => (
            <div key={g.id} className="rail-group">
              <h4>{g.label}</h4>
              {categoriesOf(g.id).map(k => (
                <button key={k.id} className={`rail-btn ${cat === k.id ? 'on' : ''}`} onClick={() => setCat(k.id)}>
                  <Icon name={k.icon} size={18} /> <span>{k.label}</span>
                  <small>{itemsOf(k.id).filter(i => s.owned[i.id]).length}/10</small>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="shop-main">
          <div className="shop-head">
            <div>
              <h3>{c.label}</h3>
              <p>{ownedCount} of 10 collected · cheapest {items[0].price.toLocaleString()} · best {items[9].price.toLocaleString()}</p>
            </div>
            <label className="switch-line">
              <input type="checkbox" checked={onlyAfford} onChange={e => setOnlyAfford(e.target.checked)} />
              <span>Only what I can afford</span>
            </label>
          </div>
          <div className="grid">
            {shown.map(i => <ItemCard key={i.id} item={i} onTry={onTry} />)}
            {shown.length === 0 && <p className="empty">Nothing here is within reach yet. Earn a few more Boxets!</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function Inventory({ onClose }) {
  const s = useStore()
  const [cat, setCat] = useState('all')
  const ownedItems = CATEGORIES.flatMap(c => itemsOf(c.id).filter(i => s.owned[i.id]))
  const list = cat === 'all' ? ownedItems : ownedItems.filter(i => i.cat === cat)
  const cats = CATEGORIES.filter(c => ownedItems.some(i => i.cat === c.id))
  return (
    <Modal title="Inventory" subtitle={`${ownedItems.length} item${ownedItems.length === 1 ? '' : 's'} collected`} onClose={onClose} wide>
      {ownedItems.length === 0 ? (
        <div className="empty-state">
          <Icon name="shop" size={34} />
          <h3>Nothing yet</h3>
          <p>Things you buy in the shop show up here, ready to place in your home.</p>
        </div>
      ) : (
        <>
          <div className="chips">
            <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All</button>
            {cats.map(c => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>)}
          </div>
          <p className="soft"><Icon name="info" size={14} /> Place furniture with Edit home. Cube skins and hats are worn from the Wardrobe.</p>
          <div className="grid">{list.map(i => <ItemCard key={i.id} item={i} mode="inventory" />)}</div>
        </>
      )}
    </Modal>
  )
}
