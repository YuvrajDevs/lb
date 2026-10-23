// The shop catalog. Pure data (no Three.js) so the same file can be shared with the server later.
// Every category has 10 tiers; tier 1 costs 100 Boxets and prices climb steeply to tier 10.

export const TIER_PRICES = [100, 140, 200, 280, 400, 560, 800, 1150, 1650, 2400]

export const RARITY = [
  { id: 'common', label: 'Common', color: '#9fb0c8' },
  { id: 'rare', label: 'Rare', color: '#6fb0ff' },
  { id: 'epic', label: 'Epic', color: '#b88cff' },
  { id: 'legendary', label: 'Legendary', color: '#ffc15a' },
]
export const rarityOf = tier => RARITY[tier <= 3 ? 0 : tier <= 6 ? 1 : tier <= 8 ? 2 : 3]

export const GROUPS = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'decor', label: 'Decor' },
  { id: 'style', label: 'Style' },
  { id: 'garden', label: 'Garden' },
  { id: 'cube', label: 'Your cube' },
]

// kind: 'placeable' = you can own several, 'unique' = buy once, then equip / apply
export const CATEGORIES = [
  { id: 'beds', place: 'floor', group: 'furniture', label: 'Beds', kind: 'placeable', icon: 'bed', slot: 'bed',
    names: ['Plain Cot', 'Pine Single', 'Cosy Quilt Bed', 'Oak Platform', 'Starlight Bed', 'Storybook Canopy', 'Velvet Dream', 'Cloud Nine', 'Royal Four-Poster', 'Aurora Float'] },
  { id: 'wardrobes', place: 'floor', group: 'furniture', label: 'Cupboards', kind: 'placeable', icon: 'wardrobe', slot: 'wardrobe',
    names: ['Crate Cabinet', 'Pine Cupboard', 'Twin-Door Closet', 'Sliding Wardrobe', 'Mirror Closet', 'Arched Armoire', 'Velvet Wardrobe', 'Glass Display Case', 'Golden Armoire', 'Hologram Closet'] },
  { id: 'tables', place: 'floor', group: 'furniture', label: 'Tables', kind: 'placeable', icon: 'table', slot: 'table',
    names: ['Crate Table', 'Pine Table', 'Round Table', 'Writing Desk', 'Glass-Top Table', 'Gamer Desk', 'Marble Table', 'Candlelit Dining', 'Golden Desk', 'Neon Desk'] },
  { id: 'shelves', place: 'floor', group: 'furniture', label: 'Bookshelves', kind: 'placeable', icon: 'shelf', slot: 'shelf',
    names: ['Two-Shelf Rack', 'Pine Bookcase', 'Ladder Shelf', 'Cube Grid', 'Corner Library', 'Wall-to-Wall Shelf', 'Reading Library', 'Glow-Lit Shelves', 'Grand Library', 'Floating Lightshelves'] },
  { id: 'seating', place: 'floor', group: 'furniture', label: 'Seating', kind: 'placeable', icon: 'sofa', slot: 'seat',
    names: ['Wood Stool', 'Cushion Bench', 'Beanbag', 'Armchair', 'Two-Seat Sofa', 'Corner Couch', 'Velvet Chesterfield', 'Cloud Sofa', 'Golden Lounger', 'Hover Couch'] },
  { id: 'lamps', place: 'floor', group: 'lighting', label: 'Lamps', kind: 'placeable', icon: 'lamp', slot: 'lamp',
    names: ['Bare Bulb', 'Desk Lamp', 'Mushroom Lamp', 'Floor Lamp', 'Arc Lamp', 'Paper Lantern', 'Lava Lamp', 'Crystal Lamp', 'Stained-Glass Lamp', 'Galaxy Orb'] },
  { id: 'pendants', place: 'ceiling', group: 'lighting', label: 'Ceiling lights', kind: 'placeable', icon: 'pendant', slot: 'ceiling',
    names: ['Cord Bulb', 'Cone Shade', 'Paper Sphere', 'Box Pendant', 'Triple Pendant', 'Ring Light', 'Simple Chandelier', 'Crystal Chandelier', 'Star Cluster', 'Floating Orbs'] },
  { id: 'rugs', place: 'flat', group: 'decor', label: 'Rugs', kind: 'placeable', icon: 'rug', slot: 'rug',
    names: ['Plain Mat', 'Striped Rug', 'Checker Rug', 'Round Rug', 'Bordered Rug', 'Patchwork Rug', 'Moon Rug', 'Sunburst Rug', 'Royal Rug', 'Aurora Rug'] },
  { id: 'plants', place: 'floor', group: 'decor', label: 'Plants', kind: 'placeable', icon: 'plant', slot: 'plant',
    names: ['Little Sprout', 'Succulent', 'Fern', 'Monstera', 'Bonsai', 'Indoor Tree', 'Spiral Topiary', 'Blossom Tree', 'Crystal Bloom', 'Golden Tree'] },
  { id: 'art', place: 'wall', group: 'decor', label: 'Wall art', kind: 'placeable', icon: 'frame', slot: 'art',
    names: ['Paper Print', 'Pine Frame', 'White Frame', 'Gallery Pair', 'Glow Frame', 'Triptych', 'Canvas Panel', 'Backlit Panel', 'Gilded Frame', 'Living Hologram'] },
  { id: 'curtains', place: 'wall', group: 'decor', label: 'Curtains', kind: 'placeable', icon: 'curtain', slot: 'curtain',
    names: ['Plain Panels', 'Gingham Curtains', 'Striped Curtains', 'Sheer Veil', 'Tie-Back Drapes', 'Velvet Drapes', 'Fairy-Light Curtain', 'Starry Curtains', 'Gilded Drapes', 'Aurora Curtain'] },
  { id: 'paint', place: 'style', group: 'style', label: 'Wall paint', kind: 'unique', icon: 'paint', slot: 'paint',
    names: ['Chalk White', 'Sage', 'Butter', 'Blush', 'Sky', 'Striped Paper', 'Polka Paper', 'Floral Paper', 'Midnight Stars', 'Golden Deco'] },
  { id: 'floors', place: 'style', group: 'style', label: 'Flooring', kind: 'unique', icon: 'floor', slot: 'floor',
    names: ['Pine Planks', 'Oak Planks', 'Walnut Planks', 'Herringbone', 'Checker Tile', 'Slate Tile', 'Terrazzo', 'White Marble', 'Gold-Vein Marble', 'Glow Glass'] },
  { id: 'fences', place: 'style', group: 'garden', label: 'Fences', kind: 'unique', icon: 'fence', slot: 'fence',
    names: ['Rope Posts', 'White Picket', 'Capped Picket', 'Log Fence', 'Brick Wall', 'Iron Bars', 'Tall Hedge', 'Lantern Stone', 'Neon Rail', 'Golden Gate'] },
  { id: 'signs', place: 'style', group: 'garden', label: 'Name signs', kind: 'unique', icon: 'sign', slot: 'sign',
    names: ['Plank Sign', 'Painted Board', 'Carved Border', 'Stone Slab', 'Iron Arch', 'Neon Sign', 'Marble Plaque', 'Hanging Lantern', 'Gold Plaque', 'Hologram Sign'] },
  { id: 'gardenlights', place: 'garden', group: 'garden', label: 'Garden lights', kind: 'placeable', icon: 'lantern', slot: 'gardenlight',
    names: ['Glow Stake', 'Jar Light', 'Post Lantern', 'Hanging Lantern', 'Path Lights', 'Fire Bowl', 'Tall Lamp Post', 'Fairy Arch', 'Crystal Torch', 'Firefly Orbs'] },
  { id: 'skins', place: 'cube', group: 'cube', label: 'Cube skins', kind: 'unique', icon: 'cube', slot: 'skin',
    names: ['Peach Pop', 'Mint Fresh', 'Sky Blue', 'Sunny Stripes', 'Lilac Dots', 'Berry Checker', 'Sunset Gradient', 'Starry Night', 'Candy Hearts', 'Rainbow Glow'] },
  { id: 'hats', place: 'cube', group: 'cube', label: 'Cube hats', kind: 'unique', icon: 'hat', slot: 'hat',
    names: ['Beanie', 'Bow', 'Baseball Cap', 'Party Hat', 'Cat Ears', 'Flower Crown', 'Top Hat', 'Wizard Hat', 'Halo', 'Golden Crown'] },
]

