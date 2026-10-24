# The Cooling Tower: infrastructure parts and the tools to build them (2026-10-24)

Draft plan; no tool is built yet. Astra (2026-10-24): one tool will not build the whole world. Split the plant into its main parts, look for free engineering CAD files of industrial things, let those files shape the tools, make Pipe Spawner and Rail Spawner two separate tools, and make a Water Spawner that works for every world (pool, ocean and lake water are different).

All tools go in Unity Unicorn (findastra/unity-unicorn), beside the vine tool, so every world can use them. Each one is a small single-purpose tool.

## 1. The main parts of the plant

What you would see walking through The Cooling Tower, grouped by the kind of thing it is:

| Part family | Where it appears | Examples |
|---|---|---|
| Big concrete shells | Tower, reactor hall | Hyperbolic tower shell, containment dome, round tanks |
| Concrete columns | Tower base | The ring of X-legs (diagonal column pairs) |
| Pipes | Everywhere | Hot water riser and flumes, circulating water pipes (the tunnel), steam lines, small service pipes, valves |
| Railings | Everywhere | Guardrails on decks, stair handrails, the railings in the video |
| Walkways and stairs | Tower deck, reactor hall | Grating catwalks, platforms, stairs with grating treads, landings |
| Ladders | Outside the shell, pits | Fixed ladders with cages, rest platforms |
| Scaffolding | Tower wall (outage work) | Tube-and-clamp scaffold, as in the video |
| Water | Basin, reactor, falling rain | Cold water basin, rain under the fill, flooded reactor pool |
| Steam and smoke | Tower top, dance floor | Plume, coloured smoke columns, steam vents |
| Machines and parts | Reactor hall, control room | Reactor vessel and lid, polar crane, refuelling bridge, pumps, valves, control panels |
| Signs and markings | Everywhere | Radiation signs, yellow-and-black stripes, pipe labels with flow arrows |

## 2. The tools, one per part family

| Tool | Builds | Built from (real rules it follows) | Other worlds |
|---|---|---|---|
| **Pipe Spawner** | Pipe runs along a path you draw: straight lengths, curved elbows at every turn, tees, reducers, flanges, hangers, optional insulation and valves | Long-radius elbows bend at 1.5× the pipe size (ASME B16.9); pipe colours and flow-arrow labels from ASME A13.1 (green bands = cooling water) | Any industrial or rave world |
| **Rail Spawner** | Guardrails and handrails along an edge or stair: posts at every corner, top rail and mid rail that meet, toe board, end returns, gates | US workplace rules (OSHA 1910.29): top rail 42 in (1.07 m) high, mid rail halfway, toe board at least 3.5 in; stair rails 30 to 38 in | Every world with a balcony or stair |
| **Walkway & Stair Spawner** | Grating catwalks, platforms and stairs with landings; asks Rail Spawner for the edges | Standard grating sizes and stair rise/run (OSHA 1910.25) | Every world |
| **Ladder Spawner** | Fixed ladders, cages, rest platforms, climb points | Rungs 10 to 14 in apart, at least 16 in wide (OSHA 1910.23); cages per older rules (new US ladders use safety systems instead) | Towers, pits, rooftops |
| **Scaffold Spawner** | Tube-and-clamp scaffolding around a wall or object | Standard 48 mm tube, ledger and standard spacing | Any "under repair" scene |
| **Shell Spawner** | Smooth shells of revolution: hyperbolic tower, domes, tanks; plus the column ring at the base | The tower's real shape: base, throat and top radii and heights (section 1 of the design doc) | Domes, silos, towers |
| **Water Spawner** | Water with presets: **pool**, **ocean**, **lake**, river/channel, basin, falling rain curtain, **reactor pool** (deep, glowing blue) | Each preset sets colour, clarity, waves, foam, caustics and depth fog | Liminal Doors, Infinite Pole, Mommy's World, every world with water |
| **Steam & Smoke Spawner** | Tower plume, coloured smoke columns that pulse with the music (AudioLink), steam vents, rain particles | VRChat has no built-in fog that fills a room, so particles plus soft materials | Every rave world |
| **CAD Converter** | Brings engineers' CAD parts into Unity: STEP in, slim textured mesh out | FreeCAD (free) turns STEP into a mesh, Blender slims it and adds UVs and materials, then FBX into Unity | Any world |

### Light Show Generator (Astra, 2026-10-24)

Every DJ plays from their own stream link on a third-party host. The Light Show Generator turns whatever they play into the light show, and every future DJ world reuses it with its own look preset. It does not need to be clever; it needs to have no delay.

