// Isometric scene geometry, shared by the renderer (src/components/SceneView.tsx)
// and the validator (scripts/validate.mjs), so both agree on where every block,
// card, label and tag lands on screen.
//
// Lessons place nodes on a flat 12 x 8 grid (x right, y down). Here that grid
// becomes an isometric floor (classic 2:1): grid x runs down-right on screen,
// grid y runs down-left, and height (z) goes straight up.
//
// All screen numbers are SVG user units ("px" in the viewBox).

import { monoWidth, textWidth } from './schema.js';

export const ISO = {
  /** screen px per grid unit, horizontally (a grid step moves G across and G/2 down) */
  G: 70,
  /** extra room around the content */
  pad: 30,
  lift: 16, // how far an "active" block floats up
  card: { label: 20, sub: 14.5, padX: 13, h1: 36, h2: 55, gap: 10, tail: 7, minW: 64 },
  edge: { size: 14.5, padX: 10, h: 27 },
  tag: { size: 13, padX: 7, h: 22, gap: 5, below: 8 },
  note: { padX: 14, h: 36, rise: 24 },
  packet: { size: 13, padX: 9, h: 23, r: 7 },
  zone: { size: 12.5, padX: 9, h: 24, thick: 7, inset: 0.1 },
  /** the smallest view (screen units) the per-step camera zooms in to */
  minView: { w: 820, h: 500 },
};

/** Node shapes an author may pick with `shape` (overrides the kind's default shape). */
export const NODE_SHAPES = ['block', 'tile', 'token', 'flag', 'stack'];

const SQRT2 = Math.SQRT2;

/** Grid point (x, y) at height z -> screen point. */
export function project(x, y, z = 0) {
  return { x: (x - y) * ISO.G, y: ((x + y) * ISO.G) / 2 - z };
}

// ---------------------------------------------------------------- node shapes
/**
 * The 3D shape used for a node: by `shape` when the author set one, otherwise
 * by kind. hw/hd are half the footprint in grid units (x and y); h is the
 * height in px.
 */
export function nodeShape(n) {
  switch (n.shape) {
    case 'block':
      return { type: 'box', hw: 0.48, hd: 0.48, h: 31 };
    case 'tile':
      return { type: 'tile', hw: 0.5, hd: 0.5, h: 11 };
    case 'token':
      return { type: 'token', hw: 0.43, hd: 0.43, r: 0.43 * SQRT2, h: 15 };
    case 'flag':
      return { type: 'flag', hw: 0.24, hd: 0.24, h: 7, poleH: 64 };
    case 'stack':
      return { type: 'stack', hw: 0.46, hd: 0.46, h: 33 };
    default:
  }
  const kind = n.kind ?? 'neutral';
  switch (kind) {
    case 'server':
      return { type: 'server', hw: 0.5, hd: 0.5, h: 48 };
    case 'data':
      return { type: 'cylinder', hw: 0.49, hd: 0.49, r: 0.49 * SQRT2, h: 42 };
    case 'ai':
      return { type: 'chip', hw: 0.5, hd: 0.5, h: 26, cap: 0.36, capH: 15 };
    case 'external':
      return { type: 'crate', hw: 0.45, hd: 0.45, h: 31, lid: 0.53, lidH: 9 };
    case 'threat':
      return { type: 'hazard', hw: 0.48, hd: 0.48, h: 38 };
    case 'client':
      return n.icon === 'phone'
        ? { type: 'phone', hw: 0.29, hd: 0.16, h: 60 }
        : { type: 'laptop', hw: 0.55, hd: 0.43, h: 8, screenH: 46 };
    case 'person':
      return { type: 'person', hw: 0.37, hd: 0.37, h: 9, figure: n.icon === 'users' ? 2 : 1, figH: 66 };
    default:
      return { type: 'box', hw: 0.48, hd: 0.48, h: 31 };
  }
}

/** Total height (px) of the shape above the floor. */
export function shapeHeight(s) {
  if (s.type === 'chip') return s.h + s.capH;
  if (s.type === 'crate') return s.h + s.lidH;
  if (s.type === 'laptop') return s.h + s.screenH;
  if (s.type === 'person') return s.h + s.figH;
  if (s.type === 'flag') return s.h + s.poleH;
  return s.h;
}

/** Screen-space corners of the footprint box (hw, hd) at height z, relative to the node centre. */
export function boxCorners(hw, hd, z) {
  const G = ISO.G;
  return {
    N: { x: (-hw + hd) * G, y: (-hw - hd) * G / 2 - z },
    E: { x: (hw + hd) * G, y: (hw - hd) * G / 2 - z },
    S: { x: (hw - hd) * G, y: (hw + hd) * G / 2 - z },
    W: { x: (-hw - hd) * G, y: (-hw + hd) * G / 2 - z },
  };
}

/** Outline polygon (screen, relative to node centre) that hides what is behind the node. */
export const FLAG_W = 46;
export function silhouette(s, lift = 0) {
  const G = ISO.G;
  if (s.type === 'person') {
    const b0 = boxCorners(s.hw, s.hd, 0);
    const b1 = boxCorners(s.hw, s.hd, s.h + lift);
    const fw = s.figure === 2 ? 36 : 20;
    const top = -s.h - lift - s.figH - (s.hw + s.hd) * G * 0.1;
    return [b0.W, b1.W, { x: -fw, y: b1.N.y }, { x: -fw, y: top }, { x: fw, y: top }, { x: fw, y: b1.N.y }, b1.E, b0.E, b0.S];
  }
  if (s.type === 'laptop') {
    const b0 = boxCorners(s.hw, s.hd, 0);
    const b1 = boxCorners(s.hw, s.hd, s.h + lift);
    const t = boxCorners(s.hw, s.hd, s.h + lift + s.screenH);
    // screen panel stands on the back-right edge (N..E)
    return [b0.W, b1.W, { x: t.N.x, y: t.N.y }, { x: t.E.x, y: t.E.y }, b0.E, b0.S];
  }
  if (s.type === 'flag') {
    const b0 = boxCorners(s.hw, s.hd, 0);
    const b1 = boxCorners(s.hw, s.hd, s.h + lift);
    const top = -s.h - lift - s.poleH;
    const fw = FLAG_W;
    return [b0.W, b1.W, { x: -2, y: b1.N.y }, { x: -2, y: top }, { x: fw, y: top + 6 }, { x: fw, y: top + 34 }, { x: 3, y: top + 34 }, { x: 3, y: b1.E.y }, b1.E, b0.E, b0.S];
  }
  const hw = s.type === 'crate' ? s.lid : s.hw;
  const hd = s.type === 'crate' ? s.lid : s.hd;
  const H = shapeHeight(s) + lift;
  const b0 = boxCorners(hw, hd, 0);
  const b1 = boxCorners(hw, hd, H);
  return [b1.N, b1.E, b0.E, b0.S, b0.W, b1.W];
}

// ---------------------------------------------------------------- text boxes
export function cardSize(n) {
  const c = ISO.card;
  const tw = Math.max(textWidth(n.label, 'label'), n.sublabel ? textWidth(n.sublabel, 'sub') : 0);
  return { w: Math.max(c.minW, Math.ceil(tw + c.padX * 2)), h: n.sublabel ? c.h2 : c.h1 };
}
export const tagWidth = (t) => Math.ceil(monoWidth(t, ISO.tag.size) + ISO.tag.padX * 2);
/** Edge labels use the text sans (Instrument Sans 600); widths scale from the measured 14.5px / 500 table. */
export const sansWidth = (text, size) => textWidth(text, 'sub') * (size / 14.5) * 1.045;
export const edgeLabelWidth = (label) => (label ? Math.ceil(sansWidth(label, ISO.edge.size) + ISO.edge.padX * 2) : 0);
export const packetWidth = (label) => (label ? Math.ceil(monoWidth(label, ISO.packet.size) + ISO.packet.padX * 2) : ISO.packet.r * 2 + 6);
export const noteWidth = (text) => Math.ceil(textWidth(text, 'note') + ISO.note.padX * 2);
export const zoneLabelWidth = (label) => Math.ceil(monoWidth(String(label).toUpperCase(), ISO.zone.size) * (0.68 / 0.6) + ISO.zone.padX * 2);

