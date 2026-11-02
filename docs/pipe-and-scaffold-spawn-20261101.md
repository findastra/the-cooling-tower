# Pipe Spawn and Scaffold Spawn (2026-11-01)

Astra, 2026-11-01: "Your pipe tool sucks. Fix it. Pipe spawn and scaffold spawn. Fix it. Make it better."

The pipe routes from 2026-10-31 were square and continuous, but they **floated**: only the yard runs had posts, and
everything else hung in the air. Small lines looked like wires on stilts, and the stairs were scaffold in name only.
Two new tools now build the supports and the scaffolds the way they are built on a real site, and each one checks its
own work against the rules it follows.

Model: `mini-model/the-cooling-tower-mini-model-20261030.html`. Written by Claude Opus 5.5 (`claude-opus-5-5`).

## Before and after

| Before | After |
|---|---|
| ![Tank block before: nitrogen lines on a forest of 16 m posts](images/spawn-before-tank-block-20261101.jpg) | ![Tank block after: the nitrogen header sits on the tank roofs and crosses each gap on a truss pipe bridge](images/spawn-after-tank-block-20261101.jpg) |
| ![Crew scaffold before: loose posts, planks and a ramp-like stair](images/spawn-before-crew-scaffold-20261101.jpg) | ![Crew scaffold after: a braced salvaged tower with an entry deck over the lake mains, one flight and an exit deck to the roof](images/spawn-after-crew-scaffold-20261101.jpg) |
| ![Stack stairs before: one straight flight of 0.5 m steps](images/spawn-before-stack-stairs-20261101.jpg) | ![Stack stairs after: a two-lift switchback stair tower up through a well in the deck](images/spawn-after-stack-stairs-20261101.jpg) |
| ![Pump-house stairs before: a 45° straight run of 0.5 m steps through the Human Raceway](images/spawn-before-pump-house-stairs-20261101.jpg) | ![Pump-house stairs after: a six-lift stair tower against the east wall](images/spawn-after-pump-house-stairs-20261101.jpg) |

| Big lines in concrete saddles | Nitrogen spheres joined crown to crown |
|---|---|
| ![The 2.3 m cold cooling-water line resting in concrete saddles](images/spawn-after-cooling-water-saddles-20261101.jpg) | ![Truss pipe bridges carry the nitrogen rows from sphere crown to sphere crown](images/spawn-after-sphere-bridges-20261101.jpg) |

| | Before | After |
|---|---|---|
| Supports | 149 posts, yard runs only | 510: 199 T-posts, 18 shared rack bents, 76 hangers, 190 concrete saddles, 4 sleepers, 15 truss pipe bridges, 8 riser guides |
| Above-ground pipe more than half a span from a support (same 2,565 m, lake mains left out of both) | **848 m** (33 %) in 97 stretches | **11 m** in 6 short stretches |
| Lake mains | goalposts about 14 m apart (the span for a 2.1 m pipe is 9.1 m) | a concrete saddle every 7.7 m, bents where they climb to the pump house; with them counted, 12 m of 2,690 m is left |
| Stair rise | 0.5 m per step on all three scaffold stairs (stack, reactor hall, pump house) | 0.188–0.2 m on a 0.25 m going, 37–39° |
| Landings | none | one at every lift |
| Scaffold parts | posts, ledgers, a few braces | base plates, sole boards, standards, ledgers, transoms, kicker lifts, zig-zag face bracing, couplers, boarded decks, toe boards, guardrails and mid-rails, wall ties, a ladder |
| Pipe audit / Rail audit | pass / pass | pass / pass |
| Draw calls (whole plant) | 12,152 | 11,576 (supports and scaffolds are instanced) |

## pipe-spawn (`tools/pipe-spawn-20261101.js`)

Reads the same pipe record as the Pipe Continuity Auditor (`window.PIPE_NETWORK`) and places everything a pipe rests on:

- **Spacing.** The longest span for each pipe size follows ASME B31.1 Table 121.5 (water service; 2.1 m for 1 in up
  to 9.1 m for 24 in), kept at 85 % so supports of neighbouring lines can line up. There is a support beside every
  elbow; an equipment nozzle carries the pipe within 3.5 m of it.
