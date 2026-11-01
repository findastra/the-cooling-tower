/* Pipe Spawn (2026-11-01)
 * Builds everything a pipe needs besides the pipe itself, from the same network record the Pipe Continuity Auditor reads:
 *   - supports at real spacings: the longest span for each pipe size follows ASME B31.1 Table 121.5 (water service),
 *     with a support right after every elbow
 *   - the right support for the place: a concrete sleeper or stub stand near the floor, a hanger from the structure
 *     overhead inside buildings, a T-post for a lone line in the yard, and shared rack bents (two columns, one beam
 *     per tier, knee braces) where lines run side by side
 *   - a pipe shoe and a U-bolt on every rest, guides on tall risers, base plates and concrete footings under columns
 *   - welds where each elbow meets the straight pipe and a girth weld every 12 m pipe length
 * Columns and beams are kept clear of buildings, equipment and other pipes. A support that cannot stand anywhere is
 * reported, never forced through something.
 *
 * Works in a browser (window.PipeSpawn) or in Node (require), with no dependencies for the planning step:
 *   const plan = PipeSpawn.plan(network.runs, env)      // pure data: parts, bents, hangers, problems
 *   const meshes = PipeSpawn.build(THREE, plan.parts, materials, group)   // instanced three.js meshes
 *   const report = PipeSpawn.check(network.runs, plan, env)              // unsupported spans
 *
 * Run format: { id, name, service, radius, points: [[x,y,z], ...] (90° turns, y up, metres), overland?, buried? }
 * env (all optional):
 *   ground(x, z, y)       height of the floor or grade under a point at height y (default 0)
 *   ceiling(p, run)       { y, name, prefer?, maxHang? } of the structure a hanger can hang from above p, or null;
 *                         prefer: hang even when a post would be shorter (inside buildings, under the fill)
 *   footing(x, z)         false where a column may not stand (roads, water)
 *   obstacles             [{ type: 'box', min, max } | { type: 'cyl', a, b, r }] in the auditor's format
 *   skipRun(run)          true for lines with their own supports (overland mains on the hillside)
 *   skip(p, run)          true where a single support is not wanted
 *   anchors               [[x,y,z], ...] equipment nozzles: the equipment carries the pipe within 3.5 m of one
 *   spanFactor            scales every span (default 0.85 keeps a little slack for bents that line up)
 */