const rect = (x, y, w, h) => ({ x, y, w, h });

/**
 * Screen layout of one node at grid position (x, y). `lift` raises the block
 * (active nodes float). Everything is in absolute screen coordinates.
 */
export function nodeLayout(n, x = n.x, y = n.y, lift = n.status === 'active' ? ISO.lift : 0) {
  const shape = nodeShape(n);
  const c = project(x, y);
  const sil = silhouette(shape, lift).map((p) => ({ x: c.x + p.x, y: c.y + p.y }));
  const topY = Math.min(...sil.map((p) => p.y));
  const size = cardSize(n);
  const card = rect(c.x - size.w / 2, topY - ISO.card.gap - ISO.card.tail - size.h, size.w, size.h);
  const front = c.y + (shape.hw + shape.hd) * ISO.G / 2; // lowest floor point of the footprint
  const tags = [];
  if (n.tags?.length) {
    const ws = n.tags.map(tagWidth);
    const total = ws.reduce((a, w) => a + w, 0) + ISO.tag.gap * (ws.length - 1);
    let tx = c.x - total / 2;
    for (const w of ws) {
      tags.push(rect(tx, front + ISO.tag.below, w, ISO.tag.h));
      tx += w + ISO.tag.gap;
    }
  }
  return { c, shape, sil, topY, card, tags, depth: x + y, x, y };
}

// ---------------------------------------------------------------- polygons
export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function nearPoly(p, poly, pad) {
  if (pointInPoly(p, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (distToSeg(p, poly[i], poly[j]) < pad) return true;
  return false;
}
export const polyBox = (poly) => {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return rect(x, y, Math.max(...xs) - x, Math.max(...ys) - y);
};
/** Overlap depth of two rects (0 = apart). */
export function rectOverlap(a, b, pad = 0) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + pad;
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + pad;
  return ox > 0 && oy > 0 ? Math.min(ox, oy) : 0;
}
// ---------------------------------------------------------------- edges
// Edges are orthogonal on the floor: every edge runs along the two grid axes
// only (grid x and grid y), turning 90 degrees once (an L) or twice (a Z), with
// small rounded corners. A route is a small spec, always in the edge's own
// direction (from -> to):
//   { kind: 'x' }          L: along x first, then y
//   { kind: 'y' }          L: along y first, then x
//   { kind: 'zx', f }      Z: along x for share f of the way, across in y, along x again
//   { kind: 'zy', f }      Z: the same with y and x swapped
//   { kind: 'sx' | 'sy' }  straight along x (or y): the ends line up on that axis
//   { kind: 'u', off }     ends lined up: detour sideways by `off` grid units
// plus `lane` (grid units, to the left of the travel direction) that keeps
// parallel and opposite edges between the same two nodes side by side.

/** Author values of an edge's `route` field. */
export const EDGE_ROUTES = ['x-first', 'y-first', 'mid'];
/** Ends closer than this (grid units) on one axis count as lined up: one straight line. */
const ALIGN = 0.3;
/** Furthest apart (grid units, across the line) two centres may be for one straight line to reach both blocks. */
const STRAIGHT = 0.9;
/** Corner radius at a turn (grid units). */
const CORNER = 0.24;
/** Gap between the edges of one node pair (grid units), and the sideways shift of a lone elbow (LANE / 2). */
const LANE_PAIR = 0.86;
const LANE = 0.6;

const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);

/** Floor polyline (grid units) of a route spec from a to b, lane offset applied. */
function routeVerts(a, b, spec) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let v;
  switch (spec.kind) {
    case 'x': v = [a, { x: b.x, y: a.y }, b]; break;
    case 'y': v = [a, { x: a.x, y: b.y }, b]; break;
    case 'zy': { const m = a.y + dy * (spec.f ?? 0.5); v = [a, { x: a.x, y: m }, { x: b.x, y: m }, b]; break; }
    // straight, at share t of the way between the two centres on the other axis
    // (the two footprints overlap there); a Z once the blocks drift too far apart
    case 'sx':
      if (Math.abs(dy) <= STRAIGHT) { const m = a.y + dy * (spec.t ?? 0.5); v = [{ x: a.x, y: m }, { x: b.x, y: m }]; }
      else { const m = a.x + dx / 2; v = [a, { x: m, y: a.y }, { x: m, y: b.y }, b]; }
      break;
    case 'sy':
      if (Math.abs(dx) <= STRAIGHT) { const m = a.x + dx * (spec.t ?? 0.5); v = [{ x: m, y: a.y }, { x: m, y: b.y }]; }
      else { const m = a.y + dy / 2; v = [a, { x: a.x, y: m }, { x: b.x, y: m }, b]; }
      break;
    case 'u': {
      // sideways detour; `off` is measured to the left of the travel direction
      if (Math.abs(dx) >= Math.abs(dy)) {
        const m = (a.y + b.y) / 2 + Math.sign(dx || 1) * spec.off;
        v = [a, { x: a.x, y: m }, { x: b.x, y: m }, b];
      } else {
        const m = (a.x + b.x) / 2 - Math.sign(dy || 1) * spec.off;
        v = [a, { x: m, y: a.y }, { x: m, y: b.y }, b];
      }
      break;
    }
    default: { const m = a.x + dx * (spec.f ?? 0.5); v = [a, { x: m, y: a.y }, { x: m, y: b.y }, b]; } // 'zx'
  }
  // drop zero-length legs and merge straight runs
  const out = [];
  for (const p of v) if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push({ x: p.x, y: p.y });
  for (let i = out.length - 2; i >= 1; i--) {
    const p = out[i - 1], q = out[i], r = out[i + 1];
    if (Math.abs((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x)) < 1e-9) out.splice(i, 1);
  }
  if (out.length < 2) out.push({ x: out[0].x + 1e-3, y: out[0].y });
  const lane = spec.lane ?? 0;
  if (!lane) return out;
  const nrm = (p, q) => { const l = dist(p, q) || 1; return { x: -(q.y - p.y) / l, y: (q.x - p.x) / l }; };
  return out.map((p, i) => {
    // joints are right angles (straight runs are merged above), so adding both normals keeps every leg at `lane`
    const n0 = i > 0 ? nrm(out[i - 1], p) : { x: 0, y: 0 };
    const n1 = i < out.length - 1 ? nrm(p, out[i + 1]) : { x: 0, y: 0 };
    return { x: p.x + (n0.x + n1.x) * lane, y: p.y + (n0.y + n1.y) * lane };
  });
}

const quadAt = (p, t) => ({ x: (1 - t) ** 2 * p.p0.x + 2 * (1 - t) * t * p.c.x + t * t * p.p1.x, y: (1 - t) ** 2 * p.p0.y + 2 * (1 - t) * t * p.c.y + t * t * p.p1.y });

/** Floor path of a polyline with rounded corners: straight legs ('L') and quadratic corners ('Q'). */
function roundedPath(verts) {
  const prims = [];
  let cur = verts[0];
  const toward = (p, q, r) => { const l = dist(p, q) || 1; return { x: p.x + ((q.x - p.x) / l) * r, y: p.y + ((q.y - p.y) / l) * r }; };
  for (let i = 1; i < verts.length; i++) {
    const v = verts[i];
    if (i < verts.length - 1) {
      const nx = verts[i + 1];
      // a leg shared by two corners gives each at most 45% of its length; end legs give 90%
      const r = Math.min(CORNER, dist(verts[i - 1], v) * (i === 1 ? 0.9 : 0.45), dist(v, nx) * (i === verts.length - 2 ? 0.9 : 0.45));
      const p0 = toward(v, verts[i - 1], r), p1 = toward(v, nx, r);
      prims.push({ t: 'L', p0: cur, p1: p0 });
      prims.push({ t: 'Q', p0, c: v, p1 });
      cur = p1;
    } else prims.push({ t: 'L', p0: cur, p1: v });
  }
  for (const p of prims) {
    if (p.t === 'L') p.len = dist(p.p0, p.p1);
    else { let l = 0, q = p.p0; for (let k = 1; k <= 8; k++) { const n = quadAt(p, k / 8); l += dist(q, n); q = n; } p.len = l; }
  }
  const out = prims.filter((p) => p.len > 1e-6);
  return out.length ? out : prims.slice(0, 1);
}

