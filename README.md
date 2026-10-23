# cc

A tiny home for two, as a Three.js doll house at night: four minimal rooms lit by lamps and the moon, inside a small fenced garden, with you and your partner as floating cubes living in them.

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
- **street:** standing in the street looking at the closed-up house, its lit windows, front door and the lit name sign. Drag or Q/E walks you around the outside.
- **room:** fills the screen with the room you are in. Scroll to zoom out smoothly to the whole house, or in.
- **close-up:** follows your cube. **my eyes:** first person (W/S walk, A/D turn, drag to look); the room closes in with walls, ceiling and frames.
- **Compass (top right):** drag the dial to spin 360°, click it for the front view, ‹ › turn 45°. Dragging the scene or Q/E also spins (vertical drag tilts). Walls facing the camera fade away so you can always see in.
- **Move:** WASD / arrows, or click the floor (clicking in the next room walks you through the doorway).

## Performance

The scene is built to stay light as more houses are added:

- All static furniture, walls, ceilings and the roof are **merged into a few meshes per room** (`src/world/bake.js`) and materials are shared. Measured: about **160 draw calls** for one room and **230** for the whole house (it was ~1,100 and ~1,300), and ~17k triangles.
- Lighting is mostly **faked**: lamps use emissive shades, additive glows, floor light pools and light cones (`src/world/fx.js`), with only **one real point light per room**.
- The moon's shadows are **baked once** (the shadow map is not redrawn every frame).
- **Adaptive resolution** lowers the pixel ratio when frames get slow and raises it again when there is headroom.

## Walking the whole house in first person

In "my eyes" you can walk from the street gate, up the path, through the front door (it swings open as you approach), through every room and doorway, and up the stairs: walk into the foot of the staircase (or press Space) and you climb to the bedroom; do the same from the landing to come back down. The fence, sign and bushes block you. `game.debug.reach()` flood-fills the floor plan and reports which spots are connected.

## Garden

Each house sits in its own fenced plot with a name sign lit by its own street lamp (currently "Sera & DeM"). `game.setName('Alex & Sam')` changes it, and this is where a couple's shared name will go when two plots merge. From outside (street view) and in first person the house is closed in: the cutaway side only exists in the doll-house views.

## Roadmap

The game design (worlds, partnerships, couples, the Boxets economy) and the phased build plan are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Layout

- `src/world/house.js`: assembles the four rooms, roof, garden, sun and collision boxes
- `src/world/shell.js`: the empty room (walls, doorways, trim, window, ceiling, frames)
- `src/world/rooms/*.js`: the furniture and lamps for each room
- `src/world/kit.js`: shared helpers and procedural textures
- `src/world/bake.js`, `src/world/fx.js`: geometry merging and the fake-lighting helpers
- `src/world/cube.js`: the floating cube
- `src/world/game.js`: renderer, cameras, input, movement, stairs, wall fading
- `src/App.jsx`, `src/Compass.jsx`: the small UI

## Picture frames

Every room has three frames on the inner face of its open front wall (seen from "my eyes"), plus a few posters. They hold pastel placeholder art for now. Swap in photos with `game.setFrameImage(index, url)` (`game.frameCount` frames in total).

The partner is a local bot that wanders between rooms. Real two-person play needs a realtime backend that syncs positions.
