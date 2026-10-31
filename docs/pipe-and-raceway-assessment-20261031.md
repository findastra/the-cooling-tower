# Pipe and Human Raceway assessment (2026-10-31)

Astra asked for a critical look at where every pipe goes, real piping rules, colour-coded and switchable services, sulfuric
tanks standing up with a valved bottom outlet, continuity everywhere, and the Human Raceway's missing rails and odd edges.
Two auditor tools were built for it and run before and after the rework.

Model: `mini-model/the-cooling-tower-mini-model-20261030.html`. Written by Claude Opus 5.5 (`claude-opus-5-5`).

## The two tools

| Tool | File | What it checks |
|---|---|---|
| Pipe Continuity Auditor | `tools/pipe-continuity-auditor-20261031.js` | 90° turns only; straight runs along x, y or z; no doubling back; every end on a nozzle, another pipe of the same fluid or a cap; one diameter per run; sizes step only at a reducer where flow splits off (distribution) or joins (collection); a branch never bigger than its header; no two fluids joined; every fluid has its own colour and switch; no pipe through another pipe, a building or equipment; tanks that must stand on legs with a valved bottom outlet |
| Rail Continuity Auditor | `tools/rail-continuity-auditor-20261031.js` | every open walkway edge has a top rail at 1.1 m and a mid-rail at 0.55 m (OSHA 1910.29); an edge may only stay open where it meets another walking surface, a stair or ramp, a wall or a door; posts no more than about 2 m apart; no diagonal decks, no jagged steps under 0.6 m, no decks overlapping at slightly different heights, no stray rails |

Both are reusable for other worlds. In the Mini Model they run from **Map controls → Audits** (tap a finding to fly to it) or
with `?audit` on the URL (report in the browser console). The page keeps its pipe record in `window.PIPE_NETWORK` and its
walkways in `window.WALKWAYS`; saved as JSON they also run in Node: `node tools/pipe-continuity-auditor-20261031.js network.json`.
For models that never kept a record, each tool has `fromScene()`, which reads the pipes or walkways straight from the three.js scene.

The auditors were tested by planting faults in a copy of the finished network: a diagonal kink, removed reducers, an
oversized branch, a deleted branch, two fluids sharing a colour, a missing switch, a U-turn, a tank on the ground, missing
tank valves and a cut handrail. Each one was caught.

## Before and after (same tools, same rules)