/** The legacy `bend` as a route: its sign picks the side of the elbow (or of the detour when the ends line up). */
function bendSpec(bend, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dy) <= ALIGN || Math.abs(dx) <= ALIGN) return { kind: 'u', off: bend };
  // a positive bend bulged towards (-dy, dx); the x-first corner (b.x, a.y) lies on that side when dx * dy < 0
  return { kind: (bend > 0) === (dx * dy < 0) ? 'x' : 'y' };
}

/** The route an author asked for with `route` (or the legacy `bend`), or null to choose automatically. */
function authorSpec(e, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (e.route === 'x-first') return { kind: 'x' };
  if (e.route === 'y-first') return { kind: 'y' };
  if (e.route === 'mid') return Math.abs(dx) >= Math.abs(dy) ? { kind: 'zx', f: 0.5 } : { kind: 'zy', f: 0.5 };
  if (typeof e.bend === 'number' && Math.abs(e.bend) > 0.001) return bendSpec(e.bend, a, b);
  return null;
}

/**
 * Route choices worth trying, each with a penalty for its turns. When the two
 * footprints overlap across the line, one straight line reaches both blocks
 * (with sideways detours in reserve, used only when that line is blocked).
 */
/** Routes of the previous step, per scene (see linkSceneRoutes). */
const PREFER = new WeakMap();

/**
 * Link the scenes of one lesson, in step order, so each step prefers the routes
 * its edges had in the step before: an edge keeps its shape while the learner
 * clicks through, unless the new step really needs another route. The renderer
 * and the validator both call this on the same resolved scenes.
 */
export function linkSceneRoutes(scenes) {
  let prev = null, last = null;
  for (const s of scenes) {
    if (!s || s === last) continue;
    last = s;
    if (prev) PREFER.set(s, prev); else PREFER.delete(s);
    prev = new Map(sceneLayout(s).edges.map(({ e, g }) => [e.id, g.route]));
  }
  return scenes;
}

function routeCandidates(a, b, A, B) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const band = (ca, ha, cb, hb) => {
    const lo = Math.max(ca - ha, cb - hb) + 0.06, hi = Math.min(ca + ha, cb + hb) - 0.06;
    return hi >= lo ? (lo + hi) / 2 : null;
  };
  const tOf = (m, c, d) => (Math.abs(d) < 1e-6 ? 0.5 : (m - c) / d);
  const my = Math.abs(dy) <= STRAIGHT ? band(a.y, A.shape.hd, b.y, B.shape.hd) : null;
  const mx = Math.abs(dx) <= STRAIGHT ? band(a.x, A.shape.hw, b.x, B.shape.hw) : null;
  let straight = null;
  if (my !== null && (mx === null || Math.abs(dx) >= Math.abs(dy))) straight = { kind: 'sx', t: tOf(my, a.y, dy) };
  else if (mx !== null) straight = { kind: 'sy', t: tOf(mx, a.x, dx) };
  // a Z whose middle leg is very short reads as a wobble
  const jog = (len) => (len < 1 ? 1.5 : 0);
  const elbows = [
    { spec: { kind: 'x' }, pen: 0.6 },
    { spec: { kind: 'y' }, pen: 0.6 },
    { spec: { kind: 'zx', f: 0.5 }, pen: 1.2 + jog(Math.abs(dy)) },
    { spec: { kind: 'zy', f: 0.5 }, pen: 1.2 + jog(Math.abs(dx)) },
    { spec: { kind: 'zx', f: 0.3 }, pen: 1.35 + jog(Math.abs(dy)) },
    { spec: { kind: 'zx', f: 0.7 }, pen: 1.35 + jog(Math.abs(dy)) },
    { spec: { kind: 'zy', f: 0.3 }, pen: 1.35 + jog(Math.abs(dx)) },
    { spec: { kind: 'zy', f: 0.7 }, pen: 1.35 + jog(Math.abs(dx)) },
  ];
  if (!straight) return elbows;
  const out = [{ spec: straight, pen: 0 }];
  // slightly offset ends: an elbow is the fallback when the straight line is blocked
  if (Math.abs(dx) > ALIGN && Math.abs(dy) > ALIGN) out.push(...elbows.map((c) => ({ ...c, pen: c.pen + 3 })));
  for (const off of [1, -1, 1.5, -1.5]) out.push({ spec: { kind: 'u', off }, pen: 5 + Math.abs(off), detour: true });
  return out;
}

/** The same route seen from the other end. */
function reverseSpec(s) {
  const r = { ...s, lane: -(s.lane ?? 0) };
  if (s.kind === 'x') r.kind = 'y';
  else if (s.kind === 'y') r.kind = 'x';
  else if (s.kind === 'zx' || s.kind === 'zy') r.f = 1 - (s.f ?? 0.5);
  else if (s.kind === 'u') r.off = -s.off;
  else if (s.kind === 'sx' || s.kind === 'sy') r.t = 1 - (s.t ?? 0.5);
  return r;
}

/**
 * Geometry of an edge between two laid-out nodes. The line lies on the floor
 * and runs along the grid axes (route specs above); it starts where it leaves
 * node A's silhouette and ends where it disappears behind / reaches node B.
 * Without a `spec`, the route is the author's `route` / `bend`, or the best one
 * for the two nodes on their own (sceneLayout picks routes with the whole
 * scene in view and passes them in).
 */