(function (root) {
  'use strict';
  const VERSION = '2026-11-01';

  // ---------- small vector kit (plain objects so Node needs nothing) ----------
  const P = a => (Array.isArray(a) ? { x: +a[0], y: +a[1], z: +a[2] } : { x: +a.x, y: +a.y, z: +a.z });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const len = a => Math.sqrt(dot(a, a));
  const unit = a => { const l = len(a) || 1; return mul(a, 1 / l); };
  const dist = (a, b) => len(sub(a, b));
  const A = p => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)];

  function segSeg(a, b, c, d) { // closest distance between segments ab and cd
    const u = sub(b, a), v = sub(d, c), w = sub(a, c);
    const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v), dd = dot(u, w), ee = dot(v, w), den = aa * cc - bb * bb;
    let s, t;
    if (den < 1e-9) { s = 0; t = cc ? ee / cc : 0; } else { s = (bb * ee - cc * dd) / den; t = (aa * ee - bb * dd) / den; }
    s = Math.max(0, Math.min(1, s)); t = cc ? Math.max(0, Math.min(1, (bb * s + ee) / cc)) : 0;
    s = aa ? Math.max(0, Math.min(1, (bb * t - dd) / aa)) : 0;
    return dist(add(a, mul(u, s)), add(c, mul(v, t)));
  }
  function segBox(a, b, min, max, r) { // segment ab thickened by r against an axis-aligned box
    let t0 = 0, t1 = 1; const d = sub(b, a);
    for (const k of ['x', 'y', 'z']) {
      const lo = min[k] - r, hi = max[k] + r;
      if (Math.abs(d[k]) < 1e-9) { if (a[k] <= lo || a[k] >= hi) return false; continue; }
      let ta = (lo - a[k]) / d[k], tb = (hi - a[k]) / d[k]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
    }
    return t1 - t0 > 1e-6;
  }

  function segCyl(a, b, w, c, d, R) { // segment ab thickened by w against a solid cylinder (axis cd, radius R) with flat ends
    const axis = sub(d, c), h = len(axis), u = mul(axis, 1 / (h || 1)), n = Math.max(2, Math.ceil(dist(a, b) / 0.25));
    for (let i = 0; i <= n; i++) {
      const p = add(a, mul(sub(b, a), i / n)), q = sub(p, c), t = dot(q, u), radial = len(sub(q, mul(u, t)));
      if (Math.hypot(t < 0 ? -t : t > h ? t - h : 0, Math.max(0, radial - R)) < w) return true;
    }
    return false;
  }

  // ---------- rules ----------
  // ASME B31.1 Table 121.5, suggested maximum span for water service: nominal pipe size (m) → span (m).
  const SPAN_TABLE = [[0.025, 2.1], [0.05, 3.0], [0.08, 3.7], [0.1, 4.3], [0.15, 5.2], [0.2, 5.8], [0.25, 6.4], [0.3, 7.0],
    [0.35, 7.6], [0.4, 8.2], [0.5, 8.8], [0.6, 9.1]];
  function maxSpan(diameter) { for (const [d, s] of SPAN_TABLE) if (diameter <= d + 1e-6) return s; return 9.1; }
  const SPOOL = 12;          // a girth weld every 12 m (one random length of pipe)
  const SHOE = 0.15;         // pipe shoe height between pipe and beam
  const BEAM = 0.3;          // beam depth (W-section)
  const COL = 0.15;          // half the column width
  const MAX_HANG = 7;        // longest hanger rod
  const RACK_STEP = 6;       // elevated lines: posts no closer than a rack bay; smaller lines get a stringer beam between
  const ANCHOR = 3.5;        // an equipment nozzle carries the pipe this far
  const GUIDE_STEP = 6;      // riser guides
  const bendRadius = (r, inLen, outLen) => Math.min(3 * r, inLen * 0.45, outLen * 0.45); // long radius 1.5 D, as the page draws it

  function cleanPoints(points) {
    const out = [];
    for (const q of points.map(P)) {
      if (out.length && dist(q, out[out.length - 1]) < 1e-4) continue;
      if (out.length >= 2) { const a = out[out.length - 2], b = out[out.length - 1]; if (dot(unit(sub(b, a)), unit(sub(q, b))) > 0.99999) { out[out.length - 1] = q; continue; } }
      out.push(q);
    }
    return out;
  }
  // the straight pieces of a run between its elbows, with what is at each end ('end' = nozzle or tie-in, 'elbow')
  function straights(run) {
    const pts = cleanPoints(run.points), r = run.radius, out = [];
    for (let i = 1; i < pts.length; i++) {
      const a0 = pts[i - 1], b0 = pts[i], L = dist(a0, b0), dir = unit(sub(b0, a0));
      const trimA = i > 1 ? bendRadius(r, dist(pts[i - 2], a0), L) : 0;
      const trimB = i < pts.length - 1 ? bendRadius(r, L, dist(b0, pts[i + 1])) : 0;
      out.push({ i, a: add(a0, mul(dir, trimA)), b: add(b0, mul(dir, -trimB)), dir, length: Math.max(0, L - trimA - trimB),
        startKind: i > 1 ? 'elbow' : 'end', endKind: i < pts.length - 1 ? 'elbow' : 'end',
        horizontal: Math.abs(dir.y) < 1e-3, vertical: Math.abs(dir.y) > 0.999,
        axis: Math.abs(dir.y) > 0.999 ? 'y' : Math.abs(dir.x) > Math.abs(dir.z) ? 'x' : 'z' });
    }
    return out;
  }

  // where along one horizontal straight the supports go: one beside each elbow, then evenly spaced, no gap over the span
  function stationOffsets(s, span) {
    const L = s.length; if (L < 0.25) return [];
    if (L < 0.9) return s.startKind === 'elbow' || s.endKind === 'elbow' ? [L / 2] : [];
    const fixed = [], phys = new Set();
    fixed.push(s.startKind === 'elbow' ? 0.3 : 0); if (s.startKind === 'elbow') phys.add(0);
    fixed.push(s.endKind === 'elbow' ? L - 0.3 : L); if (s.endKind === 'elbow') phys.add(1);
    const out = [];
    if (phys.has(0)) out.push(fixed[0]);
    const gap = fixed[1] - fixed[0], n = Math.ceil(gap / span - 1e-6);
    for (let k = 1; k < n; k++) out.push(fixed[0] + gap * k / n);
    if (phys.has(1) && (!out.length || fixed[1] - out[out.length - 1] > 0.5)) out.push(fixed[1]);
    if (!out.length && gap > span * 0.6) out.push(L / 2);
    return out;
  }

  // ---------- environment ----------
  function makeEnv(env, runs) {
    const e = Object.assign({ ground: () => 0, ceiling: () => null, footing: () => true, obstacles: [], anchors: [], skipRun: () => false, skip: () => false, spanFactor: 0.85 }, env || {});
    const anchors = e.anchors.map(P);
    e.anchored = p => anchors.some(q => dist(p, q) < ANCHOR);
    const segs = [];
    for (const run of runs) { const pts = cleanPoints(run.points); for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], r: run.radius, run }); }
    const obs = (e.obstacles || []).map(o => o.type === 'box' ? { type: 'box', min: P(o.min), max: P(o.max), name: o.name } : { type: 'cyl', a: P(o.a), b: P(o.b), r: o.r, name: o.name });
    // is a straight member (column, beam, rod) from a to b with half-width w clear of everything solid?
    // A building the pipe itself runs inside (point `inside`) does not count: the support stands on its floor.
    e.clear = (a, b, w, ignoreRuns, inside) => {
      for (const o of obs) {
        if (inside && o.type === 'box' && inside.x > o.min.x && inside.x < o.max.x && inside.z > o.min.z && inside.z < o.max.z && inside.y > o.min.y && inside.y < o.max.y) continue;
        if (o.type === 'box' ? segBox(a, b, o.min, o.max, w) : segSeg(a, b, o.a, o.b) < o.r + w && segCyl(a, b, w, o.a, o.b, o.r)) return false;
      }
      for (const s of segs) {
        if (ignoreRuns && ignoreRuns.has(s.run)) continue;
        if (segSeg(a, b, s.a, s.b) < s.r + w + 0.05) return false;
      }
      return true;
    };
    return e;
  }

  // ---------- planning ----------
  function plan(runs, envIn, opts = {}) {
    const env = makeEnv(envIn, runs), parts = [], problems = [], stations = [], supports = [], bents = [];
    const part = (o) => { parts.push(o); return o; };
    const box = (m, tag, c, s) => part({ k: 'box', m, tag, c: A(c), s: [+s[0].toFixed(3), +s[1].toFixed(3), +s[2].toFixed(3)] });
    const cyl = (m, tag, a, b, r) => part({ k: 'cyl', m, tag, a: A(a), b: A(b), r });
    const perpOf = axis => axis === 'x' ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

    // 1 · stations along every straight
    for (const run of runs) {
      if (env.skipRun(run)) continue;
      const r = run.radius, span = maxSpan(2 * r) * env.spanFactor;
      for (const s of straights(run)) {
        if (s.horizontal) {
          const mid = add(s.a, mul(s.dir, s.length / 2)), c = env.ceiling(mid, run);
          const elevated = mid.y - r - env.ground(mid.x, mid.z, mid.y) > 3 && !(c && c.prefer);
          s.stringer = elevated && span < RACK_STEP;
          const bridged = bridges(run, s);
          for (const d of stationOffsets(s, elevated ? Math.max(span, RACK_STEP) : span)) {
            const p = add(s.a, mul(s.dir, d));
            if (bridged.some(([b0, b1]) => d > b0 - 0.5 && d < b1 + 0.5)) continue;
            if (env.skip(p, run) || env.anchored(p)) continue;
            const g = env.ground(p.x, p.z, p.y), h = p.y - r - g;
            if (h < -0.02) continue;                          // buried or cast in: the ground carries it
            stations.push({ run, s, d, p, r, g, h, axis: s.axis, along: s.axis === 'x' ? p.x : p.z, perp: s.axis === 'x' ? p.z : p.x });
          }
        } else if (s.vertical && s.length > 4) {
          for (let d = GUIDE_STEP / 2; d < s.length - 1; d += GUIDE_STEP) {
            const p = add(s.a, mul(s.dir, d));
            if (env.skip(p, run) || env.anchored(p) || p.y - r < env.ground(p.x, p.z, p.y)) continue;
            guide(run, p, r); supports.push({ type: 'guide', run: run.id, at: A(p) });
          }
        }
      }
    }

    // Pipe bridge: where a line runs just over one raised surface (a tank roof, a sphere crown), drops more than 3 m
    // over a gap of at most 16 m and comes back over the next raised surface, a light box truss carries it across
    // instead of a row of tall posts. Returns the bridged stretches as [from, to] offsets along the straight.
    function bridges(run, s) {
      if (s.length < 4) return [];
      const r = run.radius, high = []; let cur = null;
      for (let d = 0; d <= s.length + 1e-6; d += 0.5) {
        const p = add(s.a, mul(s.dir, d)), g = env.ground(p.x, p.z, p.y), gap = p.y - r - g;
        if (gap >= -0.02 && gap < 1.5) { if (!cur) { cur = [d, d, g]; high.push(cur); } cur[1] = d; } else cur = null;
      }
      const out = [];
      for (let k = 1; k < high.length; k++) {
        const [, a1, gA] = high[k - 1], [b0, , gB] = high[k], L = b0 - a1;
        if (L < 1 || L > 16) continue;
        const m = add(s.a, mul(s.dir, (a1 + b0) / 2));
        if (m.y - r - env.ground(m.x, m.z, m.y) < 3) continue;
        const x0 = Math.max(0, a1 - 0.6), x1 = Math.min(s.length, b0 + 0.6), pa = add(s.a, mul(s.dir, x0)), pb = add(s.a, mul(s.dir, x1));
        if (!env.clear(pa, pb, r + 0.6, new Set([run]), pa)) continue;
        bridge(run, s, x0, x1, gA, gB); out.push([x0, x1]);
      }
      return out;
    }
    function bridge(run, s, x0, x1, gA, gB) {
      const r = run.radius, side = perpOf(s.axis), w = r + 0.35, deck = s.a.y - r - SHOE, hgt = 2 * r + 0.9, L = x1 - x0;
      const at = (d, off, y) => add(add(s.a, mul(s.dir, d)), add(mul(side, off), { x: 0, y: y - s.a.y, z: 0 }));
      for (const off of [-w, w]) {
        cyl('steel', 'Pipe bridge chord', at(x0, off, deck - 0.06), at(x1, off, deck - 0.06), 0.06);
        cyl('steel', 'Pipe bridge chord', at(x0, off, deck + hgt), at(x1, off, deck + hgt), 0.05);
        const n = Math.max(2, Math.round(L / 1.5));
        for (let k = 0; k <= n; k++) {
          const d = x0 + L * k / n; cyl('steel', 'Pipe bridge post', at(d, off, deck - 0.06), at(d, off, deck + hgt), 0.04);
          if (k < n) cyl('steel', 'Pipe bridge diagonal', at(d, off, k % 2 ? deck + hgt : deck - 0.06), at(x0 + L * (k + 1) / n, off, k % 2 ? deck - 0.06 : deck + hgt), 0.035);
        }
      }
      for (let d = x0; d <= x1 + 1e-6; d += L / Math.max(2, Math.round(L / 1.5))) {
        cyl('steel', 'Pipe bridge cross-member', at(d, -w, deck - 0.06), at(d, w, deck - 0.06), 0.04);
        cyl('steel', 'Pipe bridge cross-member', at(d, -w, deck + hgt), at(d, w, deck + hgt), 0.035);
      }
      for (const [d, g] of [[x0 + 0.3, gA], [x1 - 0.3, gB]]) { const p = add(s.a, mul(s.dir, d)); if (deck - 0.12 - g > 0.02) box('steel', 'Pipe bridge bearing', { x: p.x, y: (g + deck - 0.12) / 2, z: p.z }, s.axis === 'x' ? [0.4, deck - 0.12 - g, 2 * w + 0.2] : [2 * w + 0.2, deck - 0.12 - g, 0.4]); }
      const fake = { r, axis: s.axis, s };
      for (let d = x0 + 0.75; d < x1 - 0.5; d += 1.5) shoe(fake, add(s.a, mul(s.dir, d)), deck);
      supports.push({ type: 'bridge', run: run.id, at: A(add(s.a, mul(s.dir, x0))), to: A(add(s.a, mul(s.dir, x1))) });
      for (let d = x0; d <= x1; d += 1.5) supports.push({ type: 'bridge-shoe', run: run.id, at: A(add(s.a, mul(s.dir, d))) });
    }

    // 2 · choose the support type for each station
    const posts = [];
    for (const st of stations) {
      const c = env.ceiling(st.p, st.run), gapUp = c ? c.y - (st.p.y + st.r) : Infinity;
      st.ceiling = c && gapUp > 0.05 && gapUp <= (c.maxHang || MAX_HANG) ? c : null;
      if (st.h <= 0.9) { if (!stand(st)) fail(st, 'no room for a stand'); }
      else if (st.ceiling && (st.ceiling.prefer || gapUp < st.h)) { if (!hang(st) && !tpost(st)) fail(st, 'hanger and post both blocked'); }
      else posts.push(st);
    }

    // 3 · posts: lines that run side by side share one rack bent; a lone line gets a T-post
    posts.sort((a, b) => a.along - b.along);
    const used = new Set();
    for (const s0 of posts) {
      if (used.has(s0)) continue;
      let group = posts.filter(t => !used.has(t) && t.axis === s0.axis && Math.abs(t.along - s0.along) <= 2.2 && Math.abs(t.perp - s0.perp) <= 9 && Math.abs((t.g) - (s0.g)) < 0.3);
      // keep only lines whose straight still covers the shared position, and break the group at wide gaps
      const at = s0.along;
      group = group.filter(t => { const off = (at - t.along) * (t.axis === 'x' ? Math.sign(t.s.dir.x) : Math.sign(t.s.dir.z)); return t.d + off > 0.15 && t.d + off < t.s.length - 0.15; });
      if (!group.includes(s0)) group.push(s0);
      group.sort((a, b) => a.perp - b.perp);
      const chain = [s0]; // walk outwards from s0 while neighbours are within 4 m edge to edge
      const idx = group.indexOf(s0);
      for (let k = idx + 1; k < group.length && group[k].perp - group[k].r - (group[k - 1].perp + group[k - 1].r) < 4; k++) chain.push(group[k]);
      for (let k = idx - 1; k >= 0 && group[k + 1].perp - group[k + 1].r - (group[k].perp + group[k].r) < 4; k--) chain.unshift(group[k]);
      chain.forEach(t => used.add(t));
      if (chain.length === 1) { if (!tpost(s0) && !(s0.ceiling && hang(s0))) fail(s0, 'no clear place for a post'); continue; }
      if (!bent(chain, at)) for (const t of chain) if (!tpost(t) && !(t.ceiling && hang(t))) fail(t, 'no clear place for a post');
    }

    function fail(st, why) { problems.push({ type: 'unsupported', run: st.run.id, name: st.run.name, at: A(st.p), why }); st.failed = true; }
    function shoe(st, p, top) { // shoe from the beam top up to the pipe, and a U-bolt round the pipe
      const along = st.s.dir, w = Math.max(0.2, Math.min(0.6, st.r * 0.8)), hgt = Math.max(0.04, p.y - st.r - top);
      box('steel', 'Pipe shoe', { x: p.x, y: top + hgt / 2, z: p.z }, st.axis === 'x' ? [0.7, hgt, w] : [w, hgt, 0.7]);
      part({ k: 'disk', m: 'galv', tag: 'U-bolt', c: A(p), axis: A(along), R: st.r + 0.025, t: Math.max(0.03, Math.min(0.08, st.r * 0.12)) });
    }
    function footing(x, z, g, size) { box('concrete', 'Concrete footing', { x, y: g + 0.12, z }, [size, 0.24, size]); box('steel', 'Base plate', { x, y: g + 0.26, z }, [size * 0.7, 0.04, size * 0.7]); }
    function stand(st) {
      const p = st.p, top = p.y - st.r - SHOE, w = 2 * st.r + 0.5;
      if (st.h < 0.45) { // concrete sleeper
        if (top - st.g > 0.02) box('concrete', 'Concrete sleeper', { x: p.x, y: (st.g + top) / 2, z: p.z }, st.axis === 'x' ? [0.6, top - st.g, w] : [w, top - st.g, 0.6]);
      } else {         // steel stub stand on a base plate
        const lo = { x: p.x, y: st.g + 0.3, z: p.z }, hi = { x: p.x, y: top - 0.15, z: p.z };
        if (hi.y > lo.y && !env.clear(lo, hi, 0.12, new Set([st.run]), p)) return false;
        box('concrete', 'Concrete footing', { x: p.x, y: st.g + 0.1, z: p.z }, [0.8, 0.2, 0.8]);
        cyl('steel', 'Stub stand', { x: p.x, y: st.g + 0.2, z: p.z }, hi, 0.11);
        box('steel', 'Stub stand cap', { x: p.x, y: top - 0.075, z: p.z }, st.axis === 'x' ? [0.5, 0.15, w] : [w, 0.15, 0.5]);
      }
      shoe(st, p, top); supports.push({ type: st.h < 0.45 ? 'sleeper' : 'stand', run: st.run.id, at: A(p) }); return true;
    }
    function hang(st) {
      const p = st.p, c = st.ceiling; if (!c) return false;
      const perp = perpOf(st.axis), ign = new Set([st.run]);
      const half = st.r + 0.25, yB = p.y - st.r - SHOE - BEAM / 2, ends = [add({ x: p.x, y: yB, z: p.z }, mul(perp, -half)), add({ x: p.x, y: yB, z: p.z }, mul(perp, half))];
      // a trapeze (short beam on two rods) for bigger lines; a single clevis rod when there is no room for two
      const big = st.r >= 0.3 && ends.every(e => env.clear(add(e, { x: 0, y: BEAM / 2, z: 0 }), { x: e.x, y: c.y, z: e.z }, 0.03, ign, p));
      if (big) {
        box('steel', 'Trapeze hanger', { x: p.x, y: yB, z: p.z }, st.axis === 'x' ? [0.25, BEAM, 2 * half + 0.2] : [2 * half + 0.2, BEAM, 0.25]);
        for (const e of ends) { cyl('galv', 'Hanger rod', add(e, { x: 0, y: BEAM / 2, z: 0 }), { x: e.x, y: c.y, z: e.z }, 0.03); box('steel', 'Hanger beam clamp', { x: e.x, y: c.y - 0.06, z: e.z }, [0.25, 0.12, 0.25]); }
        shoe(st, p, yB + BEAM / 2);
      } else {   // clevis hanger: one rod and a band round the pipe
        const top = { x: p.x, y: p.y + st.r + 0.05, z: p.z };
        if (!env.clear(top, { x: p.x, y: c.y, z: p.z }, 0.03, ign, p)) return false;
        cyl('galv', 'Hanger rod', top, { x: p.x, y: c.y, z: p.z }, 0.025);
        part({ k: 'disk', m: 'galv', tag: 'Clevis hanger', c: A(p), axis: A(st.s.dir), R: st.r + 0.03, t: Math.max(0.05, st.r * 0.25) });
        box('steel', 'Hanger beam clamp', { x: p.x, y: c.y - 0.05, z: p.z }, [0.2, 0.1, 0.2]);
      }
      st.hung = true; supports.push({ type: 'hanger', run: st.run.id, at: A(p), to: c.name || null }); return true;
    }
    function tpost(st) {
      if (!env.footing(st.p.x, st.p.z)) return false;
      const p = st.p, perp = perpOf(st.axis), top = p.y - st.r - SHOE, beamY = top - BEAM / 2, half = st.r + 0.35, ign = new Set([st.run]);
      for (const shift of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.2, -3.2, 4.8, -4.8, 6.4, -6.4]) {
        const q = add(p, mul(st.s.dir, shift)), dd = st.d + shift;
        if (dd < 0.15 || dd > st.s.length - 0.15) continue;
        const lo = { x: q.x, y: st.g + 0.3, z: q.z }, hi = { x: q.x, y: beamY - BEAM / 2, z: q.z };
        if (!env.footing(q.x, q.z) || !env.clear(lo, hi, COL + 0.05, ign, p)) continue;
        const bA = add({ x: q.x, y: beamY, z: q.z }, mul(perp, -half)), bB = add({ x: q.x, y: beamY, z: q.z }, mul(perp, half));
        if (!env.clear(bA, bB, BEAM / 2, ign, p)) continue;
        footing(q.x, q.z, st.g, 1.0);
        box('steel', 'T-post column', { x: q.x, y: (st.g + 0.28 + beamY - BEAM / 2) / 2, z: q.z }, [2 * COL, beamY - BEAM / 2 - st.g - 0.28, 2 * COL]);
        box('steel', 'T-post beam', { x: q.x, y: beamY, z: q.z }, st.axis === 'x' ? [0.3, BEAM, 2 * half] : [2 * half, BEAM, 0.3]);
        if (beamY - st.g > 3) for (const sg of [-1, 1]) cyl('steel', 'Knee brace', add({ x: q.x, y: beamY - BEAM / 2 - 0.9, z: q.z }, mul(perp, sg * COL)), add({ x: q.x, y: beamY - BEAM / 2, z: q.z }, mul(perp, sg * Math.min(half - 0.1, 0.9))), 0.06);
        shoe(st, q, beamY + BEAM / 2); st.final = dd;
        supports.push({ type: 'T-post', run: st.run.id, at: A(q) }); return true;
      }
      return false;
    }
    function bent(chain, at) {
      const axis = chain[0].axis, g = Math.min(...chain.map(t => t.g)), ign = new Set(chain.map(t => t.run));
      const lo = chain[0].perp - chain[0].r - 0.45, hi = chain[chain.length - 1].perp + chain[chain.length - 1].r + 0.45;
      // tiers: lines whose bottoms are within 0.6 m share one beam
      const byBottom = chain.slice().sort((a, b) => (a.p.y - a.r) - (b.p.y - b.r)), tiers = [];
      for (const t of byBottom) { const bottom = t.p.y - t.r, tier = tiers.find(q => bottom - q.bottom < 0.6); if (tier) tier.lines.push(t); else tiers.push({ bottom, lines: [t] }); }
      for (const shift of [0, 0.8, -0.8, 1.6, -1.6]) {
        const along = at + shift;
        const ok = chain.every(t => { const off = (along - t.along) * (axis === 'x' ? Math.sign(t.s.dir.x) : Math.sign(t.s.dir.z)); return t.d + off > 0.15 && t.d + off < t.s.length - 0.15; });
        if (!ok) continue;
        const pt = (pp, y) => axis === 'x' ? { x: along, y, z: pp } : { x: pp, y, z: along };
        const topBeam = tiers[tiers.length - 1].bottom - SHOE - BEAM / 2;
        let cols = null;
        for (const widen of [0, 0.6, 1.2]) {
          const cA = lo - widen, cB = hi + widen, a0 = pt(cA, g + 0.3), a1 = pt(cA, topBeam + BEAM / 2), b0 = pt(cB, g + 0.3), b1 = pt(cB, topBeam + BEAM / 2);
          if (!env.footing(a0.x, a0.z) || !env.footing(b0.x, b0.z)) continue;
          if (!env.clear(a0, a1, COL + 0.05, ign, chain[0].p) || !env.clear(b0, b1, COL + 0.05, ign, chain[0].p)) continue;
          if (!tiers.every(q => { const y = q.bottom - SHOE - BEAM / 2; return env.clear(pt(cA, y), pt(cB, y), BEAM / 2, ign, chain[0].p); })) continue;
          cols = [cA, cB]; break;
        }
        if (!cols) continue;
        const [cA, cB] = cols, colTop = topBeam + BEAM / 2;
        for (const c of cols) { const f = pt(c, g); footing(f.x, f.z, g, 1.1); box('steel', 'Pipe rack column', pt(c, (g + 0.28 + colTop) / 2), axis === 'x' ? [2 * COL, colTop - g - 0.28, 2 * COL] : [2 * COL, colTop - g - 0.28, 2 * COL]); }
        for (const q of tiers) {
          const y = q.bottom - SHOE - BEAM / 2, mid = pt((cA + cB) / 2, y), w = cB - cA + 2 * COL;
          box('steel', 'Pipe rack beam', mid, axis === 'x' ? [0.3, BEAM, w] : [w, BEAM, 0.3]);
          for (const t of q.lines) { const pp = axis === 'x' ? { x: along, y: t.p.y, z: t.p.z } : { x: t.p.x, y: t.p.y, z: along }; shoe(t, pp, y + BEAM / 2); }
        }
        if (colTop - g > 3) for (const [c, sg] of [[cA, 1], [cB, -1]]) cyl('steel', 'Knee brace', pt(c + sg * COL, topBeam - BEAM / 2 - 1), pt(c + sg * Math.min(1, (cB - cA) / 3), topBeam - BEAM / 2), 0.06);
        if (colTop - g > 7 && tiers.length === 1) { const y = g + (colTop - g) / 2; box('steel', 'Pipe rack strut', pt((cA + cB) / 2, y), axis === 'x' ? [0.2, 0.2, cB - cA] : [cB - cA, 0.2, 0.2]); }
        bents.push({ axis, along, from: cA, to: cB, ground: g, tiers: tiers.map(q => +(q.bottom - SHOE - BEAM).toFixed(2)), lines: chain.map(t => t.run.id) });
        for (const t of chain) { t.final = t.d + (along - t.along) * (axis === 'x' ? Math.sign(t.s.dir.x) : Math.sign(t.s.dir.z)); supports.push({ type: 'rack', run: t.run.id, at: A(axis === 'x' ? { x: along, y: t.p.y, z: t.p.z } : { x: t.p.x, y: t.p.y, z: along }) }); }
        return true;
      }
      return false;
    }
    function guide(run, p, r) { // riser guide: a clamp ring with two lugs
      part({ k: 'disk', m: 'steel', tag: 'Riser guide', c: A(p), axis: [0, 1, 0], R: r + 0.06, t: Math.max(0.08, Math.min(0.2, r * 0.3)) });
      for (const sg of [-1, 1]) box('steel', 'Riser guide lug', { x: p.x + sg * (r + 0.16), y: p.y, z: p.z }, [0.22, 0.12, 0.08]);
    }

    // 4 · stringers: a small line on an elevated straight rests on a channel laid from post to post
    const byStraight = new Map();
    for (const st of stations) if (st.s.stringer && st.final != null && !st.hung) { if (!byStraight.has(st.s)) byStraight.set(st.s, []); byStraight.get(st.s).push(st); }
    for (const [s, list] of byStraight) {
      list.sort((a, b) => a.final - b.final);
      for (let k = 1; k < list.length; k++) {
        const a = list[k - 1], b = list[k], gap = b.final - a.final; if (gap < 0.5 || gap > 12) continue;
        const y = a.p.y - a.r - SHOE, pa = add(s.a, mul(s.dir, a.final)), pb = add(s.a, mul(s.dir, b.final));
        const ea = { x: pa.x, y: y - 0.075, z: pa.z }, eb = { x: pb.x, y: y - 0.075, z: pb.z };
        if (!env.clear(ea, eb, 0.08, new Set([a.run]), pa)) continue;
        box('steel', 'Stringer beam', { x: (ea.x + eb.x) / 2, y: ea.y, z: (ea.z + eb.z) / 2 }, s.axis === 'x' ? [gap, 0.15, 0.2] : [0.2, 0.15, gap]);
        for (let d = 1.5; d < gap - 0.5; d += 1.5) shoe(a, add(pa, mul(s.dir, d)), y);
      }
    }

    // 5 · welds: at both ends of every elbow and every 12 m along straight pipe
    if (opts.welds !== false) for (const run of runs) {
      const r = run.radius; if (r < 0.06 || run.curve || run.overland) continue;
      const t = Math.max(0.025, Math.min(0.06, r * 0.05));
      for (const s of straights(run)) {
        if (s.startKind === 'elbow') part({ k: 'disk', m: 'weld', tag: 'Butt weld', c: A(s.a), axis: A(s.dir), R: r * 1.025, t });
        if (s.endKind === 'elbow') part({ k: 'disk', m: 'weld', tag: 'Butt weld', c: A(s.b), axis: A(s.dir), R: r * 1.025, t });
        if (r >= 0.12) for (let d = SPOOL; d < s.length - 1; d += SPOOL) part({ k: 'disk', m: 'weld', tag: 'Girth weld', c: A(add(s.a, mul(s.dir, d))), axis: A(s.dir), R: r * 1.025, t });
      }
    }

    const count = {}; for (const s of supports) count[s.type] = (count[s.type] || 0) + 1;
    return { version: VERSION, parts, supports, bents, problems, stats: { stations: stations.length, supports: supports.length, byType: count, bents: bents.length, parts: parts.length, unsupported: problems.length } };
  }

  // ---------- check: is every metre of above-ground horizontal pipe within half a span of a support? ----------
  // supportsAt: optional list of support points [x,y,z] (e.g. an older drawing's posts); defaults to the plan's supports.
  function check(runs, planOrPoints, envIn) {
    const env = makeEnv(envIn, []), pts = (Array.isArray(planOrPoints) ? planOrPoints.map(P) : planOrPoints.supports.map(s => P(s.at))).concat((env.anchors || []).map(P));
    const byCell = new Map(), key = (x, z) => `${Math.floor(x / 10)},${Math.floor(z / 10)}`;
    for (const p of pts) { const k = key(p.x, p.z); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(p); }
    const near = (p, rad) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of byCell.get(`${Math.floor(p.x / 10) + i},${Math.floor(p.z / 10) + j}`) || []) if (Math.hypot(q.x - p.x, q.z - p.z) <= rad && Math.abs(q.y - p.y) < 1.5) return true; return false; };
    let total = 0, bad = 0; const spans = [];
    for (const run of runs) {
      if (env.skipRun(run)) continue;
      const half = maxSpan(2 * run.radius) / 2, pp = cleanPoints(run.points), ends = [pp[0], pp[pp.length - 1]];
      for (const s of straights(run)) {
        if (!s.horizontal || s.length < 0.25) continue;
        let runBad = 0, first = null;
        for (let d = 0.25; d < s.length; d += 0.5) {
          const p = add(s.a, mul(s.dir, d)); if (p.y - run.radius < env.ground(p.x, p.z, p.y) - 0.02 || env.skip(p, run)) continue;
          total += 0.5;
          if (ends.some(e => dist(e, p) <= half) || near(p, half)) continue;
          bad += 0.5; runBad += 0.5; if (!first) first = p;
        }
        if (runBad) spans.push({ run: run.id, name: run.name, metres: runBad, at: A(first) });
      }
    }
    return { metres: +total.toFixed(1), unsupportedMetres: +bad.toFixed(1), spans: spans.sort((a, b) => b.metres - a.metres) };
  }

  // ---------- three.js: one instanced mesh per (shape, material, tag) ----------
  function build(THREE, parts, materials, group) {
    const geo = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), disk: new THREE.CylinderGeometry(1, 1, 1, 20) };
    const buckets = new Map();
    for (const p of parts) { const k = p.k + '|' + p.m + '|' + p.tag; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), d = new THREE.Vector3(), meshes = [];
    for (const [k, list] of buckets) {
      const [shape, m, tag] = k.split('|'), mesh = new THREE.InstancedMesh(geo[shape], materials[m] || materials.steel, list.length);
      list.forEach((p, i) => {
        if (shape === 'box') { q.identity(); v.set(...p.c); s.set(...p.s); }
        else if (shape === 'cyl') { const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b); d.subVectors(b, a); v.copy(a).addScaledVector(d, 0.5); s.set(p.r, d.length(), p.r); q.setFromUnitVectors(up, d.normalize()); }
        else { v.set(...p.c); s.set(p.R, p.t, p.R); q.setFromUnitVectors(up, d.set(...p.axis).normalize()); }
        mesh.setMatrixAt(i, m4.compose(v, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.userData.name = tag; mesh.name = tag; mesh.userData.spawnedBy = 'pipe-spawn';
      if (group) group.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }

  const api = { plan, check, build, straights, maxSpan, SPAN_TABLE, version: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PipeSpawn = api;
})(typeof window !== 'undefined' ? window : globalThis);