const STYLES = ['basic', 'basic', 'cosy', 'cosy', 'modern', 'modern', 'dreamy', 'dreamy', 'royal', 'royal']
const BLURBS = [
  'A simple start.', 'A little nicer.', 'Warm and homely.', 'Solid and tidy.', 'Gives off a soft glow.',
  'Properly special.', 'Rich and plush.', 'Light as air.', 'Fit for royalty.', 'Nothing else compares.',
]

export const ITEMS = CATEGORIES.flatMap(cat =>
  cat.names.map((name, i) => {
    const tier = i + 1
    return {
      id: `${cat.id}-${tier}`,
      cat: cat.id,
      tier,
      name,
      price: TIER_PRICES[i],
      style: STYLES[i],
      rarity: rarityOf(tier).id,
      desc: BLURBS[i],
      kind: cat.kind,
      slot: cat.slot,
      place: cat.place,
    }
  })
)

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]))
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))
export const itemsOf = catId => ITEMS.filter(i => i.cat === catId)
export const categoriesOf = groupId => CATEGORIES.filter(c => c.group === groupId)

// Small things that may stand on top of a table instead of the floor
export const ON_TABLE = { lamps: [1, 2, 3, 7], plants: [1, 2] }
export const canStandOnTable = item => (ON_TABLE[item.cat] || []).includes(item.tier)