export function edgeLayout(e, A, B, spec) {
  const a = { x: A.x, y: A.y };
  const b = { x: B.x, y: B.y };
  if (!spec) spec = authorSpec(e, a, b) ?? pickRoute(e, A, B, null).spec;
  const verts = routeVerts(a, b, spec);
  const prims = roundedPath(verts);
  const total = prims.reduce((s, p) => s + p.len, 0) || 1e-3;
  /** floor point at arc length s (grid units) */
  const world = (s) => {
    let k = 0;
    while (k < prims.length - 1 && s > prims[k].len) { s -= prims[k].len; k++; }
    const p = prims[k];
    const t = Math.max(0, Math.min(1, s / (p.len || 1)));
    return p.t === 'L' ? { x: p.p0.x + (p.p1.x - p.p0.x) * t, y: p.p0.y + (p.p1.y - p.p0.y) * t } : quadAt(p, t);
  };
  const scr = (s) => { const w = world(s); return project(w.x, w.y); };

  const arrowEnd = (e.arrow ?? 'end') === 'end' || e.arrow === 'both';
  const arrowStart = e.arrow === 'start' || e.arrow === 'both';
  /** first arc length (going from `from` towards `to`) where the line is clear of poly */
  const exitS = (poly, from, to, pad) => {
    const n = Math.max(1, Math.ceil(Math.abs(to - from) / 0.05));
    let prev = from, hit = null;
    for (let i = 0; i <= n; i++) {
      const s = from + ((to - from) * i) / n;
      if (!nearPoly(scr(s), poly, pad)) { hit = s; break; }
      prev = s;
    }
    if (hit === null) return to;
    if (hit === from) return from;
    let lo = prev, hi = hit;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (nearPoly(scr(mid), poly, pad)) lo = mid; else hi = mid; }
    return hi;
  };
  let s0 = exitS(A.sil, 0, total / 2, arrowStart ? 9 : 5);
  let s1 = exitS(B.sil, total, total / 2, arrowEnd ? 9 : 5);
  if (s1 - s0 < 0.02 * total) { const m = (s0 + s1) / 2; s0 = m - 0.01 * total; s1 = m + 0.01 * total; }

  // the visible part [s0, s1]: SVG path, a screen polyline for `at`, and its straight legs
  let d = '';
  const pts = [];
  const legs = [];
  let acc = 0;
  const pushPt = (p) => {
    const q = project(p.x, p.y);
    q.cum = pts.length ? pts[pts.length - 1].cum + Math.hypot(q.x - pts[pts.length - 1].x, q.y - pts[pts.length - 1].y) : 0;
    pts.push(q);
    return q;
  };
  for (const p of prims) {
    const a0 = acc, a1 = acc + p.len;
    acc = a1;
    if (a1 <= s0 || a0 >= s1) continue;
    const u0 = Math.max(0, (s0 - a0) / p.len), u1 = Math.min(1, (s1 - a0) / p.len);
    const lerp = (u) => ({ x: p.p0.x + (p.p1.x - p.p0.x) * u, y: p.p0.y + (p.p1.y - p.p0.y) * u });
    const pa = p.t === 'L' ? lerp(u0) : quadAt(p, u0);
    if (!pts.length) { const q = pushPt(pa); d = `M${r1(q.x)},${r1(q.y)}`; }
    if (p.t === 'L') {
      const c0 = pts[pts.length - 1].cum;
      const pb = lerp(u1);
      const q = pushPt(pb);
      d += ` L${r1(q.x)},${r1(q.y)}`;
      legs.push({ c0, c1: q.cum, w0: pa, w1: pb });
    } else if (u0 === 0 && u1 === 1) {
      const c = project(p.c.x, p.c.y);
      for (let k = 1; k <= 8; k++) pushPt(quadAt(p, k / 8));
      const q = pts[pts.length - 1];
      d += ` Q${r1(c.x)},${r1(c.y)} ${r1(q.x)},${r1(q.y)}`;
    } else {
      for (let k = 1; k <= 8; k++) { const q = pushPt(quadAt(p, u0 + ((u1 - u0) * k) / 8)); d += ` L${r1(q.x)},${r1(q.y)}`; }
    }
  }
  if (pts.length < 2) { const q = pushPt(world(s1)); d += ` L${r1(q.x)},${r1(q.y)}`; }
  const length = pts[pts.length - 1].cum || 1;
  /** share of the drawn length (0..1) -> screen point. (This is also what SVG animateMotion keyPoints use.) */
  const at = (u) => {
    const target = Math.max(0, Math.min(1, u)) * length;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].cum < target) i++;
    const p = pts[i], q = pts[i + 1] ?? p;
    const k = Math.max(0, Math.min(1, (target - p.cum) / (q.cum - p.cum || 1)));
    return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
  };
  const ident = (u) => Math.max(0, Math.min(1, u));

  // arrowheads lie flat on the floor and point along the last (or first) leg
  const head = (s, dir) => {
    const w = world(s);
    const back = world(dir > 0 ? Math.max(0, s - 0.03) : Math.min(total, s + 0.03));
    const l = Math.hypot(w.x - back.x, w.y - back.y) || 1;
    const ux = (w.x - back.x) / l, uy = (w.y - back.y) / l;
    const L = 0.27, W = 0.15;
    const tip = project(w.x, w.y);
    const p1 = project(w.x - ux * L - uy * W, w.y - uy * L + ux * W);
    const p2 = project(w.x - ux * L + uy * W, w.y - uy * L - ux * W);
    const notch = project(w.x - ux * L * 0.62, w.y - uy * L * 0.62);
    return `M${r1(tip.x)},${r1(tip.y)} L${r1(p1.x)},${r1(p1.y)} L${r1(notch.x)},${r1(notch.y)} L${r1(p2.x)},${r1(p2.y)}Z`;
  };
  const heads = [];
  if (arrowEnd) heads.push(head(s1, 1));
  if (arrowStart) heads.push(head(s0, -1));

  // label spots: the middle of the longest straight leg, then along it, then the other legs
  const lw = edgeLabelWidth(e.label);
  const spots = [];
  for (const leg of [...legs].sort((p, q) => (q.c1 - q.c0) - (p.c1 - p.c0))) {
    const len = leg.c1 - leg.c0;
    const mid = (leg.c0 + leg.c1) / 2;
    for (const k of [0, -0.12, 0.12, -0.22, 0.22, -0.32, 0.32, -0.4, 0.4]) {
      const c = mid + k * len;
      if (k && (c - leg.c0 < lw * 0.3 || leg.c1 - c < lw * 0.3)) continue;
      spots.push(c / length);
    }
  }
  for (const u of [0.5, 0.35, 0.65, 0.22, 0.78]) spots.push(u);
  const labelAt = (u) => { const p = at(u); return rect(p.x - lw / 2, p.y - ISO.edge.h / 2, lw, ISO.edge.h); };
  const labelU = spots[0];
  const label = e.label ? labelAt(labelU) : null;
  const pk = !!e.packet;
  const segs = legs.map((l) => ({ a: l.w0, b: l.w1, axis: Math.abs(l.w1.x - l.w0.x) >= Math.abs(l.w1.y - l.w0.y) ? 'x' : 'y', from: e.from, to: e.to, pk }));
  const legLen = (l) => (l ? dist(l.w0, l.w1) : 0);
  return {
    d, at, atS: at, sOf: ident, mid: at(0.5), length, heads, label, labelU, labelAt, labelSpots: spots,
    tip: arrowEnd ? at(1) : null, tail: arrowStart ? at(0) : null,
    route: spec, segs, turns: verts.slice(1, -1), hidden: s0 + (total - s1),
    firstLeg: legLen(legs[0]), lastLeg: legLen(legs[legs.length - 1]),
  };
}
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Cost of a routed edge in a scene: running under other blocks, cards, tags,
 * notes and edge labels, on top of another edge, a turn or an arrowhead
 * hidden, and long hidden stretches behind its own blocks (meeting a block on
 * its visible front faces reads best).
 */
function routeCost(e, g, A, B, ctx) {
  let cost = 0;
  const n = Math.max(8, Math.ceil(g.length / 8));
  for (let i = 0; i <= n; i++) {
    const p = g.at(i / n);
    if (ctx) {
      for (const [id, N] of ctx.nodes) if (id !== e.from && id !== e.to && pointInPoly(p, N.sil)) { cost += 2.5; break; }
      for (const t of ctx.texts) {
        if (p.x > t.r.x - 2 && p.x < t.r.x + t.r.w + 2 && p.y > t.r.y - 2 && p.y < t.r.y + t.r.h + 2) { cost += t.tag && (t.id === e.from || t.id === e.to) ? 0.2 : 1.2; break; }
      }
    }
    // coming back behind its own end blocks
    if (i > 1 && i < n - 1 && (pointInPoly(p, A.sil) || pointInPoly(p, B.sil))) cost += 2.5;
  }
  if (ctx) {
    for (const p of [g.tip, g.tail]) {
      if (p && ctx.texts.some((t) => p.x > t.r.x - 4 && p.x < t.r.x + t.r.w + 4 && p.y > t.r.y - 4 && p.y < t.r.y + t.r.h + 4)) cost += 40;
    }
    // running on top of another edge costs a lot; crossing one costs a little
    for (const s of g.segs) for (const o of ctx.segs) cost += segClash(s, o);
    // the label needs a free spot on the route
    if (e.label) {
      let least = Infinity;
      for (const u of g.labelSpots.slice(0, 18)) {
        const r = g.labelAt(u);
        least = Math.min(least, ctx.texts.reduce((acc, t) => acc + rectOverlap(r, t.r, 2), 0) + [g.tip, g.tail].filter((p) => p && coversHead(r, p)).length * 20);
        if (!least) break;
      }
      if (least > 0) cost += 3 + Math.min(least, 40) * 0.2;
    }
    // a packet needs a clear stretch of the route
    const pk = e.packet === true ? {} : e.packet;
    if (pk && typeof pk === 'object') {
      const pw = packetWidth(pk.label), ph = ISO.packet.h;
      const others = ctx.texts.filter((t) => !(t.tag && (t.id === e.from || t.id === e.to)));
      const N = 32;
      let run = 0, longest = 0;
      for (let i = 0; i <= N; i++) {
        const p = g.at(i / N);
        const r = rect(p.x - pw / 2, p.y - ph / 2, pw, ph);
        if (others.some((t) => rectOverlap(r, t.r, -1) > 0)) run = 0; else longest = Math.max(longest, run++);
      }
      if ((longest / N) * g.length < Math.min(80, g.length * 0.4)) cost += 8;
    }
  }
  for (const t of g.turns) {
    const p = project(t.x, t.y);
    if (pointInPoly(p, A.sil) || pointInPoly(p, B.sil)) cost += 3;
    else if (ctx) for (const [id, N] of ctx.nodes) if (id !== e.from && id !== e.to && pointInPoly(p, N.sil)) { cost += 2; break; }
  }
  if (g.turns.length && g.lastLeg < 0.3) cost += 3;
  if (g.turns.length && g.firstLeg < 0.15) cost += 1;
  cost += 0.6 * g.hidden + 0.04 * (g.length / ISO.G);
  return cost;
}

