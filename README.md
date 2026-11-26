# makefun-best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/shusay12/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/shusay12/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

<sub>Entered on [make.fun](https://make.fun/?ref=susay21&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

# Kestrel Ridge Run — a chase-view flight game

An original browser flight game for make.fun's **best-flight-game-20261126-0057** bounty. You fly the Kestrel, a little orange prop-plane, down a mountain valley: thread twelve amber target rings over the river and the ridges, watch your fuel, then put her down on the runway strip. Full throttle drinks fuel, a slow wing sinks, and a ridge or the river ends the sortie — throttle and turn discipline decide whether you land or crash.

## Play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and press **Space** or click to fly. Arrow keys or WASD steer and pitch, Shift is full throttle, Ctrl is idle, B is the air brake; the mouse steers by position and the wheel sets throttle. P pauses, R restarts, M mutes.

The HUD shows altitude (ft), speed (kt) and heading on a compass strip, plus an attitude ball, throttle, fuel, score, rings and the mission clock. Land on the strip after the rings for the landing bonus — thread every ring for a perfect-course bonus.

## Layout

- `game/` — the game as static files, no build step, no network request
  - `index.html` — canvas, title screen, win/loss screens
  - `src/config.js` — canvas, flight model, course and scoring tunables
  - `src/random.js` — seeded randomness and smooth value noise
  - `src/terrain.js` — the valley: hills, ridges, river, runway strip
  - `src/world.js` — flight model, rings, fuel, crash and landing rules
  - `src/input.js` — keyboard and mouse controls
  - `src/audio.js` — WebAudio engine hum, ring chime, crash and fanfare
  - `src/render.js` — sky, voxel terrain, rings, plane, lit HUD, screens
  - `src/shots.js` — deterministic screenshot scenes and the autopilot
  - `src/test.js` — scripted self-checks behind `?test=1`
  - `src/main.js` — boot, fixed-step loop, screenshot and test modes
- `screenshots/` — real renders of the game (cover, mid-flight, ring pass, landing)
- `main.ts` — the hand-in program (Node 22): copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## Verify

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
