# Handoff: The Cooling Tower Mini Model, moving to Astra's laptop (2026-10-25)

Astra asked for this work to continue on her laptop, not the desktop PC. This note is everything the next session needs.
Written by Claude Opus 5.5 (`claude-opus-5-5`).

## Where things are

| What | Where | State |
|---|---|---|
| Mini Model (the page to edit) | `mini-model/the-cooling-tower-mini-model-20261024.html` on branch `claude/level-orbit-20261024` | PR #3, open |
| Website | `index.html` (same branch) | Live from `main` on GitHub Pages |
| Live site | https://findastra.github.io/the-cooling-tower/ | Serves `main`; PR #3 is not live until merged |
| Reactor Raccoon pet | findastra/astras-pet-os PR #245 (`claude/reactor-raccoon-seed-20261024`) | Open, mergeable, main merged in |

Edit the files in the repo directly. On the desktop they were built from a scratchpad copy by a small script that only added `<!doctype html>`, `<html lang="en">` and a charset line; the repo files already have those, so keep them.

## What PR #3 holds (newest last)

- Level-ground orbit navigation; click a part to glide and turn around it (pink ring); scroll-click drag and right-drag pan; W A S D / Q E; F = whole plant.
- Rim: 35 watchers, half sitting, half standing; the pink couple removed.
- Stack booth: round counter on the round stage, rectangular DJ deck on the front, a lighting panel either side.
- Venue buttons (1 · The Stack, 2 · Turbine Hall, 3 · Reactor Hall, Whole plant; keys 1 to 3): spinning goes round the selected venue.
- "Equipment labels" switch in the key, off by default.
- **Last commit, `20b6f8a`, NOT yet checked in a browser** (syntax-checked only):
  - always-night sky: blue-black, 5,700 white star pixels on a dome that turns slowly round the pole star (40° up, north), with the Big Dipper, Cassiopeia and Orion drawn from real positions;
  - a river valley ringed by forested rolling mountains (`hillH()`), about 3,100 trees, a band of them along the break-in pipes and round the fence;
  - the broken-into gate where the pipes cross the fence (one leaf forced open, one hanging, cut chain, padlock);
  - the rest of the plant as buildings with locked doors: auxiliary building, diesel generators, control room and offices, security, warehouse, river pump house, switchyard with transformers, power lines over the mountains, a parking lot;
  - the plume drifting east on the wind once it leaves the top.

## Next steps

1. Open the PR #3 Mini Model in a browser and check the last commit: no console errors, the stars and constellations show and turn, the hills don't cover the plant, the trees don't block the pipes or the gate, the plume drifts, and the scene isn't too dark to read.
2. Fix what is off, push to `claude/level-orbit-20261024`.
3. Ask Astra before merging PR #3 (and hub PR #245). Name each PR; her OK is per PR.

## Astra's answers so far

The decisions are in `docs/design-20261024.md`. Never re-ask a question she has already answered: the first deck was "all recommended". Since then she has decided on three connected venues (the Stack, the Turbine Hall as a rectangular control room, the Reactor Hall with a round booth), a hard-hat crew that breaks in by running along the pipes, and Reactor Raccoon of The Control Room as the caretaker pet.

## Her question about the backdrop

In Unity and VRChat the backdrop is the **skybox** (a skybox material: a cubemap or a procedural sky). The dome of stars itself is the **celestial sphere**.