- **The right support for the place.**
  - Big lines (⌀ 0.9 m and up) up to 4 m over the floor: **concrete saddles** with a steel strap.
  - Near the floor: **concrete sleepers** or **stub stands**, each with a pipe shoe and a U-bolt.
  - Inside buildings, under the cooling fill and under the operating floor: **hangers** from the steel overhead (a
    trapeze on two rods for bigger lines, a clevis rod for small ones).
  - Lines side by side in the yard: one **rack bent** (two columns, a beam per tier, knee braces) carries them all.
  - A lone line: a **T-post**, sized to the pipe.
  - Small elevated lines: posts no closer than a 6 m rack bay, with a **stringer** beam between them.
  - A line that runs just over raised surfaces (tank roofs, sphere crowns) and drops more than 3 m between them: a
    shared **truss pipe bridge** across each gap of up to 20 m.
  - Elevated lines crossing a road: a shared **girder road crossing** with an end frame on each side.
- **Clearance.** Every column, beam and rod is checked against buildings, equipment, stair towers and other pipes
  (round things as real cylinders). A support that cannot stand anywhere is listed, never forced through something.
- **Detail.** Footings and base plates under columns, shoes and U-bolts on every rest, riser guides every 6 m on tall
  verticals, a butt weld at both ends of every elbow and a girth weld every 12 m pipe length.

## scaffold-spawn (`tools/scaffold-spawn-20261101.js`)

- **Stair towers** (`stairTower`): switchback flights, one per lift, alternating lanes, with a landing at every lift.
  Rise at most 0.2 m on a 0.25 m going (EN 12811-1 access stairs; OSHA 1910.25 asks 0.15–0.19 m rise and at least
  0.24 m going), 30–50° (OSHA 1926.451(e)), no flight over 3.7 m without a landing, stair rails 0.9 m over the nosings
  on both sides (OSHA 1926.451(e)(4): 0.71–0.94 m). Options: an entry deck when the stair starts high up (from the pipe
  tops), an exit deck to a roof, exit at the end or to the side, one or two lanes, standards from a lower floor.
- **Access scaffolds** (`accessScaffold`): along a straight or curved wall, boarded at every lift, tied back to the
  wall (ties reach a wall that leans away, like the tower shell), with a ladder through traps in the first bay.
- **Both:** standards on base plates and sole boards, bays no longer than 2.6 m, ledgers and transoms at every lift
  and a kicker lift just over the ground, zig-zag face bracing in every bay, couplers at the joints, boarded decks with
  0.15 m toe boards, guardrails at 1.0 m with a mid-rail at 0.5 m on every open edge (EN 12811-1; OSHA 1926.451(g)(4)).
- **Fixed ladders** (`fixedLadder`): a permanent caged ladder bolted to a braced mast, for places people climb now and
  then (EN ISO 14122-4). Rungs 0.25–0.30 m apart, 0.4–0.6 m between the stiles, flights of at most 6 m staggered
  sideways with a rest landing between them, a cage from 2.2–3.0 m above each standing level with hoops no more than
  1.5 m apart and five straps, stiles 1.1 m above every landing and a self-closing gate at the top. Options: a truss
  walkway bridge straight on from the top, and a platform at its end with a hole for a nozzle. (OSHA 1910.28(b)(9)
  asks for a ladder safety system instead of a cage on new ladders over 24 ft; the cage is the EN arrangement.)
- **Sphere stairs** (`sphereStair`): the stair of a Horton sphere, as described below; checked for rise, going,
  pitch, width, clearance to the shell and its parts.
- `ScaffoldSpawn.check` re-measures what was built against those rules.

## Where they are used in the Mini Model

| Scaffold | What it is now |
|---|---|
| Stairs up to the dance floor (×2) | two-lift stair towers from the lower waffle grid up through new wells in the deck grating; the top landing opens north onto the deck; the crowd is kept out of the wells |
| Scaffold stairs up to the operating floor | a four-lift tower inside the hatch, up through a well cut in the operating floor ring; opens south onto the floor |
| Pump-house east roof-to-yard stairs | a six-lift tower against the east wall, clear of the Human Raceway bridge; the roof guardrail opens only where the top landing meets it |
| Makeshift crew scaffold | still salvaged (rusty clamps, mixed planks, grey tube rails) but put up properly: an entry deck resting on the two lake mains at 10 m, one flight, an exit deck onto the clubhouse roof |
| Maintenance scaffold on the inner shell | a 12 m access scaffold on the deck, boarded every 2 m, tied back to the leaning shell, ladder through traps |

