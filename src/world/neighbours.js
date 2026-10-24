// The street (the row of homes) lives in game/street.js; each neighbour's home is the real house, built in
// world/game.js. What is left here is where a plot's fence runs, shared by both.

export { streetPlots, neighbourPlots, neighbourSpan } from '../game/street.js'

/** NEIGHBOUR_PLOT_Z: the back and front fence lines of every plot along the street (yours included) */
export const NEIGHBOUR_PLOT_Z = [-(3.6 + 0.3 + 2.4), 3.6 + 0.3 + 5.2]