/** Does an edge label (rect) sit on an arrowhead whose tip is at p? */
const coversHead = (r, p) => p.x > r.x - 8 && p.x < r.x + r.w + 8 && p.y > r.y - 8 && p.y < r.y + r.h + 8;

/** Length (grid units) over which two straight floor legs run alongside each other, at most `gap` apart. */
function legOverlap(s, o, gap) {
  if (s.axis !== o.axis) return 0;
  const k = s.axis === 'x' ? 'y' : 'x', m = s.axis;
  if (Math.abs(s.a[k] - o.a[k]) > gap) return 0;
  const ov = Math.min(Math.max(s.a[m], s.b[m]), Math.max(o.a[m], o.b[m])) - Math.max(Math.min(s.a[m], s.b[m]), Math.min(o.a[m], o.b[m]));
  return Math.max(0, ov);
}

/** Two legs leaving (or entering) the same block together, neither carrying a packet: a shared trunk, as in a tree. */
const trunk = (s, o) => (s.from === o.from || s.to === o.to) && !s.pk && !o.pk;

/**
 * Cost of two straight floor legs: 25 per grid unit on top of each other (2 for a
 * shared trunk), 3 close alongside, 2 per crossing.
 */
function segClash(s, o) {
  if (s.axis === o.axis) {
    const on = legOverlap(s, o, 0.26);
    return on * (trunk(s, o) ? 2 : 25) + (legOverlap(s, o, 0.75) - on) * 3;
  }
  const h = s.axis === 'x' ? s : o, v = s.axis === 'x' ? o : s;
  const inX = v.a.x > Math.min(h.a.x, h.b.x) && v.a.x < Math.max(h.a.x, h.b.x);
  const inY = h.a.y > Math.min(v.a.y, v.b.y) && h.a.y < Math.max(v.a.y, v.b.y);
  return inX && inY ? 2 : 0;
}

/**
 * Best route for an edge, or for a group of edges between the same two nodes
 * (they share one route, each in its own lane). `ctx` (or null) holds what is
 * already on the floor: { nodes, texts: [{ r, id, tag }], segs }.
 */
function pickRoute(e, A, B, ctx, members = [{ e, rev: false, lane: 0 }], prefer = null) {
  const a = { x: A.x, y: A.y }, b = { x: B.x, y: B.y };
  // in a group the lanes keep the edges apart, so a legacy `bend` is ignored there
  const asked = members.length === 1
    ? authorSpec(e, a, b)
    : members.map((m) => { const s = authorSpec({ ...m.e, bend: undefined }, m.rev ? b : a, m.rev ? a : b); return s && (m.rev ? reverseSpec(s) : s); }).find(Boolean) ?? null;
  let cands = asked ? [{ spec: asked, pen: 0 }] : routeCandidates(a, b, A, B);
  // a lone elbow may also shift one lane sideways, so edges fanning out of one block do not share a leg
  if (!asked && members.length === 1 && ctx?.segs.length && !cands[0].spec.kind.startsWith('s')) {
    cands = [...cands, ...cands.flatMap((c) => [LANE / 2, -LANE / 2].map((shift) => ({ ...c, shift, pen: c.pen + 0.8 })))];
  }
  // the route this edge had in the previous step keeps a head start, so lines do not jump between steps
  const was = prefer?.get(e.id);
  const same = (c) => was && was.kind === c.spec.kind && Math.abs((was.f ?? 0) - (c.spec.f ?? 0)) < 1e-6 && Math.abs((was.off ?? 0) - (c.spec.off ?? 0)) < 1e-6
    && Math.abs((was.lane ?? 0) - (members[0].lane + (c.shift ?? 0))) < 1e-6;
  let best = null;
  for (const c of cands) {
    if (c.detour && best && best.cost - best.pen < 2 && !same(c)) break; // the straight line is clear enough
    let cost = c.pen - (same(c) ? 1.5 : 0);
    const geoms = [];
    for (const m of members) {
      const spec = { ...c.spec, lane: m.lane + (c.shift ?? 0) };
      const own = m.rev ? reverseSpec(spec) : spec;
      const [MA, MB] = m.rev ? [B, A] : [A, B];
      const g = edgeLayout(m.e, MA, MB, own);
      if (cands.length > 1) cost += routeCost(m.e, g, MA, MB, ctx);
      geoms.push(g);
    }
    if (!best || cost < best.cost - 0.01) best = { cost, pen: c.pen, spec: c.spec, geoms };
  }
  return best;
}

