# Antescher

▶ **Play it now: <https://flounder1664.github.io/AntAttack/>**

A browser-based clone of Sandy White's *Ant Attack* (Quicksilva, ZX Spectrum,
1983) — one of the first isometric 3D games ever made.

You enter a walled isometric city ("Antescher") to find a hostage and escort
them out through any gap in the outer wall, while giant ants pour from nests
at ground level and try to bite you to death. You have grenades, a timer,
and four hits before you fall.

Plays in any modern browser — no install, no build step.

## Controls

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` / `W` `A` `S` `D` | Walk in screen-relative directions |
| `Space` / `G` | Throw grenade (in facing direction) |
| `Q` / `E` | Rotate view 90° |
| `Esc` | Pause |

You can climb up or step down 1-block ledges as you walk. Falling more than
one block costs `(drop − 1)` hits on landing, so look before you leap.

## Running it locally

There's no build step. Serve the directory with any static file server:

```bash
python server.py        # included — serves on http://127.0.0.1:8765
```

…then open http://127.0.0.1:8765/ in a browser. The included `server.py`
adds no-cache headers, which is handy during development; any other static
server (`python -m http.server`, `npx serve`, etc.) will also work.

## Project layout

```
index.html                # canvas + HUD overlay + module entry
style.css                 # page + HUD styling
server.py                 # tiny no-cache static server for local dev
src/
  main.js                 # game loop, state machine, render orchestration
  iso.js                  # 2:1 dimetric projection + cube/sprite drawing
  world.js                # voxel grid, city generation, walkability queries
  ai.js                   # BFS pathfinding over walkable surface
  input.js                # keyboard handling + screen-relative direction map
  hud.js                  # DOM HUD overlay updates
  themes.js               # palettes + sprite tints (default: Spectrum)
  achievements.js         # event hooks, unlocks, localStorage persistence
  storage.js              # thin localStorage wrapper
  audio.js                # procedural WebAudio sound effects
  entities/
    player.js             # walk, jump, fall damage, facing
    ant.js                # AI tick, biting, BFS-driven pathing
    hostage.js            # idle / following / rescued behaviour
    grenade.js            # parabolic flight + blast radius
```

## Features

- **Isometric voxel city** generated procedurally — outer wall with 2–3 gaps,
  interior streets, scattered cube clusters, ant nests.
- **Multi-level progression** — seven levels of increasing size, more ants,
  tighter timer, and progressively maze-like layouts.
- **Five themes**, default (Spectrum monochrome) plus four locked behind
  achievements: Mint, Dusk, Circuit, and Bone & Ash.
- **Achievements** — First Rescue, Untouched, Pacifist, Speedrun, etc.,
  persisted to `localStorage` and gating theme unlocks.
- **Spectrum-faithful pixel-art sprites** for the Spectrum theme; smooth
  vector-style sprites for the other themes.
- **Procedural sound effects** synthesised with WebAudio — no audio assets.

## Credits

Original *Ant Attack* designed and programmed by **Sandy White** for
Quicksilva, 1983.

This is a fan-made tribute / reimplementation, not affiliated with the
original publisher or author.
