/* Pipe Continuity Auditor (2026-10-31)
 * Checks a plant's pipe network against piping rules:
 *   - every turn is a 90° elbow and every straight run lies along x, y or z (radial loops and overland lines are declared exceptions)
 *   - a run never doubles back on itself
 *   - every run end lands on an equipment nozzle, another run of the same service, or a cap
 *   - one diameter per run; sizes change only at a reducer where flow leaves (distribution) or joins (collection)
 *   - a branch is never bigger than its header
 *   - every service has its own colour and its own on/off switch
 *   - no pipe passes through another pipe or through a building
 *   - equipment rules, e.g. a tank that must stand on legs with a valved bottom outlet
 * Works in a browser (window.PipeContinuityAuditor) or in Node:  node pipe-continuity-auditor-20261031.js network.json
 *
 * Network format (all lengths in metres, points as [x, y, z], y up):
 *   services:  { id: { name, color, kind: 'split' | 'join' | 'transfer', radial?: [x, z], toggle?: true } }
 *   runs:      [ { id, service, name, radius, points: [[x,y,z], ...], from?: {eq, n}, to?: {eq, n},
 *                  overland?: true, plan?: [[x,z], ...], buried?: true, goalpost?: true } ]   points follow the flow
 *   equipment: { id: { name, nozzles: { key: [x,y,z] }, requires?: ['elevated','bottom-outlet','valve'], bottomY?, inside? } }
 *   reducers:  [ { at: [x,y,z], rA, rB, service } ]      valves: [ { at: [x,y,z], service } ]      caps: [ { at: [x,y,z] } ]
 *   obstacles: [ { name, type: 'box', min: [..], max: [..], owner? } | { name, type: 'cyl', a: [..], b: [..], r, owner? } ]
 */
