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
  pad: 26,
  lift: 14, // how far an "active" block floats up
  card: { label: 20, sub: 14.5, padX: 13, h1: 36, h2: 55, gap: 11, tail: 7, minW: 64 },
  edge: { size: 13, padX: 9, h: 25 },
  tag: { size: 12, padX: 7, h: 21, gap: 5, below: 8 },
  note: { padX: 13, h: 34, rise: 22 },
  packet: { size: 12.5, padX: 9, h: 22, r: 6.5 },
  zone: { size: 11.5, padX: 9, h: 22, thick: 6 },
};

const SQRT2 = Math.SQRT2;

/** Grid point (x, y) at height z -> screen point. */
export function project(x, y, z = 0) {
  return { x: (x - y) * ISO.G, y: ((x + y) * ISO.G) / 2 - z };
}

// ---------------------------------------------------------------- node shapes
/**
 * The 3D shape used for a node, by kind. hw/hd are half the footprint in grid
 * units (x and y); h is the height in px. `top` is the highest screen point of
 * the shape above the floor centre (used to place the card).
 */
export function nodeShape(n) {
  const kind = n.kind ?? 'neutral';
  switch (kind) {
    case 'server':
      return { type: 'server', hw: 0.42, hd: 0.42, h: 40 };
    case 'data':
      return { type: 'cylinder', hw: 0.41, hd: 0.41, r: 0.41 * SQRT2, h: 36 };
    case 'ai':
      return { type: 'chip', hw: 0.42, hd: 0.42, h: 22, cap: 0.3, capH: 13 };
    case 'external':
      return { type: 'crate', hw: 0.38, hd: 0.38, h: 26, lid: 0.45, lidH: 8 };
    case 'threat':
      return { type: 'hazard', hw: 0.4, hd: 0.4, h: 32 };
    case 'client':
      return n.icon === 'phone'
        ? { type: 'phone', hw: 0.24, hd: 0.13, h: 50 }
        : { type: 'laptop', hw: 0.46, hd: 0.36, h: 7, screenH: 38 };
    case 'person':
      return { type: 'person', hw: 0.36, hd: 0.36, h: 7, figure: n.icon === 'users' ? 2 : 1, figH: 48 };
    default:
      return { type: 'box', hw: 0.4, hd: 0.4, h: 26 };
  }
}

