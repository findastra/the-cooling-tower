/* Scaffold Spawn (2026-11-01)
 * Builds tube-and-fitting scaffolds the way they are put up on site, as data first and three.js meshes second:
 *   - stairTower: a switchback stair tower. Each lift has one flight and a landing; flights alternate lanes. Rise at most
 *     0.2 m and going 0.25 m (EN 12811-1 access stairs; OSHA 1910.25 allows 0.15–0.19 m rise, 0.24 m going minimum),
 *     a stair rail 0.9 m over the nosings on both sides of every flight (OSHA 1926.451(e)(4): 0.71–0.94 m)
 *   - accessScaffold: a working scaffold along a wall (straight or curved), boarded at the lifts you ask for, tied to the wall
 *   - every scaffold: standards on base plates and sole boards, bays no longer than 2.6 m, a ledger and transoms at
 *     every lift (2 m), a kicker lift just over the ground, zig-zag face bracing in every bay, couplers at the joints,
 *     boarded decks with 0.15 m toe boards, guardrails at 1.0 m with a mid-rail at 0.5 m on every open edge
 *     (EN 12811-1; OSHA 1926.451(g)(4) top rail 0.97–1.14 m)
 * Works in a browser (window.ScaffoldSpawn) or Node:
 *   const t = ScaffoldSpawn.stairTower({ foot: [x, y, z], dir: [1, 0], across: [0, 1], height: 5.5, laneWidth: 1.0 })
 *   ScaffoldSpawn.build(THREE, t.parts, materials, group)      // instanced meshes
 *   ScaffoldSpawn.check(t)                                       // rule findings ([] when it passes)
 * Materials used by the parts: tube, coupler, base, sole, board, toe, tread, rail (falls back to tube), and
 * board1..board3 / tread1.. variants when given (mixed salvaged planks).
 */
