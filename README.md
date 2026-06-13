# CarverCraft

A multiplayer Minecraft-style voxel sandbox running entirely in the browser — **one-shotted by Claude (Fable) using [CarverJS](https://docs.carverjs.dev)**.

Everyone one-shots single-player Minecraft clones. This one is *multiplayer*: real P2P WebRTC, up to 8 players building in the same world, no game server.

## What CarverJS provided out of the box

- The entire multiplayer stack: lobby, rooms, host authority, typed P2P events (`MultiplayerProvider`, `useRoom`, `useLobby`, `usePlayers`, `useNetworkEvents`)
- Game shell, render loop, input, camera (`Game`, `World`, `Camera`, `useGameLoop`, `useInput`)
- GPU-instanced particles for block-break effects (`useParticles`)

## What's hand-rolled (~the same code every Minecraft one-shot writes)

- Infinite streaming terrain (value-noise fbm continents, mountains, oceans), chunks generate/mesh/unload around each player as they move, culled meshing with vertex AO
- Procedural 16px texture atlas — zero asset files
- Voxel raycasting (DDA) + AABB player physics, swimming, creative fly
- WebAudio-synthesized sound effects

## Multiplayer design

- World = shared seed + edit log. The creator generates a seed; late joiners ask the host (`syncReq`) and receive seed + every edit (`syncRes`), then deterministically rebuild the identical world.
- Block edits are tiny discrete events — latency-proof by construction.
- Every peer keeps the full edit log, so host migration is seamless: any promoted peer can sync new joiners.
- Positions broadcast at 15 Hz, remote avatars interpolate.

## Run it

```bash
pnpm install
pnpm dev
```

Open two browser windows, create a world in one, paste the invite code in the other.

Signaling uses Firebase RTDB (see `.env`); with no `.env` it falls back to free public MQTT brokers. Game traffic itself is pure P2P WebRTC.

## Controls

WASD move · mouse look · left-click break · right-click place · 1-9/wheel select · middle-click pick · Space jump (double-tap = fly) · Shift sprint · C descend
