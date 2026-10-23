# cc

A tiny home for two, as a Three.js diorama: a cosy Japanese-style study room on a warm evening. You and your partner are floating cubes living in it.

Built with Vite, React and plain [Three.js](https://threejs.org).

```
npm install
npm run dev
```

## Views

The default view looks straight into the room and fills the screen.

- **Compass (top right):** drag the dial to spin the room 360°, click it to go back to the front view, or use the ‹ › buttons. Dragging the scene or holding Q/E also spins it (vertical drag tilts). Walls facing the camera fade out so you can always see in.
- **room / close-up / my eyes:** whole diorama, a close view that follows your cube, or first person (W/S walk, A/D turn, drag to look). In eyes view the room is closed in with walls, ceiling and picture frames.
- **Move:** WASD / arrow keys, or click the floor. **Zoom:** scroll.

## Layout

- `src/world/room.js`: the room (furniture, window, lamps, lights, collision boxes)
- `src/world/cube.js`: the floating cube (rounded body, white circle eyes, bob and blink)
- `src/world/game.js`: renderer, cameras, input, movement, wall fading
- `src/App.jsx`, `src/Compass.jsx`: the little bit of UI

## Picture frames

Five frames hang on the back wall and the inner face of the front wall (visible in eyes view). They hold pastel placeholder art for now. Swap in photos with `game.setFrameImage(index, url)`.

The partner is a local bot that wanders around. Real two-person rooms need a realtime backend that syncs positions.
