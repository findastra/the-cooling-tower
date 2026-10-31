/* Rail Continuity Auditor (2026-10-31)
 * Walks every open edge of every walkway, landing, ramp and stair and checks that a handrail guards it:
 *   - top rail at about 1.1 m above the walking surface (OSHA 1910.29 guardrails: 42 in ± 3 in), mid-rail at about half height
 *   - an edge may stay open only where it meets another walking surface, a declared opening (door, stair, hatch) or a wall
 *   - posts no further apart than 2 m along a top rail
 *   - no diagonal decks, no small jagged steps in an edge, no two decks overlapping at slightly different heights
 *   - no stray rail floating away from any walkway edge
 * Works in a browser (window.RailContinuityAuditor) or in Node:  node rail-continuity-auditor-20261031.js walkways.json
 *
 * Walkway format (metres, y up). Surfaces are rectangles centred on (cx, cz) with half sizes hx (local x) and hz (local z),
 * turned by angle (radians about y). Flat surfaces have a height y; slopes rise along local x from yA (at -hx) to yB (at +hx).
 *   surfaces: [ { name, kind: 'flat' | 'slope', cx, cz, hx, hz, angle?, y? , yA?, yB? } ]
 *   openings: [ { name, cx, cz, hx, hz, angle?, y0, y1 } ]      walls: [ { name, cx, cz, hx, hz, angle?, y0, y1 } ]
 *   rails:    [ { a: [x,y,z], b: [x,y,z], role?: 'top' | 'mid' | 'post' } ]
 */
