import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ICONS } from '../../shared/schema.js';
import type { Packet, ResolvedScene, SceneEdge, SceneNode, SceneNote, SceneZone } from '../../shared/schema.js';
import {
  FLAG_W, ISO, PACKET_KINDS, PACKET_MEANING, PACKET_MOVE, boxCorners, edgeLayout, layoutBounds, nodeLayout, packetKind, project, sceneLayout, stillPacket, zoneLayout,
} from '../../shared/iso.js';
import type { EdgeGeom, EdgeRoute, NodeLayout, PacketMotion, Pt, Rect, Shape } from '../../shared/iso.js';
import { UiIcon } from './UiIcon';

// Isometric scene renderer. The lesson grid (12 x 8) becomes an iso floor;
// nodes are extruded blocks whose shape depends on their kind (or `shape`),
// with an upright card above each block so text stays readable. Geometry
// lives in shared/iso.js so the validator checks exactly what is drawn here.
//
// The camera frames each step on its own content and glides between steps.
// Things that leave fade out first; new things rise in after them.

const TWEEN_MS = 680;
/** On a phone the camera never zooms out further than this (screen px per scene unit). */
const MIN_PHONE_SCALE = 0.56;
const CAMERA_MS = 760;
const LEAVE_MS = 260;
const ENTER_AFTER_LEAVE = 0.2; // s
const G = ISO.G;
/** blocks are drawn this much larger than the 1 x 1 grid cell (same factor as shared/iso.js) */
const BK = 1.22;
/** ids of the shared gradients of the current <svg> (several diagrams can be on one page) */
const Paint = createContext({ cyl: '', haz: '' });

export type Bounds = Rect;
/** Bounding box of everything the given scenes show. */
export const sceneBounds = (scenes: (ResolvedScene | undefined)[]): Bounds | null => layoutBounds(scenes);

// ------------------------------------------------------------------ presence
type Present<T> = { item: T; leaving: boolean };

function usePresence<T extends { id: string }>(items: T[], reduced: boolean): Present<T>[] {
  const [leaving, setLeaving] = useState<T[]>([]);
  const prev = useRef<T[]>(items);
  useLayoutEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    const gone = prev.current.filter((i) => !ids.has(i.id));
    prev.current = items;
    if (reduced) {
      setLeaving([]);
      return;
    }
    setLeaving((old) => [...old.filter((o) => !ids.has(o.id) && !gone.some((g) => g.id === o.id)), ...gone]);
    if (!gone.length) return;
    const t = setTimeout(() => setLeaving((old) => old.filter((o) => !gone.includes(o))), LEAVE_MS + 60);
    return () => clearTimeout(t);
  }, [items, reduced]);
  const ids = new Set(items.map((i) => i.id));
  return [
    ...leaving.filter((l) => !ids.has(l.id)).map((item) => ({ item, leaving: true })),
    ...items.map((item) => ({ item, leaving: false })),
  ];
}

/**
 * Entrance delay per item, frozen the first time the item shows up: when the
 * step also removes things, new things wait until those have faded out.
 */
function useEnterDelays(scene: ResolvedScene, reduced: boolean) {
  const seen = useRef(new Map<string, number>());
  const prevIds = useRef<Set<string>>(new Set());
  const all = [...scene.nodes, ...scene.edges, ...scene.zones, ...scene.notes].map((x) => x.id);
  const now = new Set(all);
  const removing = !reduced && [...prevIds.current].some((id) => !now.has(id));
  for (const id of all) if (!seen.current.has(id)) seen.current.set(id, removing ? ENTER_AFTER_LEAVE : 0);
  useEffect(() => {
    prevIds.current = now;
    for (const id of [...seen.current.keys()]) if (!now.has(id)) seen.current.delete(id);
  });
  return (id: string) => seen.current.get(id) ?? 0;
}

// ------------------------------------------------------------------ tween (grid units + lift)
type Pose = { x: number; y: number; lift: number };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function useTweenedPoses(nodes: SceneNode[], reduced: boolean): Map<string, Pose> {
  const target = useMemo(() => {
    const m = new Map<string, Pose>();
    for (const n of nodes) m.set(n.id, { x: n.x, y: n.y, lift: n.status === 'active' ? ISO.lift : 0 });
    return m;
  }, [nodes]);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const moving = [...target].some(([id, p]) => {
      const f = from.get(id);
      return f && (f.x !== p.x || f.y !== p.y || f.lift !== p.lift);
    });
    const merged = new Map(from);
    for (const [id, p] of target) if (!from.has(id) || reduced || !moving) merged.set(id, p);
    if (reduced || !moving) {
      setShown(merged);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / TWEEN_MS));
      const next = new Map(merged);
      for (const [id, p] of target) {
        const f = from.get(id);
        if (!f) continue;
        next.set(id, { x: f.x + (p.x - f.x) * k, y: f.y + (p.y - f.y) * k, lift: f.lift + (p.lift - f.lift) * k });
      }
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}

// ------------------------------------------------------------------ camera
/**
 * The view (in scene units) that shows content b as large as possible inside a
 * W x H px panel, never zooming in past `min` scene units, leaving `top` and
 * `bottom` px free (toolbar).
 */
function fitView(b: Rect, size: { w: number; h: number }, min: { w: number; h: number }, reserve = { top: 0, bottom: 0 }): Rect {
  const W = size.w, H = size.h;
  const Hu = Math.max(40, H - reserve.top - reserve.bottom);
  const w = Math.max(b.w, min.w), h = Math.max(b.h, min.h);
  const k = Math.min(W / w, Hu / h);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return { x: cx - W / (2 * k), y: cy - (reserve.top + Hu / 2) / k, w: W / k, h: H / k };
}