(function (root) {
  'use strict';
  const TOL = 0.06, SQUARE = Math.cos((89.5 * Math.PI) / 180), ALONG = Math.cos((0.5 * Math.PI) / 180);

  const P = a => (Array.isArray(a) ? { x: +a[0], y: +a[1], z: +a[2] } : { x: +a.x, y: +a.y, z: +a.z });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const addv = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const len = a => Math.sqrt(dot(a, a));
  const unit = a => { const l = len(a) || 1; return mul(a, 1 / l); };
  const dist = (a, b) => len(sub(a, b));
  const arr = q => { const p = P(q); return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; };

  // closest distance from point p to segment ab, and where along it (0..1)
  function pointSeg(p, a, b) {
    const ab = sub(b, a), l2 = dot(ab, ab);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
    return { d: dist(p, addv(a, mul(ab, t))), t };
  }
  // closest distance between segments ab and cd
  function segSeg(a, b, c, d) {
    const u = sub(b, a), v = sub(d, c), w = sub(a, c);
    const A = dot(u, u), B = dot(u, v), C = dot(v, v), D = dot(u, w), E = dot(v, w), den = A * C - B * B;
    let s, t;
    if (den < 1e-9) { s = 0; t = C ? E / C : 0; }
    else { s = (B * E - C * D) / den; t = (A * E - B * D) / den; }
    s = Math.max(0, Math.min(1, s)); t = C ? Math.max(0, Math.min(1, (B * s + E) / C)) : 0;
    s = A ? Math.max(0, Math.min(1, (B * t - D) / A)) : 0;
    const p = addv(a, mul(u, s)), q = addv(c, mul(v, t));
    return { d: dist(p, q), p, q };
  }
  // does segment ab (thickened by r) pass through an axis-aligned box?
  function segBox(a, b, min, max, r) {
    let t0 = 0, t1 = 1; const d = sub(b, a);
    for (const k of ['x', 'y', 'z']) {
      const lo = min[k] - r, hi = max[k] + r;
      if (Math.abs(d[k]) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
      let ta = (lo - a[k]) / d[k], tb = (hi - a[k]) / d[k]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
    }
    return t1 - t0 > 1e-6;
  }
  // does a pipe (segment ab, radius r) touch a solid cylinder with axis cd and radius R? Sampled along the pipe; returns the hit point.
  function segCyl(a, b, r, c, d, R) {
    const axis = sub(d, c), h = len(axis), u = mul(axis, 1 / (h || 1)), L = dist(a, b), n = Math.max(2, Math.ceil(L / 0.25));
    for (let i = 0; i <= n; i++) {
      const p = addv(a, mul(sub(b, a), i / n)), w = sub(p, c), t = dot(w, u), radial = len(sub(w, mul(u, t)));
      const along = t < 0 ? -t : t > h ? t - h : 0;            // distance beyond an end cap, 0 when level with the body
      const out = Math.max(0, radial - R);                       // distance outside the side wall
      if (Math.hypot(along, out) < r) return p;
    }
    return null;
  }
  function simplify(points) {
    const out = [];
    for (const p of points) {
      if (out.length && dist(p, out[out.length - 1]) < 1e-4) continue;
      if (out.length >= 2) {
        const a = out[out.length - 2], b = out[out.length - 1];
        if (dot(unit(sub(b, a)), unit(sub(p, b))) > 0.99999) { out[out.length - 1] = p; continue; }
      }
      out.push(p);
    }
    return out;
  }
  function hexDist(a, b) {
    const h = s => { s = String(s).replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
    const x = h(a), y = h(b); return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0));
  }

  function audit(net) {
    const F = [], add = (severity, code, message, at, run) => F.push({ severity, code, message, at: at ? arr(at) : null, run: run ? run.id : null, service: run ? run.service : null });
    const services = net.services || {}, equipment = net.equipment || {};
    const runs = (net.runs || []).map(r => Object.assign({}, r, { pts: simplify(r.points.map(P)) }));
    const reducers = (net.reducers || []).map(r => Object.assign({}, r, { at: P(r.at) }));
    const valves = (net.valves || []).map(v => Object.assign({}, v, { at: P(v.at) }));
    const caps = (net.caps || []).map(c => Object.assign({}, c, { at: P(c.at) }));
    const nozzle = ref => { const e = ref && equipment[ref.eq]; const n = e && e.nozzles && e.nozzles[ref.n]; return n ? P(n) : null; };
    const allNozzles = [];
    for (const [id, e] of Object.entries(equipment)) for (const [k, n] of Object.entries(e.nozzles || {})) allNozzles.push({ eq: id, n: k, p: P(n) });

    // 1 · colours and switches
    const ids = Object.keys(services);
    for (const id of ids) {
      const s = services[id];
      if (!s.color) add('error', 'COLOUR', `${s.name || id} has no colour`);
      if (s.toggle === false || s.toggle == null) add('error', 'SWITCH', `${s.name || id} has no on/off switch`);
    }
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = services[ids[i]], b = services[ids[j]];
      if (a.color && b.color && hexDist(a.color, b.color) < 40) add('error', 'COLOUR', `${a.name} and ${b.name} share nearly the same colour (${a.color} / ${b.color})`);
    }
    for (const r of runs) if (!services[r.service]) add('error', 'SERVICE', `${r.name} has no declared service`, r.pts[0], r);

    // 2 · geometry: square turns, runs along the grid, no doubling back
    for (const r of runs) {
      const s = services[r.service] || {};
      const pts = r.overland && r.plan ? simplify(r.plan.map(([x, z]) => ({ x, y: 0, z }))) : r.pts;
      if (r.overland && !r.plan) add('warn', 'OVERLAND', `${r.name} is marked overland but has no plan line to check`, r.pts[0], r);
      const dirs = [];
      let offGrid = 0, offAt = null, radialLegs = 0;
      for (let i = 1; i < pts.length; i++) {
        const d = unit(sub(pts[i], pts[i - 1])); dirs.push(d);
        const onGrid = Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)) >= ALONG;
        if (!onGrid) {
          if (s.radial && Math.abs(d.y) < 1e-3) radialLegs++;
          else { offGrid++; offAt = offAt || pts[i - 1]; }
        }
      }
      if (radialLegs) add('info', 'LOOP-LEG', `${r.name}: ${radialLegs} horizontal leg(s) follow the reactor's radial loop layout (allowed for ${s.name})`, pts[0], r);
      if (offGrid) add('error', 'OFF-GRID', `${r.name}: ${offGrid} straight piece(s) not along x, y or z`, offAt, r);
      let bad = 0, badAt = null, worst = 0;
      for (let i = 1; i < dirs.length; i++) {
        const c = Math.abs(dot(dirs[i - 1], dirs[i]));
        if (c > SQUARE) { bad++; badAt = badAt || pts[i]; const deg = Math.acos(Math.max(-1, Math.min(1, dot(dirs[i - 1], dirs[i])))) * 180 / Math.PI; if (Math.abs(90 - deg) > Math.abs(90 - worst)) worst = deg; }
      }
      if (bad) add('error', 'ANGLE', `${r.name}: ${bad} turn(s) that are not 90° (worst ${worst.toFixed(1)}°)`, badAt, r);
      // doubling back: a horizontal direction followed later by its opposite
      const flat = dirs.filter(d => Math.abs(d.y) < 0.5).map(d => unit({ x: d.x, y: 0, z: d.z }));
      for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (dot(flat[i], flat[j]) < -0.99) { add('error', 'DOUBLES-BACK', `${r.name}: runs one way and later back the other way`, pts[0], r); i = flat.length; break; }
      const vert = dirs.filter(d => Math.abs(d.y) > 0.99).map(d => Math.sign(d.y));
      for (let i = 1; i < vert.length; i++) if (vert[i] !== vert[i - 1] && !r.buried && !r.goalpost) { add('warn', 'GOALPOST', `${r.name}: goes ${vert[i - 1] > 0 ? 'up then down' : 'down then up'} (pockets trap gas or liquid unless vented/drained)`, pts[0], r); break; }
    }

    // 3 · continuity: gather every point where pipes meet. A run "out" starts there, "in" ends there, "through" passes it.
    for (const r of runs) for (const which of ['from', 'to']) {
      const ref = r[which]; if (!ref) continue;
      const p = which === 'from' ? r.pts[0] : r.pts[r.pts.length - 1], n = nozzle(ref);
      if (!n) add('error', 'NOZZLE', `${r.name}: ${which} names ${ref.eq}.${ref.n}, which does not exist`, p, r);
      else if (dist(n, p) > TOL) add('error', 'NOZZLE', `${r.name}: ${which} end is ${dist(n, p).toFixed(2)} m away from ${equipment[ref.eq].name} (${ref.n})`, p, r);
    }
    const nodes = [];
    const nodeAt = p => { let n = nodes.find(q => dist(q.p, p) < TOL); if (!n) { n = { p, items: [] }; nodes.push(n); } return n; };
    for (const r of runs) {
      const n = r.pts.length;
      if (!r.from) nodeAt(r.pts[0]).items.push({ run: r, role: 'out', dir: unit(sub(r.pts[1], r.pts[0])) });
      if (!r.to) nodeAt(r.pts[n - 1]).items.push({ run: r, role: 'in', dir: unit(sub(r.pts[n - 1], r.pts[n - 2])) });
    }
    for (const node of nodes) for (const o of runs) {
      if (node.items.some(it => it.run === o)) continue;
      if (dist(node.p, o.pts[0]) < TOL || dist(node.p, o.pts[o.pts.length - 1]) < TOL) continue;
      for (let i = 1; i < o.pts.length; i++) if (pointSeg(node.p, o.pts[i - 1], o.pts[i]).d < TOL) { node.items.push({ run: o, role: 'through', dir: unit(sub(o.pts[i], o.pts[i - 1])) }); break; }
    }
    const linkedPairs = new Set();
    // runs bolted to the same piece of equipment meet there by design
    const byEq = {};
    for (const r of runs) for (const ref of [r.from, r.to]) if (ref) (byEq[ref.eq] = byEq[ref.eq] || new Set()).add(r);
    for (const set of Object.values(byEq)) for (const a of set) for (const b of set) if (a !== b) linkedPairs.add(a.id + '|' + b.id);
    const kind = r => r.kind || (services[r.service] || {}).kind || 'transfer';
    const D = r => '⌀' + (2 * r.radius).toFixed(2);
    for (const node of nodes) {
      const its = node.items;
      for (const a of its) for (const b of its) if (a !== b) linkedPairs.add(a.run.id + '|' + b.run.id);
      if (its.length === 1) {
        const it = its[0], r = it.run, which = it.role === 'out' ? 'from' : 'to';
        const nzl = allNozzles.find(n => dist(n.p, node.p) < TOL);
        if (nzl) add('warn', 'UNDECLARED', `${r.name}: ${which} end sits on ${equipment[nzl.eq].name} (${nzl.n}) but does not name it`, node.p, r);
        else if (caps.some(c => dist(c.at, node.p) < TOL)) add('warn', 'CAPPED', `${r.name}: ${which} end is capped (dead leg)`, node.p, r);
        else add('error', 'OPEN-END', `${r.name}: ${which} end connects to nothing`, node.p, r);
        continue;
      }
      const svcs = [...new Set(its.map(i => i.run.service))];
      if (svcs.length > 1) { add('error', 'MIXED', `${svcs.map(s => (services[s] || {}).name || s).join(' and ')} are joined here – two different fluids`, node.p, its[0].run); continue; }
      // 4 · sizes where pipes meet
      const thru = its.filter(i => i.role === 'through'), ins = its.filter(i => i.role === 'in'), outs = its.filter(i => i.role === 'out');
      if (thru.length) {
        const h = thru.reduce((m, i) => (i.run.radius > m.run.radius ? i : m));
        for (const i of its) if (i !== h && i.run.radius > h.run.radius + 1e-3) add('error', 'BRANCH-SIZE', `${i.run.name} (${D(i.run)}) is bigger than the header it ${i.role === 'out' ? 'leaves' : 'joins'}, ${h.run.name} (${D(h.run)})`, node.p, i.run);
        continue;
      }
      if (!ins.length || !outs.length) { add('error', 'FLOW', `${its.map(i => i.run.name).join(', ')} meet head to head (all ${ins.length ? 'end' : 'start'} here)`, node.p, its[0].run); continue; }
      const red = reducers.some(x => dist(x.at, node.p) < 0.6);
      if (ins.length === 1 && outs.length === 1) {
        const up = ins[0].run, down = outs[0].run;
        if (Math.abs(up.radius - down.radius) < 1e-3) continue;
        if (!red) add('error', 'NO-REDUCER', `${up.name} → ${down.name}: ${D(up)} → ${D(down)} with no reducer`, node.p, down);
        add('error', 'SIZE', `${up.name} → ${down.name}: diameter changes ${D(up)} → ${D(down)} with no lateral ${down.radius < up.radius ? 'taking flow off' : 'adding flow'}`, node.p, down);
        continue;
      }
      if (ins.length === 1) { // one in, several out: a split
        const up = ins[0];
        for (const o of outs) {
          if (o.run.radius > up.run.radius + 1e-3) add('error', 'SIZE', `${o.run.name} (${D(o.run)}) leaves a split bigger than the pipe feeding it (${D(up.run)})`, node.p, o.run);
          if (dot(o.dir, up.dir) > 0.99 && Math.abs(o.run.radius - up.run.radius) > 1e-3 && !red) add('error', 'NO-REDUCER', `${up.run.name} → ${o.run.name}: header steps ${D(up.run)} → ${D(o.run)} with no reducer`, node.p, o.run);
          if (dot(o.dir, up.dir) > 0.99 && kind(o.run) === 'join') add('error', 'SIZE', `${o.run.name}: a collection header cannot split`, node.p, o.run);
        }
        continue;
      }
      if (outs.length === 1) { // several in, one out: a join
        const dn = outs[0];
        for (const i of ins) {
          if (i.run.radius > dn.run.radius + 1e-3) add('error', 'SIZE', `${dn.run.name} (${D(dn.run)}) is smaller than ${i.run.name} (${D(i.run)}) feeding it`, node.p, dn.run);
          if (dot(i.dir, dn.dir) > 0.99 && Math.abs(i.run.radius - dn.run.radius) > 1e-3 && !red) add('error', 'NO-REDUCER', `${i.run.name} → ${dn.run.name}: header steps ${D(i.run)} → ${D(dn.run)} with no reducer`, node.p, dn.run);
          if (dot(i.dir, dn.dir) > 0.99 && kind(dn.run) === 'split') add('error', 'SIZE', `${dn.run.name}: a distribution header cannot collect`, node.p, dn.run);
        }
        continue;
      }
      add('warn', 'CROSS', `${ins.length} pipes in and ${outs.length} out at one point – check the flow split`, node.p, its[0].run);
    }

    // 5 · clashes: pipe through pipe, pipe through building
    const segs = [];
    for (const r of runs) for (let i = 1; i < r.pts.length; i++) segs.push({ r, a: r.pts[i - 1], b: r.pts[i] });
    const linked = (r1, r2) => linkedPairs.has(r1.id + '|' + r2.id);
    const reported = new Set();
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j];
      if (A.r === B.r) continue;
      const key = A.r.id + '|' + B.r.id; if (reported.has(key)) continue;
      const { d, p } = segSeg(A.a, A.b, B.a, B.b);
      if (d >= A.r.radius + B.r.radius - 0.01) continue;
      if (linked(A.r, B.r) && Math.min(dist(p, A.a), dist(p, A.b), dist(p, B.a), dist(p, B.b)) < A.r.radius + B.r.radius + 3 * Math.max(A.r.radius, B.r.radius)) continue;
      if (linked(A.r, B.r) && A.r.service === B.r.service) continue;
      reported.add(key);
      add('error', 'CLASH', `${A.r.name} passes through ${B.r.name} (gap ${(d - A.r.radius - B.r.radius).toFixed(2)} m)`, p, A.r);
    }
    for (const o of net.obstacles || []) {
      for (const S of segs) {
        const owns = [S.r.from, S.r.to].some(ref => ref && (ref.eq === o.owner || (equipment[ref.eq] && equipment[ref.eq].inside === o.name)));
        if (owns) continue;
        let hit = false, at = S.a;
        if (o.type === 'box') hit = segBox(S.a, S.b, P(o.min), P(o.max), S.r.radius - 0.02);
        else if (o.type === 'cyl') { const c = segCyl(S.a, S.b, S.r.radius - 0.02, P(o.a), P(o.b), o.r); hit = !!c; if (c) at = c; }
        if (hit) { add('error', 'CLASH', `${S.r.name} passes through ${o.name}`, at, S.r); break; }
      }
    }

    // 6 · equipment rules
    for (const [id, e] of Object.entries(equipment)) {
      const req = e.requires || [];
      if (req.includes('elevated') && !(e.bottomY >= 1)) add('error', 'TANK', `${e.name} sits on the ground; it must stand on legs (bottom ${e.bottomY ?? 0} m)`, e.nozzles.bottom || e.nozzles.top);
      if (req.includes('bottom-outlet')) {
        const out = runs.find(r => r.from && r.from.eq === id && r.from.n === 'bottom');
        if (!out) add('error', 'TANK', `${e.name} has no pipe leaving its bottom outlet`, e.nozzles.bottom || e.nozzles.top);
        else {
          const d0 = unit(sub(out.pts[1], out.pts[0]));
          if (d0.y > -0.99) add('error', 'TANK', `${e.name}: bottom outlet must leave straight down`, out.pts[0], out);
          if (req.includes('valve') && !valves.some(v => dist(v.at, out.pts[0]) < 1.6)) add('error', 'TANK', `${e.name}: no isolation valve at the bottom outlet`, out.pts[0], out);
        }
      }
    }
    for (const err of net.errors || []) add('error', 'BUILD', String(err));

    const count = s => F.filter(f => f.severity === s).length;
    const lengthBy = {};
    for (const r of runs) { let l = 0; for (let i = 1; i < r.pts.length; i++) l += dist(r.pts[i - 1], r.pts[i]); lengthBy[r.service] = (lengthBy[r.service] || 0) + l; }
    return { tool: 'pipe-continuity-auditor', version: '2026-10-31', ok: count('error') === 0, errors: count('error'), warnings: count('warn'), info: count('info'), runs: runs.length, services: ids.length, lengthBy, findings: F };
  }

  // Build a network from meshes already in a three.js scene (for models drawn before they kept a pipe record).
  // isPipe(mesh) picks the pipe meshes; tubes give their path, cylinders their axis. Ends inside any other mesh count as equipment.
  function fromScene(scene, THREE, isPipe, opts = {}) {
    const net = { services: {}, runs: [], equipment: {}, obstacles: [] };
    scene.updateMatrixWorld(true);
    const others = [];
    scene.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      if (isPipe(o)) {
        const g = o.geometry, m = o.matrixWorld, name = o.userData.name || 'unnamed pipe';
        const col = '#' + (o.material && o.material.color ? o.material.color.getHexString() : '888888');
        const svc = (opts.serviceOf ? opts.serviceOf(o) : name.split('·')[0].trim()) || name;
        if (!net.services[svc]) net.services[svc] = { name: svc, color: col, kind: 'transfer', toggle: opts.toggle ? opts.toggle(o) : null };
        let pts = null, r = 0;
        if (g.type === 'TubeGeometry') {
          const path = g.parameters.path; r = g.parameters.radius;
          if (path.curves) { pts = []; for (const c of path.curves) if (c.isLineCurve3) { pts.push(c.v1.clone(), c.v2.clone()); } }
          else if (path.isLineCurve3) pts = [path.v1.clone(), path.v2.clone()];
          if (!pts || pts.length < 2) pts = path.getPoints(48);
          const lines = path.curves ? path.curves.filter(c => c.isLineCurve3).length : 0;
          if (path.curves && lines < path.curves.length / 2) pts = path.getPoints(48);
        } else if (g.type === 'CylinderGeometry') {
          r = g.parameters.radiusTop; const h = g.parameters.height / 2;
          pts = [new THREE.Vector3(0, -h, 0), new THREE.Vector3(0, h, 0)];
        } else return;
        pts = pts.map(p => p.applyMatrix4(m));
        const s = new THREE.Vector3(); m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s); r *= Math.max(s.x, s.z);
        net.runs.push({ id: 'scan-' + net.runs.length, service: svc, name, radius: +r.toFixed(3), points: pts.map(p => [p.x, p.y, p.z]) });
      } else others.push(o);
    });
    // any other solid that holds a run end is treated as the equipment it connects to
    const boxes = others.map(o => ({ o, b: new THREE.Box3().setFromObject(o) })).filter(x => { const s = x.b.getSize(new THREE.Vector3()); return s.x * s.y * s.z < 2e4 && s.x < 120 && s.z < 120; });
    let n = 0;
    for (const run of net.runs) for (const which of ['from', 'to']) {
      const p = run.points[which === 'from' ? 0 : run.points.length - 1], v = new THREE.Vector3(p[0], p[1], p[2]);
      const hit = boxes.find(x => x.b.clone().expandByScalar(0.15).containsPoint(v));
      if (hit) { const id = 'eq' + n++; net.equipment[id] = { name: hit.o.userData.name || hit.o.name || 'equipment', nozzles: { n: p } }; run[which] = { eq: id, n: 'n' }; }
    }
    return net;
  }

  function report(res, max = 60) {
    const lines = [`Pipe Continuity Auditor · ${res.ok ? 'PASS' : 'FAIL'} · ${res.errors} errors, ${res.warnings} warnings, ${res.info} notes · ${res.runs} runs in ${res.services} services`];
    const order = { error: 0, warn: 1, info: 2 };
    res.findings.slice().sort((a, b) => order[a.severity] - order[b.severity]).slice(0, max).forEach(f => lines.push(`${f.severity.toUpperCase().padEnd(5)} ${f.code.padEnd(12)} ${f.message}${f.at ? ' @ ' + f.at.join(', ') : ''}`));
    if (res.findings.length > max) lines.push(`… ${res.findings.length - max} more`);
    return lines.join('\n');
  }

  const api = { audit, fromScene, report, version: '2026-10-31' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PipeContinuityAuditor = api;
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const fs = require('fs'), file = process.argv[2];
    if (!file) { console.error('usage: node pipe-continuity-auditor-20261031.js network.json'); process.exit(2); }
    const res = audit(JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log(report(res, 400)); process.exit(res.ok ? 0 : 1);
  }
})(typeof window !== 'undefined' ? window : globalThis);