How it stays delay-free: the link plays in the world's video player (ProTV or similar) on every visitor's PC. AudioLink (free, already in VCC's cache) splits that same local audio into bass, low mid, high mid and treble, many times a second, on each PC. Every light reads those bands, so each person's lights match exactly what that person hears. Nothing goes over the network except the DJ's button presses.

What it is made of:

1. **A Unity tool (Generator, in Unity Unicorn)** that places a rig from a venue's anchor points (floor centre, walls, top opening, booth): VRSL moving heads and washes, lasers, smoke emitters and shell washes, wired to AudioLink bands. One click builds the rig; a preset sets the colours and moves.
2. **An automatic show, no AI:** bass pumps the floor wash and smoke, highs fire the lasers and strobes, AudioLink's built-in counters drive movement. A simple rule detects the big moments: if the bass falls well below its recent average for a couple of seconds, it is a breakdown (The Cooling Tower's "SCRAM" look: amber beacons, red light); when the bass comes back hard, it is the drop (full power: lasers fan out, smoke burst, white flash). Auto-gain keeps quiet and loud streams looking the same.
3. **A DJ panel in the booth** (Udon buttons, synced to everyone): colour theme, intensity, strobe, smoke burst, blackout, SCRAM, and a tap-tempo button. The automatic show runs underneath; the DJ steers when they want.
4. **Later, optional:** DJs with their own lighting operator can encode exact cues in a corner of their video (VRSL's DMX-over-video grid); the generator follows those when present and falls back to AudioLink otherwise.

Limits: VRSL is built for PC worlds; Quest visitors get a lighter version. Udon reading AudioLink values needs AudioLink's readback switched on.

Signs and markings start as a small decal set inside Pipe Spawner (pipe labels) and Rail Spawner (stripes); a separate tool only if they grow.

Water already exists in other worlds: Liminal Doors has its own `PoolWater` shader and about ten water materials (sea, bath, channel, black water, red water), and uses Mochie's free water shader. Water Spawner starts from those, so the worlds share one water system instead of each making its own.

## 3. Free CAD and 3D sources

Researched 2026-10-24. Licences decide what we may do with a file, so every file gets one of three tags in the download ledger (Unity Unicorn's `docs/download-ledger-20261018.json`):

- **use**: the licence allows reuse in a public world (CC0, public domain, CC BY with credit).
- **reference**: we may look and measure, but we ship our own model built from the tools.
- **ask**: reuse only with the maker's written OK.

Raw CAD files never go into a public repo; only our own built meshes do.

| Source | What's there | Format | Licence | Tag |
|---|---|---|---|---|
| [GrabCAD Community Library](https://grabcad.com) | Millions of engineers' models. Found: a SolidWorks PWR reactor pressure vessel, a condenser, HVAC cooling towers, valves, pumps | STEP, SolidWorks, Parasolid | Personal, non-commercial use; anything more needs the designer's OK ([help](https://help.grabcad.com/article/246-how-can-models-be-used-and-shared), [terms](https://grabcad.com/terms)) | reference / ask |
| [TraceParts](https://www.traceparts.com), 3D ContentCentral, [McMaster-Carr](https://www.mcmaster.com/cad-models), [Sharpe Valve](https://asc-es.com/sharpe-valve-cad-library), [Stauff](https://stauff.com/en/news/2026/ab-sofort-cad-modelle-direkt-auf-produktdetailseiten-verfugbar) | Real manufacturers' valves, fittings, flanges, grating, ladders, motors | STEP and others | Free after sign-up, meant for designing with their products; reuse is limited | reference |
| [Energy Encyclopedia 3D](https://www.energyencyclopedia.com/en/free-downloads/online-3d/npp-pwr-1) | A whole PWR plant scene with steam generators | Online 3D | Non-commercial educational use with credit | reference |
| [Sketchfab](https://sketchfab.com) (Creative Commons filter) | Game-style models: reactor rooms, consoles, cranes, VVER reactor parts ([arpoint](https://sketchfab.com/arpoint)) | glTF, FBX | Each model has its own CC licence | use (after checking each) |
| Printables, Thingiverse | Hobby models of valves, pumps, plant parts | STL | Mostly Creative Commons | use (case by case) |
| [Poly Haven](https://polyhaven.com), ambientCG | Concrete, rusty metal, painted steel, grating textures | Image textures | CC0 | use |

What this means:

- Free *engineering* CAD is excellent for **real shapes and dimensions** of parts, but most of it may not be shipped as-is in a public world. That is why the tools are built on the real engineering rules above: the shapes come out right without copying anyone's file.
- Complete nuclear plants are not published, for security; the only whole-plant model found is educational and reference only.
- CC-licensed game models and CC0 textures can go straight in, with credit.
- Nothing has been downloaded yet. Each download is listed with its source and size for Astra's OK first.

## 4. Build order (draft)

1. Pipe Spawner and Rail Spawner (every surface of the world needs them)
2. Water Spawner (helps every world at once)
3. Walkway & Stair Spawner and Ladder Spawner
4. CAD Converter (after FreeCAD is installed, with Astra's OK)
5. Shell Spawner, then Steam & Smoke Spawner, then Scaffold Spawner

The order is one of the questions in the 2026-10-24 tools deck.