(function (root) {
  'use strict';
  const VERSION = '2026-11-01';
  const RULES = { riseMax: 0.2, going: 0.25, liftMax: 2.2, bayMax: 2.6, guardTop: 1.0, guardMid: 0.5, toe: 0.15, stairRail: 0.9, landing: 1.2, tube: 0.03 };

  const r3 = v => +v.toFixed(3);
  function frameOf(o) {
    const [ux, uz] = o.dir, lu = Math.hypot(ux, uz) || 1, U = [ux / lu, uz / lu];
    const [vx, vz] = o.across || [-U[1], U[0]], lv = Math.hypot(vx, vz) || 1, Vv = [vx / lv, vz / lv];
    const [x0, y0, z0] = o.foot;
    // local (u along, v across, y up) → world [x, y, z]
    const W = (u, v, y) => [r3(x0 + U[0] * u + Vv[0] * v), r3(y), r3(z0 + U[1] * u + Vv[1] * v)];
    return { U, V: Vv, W, yaw: -Math.atan2(U[1], U[0]) };
  }

  // A parts list with helpers in local coordinates.
  function kit(f, style) {
    const parts = [], st = style || {};
    const variant = (m, i) => (st.mixed && st.mixed[m] ? m + (1 + (i % st.mixed[m])) : m);
    return {
      parts,
      tube(m, tag, a, b, r = RULES.tube) { parts.push({ k: 'cyl', m, tag, a: f.W(...a), b: f.W(...b), r }); },
      // board-like box: lu along u, lv along v, h thick; centre in local coordinates
      slab(m, tag, cu, cv, cy, lu, lv, h, i = 0) { parts.push({ k: 'obox', m: variant(m, i), tag, c: f.W(cu, cv, cy), s: [r3(lu), r3(h), r3(lv)], yaw: r3(f.yaw) }); },
      // an inclined board from local a to b (stringers), width w across, thickness h
      beam(m, tag, a, b, w, h) {
        const A = f.W(...a), B = f.W(...b), d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...d);
        parts.push({ k: 'bar', m, tag, a: A, b: B, w, h, L: r3(L), yaw: r3(f.yaw) });
      },
    };
  }

  // The frame: standards at every (u, v) station, ledgers along u and transoms along v at every lift, kicker lift,
  // face bracing on both long faces and the far end, base plates and sole boards.
  function frame(k, us, vs, base, top, lifts, o = {}) {
    const coupler = (u, v, y) => k.slab('coupler', 'Scaffold coupler', u, v, y, 0.11, 0.11, 0.09);
    for (const u of us) for (const v of vs) {
      if (o.skipStandard && o.skipStandard(u, v)) continue;
      k.slab('base', 'Base plate', u, v, base + 0.01, 0.15, 0.15, 0.02);
      k.tube('tube', 'Standard', [u, v, base + 0.02], [u, v, top], RULES.tube + 0.004);
    }
    for (const v of vs) k.slab('sole', 'Sole board', (us[0] + us[us.length - 1]) / 2, v, base - 0.02, us[us.length - 1] - us[0] + 0.5, 0.22, 0.04);
    const levels = [base + 0.15, ...lifts.filter(y => y > base + 0.4)];
    for (const y of levels) {
      for (const v of vs) { k.tube('tube', y === base + 0.15 ? 'Kicker ledger' : 'Ledger', [us[0], v, y], [us[us.length - 1], v, y]); for (const u of us) coupler(u, v, y); }
      for (const u of us) k.tube('tube', 'Transom', [u, vs[0], y], [u, vs[vs.length - 1], y]);
    }
    // zig-zag face bracing, bay by bay and lift by lift, on the two long faces; the far end gets one too
    const faces = [vs[0], vs[vs.length - 1]], ys = [base + 0.15, ...lifts.filter(y => y > base + 0.4)];
    if (ys[ys.length - 1] < top - 1.2) ys.push(top - 1.0);
    for (const v of faces) for (let i = 1; i < us.length; i++) for (let j = 1; j < ys.length; j++) {
      const up = (i + j) % 2 === 0; k.tube('tube', 'Face brace', [us[i - 1], v, up ? ys[j - 1] : ys[j]], [us[i], v, up ? ys[j] : ys[j - 1]], RULES.tube * 0.9);
    }
    if (o.endBrace !== false) { const u = us[us.length - 1]; for (let j = 1; j < ys.length; j++) k.tube('tube', 'End brace', [u, vs[0], ys[j - 1]], [u, vs[vs.length - 1], ys[j]], RULES.tube * 0.9); }
  }

  // Boarded deck with toe boards on the listed open edges (edges: 'u0','u1','v0','v1').
  function deck(k, u0, u1, v0, v1, y, open, tag = 'Scaffold deck') {
    const n = Math.max(1, Math.round((v1 - v0) / 0.225));
    for (let i = 0; i < n; i++) k.slab('board', tag, (u0 + u1) / 2, v0 + (i + 0.5) * (v1 - v0) / n, y - 0.025, u1 - u0, (v1 - v0) / n - 0.008, 0.05, i);
    const toe = (cu, cv, lu, lv) => k.slab('toe', 'Toe board', cu, cv, y + RULES.toe / 2, lu, lv, RULES.toe);
    if (open.includes('v0')) toe((u0 + u1) / 2, v0 + 0.02, u1 - u0, 0.03);
    if (open.includes('v1')) toe((u0 + u1) / 2, v1 - 0.02, u1 - u0, 0.03);
    if (open.includes('u0')) toe(u0 + 0.02, (v0 + v1) / 2, 0.03, v1 - v0);
    if (open.includes('u1')) toe(u1 - 0.02, (v0 + v1) / 2, 0.03, v1 - v0);
  }
  // guardrail along a local edge at deck level y: top rail and mid-rail
  function guard(k, a, b, y) { for (const h of [RULES.guardMid, RULES.guardTop]) k.tube('rail', h === RULES.guardTop ? 'Guardrail' : 'Mid-rail', [a[0], a[1], y + h], [b[0], b[1], y + h]); }

  // ---------- stair tower ----------
  // o: foot [x,y,z] (where the first flight's lane meets the ground, near corner), dir [dx,dz] (way up the first flight),
  //    across [dx,dz] (side the second lane goes), height (to the top landing), laneWidth (1.0), landing (1.2),
  //    standFrom (y the standards start from, default foot y), exit: 'end' | 'side' | 'none' (where the top landing opens),
  //    lanes: 1 forces a single straight flight per lift (one lane), style: { mixed: { board: 3 } } for salvaged planks.
  function stairTower(o) {
    const f = frameOf(o), k = kit(f, o.style), W = o.laneWidth || 1.0, LD = o.landing || RULES.landing, H = o.height;
    const y0 = o.foot[1], base = o.standFrom != null ? o.standFrom : y0;
    const n = o.lifts || Math.max(1, Math.round(H / RULES.liftMax)), h = H / n;
    const risers = Math.ceil(h / RULES.riseMax - 1e-9), rise = h / risers, treads = risers - 1, run = treads * RULES.going;
    const lanes = o.lanes || (n > 1 ? 2 : 1), L = LD + run + LD, width = lanes * W;
    const levels = Array.from({ length: n + 1 }, (_, i) => y0 + i * h);
    // standards: both ends of each landing and bays of at most 2.6 m along the flights; across: lane edges
    const us = [0, LD]; const m = Math.max(1, Math.ceil(run / RULES.bayMax)); for (let j = 1; j < m; j++) us.push(LD + run * j / m); us.push(LD + run, L);
    const vs = []; for (let i = 0; i <= lanes; i++) vs.push(i * W);
    const top = levels[n] + RULES.guardTop;
    // lifts: every 2 m below the first landing (a tower that starts high up), then every landing, with a middle
    // ledger where a lift is taller than 2.2 m
    const lifts = []; for (let y = base + 2; y < y0 - 0.5; y += 2) lifts.push(y);
    if (y0 - base > 0.5) lifts.push(y0);
    for (let i = 1; i <= n; i++) { if (h > RULES.liftMax) lifts.push(levels[i - 1] + h / 2); lifts.push(levels[i]); }
    frame(k, us, vs, base, top, lifts, {});
    const onTower = (u, v) => us.some(x => Math.abs(x - u) < 1e-6) && vs.some(x => Math.abs(x - v) < 1e-6);

    // an entry deck in front of the first flight when the stair starts above the ground (e.g. from pipe tops),
    // optionally wider than the tower: o.entry = { length, widen }
    if (o.entry && y0 - base > 0.3) {
      const el = o.entry.length, ew = o.entry.widen || 0, eus = [-el]; const ne = Math.ceil(el / RULES.bayMax); for (let j = 1; j < ne; j++) eus.push(-el + el * j / ne); eus.push(0, LD);
      const evs = ew ? [-ew, ...vs, width + ew] : vs;
      frame(k, eus, evs, base, y0 + RULES.guardTop, lifts.filter(y => y <= y0 + 1e-6), { endBrace: false, skipStandard: onTower });
      deck(k, -el, 0, -ew, width + ew, y0, ['v0', 'v1'], 'Entry deck');
      deck(k, 0, LD, 0, W, y0, [], 'Entry deck');
      guard(k, [-el, -ew], [0, -ew], y0); guard(k, [-el, width + ew], [0, width + ew], y0);
      if (ew) { guard(k, [0, -ew], [0, 0], y0); guard(k, [0, width], [0, width + ew], y0); }
      if (lanes === 2) guard(k, [LD, W], [LD, width], y0);
    }

    const flights = [], landings = [];
    for (let i = 0; i < n; i++) {
      const lane = lanes === 1 ? 0 : i % 2, up = lane === 0 ? 1 : -1, v0 = lane * W, v1 = v0 + W, yA = levels[i];
      // treads (steel, slip-resistant) and the two stringers
      for (let t = 1; t <= treads; t++) {
        const uc = up > 0 ? LD + (t - 0.5) * RULES.going : L - LD - (t - 0.5) * RULES.going;
        k.slab('tread', 'Stair tread', uc, (v0 + v1) / 2, yA + t * rise - 0.02, RULES.going - 0.01, W - 0.12, 0.04, t);
      }
      const uS = up > 0 ? LD : L - LD, uE = up > 0 ? LD + run : LD;
      for (const v of [v0 + 0.05, v1 - 0.05]) k.beam('tube', 'Stair stringer', [uS, v, yA - 0.08], [uE, v, yA + h - 0.08], 0.06, 0.18);
      // stair rails both sides: 0.9 m and 0.45 m over the nosing line
      for (const v of [v0, v1]) for (const hh of [RULES.stairRail / 2, RULES.stairRail]) k.tube('rail', hh === RULES.stairRail ? 'Stair rail' : 'Stair mid-rail', [uS, v, yA + hh], [uE, v, yA + h + hh]);
      flights.push({ lane, from: r3(yA), to: r3(yA + h), risers, rise: r3(rise), going: RULES.going, run: r3(run), angle: r3(Math.atan2(rise, RULES.going) * 180 / Math.PI) });
    }
    // landings: level i (i ≥ 1) sits at the far end for odd i, the near end for even i; it spans every lane
    for (let i = 1; i <= n; i++) {
      const atB = lanes === 1 ? true : i % 2 === 1, u0 = atB ? L - LD : 0, u1 = atB ? L : LD, y = levels[i];
      const isTop = i === n, openEdges = [];
      // which edges are walls of the tower (guarded): the two long faces, the end face, and on the top landing the
      // stairwell edge over the lane that does not arrive here
      const endEdge = atB ? 'u1' : 'u0', wellEdge = atB ? 'u0' : 'u1';
      const exitEdge = isTop ? (o.exit === 'side' ? (o.exitSide === 0 ? 'v0' : 'v1') : o.exit === 'none' ? null : endEdge) : null;
      for (const e of ['v0', 'v1', endEdge]) if (e !== exitEdge) openEdges.push(e);
      deck(k, u0, u1, 0, width, y, openEdges, isTop ? 'Top landing' : 'Stair landing');
      const uEnd = atB ? L : 0, uWell = atB ? L - LD : LD;
      if (exitEdge !== 'v0') guard(k, [u0, 0], [u1, 0], y);
      if (exitEdge !== 'v1') guard(k, [u0, width], [u1, width], y);
      if (exitEdge !== endEdge) guard(k, [uEnd, 0], [uEnd, width], y);
      if (lanes === 2) {
        // the lane whose flight neither arrives nor leaves here looks down the stairwell
        const arrive = (i - 1) % 2, leave = isTop ? -1 : i % 2, well = [0, 1].filter(l => l !== arrive && l !== leave);
        for (const l of well) guard(k, [uWell, l * W], [uWell, (l + 1) * W], y);
      }
      landings.push({ level: r3(y), min: f.W(Math.min(u0, u1), 0, y), max: f.W(Math.max(u0, u1), width, y), exit: isTop ? exitEdge : null });
    }
    // over the flights at the top level: the tower's outer guardrails continue (no one may step into the shaft)
    const yT = levels[n], topAtB = lanes === 1 ? true : n % 2 === 1, f0 = topAtB ? 0 : LD, f1 = topAtB ? L - LD : L;
    guard(k, [f0, 0], [f1, 0], yT); guard(k, [f0, width], [f1, width], yT);
    if (!topAtB) guard(k, [L, 0], [L, width], yT); else guard(k, [0, 0], [0, width], yT);
    // entry at the bottom: a pad in front of the first flight
    if (!(o.entry && y0 - base > 0.3)) k.slab('board', 'Stair entry landing', LD / 2, W / 2, y0 + 0.02, LD, W, 0.04);
    // a bridge deck out of the top landing's end (e.g. across to a roof): o.exitDeck = length
    if (o.exitDeck && (o.exit || 'end') === 'end') {
      const xl = o.exitDeck, uA = topAtB ? L : 0, sg = topAtB ? 1 : -1, xus = [uA]; const nx = Math.ceil(xl / RULES.bayMax); for (let j = 1; j <= nx; j++) xus.push(uA + sg * xl * j / nx);
      const sorted = xus.slice().sort((a, b) => a - b);
      frame(k, sorted, vs, base, yT + RULES.guardTop, lifts.filter(y => y <= yT + 1e-6), { endBrace: false, skipStandard: onTower });
      deck(k, Math.min(uA, uA + sg * xl), Math.max(uA, uA + sg * xl), 0, width, yT, ['v0', 'v1'], 'Exit deck');
      guard(k, [uA, 0], [uA + sg * xl, 0], yT); guard(k, [uA, width], [uA + sg * xl, width], yT);
    }

    const corners = [f.W(0, 0, base), f.W(L, 0, base), f.W(0, width, base), f.W(L, width, base)];
    const min = [Math.min(...corners.map(c => c[0])), base, Math.min(...corners.map(c => c[2]))], max = [Math.max(...corners.map(c => c[0])), r3(top), Math.max(...corners.map(c => c[2]))];
    return { kind: 'stair tower', version: VERSION, parts: k.parts, flights, landings, levels: levels.map(r3), bays: us.map(r3), lanes, laneWidth: W, length: r3(L), width: r3(width), footprint: { min, max }, top: landings[landings.length - 1] };
  }

  // ---------- access scaffold along a wall ----------
  // o: path [[x,z], ...] (inner line, next to the wall; straight legs), wallSide: +1/-1 (which side of the path the wall is,
  //    looking along it), base, height, width (1.0), lift (2.0), decks: [y, ...] boarded lifts, tie: true
  function accessScaffold(o) {
    const parts = [], width = o.width || 1.0, lift = o.lift || 2.0, base = o.base || 0, top = base + o.height;
    const path = o.path;
    for (let s = 1; s < path.length; s++) {
      const [ax, az] = path[s - 1], [bx, bz] = path[s], L = Math.hypot(bx - ax, bz - az);
      const dir = [(bx - ax) / L, (bz - az) / L], wall = o.wallSide || 1, across = [dir[1] * wall, -dir[0] * wall]; // away from the wall
      const f = frameOf({ foot: [ax, base, az], dir, across }), k = kit(f, o.style);
      const nb = Math.max(1, Math.ceil(L / RULES.bayMax)), us = []; for (let j = 0; j <= nb; j++) us.push(L * j / nb);
      const lifts = []; for (let y = base + lift; y <= top - RULES.guardTop + 0.01; y += lift) lifts.push(y);
      const deckTop = (o.decks && o.decks.length) ? o.decks : lifts;
      frame(k, us, [0, width], base, Math.max(...deckTop) + RULES.guardTop, lifts, { endBrace: s === path.length - 1 });
      for (const y of deckTop) {
        deck(k, 0, L, 0, width, y, ['v1'].concat(s === 1 ? ['u0'] : [], s === path.length - 1 ? ['u1'] : []), 'Working platform');
        guard(k, [0, width], [L, width], y);
        if (s === 1) guard(k, [0, 0], [0, width], y);
        if (s === path.length - 1) guard(k, [L, 0], [L, width], y);
      }
      // access: a ladder up the first bay through a trap in every deck, tied to the transoms
      if (s === 1 && o.ladder !== false) {
        const lu = Math.min(0.9, us[1] / 2), lv = width / 2, ladderTop = Math.max(...deckTop) + RULES.guardTop;
        for (const du of [-0.2, 0.2]) k.tube('tube', 'Ladder stile', [lu + du, lv, base], [lu + du, lv, ladderTop], 0.025);
        for (let y = base + 0.3; y < ladderTop - 0.2; y += 0.3) k.tube('tube', 'Ladder rung', [lu - 0.2, lv, y], [lu + 0.2, lv, y], 0.016);
        for (const y of deckTop) k.slab('board', 'Ladder trap lid', lu + 0.45, lv, y + 0.03, 0.5, 0.6, 0.03);
      }
      if (o.tie !== false) for (let j = 0; j <= nb; j += 2) for (let y = base + lift; y < top; y += 2 * lift) {
        const reach = o.tieLength ? o.tieLength(f.W(us[j], 0, y)) : 0.4; k.tube('tube', 'Wall tie', [us[j], 0, y], [us[j], -reach, y]);
      }
      parts.push(...k.parts);
    }
    const mid = path[Math.floor(path.length / 2)];
    return { kind: 'access scaffold', version: VERSION, parts, width, lift, base, top, centre: [mid[0], r3((base + top) / 2), mid[1]] };
  }

  // ---------- rule check ----------
  function check(t) {
    const out = [], bad = (code, msg) => out.push({ severity: 'error', code, message: msg });
    if (t.kind === 'stair tower') {
      for (const fl of t.flights) {
        if (fl.rise > RULES.riseMax + 1e-3) bad('RISE', `flight ${fl.from}→${fl.to} m: rise ${fl.rise} m is over ${RULES.riseMax} m`);
        if (fl.going < 0.24 - 1e-3) bad('GOING', `flight ${fl.from}→${fl.to} m: going ${fl.going} m is under 0.24 m`);
        if (fl.angle < 30 || fl.angle > 50) bad('ANGLE', `flight ${fl.from}→${fl.to} m: ${fl.angle}° is outside 30–50°`);
        if (fl.to - fl.from > 3.7 + 1e-3) bad('LANDING', `flight ${fl.from}→${fl.to} m climbs more than 3.7 m without a landing`);
      }
      for (let i = 1; i < t.bays.length; i++) if (t.bays[i] - t.bays[i - 1] > RULES.bayMax + 1e-3) bad('BAY', `bay ${i} is ${(t.bays[i] - t.bays[i - 1]).toFixed(2)} m long`);
      if (t.laneWidth < 0.6) bad('WIDTH', `stair lane ${t.laneWidth} m is under 0.6 m`);
    }
    const tags = new Set(t.parts.map(p => p.tag));
    if (t.kind === 'access scaffold' && !tags.has('Ladder rung')) bad('ACCESS', 'no ladder or stair up to the platforms');
    for (const need of ['Standard', 'Base plate', 'Ledger', 'Transom', 'Face brace', 'Guardrail', 'Mid-rail', 'Toe board']) if (!tags.has(need)) bad('PART', `no ${need.toLowerCase()} in the scaffold`);
    return out;
  }

  // ---------- three.js ----------
  function build(THREE, parts, materials, group) {
    const geo = { cyl: new THREE.CylinderGeometry(1, 1, 1, 8), obox: new THREE.BoxGeometry(1, 1, 1), bar: new THREE.BoxGeometry(1, 1, 1) };
    const buckets = new Map();
    for (const p of parts) { const key = p.k + '|' + p.m + '|' + p.tag; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(p); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Euler(), meshes = [];
    for (const [key, list] of buckets) {
      const [shape, m, tag] = key.split('|'), base = m.replace(/\d+$/, ''), mat = materials[m] || materials[base] || (base === 'rail' ? materials.tube : null) || materials.tube;
      const mesh = new THREE.InstancedMesh(geo[shape], mat, list.length);
      list.forEach((p, i) => {
        if (shape === 'cyl') { const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b); d.subVectors(b, a); v.copy(a).addScaledVector(d, 0.5); s.set(p.r, d.length(), p.r); q.setFromUnitVectors(up, d.normalize()); }
        else if (shape === 'obox') { v.set(...p.c); s.set(...p.s); q.setFromEuler(e.set(0, p.yaw, 0)); }
        else { // bar: a board from a to b, pitched in its own vertical plane
          const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b); d.subVectors(b, a); v.copy(a).addScaledVector(d, 0.5);
          const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); q.setFromEuler(e.set(0, Math.atan2(-d.z, d.x), pitch, 'YZX')); s.set(p.L, p.h, p.w);
        }
        mesh.setMatrixAt(i, m4.compose(v, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.name = tag; mesh.name = tag; mesh.userData.spawnedBy = 'scaffold-spawn';
      if (group) group.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }

  const api = { stairTower, accessScaffold, check, build, RULES, version: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScaffoldSpawn = api;
})(typeof window !== 'undefined' ? window : globalThis);