function useCamera(target: Rect, reduced: boolean): Rect {
  const [view, setView] = useState(target);
  const cur = useRef(target);
  cur.current = view;
  const key = `${target.x.toFixed(1)},${target.y.toFixed(1)},${target.w.toFixed(1)},${target.h.toFixed(1)}`;
  useEffect(() => {
    const from = cur.current;
    const same = Math.abs(from.x - target.x) + Math.abs(from.y - target.y) + Math.abs(from.w - target.w) + Math.abs(from.h - target.h) < 0.5;
    if (reduced || same) {
      setView(target);
      return;
    }
    // a large aspect change (resize) jumps; step changes glide
    if (Math.abs(from.w / from.h - target.w / target.h) > 0.02) {
      setView(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / CAMERA_MS));
      setView({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  return view;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (s && Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ------------------------------------------------------------------ drawing helpers
const st = (s?: string) => `st-${s ?? 'normal'}`;
const pts = (list: Pt[]) => list.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(' ');
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** An icon painted onto a plane: c = centre, u / v = screen vectors per icon unit. */
function Decal({ name, c, u, v, className = 'decal' }: { name?: string; c: Pt; u: Pt; v: Pt; className?: string }) {
  const markup = name ? ICONS[name] : undefined;
  if (!markup) return null;
  const m = `matrix(${u.x},${u.y},${v.x},${v.y},${c.x - 12 * u.x - 12 * v.x},${c.y - 12 * u.y - 12 * v.y})`;
  return <g className={className} transform={m} dangerouslySetInnerHTML={{ __html: markup }} />;
}
/** Icon lying on a horizontal surface at height z (size in grid units). */
const topDecal = (name: string | undefined, z: number, size: number, at: Pt = { x: 0, y: 0 }) => {
  const k = ((size * BK) / 24) * G;
  return <Decal name={name} c={{ x: at.x, y: at.y - z }} u={{ x: k, y: k / 2 }} v={{ x: -k, y: k / 2 }} />;
};

/** Faces of a box (footprint hw x hd, from height z0 to z1). */
function Box({ hw, hd, z0, z1, top = true, children, at }: { hw: number; hd: number; z0: number; z1: number; top?: boolean; children?: ReactNode; at?: Pt }) {
  const o = at ?? { x: 0, y: 0 };
  const b = boxCorners(hw, hd, z0);
  const t = boxCorners(hw, hd, z1);
  const s = (p: Pt) => add(p, o);
  return (
    <>
      <polygon className="f-left" points={pts([t.W, t.S, b.S, b.W].map(s))} />
      <polygon className="f-right" points={pts([t.S, t.E, b.E, b.S].map(s))} />
      {top && <polygon className="f-top" points={pts([t.N, t.E, t.S, t.W].map(s))} />}
      {children}
    </>
  );
}

/** Vertical cylinder of radius r (grid units) from z0 to z1. */
function Cylinder({ r, z0, z1, bands = 0, rim = false }: { r: number; z0: number; z1: number; bands?: number; rim?: boolean }) {
  const paint = useContext(Paint);
  const rx = r * Math.SQRT2 * G;
  const ry = (r / Math.SQRT2) * G;
  const side = `M${-rx},${-z1} L${-rx},${-z0} A${rx},${ry} 0 0 0 ${rx},${-z0} L${rx},${-z1} A${rx},${ry} 0 0 1 ${-rx},${-z1} Z`;
  const ring = (z: number) => `M${-rx},${-z} A${rx},${ry} 0 0 0 ${rx},${-z}`;
  return (
    <>
      <path className="f-left" d={side} />
      <path className="f-shade" d={side} fill={`url(#${paint.cyl})`} />
      {Array.from({ length: bands }, (_, i) => (
        <path key={i} className="f-band" d={ring(z0 + ((z1 - z0) * (i + 1)) / (bands + 1))} />
      ))}
      <ellipse className="f-top" cx={0} cy={-z1} rx={rx} ry={ry} />
      {rim && <ellipse className="f-rim" cx={0} cy={-z1} rx={rx * 0.72} ry={ry * 0.72} />}
    </>
  );
}

function Figure({ x, base, h, scale = 1 }: { x: number; base: number; h: number; scale?: number }) {
  // a friendly little person standing on the plinth (screen space, upright)
  const s = scale;
  const bodyH = h * 0.52 * s;
  const w = 15.5 * s;
  const y0 = -base;
  const headR = 10.5 * s;
  const top = y0 - bodyH;
  const paint = useContext(Paint);
  const body = `M${x - w},${y0 - 2} C${x - w},${top + 4} ${x - w * 0.55},${top} ${x},${top} C${x + w * 0.55},${top} ${x + w},${top + 4} ${x + w},${y0 - 2} Q${x},${y0 + w * 0.42} ${x - w},${y0 - 2} Z`;
  return (
    <g className="figure">
      <path className="f-left" d={body} />
      <path className="f-shade" d={body} fill={`url(#${paint.cyl})`} />
      <circle className="f-top head" cx={x} cy={top - headR + 1.5 * s} r={headR} />
      <path className="f-face" d={`M${x - 3.6 * s},${top - headR + 4.6 * s} Q${x},${top - headR + 7.4 * s} ${x + 3.6 * s},${top - headR + 4.6 * s}`} />
    </g>
  );
}

function Sparkle({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  const k = r * 0.3;
  const d = `M${x},${y - r} Q${x + k * 0.4},${y - k * 0.4} ${x + r},${y} Q${x + k * 0.4},${y + k * 0.4} ${x},${y + r} Q${x - k * 0.4},${y + k * 0.4} ${x - r},${y} Q${x - k * 0.4},${y - k * 0.4} ${x},${y - r} Z`;
  return <path className="sparkle" d={d} />;
}

/** The 3D block for one node, drawn around its floor centre (0,0). */
function Block({ n, shape, lift }: { n: SceneNode; shape: Shape; lift: number }) {
  const paint = useContext(Paint);
  const z = lift;
  const icon = n.icon;
  switch (shape.type) {
    case 'server': {
      const { hw, hd, h } = shape;
      const t1 = boxCorners(hw, hd, z + h * 0.36);
      const t2 = boxCorners(hw, hd, z + h * 0.68);
      const ledAt = (zz: number) => mix(boxCorners(hw, hd, zz).S, boxCorners(hw, hd, zz).E, 0.18);
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          <path className="f-groove" d={`M${t1.S.x},${t1.S.y} L${t1.E.x},${t1.E.y} M${t2.S.x},${t2.S.y} L${t2.E.x},${t2.E.y}`} />
          <path className="f-groove" d={`M${t1.W.x},${t1.W.y} L${t1.S.x},${t1.S.y} M${t2.W.x},${t2.W.y} L${t2.S.x},${t2.S.y}`} />
          {[0.2, 0.52, 0.84].map((k) => {
            const p = ledAt(z + h * k);
            return <ellipse key={k} className="led" cx={p.x} cy={p.y} rx={3} ry={2.5} />;
          })}
          {topDecal(icon, z + h, 0.56)}
        </Box>
      );
    }
    case 'cylinder': {
      const r = shape.r ?? 0.6;
      return (
        <>
          <Cylinder r={r} z0={z} z1={z + shape.h} bands={2} />
          {topDecal(icon, z + shape.h, 0.56)}
        </>
      );
    }
    case 'token': {
      const r = shape.r ?? 0.6;
      return (
        <>
          <Cylinder r={r} z0={z} z1={z + shape.h} rim />
          {topDecal(icon, z + shape.h, 0.46)}
        </>
      );
    }
    case 'tile': {
      const { hw, hd, h } = shape;
      const t = boxCorners(hw, hd, z + h);
      const inner = [t.N, t.E, t.S, t.W].map((p) => mix(p, { x: 0, y: -z - h }, 0.18));
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          <polygon className="f-inset" points={pts(inner)} />
          {topDecal(icon, z + h, 0.5)}
        </Box>
      );
    }
    case 'stack': {
      const { hw, hd, h } = shape;
      const k = h / 3;
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={z + k - 1} at={{ x: 3, y: 0 }} />
          <Box hw={hw} hd={hd} z0={z + k} z1={z + 2 * k - 1} at={{ x: -3, y: 0 }} />
          <Box hw={hw} hd={hd} z0={z + 2 * k} z1={z + h}>
            {topDecal(icon, z + h, 0.52)}
          </Box>
        </>
      );
    }
    case 'flag': {
      const { hw, hd, h } = shape;
      const poleH = shape.poleH ?? 60;
      const top = -z - h - poleH;
      const cloth = `M2,${top + 2} C${FLAG_W * 0.35},${top - 4} ${FLAG_W * 0.6},${top + 10} ${FLAG_W},${top + 6} L${FLAG_W},${top + 32} C${FLAG_W * 0.6},${top + 36} ${FLAG_W * 0.35},${top + 22} 2,${top + 28} Z`;
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={z + h} />
          <rect className="f-pole" x={-2} y={top - 4} width={4} height={poleH + 4} rx={2} />
          <path className="f-left cloth" d={cloth} />
          <circle className="f-top" cx={0} cy={top - 5} r={4} />
        </>
      );
    }
    case 'chip': {
      const { hw, hd, h } = shape;
      const cap = shape.cap ?? 0.3;
      const capH = shape.capH ?? 12;
      const b = boxCorners(hw, hd, z + h * 0.5);
      const pins: string[] = [];
      for (const k of [0.25, 0.5, 0.75]) {
        const l = mix(b.W, b.S, k);
        const r = mix(b.S, b.E, k);
        pins.push(`M${l.x},${l.y - 5} L${l.x},${l.y + 5}`, `M${r.x},${r.y - 5} L${r.x},${r.y + 5}`);
      }
      const capTop = boxCorners(cap, cap, z + h + capH);
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={z + h}>
            <path className="f-pins" d={pins.join(' ')} />
          </Box>
          <g className="chip-cap">
            <Box hw={cap} hd={cap} z0={z + h} z1={z + h + capH} />
          </g>
          {topDecal(icon, z + h + capH, 0.46)}
          <Sparkle x={capTop.E.x + 12} y={capTop.E.y - 18} r={11} />
        </>
      );
    }
    case 'crate': {
      const { hw, hd, h } = shape;
      const lid = shape.lid ?? 0.45;
      const lidH = shape.lidH ?? 8;
      const m1 = boxCorners(hw, hd, z);
      const m2 = boxCorners(hw, hd, z + h);
      const strapL = [mix(m2.W, m2.S, 0.5), mix(m1.W, m1.S, 0.5)];
      const strapR = [mix(m2.S, m2.E, 0.5), mix(m1.S, m1.E, 0.5)];
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={z + h}>
            <path className="f-groove" d={`M${strapL[0].x},${strapL[0].y} L${strapL[1].x},${strapL[1].y} M${strapR[0].x},${strapR[0].y} L${strapR[1].x},${strapR[1].y}`} />
          </Box>
          <g className="lid">
            <Box hw={lid} hd={lid} z0={z + h} z1={z + h + lidH} />
          </g>
          {topDecal(icon, z + h + lidH, 0.56)}
        </>
      );
    }
    case 'hazard': {
      const { hw, hd, h } = shape;
      const a = boxCorners(hw, hd, z + h - 13);
      const t = boxCorners(hw, hd, z + h);
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          <polygon className="hazard" points={pts([t.W, t.S, a.S, a.W])} fill={`url(#${paint.haz})`} />
          <polygon className="hazard" points={pts([t.S, t.E, a.E, a.S])} fill={`url(#${paint.haz})`} />
          <polygon className="f-edge" points={pts([t.W, t.S, a.S, a.W])} />
          <polygon className="f-edge" points={pts([t.S, t.E, a.E, a.S])} />
          {topDecal(icon, z + h, 0.54)}
        </Box>
      );
    }
    case 'laptop': {
      const { hw, hd, h } = shape;
      const H = shape.screenH ?? 38;
      // screen panel stands on the back-right edge, facing the viewer (down-left)
      const p = (x: number, zz: number, y = -hd) => project(x, y, zz);
      const back = 0.05;
      const panel = [p(-hw, z + h), p(hw, z + h), p(hw + 0, z + h + H), p(-hw, z + h + H)].map((q) => ({ x: q.x, y: q.y }));
      const rear = [p(-hw, z + h, -hd - back), p(hw, z + h, -hd - back), p(hw, z + h + H, -hd - back), p(-hw, z + h + H, -hd - back)];
      const inset = (k: number, kz: number) => [p(-hw + k, z + h + kz), p(hw - k, z + h + kz), p(hw - k, z + h + H - kz), p(-hw + k, z + h + H - kz)];
      const t = boxCorners(hw, hd, z + h);
      const kb = [mix(t.W, t.N, 0.22), mix(t.S, t.E, 0.22), mix(t.S, t.E, 0.78), mix(t.W, t.N, 0.78)];
      const kk = 0.026 * G;
      const centre = project(0, -hd, z + h + H / 2);
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={z + h} />
          <polygon className="f-keys" points={pts([mix(kb[0], kb[1], 0.12), mix(kb[0], kb[1], 0.62), mix(kb[3], kb[2], 0.62), mix(kb[3], kb[2], 0.12)])} />
          <polygon className="f-right" points={pts([rear[1], panel[1], panel[2], rear[2]])} />
          <polygon className="f-top" points={pts([rear[3], rear[2], panel[2], panel[3]])} />
          <polygon className="f-left" points={pts(panel)} />
          <polygon className="screen" points={pts(inset(0.06, 4))} />
          <Decal name={icon} c={centre} u={{ x: kk, y: kk / 2 }} v={{ x: 0, y: kk * 1.05 }} className="decal on-screen" />
        </>
      );
    }
    case 'phone': {
      const { hw, hd, h } = shape;
      const b = boxCorners(hw, hd, z + 5);
      const t = boxCorners(hw, hd, z + h - 5);
      const sc = [mix(t.W, t.S, 0.14), mix(t.W, t.S, 0.86), mix(b.W, b.S, 0.86), mix(b.W, b.S, 0.14)];
      const centre = mix(mix(t.W, t.S, 0.5), mix(b.W, b.S, 0.5), 0.5);
      const k = 0.025 * G;
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          <polygon className="screen" points={pts(sc)} />
          <Decal name={icon} c={centre} u={{ x: k * 0.9, y: k * 0.45 }} v={{ x: 0, y: k * 0.95 }} className="decal on-screen" />
        </Box>
      );
    }
    case 'person': {
      const r = shape.hw * Math.SQRT2;
      const base = z + shape.h;
      const two = shape.figure === 2;
      return (
        <>
          <Cylinder r={r} z0={z} z1={base} />
          {two ? (
            <>
              <Figure x={14 * BK} base={base + 8} h={shape.figH ?? 48} scale={1.0 * BK} />
              <Figure x={-11 * BK} base={base - 2} h={shape.figH ?? 48} scale={1.12 * BK} />
            </>
          ) : (
            <Figure x={0} base={base} h={shape.figH ?? 48} scale={1.18 * BK} />
          )}
        </>
      );
    }
    case 'crowd': {
      // a group of people on one plinth: many users drawn as one block
      const { hw, hd, h } = shape;
      const base = z + h;
      const spots = [
        { x: -0.3, y: -0.3, s: 0.92 },
        { x: 0.3, y: -0.3, s: 0.92 },
        { x: -0.32, y: 0.26, s: 0.98 },
        { x: 0.26, y: 0.3, s: 0.98 },
        { x: 0, y: 0, s: 1.04 },
      ].sort((a, b) => a.x + a.y - (b.x + b.y));
      return (
        <>
          <Box hw={hw} hd={hd} z0={z} z1={base} />
          {spots.map((p, i) => {
            const q = project(p.x * hw * 1.25, p.y * hd * 1.25);
            return (
              <g key={i} transform={`translate(${q.x},${q.y})`}>
                <Figure x={0} base={base} h={shape.figH ?? 50} scale={0.82 * p.s * BK} />
              </g>
            );
          })}
        </>
      );
    }
    default: {
      const { hw, hd, h } = shape;
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          {topDecal(icon, z + h, 0.56)}
        </Box>
      );
    }
  }
}

