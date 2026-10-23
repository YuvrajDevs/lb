import { useMemo, useState } from 'react'
import { itemsOf, rarityOf } from '../game/catalog'
import { store } from '../game/store'
import { useStore } from './useStore'
import { previewCube } from '../world/preview'
import { Icon } from './icons'
import Modal from './Modal'
import Preview from './Preview'

export default function Wardrobe({ onClose, onOpenShop }) {
  const s = useStore()
  const [tab, setTab] = useState('skins')
  const slot = tab === 'skins' ? 'skin' : 'hat'
  const skinTier = store.equippedTier('skin')
  const hatTier = store.equippedTier('hat')
  const picture = useMemo(() => previewCube(skinTier, hatTier), [skinTier, hatTier])
  const items = itemsOf(tab)

  return (
    <Modal title="Wardrobe" subtitle="Dress your cube. Your partner and friends see it too." onClose={onClose} wide>
      <div className="ward">
        <aside className="stage-card">
          <img src={picture} alt="Your cube" width="260" height="260" />
          <h3>{s.profile.name}</h3>
          <p className="soft">
            {skinTier ? itemsOf('skins')[skinTier - 1].name : 'Classic Pink'}
            {hatTier ? ` · ${itemsOf('hats')[hatTier - 1].name}` : ' · no hat'}
          </p>
          <button className="btn ghost" onClick={() => { store.equip('skin', null); store.equip('hat', null) }}>Reset to classic</button>
        </aside>
        <div className="ward-main">
          <div className="chips">
            <button className={`chip ${tab === 'skins' ? 'on' : ''}`} onClick={() => setTab('skins')}><Icon name="cube" size={15} /> Skins</button>
            <button className={`chip ${tab === 'hats' ? 'on' : ''}`} onClick={() => setTab('hats')}><Icon name="hat" size={15} /> Hats</button>
          </div>
          <div className="grid small">
            {tab === 'hats' && (
              <button className={`tile ${!s.equipped.hat ? 'sel' : ''}`} onClick={() => store.equip('hat', null)}>
                <div className="pv" style={{ width: 90, height: 90 }}><Icon name="close" size={28} /></div>
                <span>No hat</span>
              </button>
            )}
            {tab === 'skins' && (
              <button className={`tile ${!s.equipped.skin ? 'sel' : ''}`} onClick={() => store.equip('skin', null)}>
                <div className="pv" style={{ width: 90, height: 90 }}><span className="dot-pink" /></div>
                <span>Classic Pink</span>
              </button>
            )}
            {items.map(i => {
              const owned = !!s.owned[i.id]
              const sel = s.equipped[slot] === i.id
              const r = rarityOf(i.tier)
              return (
                <button
                  key={i.id}
                  className={`tile ${sel ? 'sel' : ''} ${owned ? '' : 'locked'}`}
                  style={{ '--rc': r.color }}
                  onClick={() => (owned ? store.equip(slot, sel ? null : i.id) : onOpenShop(tab))}
                  title={owned ? i.name : `Get ${i.name} in the shop`}
                >
                  <Preview id={i.id} size={90} />
                  <span>{i.name}</span>
                  {!owned && <em><Icon name="lock" size={11} /> {i.price}</em>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
