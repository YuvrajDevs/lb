/** how much of the screen the editor drawer covers, so the room can be centred in what is left */
export const editInset = () => (window.innerHeight < 520 ? 262 : window.innerWidth < window.innerHeight ? 300 : 340)