const isRound = (s: Shape) => s.type === 'cylinder' || s.type === 'person' || s.type === 'token';
/** The colour family of a node: crowds are people unless the author says otherwise. */
const kindOf = (n: SceneNode) => n.kind ?? (n.shape === 'crowd' ? 'person' : 'neutral');

/** Soft shadow + status ring on the floor under a node. */
function FloorMark({ n, L, leaving, delay, fresh }: { n: SceneNode; L: NodeLayout; leaving: boolean; delay: number; fresh?: boolean }) {
  const s = L.shape;
  const sh = boxCorners(s.hw + 0.06, s.hd + 0.06, 0);
  const off = { x: 0.16 * G, y: 0.02 * G };
  const ring = boxCorners(s.hw + 0.14, s.hd + 0.14, 0);
  const round = isRound(s);
  const rr = Math.max(s.hw, s.hd) * Math.SQRT2 + 0.14;
  return (
    <g transform={`translate(${L.c.x},${L.c.y})`}>
      <g className={`iso-floor ${st(n.status)}${leaving ? ' leaving' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
        {round ? (
          <ellipse className="shadow" cx={off.x} cy={off.y} rx={(s.hw + 0.08) * 2 * G} ry={(s.hw + 0.08) * G} />
        ) : (
          <polygon className="shadow" points={pts([sh.N, sh.E, sh.S, sh.W].map((p) => add(p, off)))} />
        )}
        {round ? (
          <ellipse className="ring" rx={rr * Math.SQRT2 * G} ry={(rr / Math.SQRT2) * G} />
        ) : (
          <polygon className="ring" points={pts([ring.N, ring.E, ring.S, ring.W])} />
        )}
      </g>
      {fresh && !leaving && (
        <g className="fresh-mark" style={{ ['--d' as string]: `${delay}s` }} aria-hidden="true">
          {round ? (
            <ellipse className="fresh-ring" rx={(rr + 0.08) * Math.SQRT2 * G} ry={((rr + 0.08) / Math.SQRT2) * G} />
          ) : (
            <polygon className="fresh-ring" points={pts(Object.values(boxCorners(s.hw + 0.24, s.hd + 0.24, 0)).slice(0, 4))} />
          )}
        </g>
      )}
    </g>
  );
}

function NodeBlock({ n, L, lift, leaving, delay, tint }: { n: SceneNode; L: NodeLayout; lift: number; leaving: boolean; delay: number; tint?: string }) {
  return (
    <g transform={`translate(${L.c.x},${L.c.y})`} aria-hidden="true">
      <g
        className={`iso-node kind-${kindOf(n)} shape-${L.shape.type} ${st(n.status)}${tint ? ` zt-${tint}` : ''}${leaving ? ' leaving' : ''}`}
        style={{ ['--d' as string]: `${delay}s` }}
      >
        <g className="iso-node-in">
          <g className="iso-node-bob">
            <Block n={n} shape={L.shape} lift={lift} />
          </g>
        </g>
      </g>
    </g>
  );
}

function Badge({ status, x, y }: { status?: string; x: number; y: number }) {
  if (status !== 'ok' && status !== 'warn' && status !== 'error') return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <g className={`badge ${st(status)}`}>
        <circle r={11.5} />
        {status === 'ok' && <path d="M-4.8 0.4l3.2 3.2L5.2-3.8" />}
        {status === 'error' && <path d="M-3.8-3.8l7.6 7.6M3.8-3.8l-7.6 7.6" />}
        {status === 'warn' && <path d="M0-5.2v6M0 4.4v.2" />}
      </g>
    </g>
  );
}

/** The node's name, printed on a plate fixed to the block's front corner (no floating cards). */
function NamePlate({ n, L, leaving, delay, badge }: { n: SceneNode; L: NodeLayout; leaving: boolean; delay: number; badge: boolean }) {
  const c = L.plate;
  const pill = L.pillValue;
  return (
    <g
      className={`iso-plate kind-${kindOf(n)} ${st(n.status)}${leaving ? ' leaving' : ''}`}
      data-node={n.id}
      role="img"
      aria-label={`${n.label}${n.status && n.status !== 'normal' ? ` (${n.status})` : ''}${pill ? `, ${pill.text}` : ''}`}
      style={{ ['--d' as string]: `${delay}s` }}
    >
      <g transform={`translate(${c.x},${c.y})`}>
        <g className="iso-plate-in">
          <rect className="plate-lip" x={0} y={2.5} width={c.w} height={c.h} rx={7} />
          <rect className="plate-bg" width={c.w} height={c.h} rx={7} />
          <text className="plate-label" x={c.w / 2} y={c.h / 2 + 6.6} textAnchor="middle">
            {n.label}
          </text>
          {badge && <Badge status={n.status} x={c.w - 2} y={1} />}
        </g>
      </g>
    </g>
  );
}

/** The one pill a node may carry: a live value or state ("25%", "23 queued"), just above the block. */
function NodePill({ n, L, leaving, delay }: { n: SceneNode; L: NodeLayout; leaving: boolean; delay: number }) {
  const r = L.pill;
  const p = L.pillValue;
  if (!r || !p) return null;
  const P = ISO.pill;
  const hasGauge = typeof p.gauge === 'number' && Number.isFinite(p.gauge);
  let x = P.padX;
  const iconAt = x;
  if (p.icon) x += P.icon + 5;
  const gaugeAt = x;
  if (hasGauge) x += P.gauge + 7;
  const markup = p.icon ? ICONS[p.icon] : undefined;
  const g = hasGauge ? Math.max(0, Math.min(100, p.gauge!)) / 100 : 0;
  return (
    <g className={`iso-pill tone-${p.tone ?? 'neutral'} ${st(n.status)}${leaving ? ' leaving' : ''}`} data-node={n.id} style={{ ['--d' as string]: `${delay}s` }} aria-hidden="true">
      <g transform={`translate(${r.x},${r.y})`}>
        <g className="iso-pill-in">
          <rect className="pill-bg" width={r.w} height={r.h} rx={r.h / 2} />
          {markup && <g className="pill-icon" transform={`translate(${iconAt},${(r.h - P.icon) / 2}) scale(${P.icon / 24})`} dangerouslySetInnerHTML={{ __html: markup }} />}
          {hasGauge && (
            <>
              <rect className="pill-gauge-track" x={gaugeAt} y={r.h / 2 - 3.5} width={P.gauge} height={7} rx={3.5} />
              <rect className="pill-gauge" x={gaugeAt} y={r.h / 2 - 3.5} width={Math.max(7, P.gauge * g)} height={7} rx={3.5} />
            </>
          )}
          <text x={x} y={r.h / 2 + 4.6}>
            {p.text}
          </text>
        </g>
      </g>
    </g>
  );
}

// ------------------------------------------------------------------ packets
const MOVE = PACKET_MOVE; // share of the loop spent travelling (shared with the validator)

function PacketBody() {
  return (
    <>
      <circle className="pk-glow" r={14} />
      <circle className="pk-body" r={ISO.packet.r} />
      <circle className="pk-shine" cx={-2.4} cy={-2.6} r={2.3} />
    </>
  );
}

type Motion = PacketMotion;

function PacketView({ d, packet, reverse, begin, dur, sa, sb, still }: { d: string; packet: Packet; reverse: boolean; begin: number; dur: number; sa: number; sb: number; still?: Pt | null }) {
  const kind = packetKind(packet, reverse && packet.direction === 'both');
  if (still) {
    return (
      <g transform={`translate(${still.x},${still.y})`}>
        <g className={`packet pk-${kind}`}>
          <PacketBody />
        </g>
      </g>
    );
  }
  const a = sa.toFixed(4), b = sb.toFixed(4);
  return (
    <g className={`packet pk-${kind}`} opacity={0}>
      <PacketBody />
      <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} keyPoints={reverse ? `${b};${b};${a};${a}` : `${a};${a};${b};${b}`} keyTimes={`0;${MOVE.start};${MOVE.end};1`} calcMode="linear" />
      <animate attributeName="opacity" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.07;0.84;0.9;1" />
    </g>
  );
}

const edgePacket = (e: SceneEdge): Packet | null => (e.packet === true ? {} : e.packet && typeof e.packet === 'object' ? e.packet : null);

function EdgeLine({ e, g, leaving, delay, fresh }: { e: SceneEdge; g: EdgeGeom; leaving: boolean; delay: number; fresh?: boolean }) {
  return (
    <g className={`iso-edge ${st(e.status)} style-${e.style ?? 'solid'}${leaving ? ' leaving' : ''}${fresh && !leaving ? ' fresh' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
      <path className="edge-track" d={g.d} />
      {fresh && !leaving && <path className="edge-fresh" d={g.d} />}
      <path className="edge-line" d={g.d} />
      {g.heads.map((h, i) => (
        <path key={i} className="edge-head" d={h} />
      ))}
    </g>
  );
}

function EdgePackets({ e, g, reduced, m, delay }: { e: SceneEdge; g: EdgeGeom; reduced: boolean; m: Motion | null; delay: number }) {
  const packet = edgePacket(e);
  if (!packet || !m) return null;
  if (reduced) {
    const a = m.fwd !== null ? (g.stills ? g.stills.fwd : stillPacket(e, g, 'fwd')) : null;
    const b = m.back !== null ? (g.stills ? g.stills.back : stillPacket(e, g, 'back')) : null;
    return (
      <>
        {a && <PacketView d={g.d} packet={packet} reverse={false} begin={0} dur={m.dur} sa={0} sb={1} still={a.p} />}
        {b && <PacketView d={g.d} packet={packet} reverse begin={0} dur={m.dur} sa={0} sb={1} still={b.p} />}
      </>
    );
  }
  return (
    <g className="pk-in" data-edge={e.id} data-from={e.from} data-to={e.to} style={{ ['--d' as string]: `${delay}s` }}>
      {m.fwd !== null && <PacketView d={g.d} packet={packet} reverse={false} begin={m.fwd} dur={m.dur} sa={m.sa} sb={m.sb} />}
      {m.back !== null && <PacketView d={g.d} packet={packet} reverse begin={m.back} dur={m.dur} sa={m.sa} sb={m.sb} />}
    </g>
  );
}

/** Opacity keyframes that dim a label while its packet passes over it. */
function duckFrames(g: EdgeGeom, m: Motion): { values: string; keyTimes: string } | null {
  if (!g.duck || m.sb - m.sa < 0.01) return null;
  const la = g.sOf(g.duck.a), lb = g.sOf(g.duck.b);
  const span = MOVE.end - MOVE.start;
  const windows: [number, number][] = [];
  const addWin = (shift: number, reverse: boolean) => {
    const toT = (s: number) => MOVE.start + span * (reverse ? (m.sb - s) / (m.sb - m.sa) : (s - m.sa) / (m.sb - m.sa));
    let a = toT(reverse ? lb : la), b = toT(reverse ? la : lb);
    a = Math.max(MOVE.start, a);
    b = Math.min(MOVE.end + 0.02, b);
    if (b <= a) return;
    a = (a + shift) % 1;
    b = a + (b - (a - shift + (a < shift ? 1 : 0)) - 0);
    // split on wrap
    const len = b - a;
    if (a + len <= 1) windows.push([a, a + len]);
    else {
      windows.push([a, 1]);
      windows.push([0, a + len - 1]);
    }
  };
  if (m.fwd !== null) addWin(0, false);
  if (m.back !== null) addWin(m.fwd !== null ? (m.back - m.fwd) / m.dur : 0, true);
  if (!windows.length) return null;
  windows.sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1] + 0.04) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  const f = 0.035;
  const kt: number[] = [0];
  const vs: number[] = [1];
  const push = (t: number, v: number) => {
    t = Math.max(0, Math.min(1, t));
    if (t <= kt[kt.length - 1]) {
      vs[vs.length - 1] = v;
      return;
    }
    kt.push(t);
    vs.push(v);
  };
  for (const [a, b] of merged) {
    if (a > 0) push(a - f, 1);
    else vs[0] = 0.22;
    push(a, 0.22);
    push(b, 0.22);
    if (b < 1) push(b + f, 1);
  }
  if (kt[kt.length - 1] < 1) push(1, vs[0]);
  else vs[vs.length - 1] = vs[0];
  return { values: vs.map((v) => v.toFixed(2)).join(';'), keyTimes: kt.map((t) => t.toFixed(4)).join(';') };
}

