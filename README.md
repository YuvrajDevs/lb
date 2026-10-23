# cc

A tiny isometric home for two. You and your partner are cubes living in a cosy bedroom diorama: walk around, chat, send hearts.

Built with Vite, React and plain [Three.js](https://threejs.org) (orthographic isometric camera, soft daylight through the window, shadows).

```
npm install
npm run dev
```

- **Move:** WASD / arrow keys, or click the floor
- **Compass (top right):** drag the dial to spin the room 360°, click it to reset, or use the ‹ › buttons. Q/E and dragging the scene also spin it. Walls facing the camera fade out so you can always see in.
- **Views:** `room` (whole diorama), `close-up` (follows your cube), `my eyes` (first person: W/S walk, A/D turn, drag to look). In eyes view the room is closed in with walls, ceiling and picture frames.
- **Zoom:** scroll
- **Chat:** type and press enter (bubbles appear over your cube)
- **Customise:** pick your cube colour (saved locally)

## Layout

- `src/world/room.js`: the bedroom (furniture, window, lights, collision boxes)
- `src/world/cube.js`: the cube character (pink body, white circle eyes, hop and blink)
- `src/world/game.js`: renderer, camera, input, movement, chat bubbles
- `src/App.jsx`: UI (colour picker, chat)

## Picture frames

There are 6 frames on the two inner walls (only seen from inside / eyes view), currently pastel placeholder art. Swap in real photos with `game.setFrameImage(index, url)` (see `frames` in `src/world/room.js`).

The partner (mochi) is a local bot for now. Real two-person rooms need a realtime backend (e.g. WebSocket or Supabase Realtime) that syncs position and chat.