/** Total height (px) of the shape above the floor. */
export function shapeHeight(s) {
  if (s.type === 'chip') return s.h + s.capH;
  if (s.type === 'crate') return s.h + s.lidH;
  if (s.type === 'laptop') return s.h + s.screenH;
  if (s.type === 'person') return s.h + s.figH;
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
export function silhouette(s, lift = 0) {
  const G = ISO.G;
  if (s.type === 'person') {
    const b0 = boxCorners(s.hw, s.hd, 0);
    const b1 = boxCorners(s.hw, s.hd, s.h + lift);
    const fw = s.figure === 2 ? 30 : 17;
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
export const edgeLabelWidth = (label) => (label ? Math.ceil(monoWidth(label, ISO.edge.size) + ISO.edge.padX * 2) : 0);
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
/**
 * Geometry of an edge between two laid-out nodes. The line lies on the floor;
 * it starts where it leaves node A's silhouette and ends where it disappears
 * behind / reaches node B. `bend` curves it sideways (grid units).
 */
export function edgeLayout(e, A, B, bend = 0) {
  const a = { x: A.x, y: A.y };
  const b = { x: B.x, y: B.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // world-space quadratic control point (passes through the bent midpoint)
  const m = { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
  const q = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
  const curved = Math.abs(bend) > 0.001;
  const world = (t) => (curved
    ? { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * q.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * q.y + t * t * b.y }
    : { x: a.x + dx * t, y: a.y + dy * t });
  const tangent = (t) => (curved
    ? { x: 2 * (1 - t) * (q.x - a.x) + 2 * t * (b.x - q.x), y: 2 * (1 - t) * (q.y - a.y) + 2 * t * (b.y - q.y) }
    : { x: dx, y: dy });
  const scr = (t) => { const w = world(t); return project(w.x, w.y); };

  const arrowEnd = (e.arrow ?? 'end') === 'end' || e.arrow === 'both';
  const arrowStart = e.arrow === 'start' || e.arrow === 'both';
  const exitT = (poly, from, to, pad) => {
    // first t (going from `from` to `to`) where the point is clear of poly
    let lo = from, hi = to;
    if (nearPoly(scr(hi), poly, pad)) return hi;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (nearPoly(scr(mid), poly, pad)) lo = mid; else hi = mid;
    }
    return hi;
  };
  let t0 = exitT(A.sil, 0, 0.5, arrowStart ? 9 : 5);
  let t1 = exitT(B.sil, 1, 0.5, arrowEnd ? 9 : 5);
  if (t1 - t0 < 0.02) { const mid = (t0 + t1) / 2; t0 = mid - 0.01; t1 = mid + 0.01; }

  // sub-curve [t0, t1] as a screen-space path
  const s = scr(t0), en = scr(t1);
  let d;
  if (curved) {
    const p0 = world(t0);
    // exact control for sub-curve: C = P0 + (t1 - t0)/2 * B'(t0)
    const tg = tangent(t0);
    const cw = { x: p0.x + ((t1 - t0) / 2) * tg.x, y: p0.y + ((t1 - t0) / 2) * tg.y };
    const cs = project(cw.x, cw.y);
    d = `M${r1(s.x)},${r1(s.y)} Q${r1(cs.x)},${r1(cs.y)} ${r1(en.x)},${r1(en.y)}`;
  } else {
    d = `M${r1(s.x)},${r1(s.y)} L${r1(en.x)},${r1(en.y)}`;
  }

  const at = (u) => scr(t0 + (t1 - t0) * u); // u in 0..1 along the visible part
  let length = 0;
  { let p = at(0); for (let i = 1; i <= 24; i++) { const n = at(i / 24); length += Math.hypot(n.x - p.x, n.y - p.y); p = n; } }

  // arrowheads lie flat on the floor
  const head = (t, dir) => {
    const w = world(t);
    const tg = tangent(t);
    const l = Math.hypot(tg.x, tg.y) || 1;
    const ux = (tg.x / l) * dir, uy = (tg.y / l) * dir;
    const L = 0.27, W = 0.15;
    const tip = project(w.x, w.y);
    const p1 = project(w.x - ux * L - uy * W, w.y - uy * L + ux * W);
    const p2 = project(w.x - ux * L + uy * W, w.y - uy * L - ux * W);
    const notch = project(w.x - ux * L * 0.62, w.y - uy * L * 0.62);
    return `M${r1(tip.x)},${r1(tip.y)} L${r1(p1.x)},${r1(p1.y)} L${r1(notch.x)},${r1(notch.y)} L${r1(p2.x)},${r1(p2.y)}Z`;
  };
  const heads = [];
  if (arrowEnd) heads.push(head(t1, 1));
  if (arrowStart) heads.push(head(t0, -1));

  const mid = at(0.5);
  const lw = edgeLabelWidth(e.label);
  const labelAt = (u) => { const p = at(u); return rect(p.x - lw / 2, p.y - ISO.edge.h / 2, lw, ISO.edge.h); };
  const label = e.label ? labelAt(0.5) : null;
  return { d, at, mid, length, heads, label, labelU: 0.5, labelAt };
}
const r1 = (v) => Math.round(v * 10) / 10;

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
  const N = project(z.x, z.y), E = project(z.x + z.w, z.y), S = project(z.x + z.w, z.y + z.h), W = project(z.x, z.y + z.h);
  const poly = [N, E, S, W];
  const candidates = [];
  if (z.label) {
    const w = zoneLabelWidth(z.label);
    const h = ISO.zone.h;
    // name tab positions, in order of preference: back corner, left corner,
    // right corner, front corner. The first one that covers no text wins.
    const a = project(z.x + 0.12, z.y + 0.12);
    candidates.push(rect(a.x - 14, a.y - h / 2 - 2, w, h));
    candidates.push(rect(W.x + 10, W.y - h / 2, w, h));
    candidates.push(rect(E.x - 10 - w, E.y - h / 2, w, h));
    candidates.push(rect(S.x - w / 2, S.y + ISO.zone.thick + 6, w, h));
  }
  return { poly, label: candidates[0] ?? null, candidates };
}

export function noteLayout(n) {
  const p = project(n.x, n.y);
  const w = noteWidth(n.text);
  return { anchor: p, rect: rect(p.x - w / 2, p.y - ISO.note.rise - ISO.note.h, w, ISO.note.h) };
}

// ---------------------------------------------------------------- whole scene
/** Opposite edges between the same two nodes curve apart automatically. */
export function autoBends(edges) {
  const keys = new Set(edges.map((e) => `${e.from}>${e.to}`));
  const m = new Map();
  for (const e of edges) if (e.bend === undefined && keys.has(`${e.to}>${e.from}`)) m.set(e.id, 0.4);
  return m;
}

/**
 * Lay out a scene. `poses` (optional) overrides node positions and lift (the
 * renderer passes tweened values). Edge labels slide along their edge and zone
 * names move to another corner when their first spot would cover other text.
 */
export function sceneLayout(scene, poses) {
  const nodes = new Map();
  for (const n of scene.nodes) {
    const p = poses?.get(n.id);
    if (p) nodes.set(n.id, nodeLayout(n, p.x, p.y, p.lift));
    else if (Number.isFinite(n.x) && Number.isFinite(n.y)) nodes.set(n.id, nodeLayout(n));
  }
  const bends = autoBends(scene.edges);
  const notes = scene.notes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y)).map((n) => ({ n, ...noteLayout(n) }));
  const fixed = [];
  for (const L of nodes.values()) fixed.push(L.card, ...L.tags);
  for (const n of notes) fixed.push(n.rect);
  const hits = (r, list) => list.reduce((acc, o) => acc + rectOverlap(r, o, 2), 0);

  const edges = [];
  const placed = [];
  for (const e of scene.edges) {
    const A = nodes.get(e.from), B = nodes.get(e.to);
    if (!A || !B) continue;
    const g = edgeLayout(e, A, B, e.bend ?? bends.get(e.id) ?? 0);
    if (g.label) {
      let best = null;
      for (const u of LABEL_SPOTS) {
        const r = g.labelAt(u);
        // keep the pill off the end blocks as well
        let others = 0;
        for (const [id, N] of nodes) if (id !== e.from && id !== e.to) others += blockHit(r, N);
        const cost = hits(r, fixed) + hits(r, placed) + 0.5 * (blockHit(r, A) + blockHit(r, B)) + 0.3 * others;
        if (!best || cost < best.cost - 0.01) best = { u, r, cost };
        if (cost === 0) break;
      }
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
        const cost = hits(r, fixed) + hits(r, placed) + 0.4 * blocks;
        if (!best || cost < best.cost - 0.01) best = { r, cost };
        if (cost === 0) break;
      }
      L.label = best.r;
      placed.push(best.r);
    }
    zones.push({ z, ...L });
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
  return { nodes, edges, zones, notes };
}
const LABEL_SPOTS = [0.5, 0.42, 0.58, 0.35, 0.65, 0.28, 0.72];
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
    for (const { g } of L.edges) if (g.label) add(g.label);
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