/** Edges between the same two nodes, with the lane each one takes (in the lead edge's direction). */
function edgeGroups(edges, nodes) {
  const groups = new Map();
  for (const e of edges) {
    const key = [e.from, e.to].sort().join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const of = new Map();
  for (const list of groups.values()) {
    const lead = list[0];
    // wide enough for packets to pass each other, the same in every step (so lanes do not
    // shift when a packet comes or goes); every lane still has to land inside both blocks
    let gap = LANE_PAIR;
    const A = nodes?.get(lead.from)?.shape, B = nodes?.get(lead.to)?.shape;
    if (A && B && list.length > 1) gap = Math.min(gap, ((Math.min(A.hw, A.hd, B.hw, B.hd) - 0.06) * 2) / (list.length - 1));
    const members = list.map((x, k) => ({ e: x, rev: x.from !== lead.from, lane: list.length > 1 ? (k - (list.length - 1) / 2) * gap : 0 }));
    list.forEach((x, i) => of.set(x.id, { lead, members, index: i }));
  }
  return of;
}

/**
 * Where a packet rests when motion is reduced: on the edge, beside its label,
 * in the first spot that covers no text and no block. Null = no room (the
 * label already says enough). `avoid(rect)` returns a collision cost.
 */
export function stillPacket(e, g, which, avoid = () => 0) {
  const pk = e.packet === true ? {} : e.packet;
  if (!pk || typeof pk !== 'object') return null;
  const pw = packetWidth(pk.label);
  const ph = ISO.packet.h;
  const edgeMargin = (pw / 2 + 6) / g.length;
  const c = g.labelU ?? 0.5;
  const lw = e.label ? edgeLabelWidth(e.label) : 0;
  const off = e.label ? (lw / 2 + pw / 2 + 10) / g.length : 0;
  const sign = which === 'back' ? 1 : -1;
  const spots = e.label
    ? [c + sign * off, c + sign * (off + 0.08), c + sign * (off + 0.16)]
    : [0.5 + sign * 0.0, 0.5 + sign * 0.12, 0.5 - sign * 0.12, 0.5 + sign * 0.22];
  for (const u of spots) {
    if (u < edgeMargin || u > 1 - edgeMargin) continue;
    const p = g.at(u);
    const r = rect(p.x - pw / 2, p.y - ph / 2, pw, ph);
    if (avoid(r) === 0) return { p, rect: r };
  }
  return null;
}

// ---------------------------------------------------------------- zones & notes
export function zoneLayout(z) {
  const k = Math.min(ISO.zone.inset, z.w / 4, z.h / 4);
  const x0 = z.x + k, y0 = z.y + k, x1 = z.x + z.w - k, y1 = z.y + z.h - k;
  const N = project(x0, y0), E = project(x1, y0), S = project(x1, y1), W = project(x0, y1);
  const poly = [N, E, S, W];
  const candidates = [];
  if (z.label) {
    const w = zoneLabelWidth(z.label);
    const h = ISO.zone.h;
    // name tab positions, in order of preference: the plate's left corner
    // (front-left edge), along that edge, the right corner, the back corner,
    // then in front of the plate. The first one that covers no text wins.
    const left = project(x0 + 0.22, y1 - 0.22);
    candidates.push(rect(left.x, left.y - h / 2, w, h));
    const mid = project(x0 + Math.min(1.6, (x1 - x0) * 0.4), y1 - 0.2);
    candidates.push(rect(mid.x - 6, mid.y - h - 2, w, h));
    const right = project(x1 - 0.22, y0 + 0.22);
    candidates.push(rect(right.x - w, right.y - h / 2, w, h));
    const back = project(x0 + 0.3, y0 + 0.3);
    candidates.push(rect(back.x - w / 2, back.y - h / 2 + 4, w, h));
    candidates.push(rect(S.x - w / 2, S.y + ISO.zone.thick + 6, w, h));
  }
  return { poly, label: candidates[0] ?? null, candidates, depth: x0 + y0 };
}

export function noteLayout(n) {
  const p = project(n.x, n.y);
  const w = noteWidth(n.text);
  return { anchor: p, rect: rect(p.x - w / 2, p.y - ISO.note.rise - ISO.note.h, w, ISO.note.h) };
}

// ---------------------------------------------------------------- whole scene
/**
 * Lay out a scene. `poses` (optional) overrides node positions and lift (the
 * renderer passes tweened values); `routes` (optional, edge id -> route spec)
 * reuses routes picked earlier, so an edge keeps its shape while nodes glide.
 * Edges are routed in scene order: each one picks the elbow that keeps off
 * blocks, text and the edges routed before it, then its label takes the first
 * free spot on its longest straight leg. Zone names move to another corner
 * when their first spot would cover other text.
 */
export function sceneLayout(scene, poses, routes) {
  const nodes = new Map();
  for (const n of scene.nodes) {
    const p = poses?.get(n.id);
    if (p) nodes.set(n.id, nodeLayout(n, p.x, p.y, p.lift));
    else if (Number.isFinite(n.x) && Number.isFinite(n.y)) nodes.set(n.id, nodeLayout(n));
  }
  const notes = scene.notes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y)).map((n) => {
    // a note points at something only when its spot is next to a block;
    // otherwise it is a free-standing sticker without a tail
    let near = Infinity;
    for (const L of nodes.values()) near = Math.min(near, Math.hypot(L.x - n.x, L.y - n.y));
    return { n, ...noteLayout(n), attached: near <= 1.5 };
  });
  const fixed = [];
  for (const L of nodes.values()) fixed.push(L.card, ...L.tags);
  for (const n of notes) fixed.push(n.rect);
  const hits = (r, list) => list.reduce((acc, o) => acc + rectOverlap(r, o, 2), 0);
  // what a route should keep off: cards (with their tail), tags, notes, then edge labels as they are placed
  const texts = [];
  for (const [id, L] of nodes) { texts.push({ r: { ...L.card, h: L.card.h + ISO.card.tail }, id }); L.tags.forEach((r) => texts.push({ r, id, tag: true })); }
  for (const n of notes) texts.push({ r: n.rect, id: n.n.id });

  const live = scene.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  const groups = edgeGroups(live, nodes);
  const leads = [...new Set(live.map((e) => groups.get(e.id).lead))];
  const routed = new Map();
  const segsBut = (mine) => [...routed].filter(([id]) => !mine.has(id)).flatMap(([, g]) => g.segs);
  const linesBut = (id) => {
    const out = [];
    for (const [k, g] of routed) {
      if (k === id) continue;
      const pk = !!live.find((x) => x.id === k)?.packet;
      for (let i = 1; i < 24; i++) out.push({ p: g.at(i / 24), pk });
    }
    return out;
  };
  /** The free-est spot for an edge label on its route: off text, off blocks, off the lines of other edges. */
  const placeLabel = (e, g, taken) => {
    const A = nodes.get(e.from), B = nodes.get(e.to);
    const lines = linesBut(e.id);
    const heads = [...routed.values()].flatMap((h) => [h.tip, h.tail]).filter(Boolean);
    let best = null;
    const tried = new Set();
    for (const u of g.labelSpots) {
      const key = Math.round(u * 200);
      if (tried.has(key)) continue;
      tried.add(key);
      const r = g.labelAt(u);
      let others = 0;
      for (const [id, N] of nodes) if (id !== e.from && id !== e.to) others += blockHit(r, N);
      let crossing = 0;
      for (const l of lines) if (l.p.x > r.x && l.p.x < r.x + r.w && l.p.y > r.y && l.p.y < r.y + r.h) crossing += l.pk ? 4 : 1; // packets need a clear line
      // and never on an arrowhead, its own or another edge's
      const onHead = heads.filter((p) => coversHead(r, p)).length;
      const cost = 20 * (hits(r, fixed) + hits(r, taken)) + 0.5 * (blockHit(r, A) + blockHit(r, B)) + 0.3 * others + crossing + 25 * onHead;
      if (!best || cost < best.cost - 0.01) best = { u, r, cost };
      if (cost === 0) break;
    }
    return best;
  };
  const route = (lead, labels) => {
    const grp = groups.get(lead.id);
    const mine = new Set(grp.members.map((m) => m.e.id));
    const ctx = { nodes, texts: [...texts, ...[...labels].filter(([id]) => !mine.has(id)).map(([id, r]) => ({ r, id: `edge:${id}` }))], segs: segsBut(mine) };
    const { geoms } = pickRoute(lead, nodes.get(lead.from), nodes.get(lead.to), ctx, grp.members, PREFER.get(scene));
    grp.members.forEach((m, i) => routed.set(m.e.id, geoms[i]));
  };
  if (routes && live.every((e) => routes.get(e.id))) {
    for (const e of live) routed.set(e.id, edgeLayout(e, nodes.get(e.from), nodes.get(e.to), routes.get(e.id)));
  } else {
    // 1. greedy, in scene order: each group routes around what is already there (rough labels included)
    const labels = new Map();
    for (const lead of leads) {
      route(lead, labels);
      for (const m of groups.get(lead.id).members) {
        const g = routed.get(m.e.id);
        if (g.label) labels.set(m.e.id, placeLabel(m.e, g, [...labels.values()]).r);
      }
    }
    // 2. two more rounds, each group now seeing every other edge, so an early edge
    //    can step aside for a later one (and the later one settle in turn)
    for (let round = 0; round < 2; round++) for (const lead of leads) route(lead, labels);
  }
  // labels, once every line is final
  const edges = [];
  const placed = [];
  for (const e of live) {
    const g = routed.get(e.id);
    if (g.label) {
      const best = placeLabel(e, g, placed);
      g.label = best.r;
      g.labelU = best.u;
      placed.push(best.r);
    }
    edges.push({ e, g });
  }
  const zones = [];
  for (const z of scene.zones) {
    if (![z.x, z.y, z.w, z.h].every(Number.isFinite)) continue;
    const L = zoneLayout(z);
    if (L.candidates.length) {
      let best = null;
      for (const r of L.candidates) {
        let blocks = 0;
        for (const N of nodes.values()) blocks += blockHit(r, N);
        // stay off edge lines too (packets travel there)
        let lines = 0;
        for (const { g } of edges) for (let i = 1; i < 12; i++) { const p = g.at(i / 12); if (p.x > r.x - 4 && p.x < r.x + r.w + 4 && p.y > r.y - 4 && p.y < r.y + r.h + 4) lines += 3; }
        const cost = hits(r, fixed) + hits(r, placed) + 0.4 * blocks + lines;
        if (!best || cost < best.cost - 0.01) best = { r, cost };
        if (cost === 0) break;
      }
      L.label = best.r;
      placed.push(best.r);
    }
    zones.push({ z, ...L });
  }
  // moving packets: each one travels only along the longest stretch of its
  // edge where it covers no text (its own label ducks while it passes)
  const owned = [];
  for (const [id, L] of nodes) { owned.push({ r: L.card, id }); L.tags.forEach((r) => owned.push({ r, id, tag: true })); }
  for (const n of notes) owned.push({ r: n.rect, id: n.n.id });
  for (const { e, g } of edges) {
    const pk = e.packet === true ? {} : e.packet;
    if (!pk || typeof pk !== 'object') continue;
    const pw = packetWidth(pk.label), ph = ISO.packet.h;
    // the end blocks' own floor tags are drawn above packets, so a packet may slip under them
    const others = [...owned.filter((o) => !(o.tag && (o.id === e.from || o.id === e.to))), ...zones.filter((z) => z.label).map((z) => ({ r: z.label, id: z.z.id })), ...edges.filter((x) => x.e !== e && x.g.label).map((x) => ({ r: x.g.label, id: x.e.from }))];
    const N = 48;
    const clear = [];
    const blockers = new Set();
    for (let i = 0; i <= N; i++) {
      const p = g.at(i / N);
      const r = rect(p.x - pw / 2, p.y - ph / 2, pw, ph);
      const hit = others.filter((o) => rectOverlap(r, o.r, -1) > 0);
      hit.forEach((o) => blockers.add(o.id));
      clear.push(!hit.length);
    }
    g.blockers = [...blockers];
    let best = null;
    for (let i = 0; i <= N; ) {
      if (!clear[i]) { i++; continue; }
      let j = i;
      while (j + 1 <= N && clear[j + 1]) j++;
      if (!best || j - i > best.b - best.a) best = { a: i, b: j };
      i = j + 1;
    }
    const minPx = Math.min(80, g.length * 0.4);
    if (best && ((best.b - best.a) / N) * g.length >= minPx) g.run = { a: best.a / N, b: best.b / N, ok: true };
    else g.run = best && best.b > best.a ? { a: best.a / N, b: best.b / N, ok: false } : { a: 0, b: 1, ok: false };
    if (g.label) {
      const half = (g.label.w / 2 + pw / 2 + 4) / Math.max(1, g.length);
      g.duck = { a: g.labelU - half, b: g.labelU + half };
    }
  }
  // resting spots for packets (used when motion is reduced)
  for (const { e, g } of edges) {
    const pk = e.packet === true ? {} : e.packet;
    if (!pk || typeof pk !== 'object') continue;
    const dir = pk.direction ?? 'forward';
    const avoid = (r) => {
      let blocks = 0;
      for (const N of nodes.values()) blocks += blockHit(r, N);
      return hits(r, fixed) + hits(r, placed) + blocks;
    };
    g.stills = {};
    for (const which of ['fwd', 'back']) {
      if (which === 'fwd' ? dir === 'backward' : dir === 'forward') continue;
      const sp = stillPacket(e, g, which, avoid);
      g.stills[which] = sp;
      if (sp) placed.push(sp.rect);
    }
  }
  if (!poses) assignPacketPhases(edges);
  return { nodes, edges, zones, notes };
}