Later the same day (Astra: the Horton spheres had "weird" walkways round them; the Human Raceway should only go between
them and a ladder is for reaching the top; all the other tanks need legs):

- The sphere crown stairs, crown walkway and crown platforms are gone. The Human Raceway runs only between the two
  sphere rows (x = 69).
- Each sphere now has the stair real Horton spheres have (Astra asked for it to look exactly like a photo of one:
  [Horton Sphere, Jackville, Alberta](https://commons.wikimedia.org/wiki/File:Horton_Sphere_-_52201347661.jpg),
  Jason Woodhead, CC BY 2.0). Scaffold Spawn `sphereStair` builds it. It starts on the Human Raceway deck between
  the rows, spirals up round the outside at 38° to the equator, then keeps that pitch over the upper half by turning
  towards the top. Last, it runs straight up the shell, easing to 12°, to a round railed platform on the crown that
  holds the outlet valve, a relief-valve stub and an instrument mast. The treads stay level on a 0.25 m going, with
  rises of 0.05–0.195 m. Stringers sit on radial brackets to the shell, with handrails and mid-rails on both sides.
  West-row stairs leave the west edge of the deck and climb south. East-row stairs leave the east edge and climb
  north, so the feet of a pair never pinch the deck. Each stair starts from its own landing, joined to the deck and
  as wide as the stair. The Human Raceway handrail wraps round the landing and opens only across the stair. The
  stair's handrails are Human Raceway yellow. Like the
  photo, the stair has no intermediate landing.
- The sphere legs now match the photo: eight columns at the shell, welded on at the equator with tapered tops, with
  concrete fireproofing on the lower part, concrete pedestals, and tie rods crossing from the foot of one leg to just
  under the equator of the next.
- Every other free-standing tank stands on legs the way a legged tank does: the eight utility tanks, the two
  detector water-service vessels, the Gd mixing tank and the three detector filters.
  - Pipe legs are welded to the shell over doubler plates and stand on concrete piers.
  - Crossed bracing fills every bay except the one the outlet leaves through.
  - The bottom outlet drops through a flanged valve at hand height to an elbow, then runs out between two legs onto a
    pipe sleeper. The lift of 2.2 m + 0.18 × radius leaves about 2 m under the dished bottom for that piping.
  - Tanks over 7 m tall get a caged ladder fixed to the shell (`fixedLadder` with `mount: 'wall'`), opposite the
    outlet, up to a roof landing with a handrail round that part of the roof edge.
  - (Big atmospheric tanks usually sit on a ring wall rather than legs; legs here are by request.)

### OSHA pass (Astra: "more detail please, reference OSHA")

The sphere stairs and the tank ladders are laid out and checked against OSHA 29 CFR 1910 Subpart D (read from
osha.gov on 2026-11-01). The Scaffold audit names the paragraph behind every check.

| Part | Rule | What the model has |
|---|---|---|
| Stair angle | 30–50° (1910.25(c)(1)) | 38°; the last flight 37° |
| Riser / tread | rise ≤ 9.5 in (0.24 m), tread ≥ 9.5 in (1910.25(c)(2)–(3)) | 0.195 m on a 0.25 m going |
| Uniform steps | equal risers and treads between landings (1910.25(b)(3)) | every riser in a flight is the same. The stair no longer flattens over the top: where the shell gets too flat to keep the pitch, it takes a landing, one straight flight towards the crown and a level walkway onto the platform |
| Width | ≥ 22 in (0.56 m) (1910.25(c)(4)) | 0.9 m |
| Landings | as wide as the stair, ≥ 30 in (0.76 m) deep (1910.25(b)(4)) | 1.0 m after every flight; flights rise at most 3.66 m (12 ft). That limit is from IBC 1011.8, because 1910 sets no maximum rise between landings |
| Headroom | 6 ft 8 in (2.03 m) over every nosing (1910.25(b)(2)) | checked against the stair itself and against every pipe in the model |
| Rails on an open-sided stair under 44 in wide | a stair rail system on each open side (1910.28(b)(11), Table D-2) | both sides |
| Stair rail | top rail ≥ 42 in (1.07 m) (1910.29(f)(1)(ii)(B)); no opening over 19 in (0.48 m) (1910.29(f)(4)) | 1.07 m top rail, intermediate rails at 0.71 and 0.36 m |
| Handrail | 30–38 in (0.76–0.97 m) (1910.29(f)(1)(i)); 2.25 in (57 mm) finger clearance (1910.29(f)(2)); ends without a projection hazard (1910.29(f)(6)) | 42 mm rail at 0.91 m on brackets inside the posts, 57 mm clear, returned to the post at both ends |
| Landings, walkway, crown platform | guardrail 42 in ± 3 in (1910.29(b)(1)), mid-rail half way (1910.29(b)(2)(i)), toe board ≥ 3.5 in (1910.29(k)(1)(ii)) | 1.07 m guardrail, 0.535 m mid-rail, 0.1 m toe boards, and a kick ring round the nozzle hole |
| Fixed ladders over 24 ft | ladder safety system or fall arrest on ladders installed from 2018-11-19 (1910.28(b)(9)(i)(B)); a cage may stay if it does not interfere (1910.28(b)(9)(iv)) | every tank ladder has a rigid ladder safety rail up the middle of the rungs, and keeps its cage |
| Ladder rungs and clearances | rungs 10–14 in apart (1910.23(b)(2)); ≥ 16 in clear width (1910.23(b)(4)); ≥ 7 in behind the rungs (1910.23(d)(2)) | 0.28 m, 0.5 m, 0.3 m |
| Ladder exits | side rails 42 in over the landing (1910.23(d)(4)); a through ladder's extension flared to 24–30 in with no rungs (1910.23(d)(5)); a side-step ladder's rails and rungs continue (1910.23(d)(6)); gate at the opening (1910.29(b)(13)) | 1.1 m; the top exit flares to 0.69 m; the rest-landing flights carry their rungs up; self-closing gate at the top |

Continuity: every rail, the handrail and the stringers each run as one unbroken line per side. They follow the
nosing line, offset at mitred corners so the pieces meet at every bend, with the same rail set on flights, landings and
the walkway into the platform ring. Each tread is as long as its outer edge, so the treads close up round the curve.
At the foot, corner posts tie the Human Raceway rails (1.1 / 0.55 m) into the stair rails (1.07 / 0.71 / 0.36 m).

More detail on the stairs: bar-grating treads with a safety-yellow nosing, and channel stringers tied together under the
treads and held off the shell by radial brackets on pads. Rail posts stand about every 1.5 m. Rails are in Human Raceway yellow.

Pipe changes made for the supports: the nitrogen trunk now drops to tank-roof height (15 m) at the sphere rows instead of
running 68 m at 26 m on tall posts, and the blanketing headers sit on the tank roofs at 15 m (was 16 m).

## How to use them

- **In the Mini Model:** Map controls → Audits → **Support audit** and **Scaffold audit** (tap a line to fly there).
  Show / hide → **Pipe supports** hides the supports to see the pipes alone.
- **On their own:** [`tools/pipe-and-scaffold-spawn-panel-20261101.html`](../tools/pipe-and-scaffold-spawn-panel-20261101.html)
  — a yard rack crossing a road, a tank-farm header, lines in a building; a stair tower or access scaffold of any height.
  Change a slider and the tool rebuilds and checks itself.

  ![The panel: three lines on rack bents cross a road on a shared girder bridge](images/spawn-panel-road-crossing-20261101.jpg)
- **In code** (browser or Node, no dependencies for planning):
  `PipeSpawn.plan(runs, env)` → parts, supports, problems; `PipeSpawn.check(runs, plan, env)` → unsupported metres;
  `ScaffoldSpawn.stairTower({...})` / `accessScaffold({...})` → parts and a record; `ScaffoldSpawn.check(record)`;
  `PipeSpawn.build` / `ScaffoldSpawn.build(THREE, parts, materials, group)` → instanced three.js meshes.

## Honest limits

- Spans and sizes are rules of thumb for a believable model, not a stress or pipe-flexibility analysis; no loads,
  thermal expansion or anchors are calculated.
- 11 m of pipe is still more than half a span from a support, in six short stretches: next to the sphere-row tie-ins
  over the nitrogen trunk (2.5 m each) and beside two condenser hotwells, where equipment leaves no room for a post.
- Hangers in the turbine hall reach up to about 21 m to the roof steel; a real hall would add intermediate steel.
- The tools only know the obstacles the page registers; a column can still touch something that is drawn but not
  registered (trees, fences, small props).
- The Unity version (Pipe Spawner and Scaffold Spawner in the tools plan) is not built; these JavaScript tools give it
  the rules and the part lists to start from.
