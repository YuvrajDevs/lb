# cc

A tiny isometric home for two. You and your partner are cubes living in a cosy bedroom diorama: walk around, chat, send hearts.

Built with Vite, React and plain [Three.js](https://threejs.org) (orthographic isometric camera, shadows, warm lamps and moonlight).

```
npm install
npm run dev
```

- **Move:** WASD / arrow keys, or click the floor
- **Zoom:** scroll
- **Chat:** type and press enter (bubbles appear over your cube)
- **Customise:** pick your cube colour (saved locally)

## Layout

- `src/world/room.js`: the bedroom (furniture, window, lights, collision boxes)
- `src/world/cube.js`: the cube character (pink body, white circle eyes, hop and blink)
- `src/world/game.js`: renderer, camera, input, movement, chat bubbles
- `src/App.jsx`: UI (colour picker, chat)

The partner (mochi) is a local bot for now. Real two-person rooms need a realtime backend (e.g. WebSocket or Supabase Realtime) that syncs position and chat.