function EdgeLabel({ e, g, leaving, delay, m, reduced }: { e: SceneEdge; g: EdgeGeom; leaving: boolean; delay: number; m: Motion | null; reduced: boolean }) {
  if (!g.label || !e.label) return null;
  const r = g.label;
  const duck = !reduced && !leaving && m ? duckFrames(g, m) : null;
  return (
    <g transform={`translate(${r.x},${r.y})`}>
      <g className={`iso-elabel ${st(e.status)}${leaving ? ' leaving' : ''}`} data-edge={e.id} style={{ ['--d' as string]: `${delay}s` }}>
        <g>
          {duck && <animate attributeName="opacity" dur={`${m!.dur}s`} begin={`${m!.fwd ?? m!.back}s`} repeatCount="indefinite" values={duck.values} keyTimes={duck.keyTimes} />}
          <rect width={r.w} height={r.h} rx={r.h / 2} />
          <text x={r.w / 2} y={r.h / 2 + 5} textAnchor="middle">
            {e.label}
          </text>
        </g>
      </g>
    </g>
  );
}

function ZonePlate({ z, poly, leaving, delay }: { z: SceneZone; poly: Pt[]; leaving: boolean; delay: number }) {
  const [N, E, S, W] = poly;
  const T = ISO.zone.thick;
  const down = (p: Pt) => ({ x: p.x, y: p.y + T });
  return (
    <g className={`iso-zone ${st(z.status)}${leaving ? ' leaving' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
      <polygon className="zone-side l" points={pts([W, S, down(S), down(W)])} />
      <polygon className="zone-side r" points={pts([S, E, down(E), down(S)])} />
      <polygon className="zone-top" points={pts([N, E, S, W])} />
      <polygon className="zone-rim" points={pts([N, E, S, W].map((p, i) => mix(p, [S, W, N, E][i], 0.035)))} />
    </g>
  );
}

function ZoneLabel({ z, r, leaving, delay }: { z: SceneZone; r: Rect | null; leaving: boolean; delay: number }) {
  if (!r || !z.label) return null;
  return (
    <g transform={`translate(${r.x},${r.y})`}>
      <g className={`iso-zlabel ${st(z.status)}${leaving ? ' leaving' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
        <rect width={r.w} height={r.h} rx={6} />
        <text x={ISO.zone.padX} y={16.4}>
          {z.label.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

function NoteBubble({ n, anchor, r, attached, leaving, delay }: { n: SceneNote; anchor: Pt; r: Rect; attached: boolean; leaving: boolean; delay: number }) {
  const cx = r.x + r.w / 2;
  const by = r.y + r.h;
  const tail = `M${cx - 8},${by - 0.5} L${anchor.x},${anchor.y - 5} L${cx + 6},${by - 0.5}`;
  return (
    <g className={`iso-note ${st(n.status)}${attached ? '' : ' sticker'}${leaving ? ' leaving' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
      {attached && <ellipse className="note-dot" cx={anchor.x} cy={anchor.y} rx={7} ry={3.5} />}
      <rect className="note-lip" x={r.x} y={r.y + 3} width={r.w} height={r.h} rx={attached ? 12 : 7} />
      {attached && <path className="note-tail" d={tail} />}
      <rect className="note-bg" x={r.x} y={r.y} width={r.w} height={r.h} rx={attached ? 12 : 7} />
      {!attached && <rect className="note-tab" x={cx - 16} y={r.y - 4} width={32} height={8} rx={2} />}
      <text x={cx} y={r.y + r.h / 2 + 5.4} textAnchor="middle">
        {n.text}
      </text>
    </g>
  );
}

// ------------------------------------------------------------------ legend
/** One legend under the diagram: what the packet colours mean (only kinds in this step), and line styles. */
function Legend({ scene }: { scene: ResolvedScene }) {
  const kinds = new Set<string>();
  const styles = new Set<string>();
  for (const e of scene.edges) {
    const p = edgePacket(e);
    if (p) {
      kinds.add(packetKind(p));
      if (p.direction === 'both') kinds.add(packetKind(p, true));
    }
    if (e.style && e.style !== 'solid') styles.add(e.style);
  }
  if (!kinds.size && !styles.size) return null;
  return (
    <ul className="scene-legend" aria-label="Diagram legend">
      {PACKET_KINDS.filter((k) => kinds.has(k)).map((k) => (
        <li key={k}>
          <span className={`lg-dot pk-${k}`} aria-hidden="true" />
          {(PACKET_MEANING as Record<string, string>)[k]}
        </li>
      ))}
      {styles.has('dashed') && (
        <li>
          <span className="lg-line dashed" aria-hidden="true" />
          optional / later
        </li>
      )}
      {styles.has('dotted') && (
        <li>
          <span className="lg-line dotted" aria-hidden="true" />
          background link
        </li>
      )}
    </ul>
  );
}

// ------------------------------------------------------------------ helpers for a step
/** Which nodes get a status badge: only statuses that changed in this step, and never a wall of them. */
function badgeSet(scene: ResolvedScene, prev?: ResolvedScene) {
  const before = new Map((prev?.nodes ?? []).map((n) => [n.id, n.status ?? 'normal']));
  const changed = scene.nodes.filter((n) => ['ok', 'warn', 'error'].includes(n.status ?? '') && before.get(n.id) !== n.status);
  if (changed.length > 3) return new Set(changed.filter((n) => n.status === 'error').slice(0, 2).map((n) => n.id));
  return new Set(changed.map((n) => n.id));
}

/** Nodes that are new or changed in this step (the mobile camera looks at them). */
function focusNodes(scene: ResolvedScene, prev?: ResolvedScene) {
  const before = new Map((prev?.nodes ?? []).map((n) => [n.id, n]));
  const changed = scene.nodes.filter((n) => {
    const b = before.get(n.id);
    return !b || b.status !== n.status || b.x !== n.x || b.y !== n.y || b.label !== n.label;
  });
  if (prev && changed.length && changed.length < scene.nodes.length) return changed;
  const marked = scene.nodes.filter((n) => n.status && n.status !== 'normal' && n.status !== 'dim');
  return marked.length ? marked : scene.nodes;
}

/**
 * What this step added or changed, compared with the step before: those blocks
 * and edges get a brief highlight (it matches the step's "What changed" list).
 */
function freshSets(scene: ResolvedScene, prev?: ResolvedScene) {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  if (!prev) return { nodes, edges };
  const pn = new Map(prev.nodes.map((n) => [n.id, n]));
  // a status going back to normal (or dim) is the spotlight moving on, not news
  const calm = (st?: string) => !st || st === 'normal' || st === 'dim';
  const key = (n: SceneNode) => JSON.stringify([n.label, n.pill ?? n.tags?.[0] ?? null, n.kind, n.icon, n.shape]);
  for (const n of scene.nodes) {
    const b = pn.get(n.id);
    if ((n.status ?? 'normal') === 'dim') continue;
    if (!b || key(b) !== key(n) || b.x !== n.x || b.y !== n.y || (b.status !== n.status && !calm(n.status))) nodes.add(n.id);
  }
  const pe = new Map(prev.edges.map((e) => [e.id, e]));
  const ek = (e: SceneEdge) => JSON.stringify([e.label ?? null, e.style ?? 'solid', e.packet ?? null, e.arrow ?? 'end']);
  for (const e of scene.edges) {
    const b = pe.get(e.id);
    if ((e.status ?? 'normal') === 'dim') continue;
    if (!b || ek(b) !== ek(e) || (b.status !== e.status && !calm(e.status))) edges.add(e.id);
  }
  return { nodes, edges };
}

/** Neutral blocks pick up a faint tint from the zone they stand in. */
function zoneTints(scene: ResolvedScene) {
  const m = new Map<string, string>();
  for (const n of scene.nodes) {
    if ((n.kind ?? 'neutral') !== 'neutral') continue;
    const z = scene.zones
      .filter((z) => n.x >= z.x && n.x <= z.x + z.w && n.y >= z.y && n.y <= z.y + z.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (z) m.set(n.id, z.status && z.status !== 'normal' ? z.status : 'plain');
  }
  return m;
}

// ------------------------------------------------------------------ main
type Frame = 'fill' | 'content';

export function SceneView({
  scene,
  prevScene,
  bounds,
  reduced,
  stepKey,
  legend = true,
  frame = 'content',
  controls = false,
  compact = false,
}: {
  scene?: ResolvedScene;
  prevScene?: ResolvedScene;
  bounds: Bounds;
  reduced: boolean;
  stepKey: number;
  legend?: boolean;
  /** fill: the diagram fills its panel and the camera frames each step. content: the panel takes the diagram's shape. */
  frame?: Frame;
  controls?: boolean;
  /** small static thumbnail */
  compact?: boolean;
}) {
  const empty = useMemo<ResolvedScene>(() => ({ nodes: [], edges: [], zones: [], notes: [] }), []);
  const s = scene ?? empty;
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [stageRef, size] = useSize<HTMLDivElement>();
  const narrow = size ? size.w < 560 : false;

  // reset playback on a new step
  useEffect(() => {
    setPaused(false);
    svgRef.current?.unpauseAnimations?.();
  }, [stepKey]);

  const stepBounds = useMemo(() => layoutBounds([s]) ?? bounds, [s, bounds]);
  const focusBounds = useMemo(() => {
    if (!narrow) return null;
    const f = focusNodes(s, prevScene);
    const ids = new Set(f.map((n) => n.id));
    const sub: ResolvedScene = { ...s, nodes: f, edges: s.edges.filter((e) => ids.has(e.from) && ids.has(e.to)), zones: [], notes: [] };
    return layoutBounds([sub]);
  }, [narrow, s, prevScene]);

  let target: Rect = bounds;
  const reserve = { top: controls ? 40 : 6, bottom: 4 };
  const fullView = frame === 'fill' && size ? fitView(stepBounds, size, ISO.minView, reserve) : null;
  if (fullView && size) {
    target = fullView;
    // on a phone, when the whole step would be too small to read, the camera
    // looks at what changed in this step (Expand shows everything)
    // (never smaller than MIN_PHONE_SCALE, so the names on the blocks stay readable)
    if (narrow && focusBounds && size.w / fullView.w < MIN_PHONE_SCALE) {
      const Hu = size.h - reserve.top - reserve.bottom;
      const f = fitView(focusBounds, size, { w: size.w / 0.7, h: Hu / 0.7 }, reserve);
      const k = Math.max(size.w / f.w, MIN_PHONE_SCALE);
      const cx = focusBounds.x + focusBounds.w / 2, cy = focusBounds.y + focusBounds.h / 2;
      target = { x: cx - size.w / (2 * k), y: cy - (reserve.top + Hu / 2) / k, w: size.w / k, h: size.h / k };
    }
  }
  const view = useCamera(target, reduced || frame !== 'fill');

  const content = (
    <SceneContent key={replay} s={s} prevScene={prevScene} reduced={reduced} view={view} />
  );

  const caption = s.caption;
  const describe = s.nodes.map((n) => n.label).join(', ');
  // zoomed in = part of this step's diagram is outside the view
  const zoomedIn = !!fullView && target !== fullView
    && (stepBounds.x < target.x - 1 || stepBounds.y < target.y - 1 || stepBounds.x + stepBounds.w > target.x + target.w + 1 || stepBounds.y + stepBounds.h > target.y + target.h + 1);

  const togglePause = () => {
    const el = svgRef.current;
    if (!el) return;
    if (paused) el.unpauseAnimations();
    else el.pauseAnimations();
    setPaused(!paused);
  };
  const doReplay = () => {
    setReplay((k) => k + 1);
    setPaused(false);
    requestAnimationFrame(() => {
      const el = svgRef.current;
      if (!el) return;
      el.setCurrentTime(0);
      el.unpauseAnimations();
    });
  };

  const svg = (
    <svg
      ref={svgRef}
      className="scene-svg"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={frame === 'content' ? { aspectRatio: `${bounds.w} / ${bounds.h}` } : undefined}
      role="img"
      aria-label={caption ? `${caption}. Shows: ${describe}` : `Diagram showing: ${describe}`}
    >
      {content}
    </svg>
  );

  if (frame === 'content') {
    return (
      <figure className={`scene scene-content${compact ? ' compact' : ''}${reduced ? ' still' : ''}`}>
        <div className="scene-stage" ref={stageRef}>
          {svg}
        </div>
        {legend && caption && (
          <div className="scene-foot">
            <figcaption className="scene-caption">{caption}</figcaption>
          </div>
        )}
      </figure>
    );
  }

  return (
    <figure className={`scene scene-fill${paused ? ' paused' : ''}${reduced ? ' still' : ''}${zoomedIn ? ' zoomed' : ''}`}>
      <div className="scene-panel">
        <div className="scene-stage" ref={stageRef}>
          {size && svg}
          {controls && (
            <div className="scene-tools">
              {narrow && (
                <button type="button" className="tool-btn" onClick={() => setExpanded(true)} aria-label="Open the diagram full screen">
                  <UiIcon name="expand" size={15} />
                  <span className="tool-text">{zoomedIn ? 'Whole diagram' : 'Expand'}</span>
                </button>
              )}
              {!reduced && (
                <>
                  <button type="button" className="tool-btn" onClick={doReplay} aria-label="Replay this step">
                    <UiIcon name="rotate-ccw" size={15} />
                    <span className="tool-text">Replay</span>
                  </button>
                  <button type="button" className="tool-btn" onClick={togglePause} aria-pressed={paused} aria-label={paused ? 'Play the animation' : 'Pause the animation'}>
                    <UiIcon name={paused ? 'play' : 'pause'} size={15} />
                    <span className="tool-text">{paused ? 'Play' : 'Pause'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {(legend || caption) && (
          <div className="scene-foot">
            {caption && <figcaption className="scene-caption">{caption}</figcaption>}
            {legend && <Legend scene={s} />}
          </div>
        )}
      </div>
      {expanded && <FullScreen s={s} prevScene={prevScene} reduced={reduced} b={stepBounds} focus={focusBounds} onClose={() => setExpanded(false)} caption={caption} />}
    </figure>
  );
}

/** Phone: the whole step at a readable size, in a pannable full-screen sheet. */
function FullScreen({ s, prevScene, reduced, b, focus, onClose, caption }: { s: ResolvedScene; prevScene?: ResolvedScene; reduced: boolean; b: Rect; focus: Rect | null; onClose: () => void; caption?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const k = 0.7;
  useEffect(() => {
    const el = scroller.current;
    if (el && focus) el.scrollTo({ left: (focus.x + focus.w / 2 - b.x) * k - el.clientWidth / 2, top: (focus.y + focus.h / 2 - b.y) * k - el.clientHeight / 2 });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b, focus, onClose]);
  return (
    <div className="scene-full" role="dialog" aria-modal="true" aria-label="Diagram, full screen">
      <div className="scene-full-bar">
        <span className="scene-full-hint">Drag to look around</span>
        <button type="button" className="tool-btn" onClick={onClose} autoFocus>
          <UiIcon name="x" size={15} />
          <span className="tool-text">Close</span>
        </button>
      </div>
      <div className="scene-full-scroll" ref={scroller}>
        <svg className="scene-svg" width={b.w * k} height={b.h * k} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} role="img" aria-label={caption ?? 'Diagram'}>
          <SceneContent s={s} prevScene={prevScene} reduced={reduced} view={b} />
        </svg>
      </div>
      {caption && <p className="scene-full-caption">{caption}</p>}
    </div>
  );
}

/** Everything inside the <svg>: floor, zones, blocks, edges, labels, cards, packets. */
function SceneContent({ s, prevScene, reduced, view }: { s: ResolvedScene; prevScene?: ResolvedScene; reduced: boolean; view: Rect }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (k: string) => `${k}-${uid}`;
  const nodes = usePresence(s.nodes, reduced);
  const edges = usePresence(s.edges, reduced);
  const zones = usePresence(s.zones, reduced);
  const notes = usePresence(s.notes, reduced);
  const delayOf = useEnterDelays(s, reduced);
  const poses = useTweenedPoses(s.nodes, reduced);
  const lastPose = useRef(new Map<string, Pose>());
  for (const [k, v] of poses) lastPose.current.set(k, v);
  const badges = useMemo(() => badgeSet(s, prevScene), [s, prevScene]);
  const tints = useMemo(() => zoneTints(s), [s]);
  const fresh = useMemo(() => freshSets(s, prevScene), [s, prevScene]);

  // layouts at the current (tweened) poses; the same code the validator runs
  const livePoses = new Map<string, Pose>();
  for (const n of s.nodes) {
    const p = poses.get(n.id) ?? lastPose.current.get(n.id);
    if (p) livePoses.set(n.id, p);
  }
  // the resting layout picks each edge's route and its packet timing; the live (tweened)
  // layout reuses those routes, so an edge keeps its shape while its nodes glide
  const rest = useMemo(() => sceneLayout(s), [s]);
  const routes = useMemo(() => new Map(rest.edges.map(({ e, g }) => [e.id, g.route])), [rest]);
  const lastRoutes = useRef(new Map<string, EdgeRoute>());
  for (const [k, v] of routes) lastRoutes.current.set(k, v);
  const live = sceneLayout(s, livePoses, routes);
  const layouts = new Map<string, NodeLayout>(live.nodes);
  for (const { item, leaving } of nodes) {
    if (!leaving || layouts.has(item.id)) continue;
    const p = lastPose.current.get(item.id);
    if (p) layouts.set(item.id, nodeLayout(item, p.x, p.y, p.lift));
  }
  const liveEdges = new Map(live.edges.map(({ e, g }) => [e.id, g]));
  const liveZones = new Map(live.zones.map((z) => [z.z.id, z]));
  const liveNotes = new Map(live.notes.map((n) => [n.n.id, n]));
  const nodeOrder = nodes
    .filter(({ item }) => layouts.has(item.id))
    .sort((a, b) => {
      const A = layouts.get(a.item.id)!, B = layouts.get(b.item.id)!;
      return A.depth - B.depth || A.x - B.x;
    });
  const zoneOrder = zones
    .map(({ item, leaving }) => {
      const L = (!leaving && liveZones.get(item.id)) || { z: item, ...zoneLayout(item) };
      return { item, leaving, L };
    })
    .sort((a, b) => a.L.depth - b.L.depth);

  // packet timing (start offsets that keep packets apart) comes from the resting layout
  const motions = useMemo(() => new Map(rest.edges.map(({ e, g }) => [e.id, g.motion ?? null])), [rest]);
  const edgeGeoms = edges.flatMap(({ item, leaving }) => {
    const g = !leaving ? liveEdges.get(item.id) : undefined;
    const geom = g ?? (() => {
      const A = layouts.get(item.from);
      const B = layouts.get(item.to);
      return A && B ? edgeLayout(item, A, B, lastRoutes.current.get(item.id)) : null;
    })();
    if (!geom) return [];
    return [{ item, leaving, g: geom, m: motions.get(item.id) ?? null }];
  });

  const origin = project(0, 0);
  const CYL = id('cyl');
  const HAZ = id('haz');

  return (
    <g className="scene-root">
      <defs>
        <pattern id={id('floor')} x={origin.x} y={origin.y} width={G * 2} height={G} patternUnits="userSpaceOnUse">
          <path className="floor-line" d={`M0,0 L${G * 2},${G} M0,${G} L${G * 2},0`} />
          <circle className="floor-dot" cx={0} cy={0} r={1.8} />
          <circle className="floor-dot" cx={G * 2} cy={0} r={1.8} />
          <circle className="floor-dot" cx={0} cy={G} r={1.8} />
          <circle className="floor-dot" cx={G * 2} cy={G} r={1.8} />
          <circle className="floor-dot" cx={G} cy={G / 2} r={1.8} />
        </pattern>
        <radialGradient id={id('fade')} cx="50%" cy="50%" r="60%">
          <stop offset="50%" stopColor="#fff" stopOpacity={1} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id={id('mask')}>
          <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={`url(#${id('fade')})`} />
        </mask>
        <linearGradient id={CYL} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0.24} />
          <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.58" stopColor="#000" stopOpacity={0.04} />
          <stop offset="1" stopColor="#000" stopOpacity={0.26} />
        </linearGradient>
        <pattern id={HAZ} width={11} height={11} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width={11} height={11} className="hz-a" />
          <rect width={5.5} height={11} className="hz-b" />
        </pattern>
      </defs>
      <rect className="floor" x={view.x} y={view.y} width={view.w} height={view.h} fill={`url(#${id('floor')})`} mask={`url(#${id('mask')})`} />
      <Paint.Provider value={{ cyl: CYL, haz: HAZ }}>
        <g className="layer-zones">
          {zoneOrder.map(({ item, leaving, L }) => (
            <ZonePlate key={item.id} z={item} poly={L.poly} leaving={leaving} delay={delayOf(item.id)} />
          ))}
        </g>
        <g className="layer-floor">
          {nodeOrder.map(({ item, leaving }) => (
            <FloorMark key={item.id} n={item} L={layouts.get(item.id)!} leaving={leaving} delay={delayOf(item.id)} fresh={!reduced && fresh.nodes.has(item.id)} />
          ))}
        </g>
        <g className="layer-edges">
          {edgeGeoms.map(({ item, leaving, g }) => (
            <EdgeLine key={item.id} e={item} g={g} leaving={leaving} delay={delayOf(item.id)} fresh={!reduced && fresh.edges.has(item.id)} />
          ))}
        </g>
        <g className="layer-blocks">
          {nodeOrder.map(({ item, leaving }) => {
            const p = poses.get(item.id) ?? lastPose.current.get(item.id);
            return <NodeBlock key={item.id} n={item} L={layouts.get(item.id)!} lift={p?.lift ?? 0} leaving={leaving} delay={delayOf(item.id)} tint={tints.get(item.id)} />;
          })}
        </g>
        <g className="layer-labels">
          {zoneOrder.map(({ item, leaving, L }) => (
            <ZoneLabel key={item.id} z={item} r={L.label} leaving={leaving} delay={delayOf(item.id)} />
          ))}
          {edgeGeoms.map(({ item, leaving, g, m }) => (
            <EdgeLabel key={item.id} e={item} g={g} leaving={leaving} delay={delayOf(item.id)} m={m} reduced={reduced} />
          ))}
        </g>
        <g className="layer-notes">
          {notes.map(({ item, leaving }) => {
            const L = liveNotes.get(item.id);
            if (!L && !leaving) return null;
            const anchor = L?.anchor ?? project(item.x, item.y);
            const r = L?.rect ?? { x: anchor.x - 60, y: anchor.y - 60, w: 120, h: ISO.note.h };
            return <NoteBubble key={item.id} n={item} anchor={anchor} r={r} attached={L?.attached ?? false} leaving={leaving} delay={delayOf(item.id)} />;
          })}
        </g>
        <g className="layer-cards">
          {nodeOrder.map(({ item, leaving }) => (
            <NamePlate key={item.id} n={item} L={layouts.get(item.id)!} leaving={leaving} delay={delayOf(item.id)} badge={!leaving && badges.has(item.id)} />
          ))}
        </g>
        <g className="layer-packets">
          {edgeGeoms.filter((x) => !x.leaving).map(({ item, g, m }) => (
            <EdgePackets key={item.id} e={item} g={g} reduced={reduced} m={m} delay={delayOf(item.id)} />
          ))}
        </g>
        <g className="layer-tags">
          {nodeOrder.map(({ item, leaving }) => (
            <NodePill key={item.id} n={item} L={layouts.get(item.id)!} leaving={leaving} delay={delayOf(item.id)} />
          ))}
        </g>
      </Paint.Provider>
    </g>
  );
}