// ---------------------------------------------------------------- packet timing
/** Seconds per loop, by speed. */
export const PACKET_SPEED = { slow: 3.6, normal: 2.5, fast: 1.5 };
/** Share of each loop spent travelling (the rest: fade in at the start, fade out at the end). */
export const PACKET_MOVE = { start: 0.06, end: 0.88, visibleFrom: 0.04, visibleTo: 0.88 };

/** Timing of the packet(s) on one edge, with begin offsets (s) for the forward and backward packet. */
function packetMotionFor(e, g, phase) {
  const pk = e.packet === true ? {} : e.packet;
  if (!pk || typeof pk !== 'object') return null;
  const dur = PACKET_SPEED[pk.speed ?? 'normal'] ?? PACKET_SPEED.normal;
  const dir = pk.direction ?? 'forward';
  const run = g.run ?? { a: 0, b: 1 };
  return {
    dur,
    fwd: dir === 'forward' || dir === 'both' ? phase : null,
    back: dir === 'backward' || dir === 'both' ? (dir === 'both' ? phase + dur / 2 : phase) : null,
    sa: g.sOf(run.a),
    sb: g.sOf(run.b),
    w: packetWidth(pk.label),
  };
}

/** Screen rect of a moving packet at time t (s), or null while it is faded out. */
export function packetRectAt(g, m, begin, reverse, t) {
  const local = ((((t - begin) % m.dur) + m.dur) % m.dur) / m.dur;
  if (local < PACKET_MOVE.visibleFrom || local > PACKET_MOVE.visibleTo) return null;
  const k = Math.max(0, Math.min(1, (local - PACKET_MOVE.start) / (PACKET_MOVE.end - PACKET_MOVE.start)));
  let s = m.sa + (m.sb - m.sa) * k;
  if (reverse) s = m.sb - (m.sb - m.sa) * k;
  const p = g.atS(s);
  return rect(p.x - m.w / 2, p.y - ISO.packet.h / 2, m.w, ISO.packet.h);
}

const PHASE_T = Array.from({ length: 160 }, (_, i) => i * 0.05); // 8 s of timeline

/** Packets of different edges should not run into each other: pick each edge's start offset greedily. */
function assignPacketPhases(edges) {
  const done = [];
  edges.forEach(({ e, g }, index) => {
    if (!g.run) return;
    const base = packetMotionFor(e, g, 0);
    if (!base) return;
    let best = null;
    for (let k = 0; k < 8; k++) {
      const phase = ((index * 0.43) + (k * base.dur) / 8) % base.dur;
      const m = packetMotionFor(e, g, phase);
      let cost = 0;
      for (const t of PHASE_T) {
        const mine = [m.fwd !== null && packetRectAt(g, m, m.fwd, false, t), m.back !== null && packetRectAt(g, m, m.back, true, t)].filter(Boolean);
        if (!mine.length) continue;
        for (const o of done) {
          const theirs = [o.m.fwd !== null && packetRectAt(o.g, o.m, o.m.fwd, false, t), o.m.back !== null && packetRectAt(o.g, o.m, o.m.back, true, t)].filter(Boolean);
          for (const a of mine) for (const b of theirs) cost += rectOverlap(a, b, 2);
        }
      }
      if (!best || cost < best.cost - 0.01) best = { m, cost };
      if (cost === 0) break;
    }
    g.motion = best.m;
    g.motionClash = best.cost;
    done.push({ g, m: best.m });
  });
}
/** Overlap depth between a rect and a node's block outline (bounding box). */
function blockHit(r, L) {
  const b = polyBox(L.sil);
  const inset = { x: b.x + b.w * 0.18, y: b.y + b.h * 0.12, w: b.w * 0.64, h: b.h * 0.76 };
  return rectOverlap(r, inset);
}

