import * as THREE from 'three'
import * as F from './furniture.js'
import * as D from './decor.js'
import { buildHat } from '../skins.js'

const BUILDERS = {
  beds: F.bed, wardrobes: F.wardrobe, tables: F.table, shelves: F.shelf, seating: F.seating,
  lamps: F.lamp, pendants: F.pendant, rugs: D.rug, plants: D.plant, art: D.art, curtains: D.curtain,
  paint: D.paint, floors: D.floors, fences: D.fences, signs: D.signs, gardenlights: D.gardenlights,
  hats: buildHat,
}

/** the 3D model of a shop item (skins have no model: they restyle the cube, see skins.js) */
export function buildItem(item, opts = {}) {
  const g = new THREE.Group()
  const b = BUILDERS[item.cat]
  if (b) b(item.tier, g, opts.text)
  return g
}