(function (root) {
  'use strict';
  const STEP = 0.2, PROBE = 0.12, TOP = 1.1, MID = 0.55, RAIL_REACH = 0.25, RAIL_HEIGHT_TOL = 0.3;

  const local = (s, x, z) => { const a = -(s.angle || 0), dx = x - s.cx, dz = z - s.cz; return { x: dx * Math.cos(a) - dz * Math.sin(a), z: dx * Math.sin(a) + dz * Math.cos(a) }; };
  const world = (s, lx, lz) => { const a = s.angle || 0; return { x: s.cx + lx * Math.cos(a) - lz * Math.sin(a), z: s.cz + lx * Math.sin(a) + lz * Math.cos(a) }; };
  const inside = (s, x, z, pad = 0) => { const p = local(s, x, z); return Math.abs(p.x) <= s.hx + pad && Math.abs(p.z) <= s.hz + pad; };
  const heightAt = (s, x, z) => { if (s.kind !== 'slope') return s.y; const p = local(s, x, z); const t = (p.x + s.hx) / (2 * s.hx); return s.yA + (s.yB - s.yA) * Math.max(0, Math.min(1, t)); };
  const square = a => { const k = ((a || 0) / (Math.PI / 2)) % 1; return Math.min(Math.abs(k), Math.abs(1 - Math.abs(k))) < 0.006; };
  const r2 = v => +v.toFixed(2);

  // horizontal distance from (x,z) to a rail, and the rail's height there
  function railNear(rail, x, z) {
    const [ax, ay, az] = rail.a, [bx, by, bz] = rail.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    if (l2 < 1e-6) return { d: Math.hypot(x - ax, z - az), y0: Math.min(ay, by), y1: Math.max(ay, by), vertical: true };
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    return { d: Math.hypot(x - (ax + dx * t), z - (az + dz * t)), y: ay + (by - ay) * t };
  }
  function guarded(rails, x, z, wantY) {
    for (const r of rails) {
      const q = railNear(r, x, z);
      if (q.vertical || q.d > RAIL_REACH) continue;
      if (Math.abs(q.y - wantY) <= RAIL_HEIGHT_TOL) return true;
    }
    return false;
  }

  function audit(w) {
    const F = [], add = (severity, code, message, at, surface) => F.push({ severity, code, message, at: at ? at.map(r2) : null, surface: surface || null });
    const S = w.surfaces || [], O = w.openings || [], W = w.walls || [], R = (w.rails || []).filter(r => r && r.a && r.b);
    const top = R.filter(r => r.role !== 'post'), posts = R.filter(r => r.role === 'post' || (Math.abs(r.a[0] - r.b[0]) < 1e-3 && Math.abs(r.a[2] - r.b[2]) < 1e-3));
    let sampled = 0, open = 0;

    for (const s of S) {
      if (!square(s.angle)) add('warn', 'DIAGONAL', `${s.name}: deck is turned ${((s.angle || 0) * 180 / Math.PI).toFixed(1)}° off the x/z grid (odd edges where it meets square decks)`, [s.cx, heightAt(s, s.cx, s.cz), s.cz], s.name);
      const edges = [
        { n: [1, 0], from: [s.hx, -s.hz], to: [s.hx, s.hz] }, { n: [-1, 0], from: [-s.hx, -s.hz], to: [-s.hx, s.hz] },
        { n: [0, 1], from: [-s.hx, s.hz], to: [s.hx, s.hz] }, { n: [0, -1], from: [-s.hx, -s.hz], to: [s.hx, -s.hz] }];
      for (const e of edges) {
        // slopes keep their low and high ends open: those ends meet the landings they connect
        if (s.kind === 'slope' && e.n[1] === 0) continue;
        const L = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]), n = Math.max(2, Math.ceil(L / STEP));
        let gapStart = null, gapEnd = null, midGap = 0;
        const flush = () => {
          if (gapStart == null) return;
          const len = Math.hypot(gapEnd.x - gapStart.x, gapEnd.z - gapStart.z) + STEP;
          if (len >= 0.3) { const mx = (gapStart.x + gapEnd.x) / 2, mz = (gapStart.z + gapEnd.z) / 2; add('error', 'NO-RAIL', `${s.name}: ${len.toFixed(1)} m of open edge with no handrail`, [mx, heightAt(s, mx, mz), mz], s.name); }
          gapStart = gapEnd = null;
        };
        for (let i = 0; i <= n; i++) {
          const t = Math.min(1, Math.max(0, (i + 0.0) / n)), lx = e.from[0] + (e.to[0] - e.from[0]) * t, lz = e.from[1] + (e.to[1] - e.from[1]) * t;
          const pin = world(s, lx - e.n[0] * 0.05, lz - e.n[1] * 0.05), pout = world(s, lx + e.n[0] * PROBE, lz + e.n[1] * PROBE);
          const h = heightAt(s, pin.x, pin.z);
          sampled++;
          // the edge continues into another walking surface at about the same height: no rail needed
          const seam = S.some(o => o !== s && inside(o, pout.x, pout.z) && Math.abs(heightAt(o, pout.x, pout.z) - h) < 0.45);
          const door = O.some(o => inside(o, pout.x, pout.z, 0.05) && h >= o.y0 - 0.6 && h <= o.y1 + 0.6);
          const wall = W.some(o => inside(o, pout.x, pout.z, 0.1) && h + 0.5 >= o.y0 && h + 0.5 <= o.y1);
          if (seam || door || wall) { flush(); continue; }
          open++;
          if (!guarded(top, pin.x, pin.z, h + TOP)) { if (gapStart == null) gapStart = pin; gapEnd = pin; }
          else { flush(); if (!guarded(top, pin.x, pin.z, h + MID)) midGap++; }
        }
        flush();
        if (midGap * STEP >= 1) add('warn', 'NO-MID-RAIL', `${s.name}: ${(midGap * STEP).toFixed(1)} m of edge has a top rail but no mid-rail`, [s.cx, heightAt(s, s.cx, s.cz), s.cz], s.name);
      }
    }

    // two decks overlapping at slightly different heights: a trip step or flickering surfaces
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const a = S[i], b = S[j]; if (a.kind === 'slope' || b.kind === 'slope') continue;
      const dy = Math.abs(a.y - b.y); if (dy < 0.015 || dy > 0.3) continue;
      const p = world(b, 0, 0); if (inside(a, p.x, p.z, Math.max(b.hx, b.hz))) add('warn', 'STEP', `${a.name} and ${b.name} overlap ${dy.toFixed(2)} m apart in height`, [p.x, a.y, p.z], a.name);
    }

    // jagged edges on square decks of one level: union outline pieces shorter than 0.6 m
    const levels = {};
    for (const s of S) if (s.kind !== 'slope' && square(s.angle)) (levels[s.y.toFixed(2)] = levels[s.y.toFixed(2)] || []).push(s);
    for (const [y, list] of Object.entries(levels)) {
      const rect = s => { const q = Math.abs(Math.sin(s.angle || 0)) > 0.5; const hx = q ? s.hz : s.hx, hz = q ? s.hx : s.hz; return [s.cx - hx, s.cz - hz, s.cx + hx, s.cz + hz]; };
      const rs = list.map(rect), xs = [...new Set(rs.flatMap(r => [r[0], r[2]]).map(v => +v.toFixed(3)))].sort((a, b) => a - b), zs = [...new Set(rs.flatMap(r => [r[1], r[3]]).map(v => +v.toFixed(3)))].sort((a, b) => a - b);
      if (xs.length * zs.length > 400000) continue;
      const cov = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < zs.length - 1 && rs.some(r => (xs[i] + xs[i + 1]) / 2 > r[0] && (xs[i] + xs[i + 1]) / 2 < r[2] && (zs[j] + zs[j + 1]) / 2 > r[1] && (zs[j] + zs[j + 1]) / 2 < r[3]);
      const grid = []; for (let i = 0; i < xs.length - 1; i++) { grid[i] = []; for (let j = 0; j < zs.length - 1; j++) grid[i][j] = cov(i, j); }
      const C = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < zs.length - 1 && grid[i][j];
      // walk the joined outline: every straight piece between two corners; a piece shorter than 0.6 m is a jagged step
      const nx = xs.length - 1, nz = zs.length - 1, short = (len, at) => { if (len < 0.6 - 1e-6) add('warn', 'JAGGED', `walkway outline has a ${len.toFixed(2)} m step`, [at[0], +y, at[1]]); };
      for (let j = 0; j <= nz; j++) for (const s of [-1, 1]) {
        let start = null;
        for (let i = 0; i <= nx; i++) {
          const edge = i < nx && (s < 0 ? C(i, j) && !C(i, j - 1) : C(i, j - 1) && !C(i, j));
          if (edge && start === null) start = i;
          if (!edge && start !== null) { short(xs[i] - xs[start], [(xs[i] + xs[start]) / 2, zs[j]]); start = null; }
        }
      }
      for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) {
        let start = null;
        for (let j = 0; j <= nz; j++) {
          const edge = j < nz && (s < 0 ? C(i, j) && !C(i - 1, j) : C(i - 1, j) && !C(i, j));
          if (edge && start === null) start = j;
          if (!edge && start !== null) { short(zs[j] - zs[start], [xs[i], (zs[j] + zs[start]) / 2]); start = null; }
        }
      }
    }

    // posts along top rails
    for (const r of top) {
      const [ax, ay, az] = r.a, [bx, by, bz] = r.b, L = Math.hypot(bx - ax, bz - az);
      if (L < 2.2 || r.role === 'mid') continue;
      const along = posts.map(p => { const t = ((p.a[0] - ax) * (bx - ax) + (p.a[2] - az) * (bz - az)) / (L * L); const d = Math.abs((p.a[0] - ax) * (bz - az) - (p.a[2] - az) * (bx - ax)) / L; return d < 0.3 && t > -0.05 && t < 1.05 ? t * L : null; }).filter(v => v != null).sort((a, b) => a - b);
      const marks = [0, ...along, L]; let worst = 0; for (let i = 1; i < marks.length; i++) worst = Math.max(worst, marks[i] - marks[i - 1]);
      if (worst > 2.4) add('warn', 'POSTS', `handrail span of ${worst.toFixed(1)} m between posts`, [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2]);
    }
    // stray rails: a rail that guards no walkway edge
    for (const r of top) {
      const mx = (r.a[0] + r.b[0]) / 2, my = (r.a[1] + r.b[1]) / 2, mz = (r.a[2] + r.b[2]) / 2;
      const ok = S.some(s => { const p = local(s, mx, mz), h = heightAt(s, mx, mz); const nearEdge = (Math.abs(Math.abs(p.x) - s.hx) < 0.35 && Math.abs(p.z) <= s.hz + 0.35) || (Math.abs(Math.abs(p.z) - s.hz) < 0.35 && Math.abs(p.x) <= s.hx + 0.35); return nearEdge && my - h > 0.2 && my - h < 1.5; });
      if (!ok) add('warn', 'STRAY-RAIL', 'handrail does not sit on any walkway edge', [mx, my, mz]);
    }

    const count = s => F.filter(f => f.severity === s).length;
    return { tool: 'rail-continuity-auditor', version: '2026-10-31', ok: count('error') === 0, errors: count('error'), warnings: count('warn'), info: count('info'), surfaces: S.length, rails: R.length, edgeSamples: sampled, openSamples: open, findings: F };
  }

  // Build a walkway record from a three.js scene. isDeck/isRail/isWall pick meshes; box decks become rectangles,
  // ribbon decks (two vertices per station) become one rectangle or slope per quad, cylinders become rails.
  function fromScene(scene, THREE, { isDeck, isRail, isWall }) {
    const w = { surfaces: [], openings: [], walls: [], rails: [] };
    scene.updateMatrixWorld(true);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), e = new THREE.Euler();
    scene.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry, name = o.userData.name || o.name || g.type;
      if (isRail && isRail(o) && g.type === 'CylinderGeometry' && o.isInstancedMesh) {
        // batched handrails: one cylinder drawn many times, each with its own matrix
        const m = new THREE.Matrix4(), h = g.parameters.height / 2;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
          const a = new THREE.Vector3(0, -h, 0).applyMatrix4(m), b = new THREE.Vector3(0, h, 0).applyMatrix4(m);
          w.rails.push({ a: a.toArray(), b: b.toArray(), role: Math.abs(a.y - b.y) > 0.8 * a.distanceTo(b) ? 'post' : undefined });
        }
        return;
      }
      if (isRail && isRail(o) && g.type === 'CylinderGeometry') {
        const h = g.parameters.height / 2, a = new THREE.Vector3(0, -h, 0).applyMatrix4(o.matrixWorld), b = new THREE.Vector3(0, h, 0).applyMatrix4(o.matrixWorld);
        w.rails.push({ a: a.toArray(), b: b.toArray(), role: Math.abs(a.y - b.y) > 0.8 * a.distanceTo(b) ? 'post' : undefined });
        return;
      }
      const deck = isDeck && isDeck(o), wall = isWall && isWall(o);
      if (!deck && !wall) return;
      o.matrixWorld.decompose(pos, quat, scl); e.setFromQuaternion(quat, 'YXZ');
      if (g.type === 'BoxGeometry') {
        const p = g.parameters, rec = { name, cx: pos.x, cz: pos.z, hx: p.width * scl.x / 2, hz: p.depth * scl.z / 2, angle: -e.y };
        if (deck) w.surfaces.push(Object.assign(rec, { kind: 'flat', y: pos.y + p.height * scl.y / 2 }));
        else w.walls.push(Object.assign(rec, { y0: pos.y - p.height * scl.y / 2, y1: pos.y + p.height * scl.y / 2 }));
      } else if (deck && g.index && g.attributes.position) {
        const a = g.attributes.position, v = i => new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
        for (let i = 0; i + 3 < a.count; i += 2) {
          const l0 = v(i), r0 = v(i + 1), l1 = v(i + 2), r1 = v(i + 3);
          const c0 = l0.clone().add(r0).multiplyScalar(0.5), c1 = l1.clone().add(r1).multiplyScalar(0.5);
          const d = c1.clone().sub(c0), L = Math.hypot(d.x, d.z); if (L < 1e-3) continue;
          w.surfaces.push({ name, kind: Math.abs(c1.y - c0.y) > 0.05 ? 'slope' : 'flat', cx: (c0.x + c1.x) / 2, cz: (c0.z + c1.z) / 2, hx: L / 2, hz: l0.distanceTo(r0) / 2, angle: Math.atan2(d.z, d.x), y: (c0.y + c1.y) / 2, yA: c0.y, yB: c1.y });
        }
      }
    });
    return w;
  }

  function report(res, max = 60) {
    const lines = [`Rail Continuity Auditor · ${res.ok ? 'PASS' : 'FAIL'} · ${res.errors} errors, ${res.warnings} warnings · ${res.surfaces} walking surfaces, ${res.rails} rail pieces, ${res.openSamples} open-edge samples`];
    const order = { error: 0, warn: 1, info: 2 };
    res.findings.slice().sort((a, b) => order[a.severity] - order[b.severity]).slice(0, max).forEach(f => lines.push(`${f.severity.toUpperCase().padEnd(5)} ${f.code.padEnd(11)} ${f.message}${f.at ? ' @ ' + f.at.join(', ') : ''}`));
    if (res.findings.length > max) lines.push(`… ${res.findings.length - max} more`);
    return lines.join('\n');
  }

  const api = { audit, fromScene, report, version: '2026-10-31' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RailContinuityAuditor = api;
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const fs = require('fs'), file = process.argv[2];
    if (!file) { console.error('usage: node rail-continuity-auditor-20261031.js walkways.json'); process.exit(2); }
    const res = audit(JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log(report(res, 400)); process.exit(res.ok ? 0 : 1);
  }
})(typeof window !== 'undefined' ? window : globalThis);