/** Bounding box of everything any step shows, so the camera never jumps. */
export function layoutBounds(scenes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (r) => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); };
  for (const s of scenes) {
    if (!s) continue;
    const L = sceneLayout(s);
    for (const n of L.nodes.values()) {
      add(polyBox(n.sil)); add(n.card); n.tags.forEach(add);
      // room for the lifted state, whatever the status
      add(polyBox(silhouette(n.shape, ISO.lift).map((p) => ({ x: n.c.x + p.x, y: n.c.y + p.y }))));
      add({ ...n.card, y: n.card.y - ISO.lift });
    }
    for (const { g } of L.edges) {
      if (g.label) add(g.label);
      // elbows can reach past the blocks: keep the whole line (and its arrowheads) in view
      for (let i = 0; i <= 24; i++) { const p = g.at(i / 24); add(rect(p.x - 10, p.y - 10, 20, 20)); }
    }
    for (const z of L.zones) { add(polyBox(z.poly)); add({ ...polyBox(z.poly), h: polyBox(z.poly).h + ISO.zone.thick }); if (z.label) add(z.label); }
    for (const n of L.notes) add(n.rect);
  }
  if (!Number.isFinite(x0)) return null;
  const p = ISO.pad;
  return { x: x0 - p, y: y0 - p, w: x1 - x0 + p * 2, h: y1 - y0 + p * 2 };
}

/**
 * Collision report for one resolved scene, in screen space. Returns
 * [{ level: 'error' | 'warn', msg }]. Used by the validator.
 *  - errors: two blocks standing on each other; any two pieces of text
 *    (cards, tags, edge labels, notes, zone names) covering each other.
 *  - warnings: a piece of text hiding a large part of another block.
 */
export function layoutProblems(scene) {
  const L = sceneLayout(scene);
  const out = [];
  const nodes = [...L.nodes.entries()];
  // blocks on top of each other (footprints, grid units)
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const [ia, A] = nodes[i], [ib, B] = nodes[j];
    const gx = Math.abs(A.x - B.x) - (A.shape.hw + B.shape.hw);
    const gy = Math.abs(A.y - B.y) - (A.shape.hd + B.shape.hd);
    if (gx < 0.12 && gy < 0.12) out.push({ level: 'error', msg: `blocks "${ia}" (${A.x},${A.y}) and "${ib}" (${B.x},${B.y}) stand on each other. Move them apart (about 1 grid unit between centres in x or y).`, ids: [ia, ib] });
  }
  const texts = [];
  for (const [id, n] of nodes) {
    texts.push({ what: `card of "${id}"`, owner: id, ids: [id], r: n.card });
    n.tags.forEach((r, k) => texts.push({ what: `tag "${scene.nodes.find((x) => x.id === id).tags[k]}" of "${id}"`, owner: id, ids: [id], r }));
  }
  for (const { e, g } of L.edges) {
    if (g.label) texts.push({ what: `label "${e.label}" of edge "${e.id}"`, owner: `edge:${e.id}`, ends: [e.from, e.to], ids: [e.from, e.to], r: g.label });
  }
  for (const z of L.zones) if (z.label) texts.push({ what: `name of zone "${z.z.id}"`, owner: `zone:${z.z.id}`, ids: [z.z.id], r: z.label });
  for (const n of L.notes) texts.push({ what: `note "${n.n.id}"`, owner: `note:${n.n.id}`, ids: [n.n.id], r: n.rect });

  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.owner === b.owner) continue;
    const o = rectOverlap(a.r, b.r);
    if (o > 0.5) out.push({ level: 'error', msg: `${a.what} covers ${b.what} (${Math.round(o)}px)`, ids: [...a.ids, ...b.ids], depth: o });
  }
  for (const t of texts) {
    for (const [id, n] of nodes) {
      if (t.owner === id) continue;
      const cov = coverage(n, t.r);
      const limit = t.ends?.includes(id) ? 0.22 : 0.3;
      if (cov > limit) out.push({ level: 'warn', msg: `${t.what} hides ${Math.round(cov * 100)}% of block "${id}"`, ids: [...t.ids, id], depth: cov * 20 });
    }
  }
  // zone plates may nest, but must not partly overlap
  const zs = L.zones.map((z) => z.z);
  for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
    const a = zs[i], b = zs[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox <= 0.05 || oy <= 0.05) continue;
    const inside = (p, q) => p.x >= q.x - 0.01 && p.y >= q.y - 0.01 && p.x + p.w <= q.x + q.w + 0.01 && p.y + p.h <= q.y + q.h + 0.01;
    if (inside(a, b) || inside(b, a)) continue;
    out.push({ level: 'error', msg: `zones "${a.id}" and "${b.id}" partly overlap (${ox.toFixed(1)} x ${oy.toFixed(1)} grid units). Leave a gap between them, or put one fully inside the other.`, ids: [a.id, b.id], depth: Math.min(ox, oy) * 20 });
  }
  // arrowheads must stay visible: not under a card, tag, note or other label
  const cover = [];
  for (const [id, n] of nodes) { cover.push({ what: `the card of "${id}"`, r: { ...n.card, h: n.card.h + ISO.card.tail }, id }); n.tags.forEach((r) => cover.push({ what: `a tag of "${id}"`, r, id })); }
  for (const n of L.notes) cover.push({ what: `note "${n.n.id}"`, r: n.rect, id: n.n.id });
  for (const { e, g } of L.edges) {
    for (const p of [g.tip, g.tail]) {
      if (!p) continue;
      const hit = cover.find((c) => p.x > c.r.x - 3 && p.x < c.r.x + c.r.w + 3 && p.y > c.r.y - 3 && p.y < c.r.y + c.r.h + 3);
      if (hit) out.push({ level: 'error', msg: `the arrowhead of edge "${e.id}" hides under ${hit.what}`, ids: [e.from, e.to, hit.id], depth: 6 });
    }
  }
  // moving packets need a clear stretch of their edge
  for (const { e, g } of L.edges) {
    if (g.run && !g.run.ok) out.push({ level: 'error', msg: `the packet on edge "${e.id}" has no clear stretch to travel: it would pass over other text (cards, tags, labels) almost all the way`, ids: [e.from, e.to, ...(g.blockers ?? [])], depth: 8 });
  }
  // moving packets of different edges should not run into each other
  for (const { e, g } of L.edges) {
    if (g.motionClash > 30) out.push({ level: 'warn', msg: `the packet on edge "${e.id}" runs into another packet while moving; lower the number of packets or move the edges apart`, ids: [e.from, e.to], depth: 4 });
  }
  // an edge whose line runs mostly underneath cards cannot be followed
  for (const { e, g } of L.edges) {
    const N = 24;
    let hidden = 0;
    const by = new Set();
    for (let i = 0; i <= N; i++) {
      const p = g.at(i / N);
      for (const [id, n] of nodes) {
        const r = n.card;
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h + ISO.card.tail) { hidden++; by.add(id); break; }
      }
    }
    const frac = hidden / (N + 1);
    if (frac > 0.45) out.push({ level: 'warn', msg: `edge "${e.id}" runs ${Math.round(frac * 100)}% under the card of ${[...by].map((x) => `"${x}"`).join(', ')}; it is hard to follow`, ids: [e.from, e.to, ...by], depth: frac * 20 });
  }
  // two edges running on top of each other (edges between the same two nodes take lanes and never do;
  // a shared trunk out of one block, without packets, is fine)
  for (let i = 0; i < L.edges.length; i++) for (let j = i + 1; j < L.edges.length; j++) {
    const p = L.edges[i], q = L.edges[j];
    let ov = 0;
    for (const s of p.g.segs) for (const o of q.g.segs) if (!trunk(s, o)) ov += legOverlap(s, o, 0.26);
    if (ov > 0.4) out.push({ level: 'warn', msg: `edges "${p.e.id}" and "${q.e.id}" run on top of each other for ${ov.toFixed(1)} grid units; move a node or set "route" on one of them`, ids: [p.e.from, p.e.to, q.e.from, q.e.to], depth: ov * 10 });
  }
  return out;
}

/** Share of a node's silhouette hidden under rect r (0..1). */
function coverage(n, r) {
  const box = polyBox(n.sil);
  const N = 10;
  let inside = 0, hidden = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = { x: box.x + ((i + 0.5) / N) * box.w, y: box.y + ((j + 0.5) / N) * box.h };
    if (!pointInPoly(p, n.sil)) continue;
    inside++;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) hidden++;
  }
  return inside ? hidden / inside : 0;
}
