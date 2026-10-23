# cc

A tiny home for two, as a Three.js doll house: four cosy Japanese-style rooms on a warm evening, with you and your partner as floating cubes living in them.

Built with Vite, React and plain [Three.js](https://threejs.org).

```
npm install
npm run dev
```

## The house

Two storeys, two rooms each:

| | left | right |
|---|---|---|
| **top** | study | bedroom |
| **bottom** | kitchen | living room |

Doorways join the rooms side by side. A steep staircase in the living room leads up to the bedroom: stand at its foot (or at the top landing) and press **Space**.

## Views

- **house:** the whole doll house, roof and garden included.
- **room:** fills the screen with the room you are in. Scroll to zoom out smoothly to the whole house, or in.
- **close-up:** follows your cube. **my eyes:** first person (W/S walk, A/D turn, drag to look); the room closes in with walls, ceiling and frames.
- **Compass (top right):** drag the dial to spin 360°, click it for the front view, ‹ › turn 45°. Dragging the scene or Q/E also spins (vertical drag tilts). Walls facing the camera fade away so you can always see in.
- **Move:** WASD / arrows, or click the floor (clicking in the next room walks you through the doorway).

## Layout

- `src/world/house.js`: assembles the four rooms, roof, garden, sun and collision boxes
- `src/world/shell.js`: the empty room (walls, doorways, trim, window, ceiling, frames)
- `src/world/rooms/*.js`: the furniture and lamps for each room
- `src/world/kit.js`: shared helpers and procedural textures
- `src/world/cube.js`: the floating cube
- `src/world/game.js`: renderer, cameras, input, movement, stairs, wall fading
- `src/App.jsx`, `src/Compass.jsx`: the small UI

## Picture frames

Every room has three frames on the inner face of its open front wall (seen from "my eyes"), plus a few posters. They hold pastel placeholder art for now. Swap in photos with `game.setFrameImage(index, url)` (`game.frameCount` frames in total).

The partner is a local bot that wanders between rooms. Real two-person play needs a realtime backend that syncs positions.