| | Before | After |
|---|---|---|
| Pipe errors | **305** across 113 pipe pieces | **0** across 304 runs |
| Turns that were not 90° | 56 pipes | 0 |
| Straight runs off the x/y/z grid | 60 pipes (curving lake mains, diagonal branches) | 0 (the reactor's four radial loops are the one allowed exception, noted 12 times) |
| Lines that double back | 8 | 0 |
| Open or dangling ends | 28 | 0 |
| Pipes through other pipes or equipment | 73 | 0 |
| Fluids with their own colour and switch | 0 of 24 (one Pipes switch; many colours shared) | 14 of 14 |
| Handrail gaps | **227 gaps, 442 m of unguarded edge** | **0** |
| Jagged edges, missing mid-rails, wide post spans, diagonal deck | 70 warnings | 0 |

## What was wrong (the critical part)

- **Lake mains** curved freely down the mountain and in through odd angles; the pump-house drops ended on a diagonal.
- **Cooling water**: the warm return ran east inside the hall and then 90 m back west; it then shrank from ⌀2.3 m to ⌀0.56 m
  with no take-off to justify it before reaching the fill. The cold line had a 0.75 m jog at the basin.
- **Steam**: the main steam header ran west at 25 m and the crossover lines ran back east at 14 m over the same corridor; the
  crossover started at the HP turbine's inlet instead of its exhaust and skipped the moisture separator reheaters.
- **Feedwater** ran east at 1 m and back west at 6 m along the same line; one branch jogged out and back around a generator.
- **Detector water** came from a skid in the wrong building, 150 m away, with duplicate parallel lines and vertical drops.
- **Nitrogen** sphere outlets fed a manifold that ran over itself and ended at a blind cap in the yard.
- **Three yard lines** ("raw-water supply manifold", "treatment recovery", "utility water") went nowhere and ended in caps.
- **Chemical tanks** sat on the ground with a pipe from the top down to a cap and no bottom outlet or valve.
- **The single Pipes switch** also hid fences, roads and spheres, because it matched anything with "pipe" in its name;
  "Neon pipes" painted every pipe the same yellow, which hid what each one carries.
- **Human Raceway**: rails stopped 1.5 m short of every junction and bend, leaving gaps on the outside of every tee and
  corner; bends had missing corner squares; one leg ran on a diagonal; one path had a zero-length segment; door pads were
  wider than the deck; the sphere-access walkways at 8 m and 23 m had no rails at all.

## The rules the new layout follows

1. **Square routing.** Every turn is a 90° long-radius elbow (bend radius 1.5 × diameter, ASME B16.9 LR). Straight runs lie
   along x, y or z. A line never turns back on itself.
2. **One diameter per run.** Pipe size follows flow at equal velocity, r ∝ √flow. A **distribution** header steps down at a
   concentric reducer right after each take-off ("downhill" sizing with lateral distribution); a **collection** header steps
   up after each tie-in; a **transfer** line keeps one size from end to end. Branches are never bigger than their header.
3. **Continuity.** Every pipe starts and ends on an equipment nozzle, another pipe of the same fluid, or (nowhere, now) a cap.
4. **One rack level.** Yard pipes ride at 6.9 m: under the Human Raceway deck (8.06 m) and 6.2 m clear over roads, on
   support posts every 9 m.
5. **Colour = fluid.** Fourteen fluids, each with its own colour and its own switch; hover any pipe for its fluid, run name
   and diameter; arrows show flow direction. ASME A13.1 groups all water under one colour, which would hide the
   difference between, say, cold and warm cooling water, so the model gives every fluid its own colour (the legend is the
   Pipe services panel).

## Where each fluid goes now

| Fluid (colour) | Route |
|---|---|
| Raw lake water (green) | Two ⌀2.1 m mains from the lake (south of the intake screen), one square bend each, straight east to the pump house; two pumps; ⌀0.92 → ⌀1.3 m header out of the pump house's south wall, under the roof stairs, north along x −54 on the utility rack, east into the water-treatment building |
| Treated make-up (aqua) | Treatment building → west 3.5 m → straight to the basin at x −1.5, between two X-leg feet, past the detector buffer vessels |
| Cooling water supply, cold (sky blue) | Basin sump → circulating pump (new) → rack along the south side → condenser header that steps ⌀2.3 → ⌀1.9 → ⌀1.3 m after each branch |
| Cooling water return, warm (red) | North waterboxes → low collection header stepping up ⌀1.3 → ⌀1.9 → ⌀2.3 m → below the hall floor before the west door (the emergency exit stays clear) → under the yard and basin → up the central hot-water riser → two spines and 22 laterals under the fill, stepping down at every bank → a spray head in the gap beside each of the 88 banks |
| Reactor coolant (magenta) | Four radial loops of one size: hot leg → steam generator → crossover → coolant pump → cold leg (cold legs lowered so they no longer pass through the hot legs); surge line rises off the top of hot leg 1A to the pressurizer |
| Main steam (white) | Four generator outlets join one header (⌀1.1 → ⌀1.56 → ⌀2.2 m) that runs straight west to the top of the HP turbine |
| Crossover and reheat steam (pink) | HP exhaust → both moisture separator reheaters in parallel → hot reheat header → the three LP turbines |
| Condensate (pale blue) | Hotwells → collection header (steps up at each condenser) → feedwater pump (new) |
| Feedwater (royal blue) | Pump → header that splits to the west and east generator pairs, each branch entering its generator's shell |
| Detector water supply (gold) and return (bronze) | Tank roof → service chase → three purification filters in series beside the observatory water-services annex → chase → tank roof |
| Nitrogen (violet) | Six sphere outlets (each with an isolation valve) → collection trunk → blanketing header over the chemical block → a drop to the roof of every tank |
| Sulfuric acid (orange) | 8 tanks drain north through bottom valves into two column headers → acid transfer pump (new) → rack → basin dosing point between X-leg feet |
| Caustic soda (lime) | 8 tanks drain south the same way → caustic transfer pump (new) → water-treatment building (demineraliser regeneration) |

## Tanks

All sixteen chemical tanks (acid and caustic, for one consistent block) now stand on four legs with their dished bottom at
2.8 m. Each has a bottom outlet straight down, an isolation valve (red handwheel) and a drain into its column header, which
rides 2 m up and clears the bund walls.

## Human Raceway

- Rails are no longer drawn per segment. Every walking surface is kept as a rectangle; on each level their joined outline
  gets a top rail, a mid-rail and posts at most 1.8 m apart. Edges stay open only into another walkway, a stair or ramp, a
  building wall or the two hall doors.
- Square pads fill every bend and junction, sized to the walkways that meet there, so corners are clean.
- The diagonal leg near detector control is square; the zero-length segment at Administration is gone; door pads match the
  deck width.
- The sphere-access walkways, landings and stair flights (8 m and 23 m levels) and the ramp into the stack now have rails.

## Model changes made to fit the pipes (Astra may want to look)

- **Four fill banks removed** at (±18, −6) and (±18, 0): the two scaffold stair towers to the dance floor stood inside them.
  These are now stair wells; rows −6 and 0 run their laterals beside the towers.
- **Deck columns under the grating** moved to the gaps between fill banks, clear of laterals and spray risers.
- **Upper internals** parked in the pool moved 5 m west so the hot legs pass clear.
- **Waterbox nozzles** raised to match the cooling-water pipes; the rack under the cold line was rebuilt to carry it.

## Honest limits

- Pipe sizes are proportional to flow for a sensible look, not a hydraulic design; nothing here is sized for pressure drop.
- The lake mains are square in plan but follow the ground up and down the mountain on their supports, as overland
  pipelines do; the auditor checks their plan line.
- The reactor loops stay radial, as in a real four-loop PWR; the auditor allows radial legs for that fluid only.
- The warm-water return and the detector chase are partly below ground, so parts of them are hidden from most views.
- The auditor only knows the obstacles the page registers (buildings, turbines, generators, pumps, tanks, spheres,
  reheaters, decks, posts, stairs and others). A whole-scene sweep was also run by hand; its remaining hits were
  bounding-box false alarms (curved or round shapes whose boxes overlap but whose solids do not).
- Not piped yet: the utility tank farm (condensate storage, demineralised water, make-up and service water buffers,
  fire-water reserve, blowdown), the two detector buffer vessels and the gadolinium mixing skid. They have no pipes, so
  nothing is broken, but a real plant would connect them.
