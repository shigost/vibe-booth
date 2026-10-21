# Vibe Booth: project guide for Claude Code

Vibe Booth is a gamified 3D EDM/DJ web app by Recklyss Studios, live at https://play.recklyss.com (GitHub Pages from the `main` branch of shigost/vibe-booth). Pushing to `main` deploys automatically.

## Stack and files
- No build step. Plain HTML, CSS, and JavaScript.
- `index.html`: markup and UI panels (Mix, Studio, Show, Learn tabs, Gear guide text).
- `styles.css`: all styling. Mobile-first; the console is a bottom sheet under 820px wide.
- `app.js`: everything else, in one IIFE: music engine (Tone.js), 3D island (three.js r128), game logic, UI wiring.
- `assets/shigost.glb`: Shigost's rigged model with clips `sit`, `dance`, `jump`. `assets/shigost.jpg`: her texture.
- Libraries load from CDNs pinned to exact versions: three.js r128 (+ GLTFLoader 0.128.0) and Tone.js 14.8.49. Do not upgrade them casually; three r128 APIs (sRGBEncoding, Geometry-free BufferGeometry, etc.) are assumed throughout.

## Map of app.js (search these comments/names)
- Music: `KITS`, `PERC`, `ARR` (song structure: Intro, Groove, Build, Drop, Break, Build, Drop, Outro), `BUILTINS` (crate tracks), `VOICES` (all synth/drum voices), `class Deck` (sequencing, arrangement, hot cues, loop, roll), `initAudio`, `startAmbience`.
- Avoid Tone.js nodes that need AudioWorklets (Freeverb, JCReverb, PluckSynth, BitCrusher, FeedbackCombFilter). Use `Tone.Reverb`, synth-based plucks, etc.
- Monophonic Tone synths must be triggered with increasing times.
- Island: `SLAB`, `islandR`/`RA` (irregular shoreline), `terrainH`, `buildTerrain`, `makeWaterSurface` (shader), `makeLavaShader`, `VOLC`/`VPROF` (volcano), `riverPath`, reef (`coralGeos`, `critterGeos`, `FISH`), plants (`palm`, `banyan`, `breadfruit`, `pago`, `PLANT_BLOCK` keeps plants off the stage and props).
- Wider world: the island sits in an endless ocean. `makeWaterSurface` (one shader for the lagoon and the open sea; `perimeterRing` carries sea and seabed to the horizon), `buildFarWorld`/`updateFarWorld` (sky dome, scene fog matched to the sky haze, underwater factor `uwK`), `FAR_ISLES` (closed low-poly peaks on the horizon; swap an entry for a real scene when that island becomes visitable), `islets()`/`buildIslet` (lagoon rocks, part of the ground via `surfRaw`).
- Underwater: `applyUnderwater` (depth tint + caustics on seabed and reef), `uwLP` low-pass on the mix, orbit camera collision in `update3D`. The Reef view is a fish ride: `ride`, `rideRoute` (loop checked against `rideObstacles`), `updateRide` (follow cam or fish eyes), `rideFish` (hop), `rideUI` (label and toggle).
- Reactions: the ground never deforms. `squish`/`rumble` are small camera moves scaled by `motionK()` (Comfort mode, Reduce flashing lights, reduced motion); taps go to `waterTap`, `groundTap`, `plantTap` (coconuts), with ripples via `addRipple`.
- Stage: guma' latte house, booth, round screen (`drawProj`), sail screen (`drawSail`, mandala visuals), lasers, lava vents (flames), crowd (instanced characters).
- Mix controls: one set of parts (`#parts` in index.html: `coreA/B` platter and Play, `padsA/B`, `knobsA/B`, `faderA/B`, `xfU`, `fxU`, `tempoU`, `showRow`, `tabsNav`, `dockTools`) that `layoutControls` places by screen shape (`mode-desk` controller dock, `mode-sheet` phone sheet, `mode-land` phone on its side). Desktop dock size (`dockSize`: full, compact, hidden) and Show all controls are saved. Controls with `data-unlock` appear when that quest opens (`refreshLocks`); `data-tip` gives the tooltip. Quest targets use the part ids, and `applyCoach` points at whatever reveals a hidden target.
- Shigost: `buildShigost`, `updateShigost`, IK in `ik2`, clips via `sgMove('dance'|'jump')`.
- Game: `MISSIONS`, `LEVELS`, `complete(id)`, `addXP`, coach pill.
- `update3D` and `frame` are the per-frame loops.

## Rules for this project
- Keep everything original. Never add real artist names, song titles, brand names, or copyrighted/trademarked characters. Kits are named by genre only.
- The tall bean crowd characters are not named in the UI yet (their working name is a Nintendo trademark). Refer to them as "the crowd" until a new name is chosen.
- CHamoru culture: be accurate and respectful. Use the spelling CHamoru. Do not depict ancestral skulls or taotaomo'na. Prefer documented items (latte stones, sakman, sinahi, kulo', lusong, pågo, nunu, dokdok, Puntan and Fu'una, cave pictographs).
- Shigost must stand tall and straight; her eyes should match the Kikis' and crowd's eye size proportionally.
- UI copy: friendly, plain language, Oxford commas, never em dashes.
- Keep performance in mind for phones: prefer InstancedMesh and merged geometry for repeated objects.

## Workflow
- Test locally with Live Server (Go Live) before committing.
- Small, focused commits with clear messages. Pushing `main` updates the live site in a minute or two.
- `CNAME` in the repo root (play.recklyss.com) must stay.
