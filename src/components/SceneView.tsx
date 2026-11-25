import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ICONS } from '../../shared/schema.js';
import type { Packet, ResolvedScene, SceneEdge, SceneNode, SceneNote, SceneZone } from '../../shared/schema.js';
import {
  ISO, autoBends, boxCorners, edgeLayout, layoutBounds, nodeLayout, noteLayout, project, sceneLayout, stillPacket, zoneLayout,
} from '../../shared/iso.js';
import type { EdgeGeom, NodeLayout, Pt, Rect, Shape } from '../../shared/iso.js';

// Isometric scene renderer. The lesson grid (12 x 8) becomes an iso floor;
// nodes are extruded blocks whose shape depends on their kind, with an upright
// card above each block so text stays readable. Geometry lives in
// shared/iso.js so the validator checks exactly what is drawn here.

const TWEEN_MS = 640;
const G = ISO.G;

export type Bounds = Rect;
/** Bounding box of everything any step of the lesson shows, so the camera never jumps. */
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
    const t = setTimeout(() => setLeaving((old) => old.filter((o) => !gone.includes(o))), 420);
    return () => clearTimeout(t);
  }, [items, reduced]);
  const ids = new Set(items.map((i) => i.id));
  return [
    ...leaving.filter((l) => !ids.has(l.id)).map((item) => ({ item, leaving: true })),
    ...items.map((item) => ({ item, leaving: false })),
  ];
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
  const k = (size / 24) * G;
  return <Decal name={name} c={{ x: at.x, y: at.y - z }} u={{ x: k, y: k / 2 }} v={{ x: -k, y: k / 2 }} />;
};

/** Faces of a box (footprint hw x hd, from height z0 to z1). */
function Box({ hw, hd, z0, z1, top = true, children }: { hw: number; hd: number; z0: number; z1: number; top?: boolean; children?: ReactNode }) {
  const b = boxCorners(hw, hd, z0);
  const t = boxCorners(hw, hd, z1);
  return (
    <>
      <polygon className="f-left" points={pts([t.W, t.S, b.S, b.W])} />
      <polygon className="f-right" points={pts([t.S, t.E, b.E, b.S])} />
      {top && <polygon className="f-top" points={pts([t.N, t.E, t.S, t.W])} />}
      {children}
    </>
  );
}

/** Vertical cylinder of radius r (grid units) from z0 to z1. */
function Cylinder({ r, z0, z1, bands = 0 }: { r: number; z0: number; z1: number; bands?: number }) {
  const rx = r * Math.SQRT2 * G;
  const ry = (r / Math.SQRT2) * G;
  const side = `M${-rx},${-z1} L${-rx},${-z0} A${rx},${ry} 0 0 0 ${rx},${-z0} L${rx},${-z1} A${rx},${ry} 0 0 1 ${-rx},${-z1} Z`;
  const ring = (z: number) => `M${-rx},${-z} A${rx},${ry} 0 0 0 ${rx},${-z}`;
  return (
    <>
      <path className="f-left" d={side} />
      <path className="f-shade" d={side} fill="url(#iso-cyl-shade)" />
      {Array.from({ length: bands }, (_, i) => (
        <path key={i} className="f-band" d={ring(z0 + ((z1 - z0) * (i + 1)) / (bands + 1))} />
      ))}
      <ellipse className="f-top" cx={0} cy={-z1} rx={rx} ry={ry} />
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
  const body = `M${x - w},${y0 - 2} C${x - w},${top + 4} ${x - w * 0.55},${top} ${x},${top} C${x + w * 0.55},${top} ${x + w},${top + 4} ${x + w},${y0 - 2} Q${x},${y0 + w * 0.42} ${x - w},${y0 - 2} Z`;
  return (
    <g className="figure">
      <path className="f-left" d={body} />
      <path className="f-shade" d={body} fill="url(#iso-cyl-shade)" />
      <circle className="f-top head" cx={x} cy={top - headR + 1.5 * s} r={headR} />
      <path className="f-face" d={`M${x - 3.6 * s},${top - headR + 4.6 * s} Q${x},${top - headR + 7.4 * s} ${x + 3.6 * s},${top - headR + 4.6 * s}`} />
    </g>
  );
}

function Sparkle({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  const k = r * 0.3;
  const d = `M${x},${y - r} Q${x + k * 0.4},${y - k * 0.4} ${x + r},${y} Q${x + k * 0.4},${y + k * 0.4} ${x},${y + r} Q${x - k * 0.4},${y + k * 0.4} ${x - r},${y} Q${x - k * 0.4},${y - k * 0.4} ${x},${y - r} Z`;
  return <path className="sparkle" d={d} />;
}

/** The 3D block for one node, drawn around its floor centre (0,0). */
function Block({ n, shape, lift }: { n: SceneNode; shape: Shape; lift: number }) {
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
            return <ellipse key={k} className="led" cx={p.x} cy={p.y} rx={2.6} ry={2.2} />;
          })}
          {topDecal(icon, z + h, 0.52)}
        </Box>
      );
    }
    case 'cylinder': {
      const r = shape.r ?? 0.58;
      return (
        <>
          <Cylinder r={r} z0={z} z1={z + shape.h} bands={2} />
          {topDecal(icon, z + shape.h, 0.5)}
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
          {topDecal(icon, z + h + capH, 0.4)}
          <Sparkle x={capTop.E.x + 10} y={capTop.E.y - 16} />
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
          {topDecal(icon, z + h + lidH, 0.52)}
        </>
      );
    }
    case 'hazard': {
      const { hw, hd, h } = shape;
      const a = boxCorners(hw, hd, z + h - 11);
      const t = boxCorners(hw, hd, z + h);
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          <polygon className="hazard" points={pts([t.W, t.S, a.S, a.W])} fill="url(#iso-hazard)" />
          <polygon className="hazard" points={pts([t.S, t.E, a.E, a.S])} fill="url(#iso-hazard)" />
          <polygon className="f-edge" points={pts([t.W, t.S, a.S, a.W])} />
          <polygon className="f-edge" points={pts([t.S, t.E, a.E, a.S])} />
          {topDecal(icon, z + h, 0.5)}
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
      const kk = 0.023 * G;
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
      const k = 0.022 * G;
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
              <Figure x={12} base={base + 7} h={shape.figH ?? 48} scale={0.86} />
              <Figure x={-9} base={base - 2} h={shape.figH ?? 48} scale={0.96} />
            </>
          ) : (
            <Figure x={0} base={base} h={shape.figH ?? 48} />
          )}
        </>
      );
    }
    default: {
      const { hw, hd, h } = shape;
      return (
        <Box hw={hw} hd={hd} z0={z} z1={z + h}>
          {topDecal(icon, z + h, 0.52)}
        </Box>
      );
    }
  }
}

/** Soft shadow + status ring on the floor under a node. */
function FloorMark({ n, L, leaving, index }: { n: SceneNode; L: NodeLayout; leaving: boolean; index: number }) {
  const s = L.shape;
  const sh = boxCorners(s.hw + 0.06, s.hd + 0.06, 0);
  const off = { x: 0.16 * G, y: 0.02 * G };
  const ring = boxCorners(s.hw + 0.13, s.hd + 0.13, 0);
  const round = s.type === 'cylinder' || s.type === 'person';
  const rr = Math.max(s.hw, s.hd) * Math.SQRT2 + 0.13;
  return (
    <g className={`iso-floor ${st(n.status)}${leaving ? ' leaving' : ''}`} transform={`translate(${L.c.x},${L.c.y})`} style={{ ['--i' as string]: index }}>
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
  );
}

function NodeBlock({ n, L, lift, leaving, index }: { n: SceneNode; L: NodeLayout; lift: number; leaving: boolean; index: number }) {
  return (
    <g
      className={`iso-node kind-${n.kind ?? 'neutral'} shape-${L.shape.type} ${st(n.status)}${leaving ? ' leaving' : ''}`}
      transform={`translate(${L.c.x},${L.c.y})`}
      style={{ ['--i' as string]: index }}
      aria-hidden="true"
    >
      <g className="iso-node-in">
        <g className="iso-node-bob">
          <Block n={n} shape={L.shape} lift={lift} />
        </g>
      </g>
    </g>
  );
}

function Badge({ status, x, y }: { status?: string; x: number; y: number }) {
  if (status !== 'ok' && status !== 'warn' && status !== 'error') return null;
  return (
    <g className={`badge ${st(status)}`} transform={`translate(${x},${y})`}>
      <circle r={11} />
      {status === 'ok' && <path d="M-4.8 0.4l3.2 3.2L5.2-3.8" />}
      {status === 'error' && <path d="M-3.8-3.8l7.6 7.6M3.8-3.8l-7.6 7.6" />}
      {status === 'warn' && <path d="M0-5.2v6M0 4.4v.2" />}
    </g>
  );
}

function NodeCard({ n, L, leaving, index }: { n: SceneNode; L: NodeLayout; leaving: boolean; index: number }) {
  const c = L.card;
  const T = ISO.card;
  const cx = c.w / 2;
  const tail = `M${cx - 7},${c.h - 1.2} L${cx},${c.h + T.tail} L${cx + 7},${c.h - 1.2}`;
  return (
    <g
      className={`iso-card kind-${n.kind ?? 'neutral'} ${st(n.status)}${leaving ? ' leaving' : ''}`}
      role="img"
      aria-label={`${n.label}${n.sublabel ? `, ${n.sublabel}` : ''}${n.status && n.status !== 'normal' ? ` (${n.status})` : ''}${n.tags?.length ? `. Tags: ${n.tags.join(', ')}` : ''}`}
      style={{ ['--i' as string]: index }}
    >
      <g className="iso-card-in" transform={`translate(${c.x},${c.y})`}>
        <rect className="card-lip" x={0} y={3} width={c.w} height={c.h} rx={9} />
        <rect className="card-bg" width={c.w} height={c.h} rx={9} />
        <path className="card-tail" d={tail} />
        <text className="card-label" x={T.padX} y={n.sublabel ? 25 : 24.5}>
          {n.label}
        </text>
        {n.sublabel && (
          <text className="card-sub" x={T.padX} y={44}>
            {n.sublabel}
          </text>
        )}
        <Badge status={n.status} x={c.w - 3} y={2} />
      </g>
      {L.tags.map((r, i) => (
        <g key={i} className="iso-tag" transform={`translate(${r.x},${r.y})`}>
          <rect width={r.w} height={r.h} rx={6} />
          <text x={r.w / 2} y={15.3} textAnchor="middle">
            {n.tags![i]}
          </text>
        </g>
      ))}
    </g>
  );
}

const SPEED = { slow: 3.4, normal: 2.3, fast: 1.35 } as const;

function PacketBody({ packet }: { packet: Packet }) {
  if (packet.label) {
    const w = Math.ceil(packet.label.length * ISO.packet.size * 0.6 + ISO.packet.padX * 2);
    return (
      <>
        <rect className="pk-glow" x={-w / 2 - 5} y={-ISO.packet.h / 2 - 5} width={w + 10} height={ISO.packet.h + 10} rx={16} />
        <rect className="pk-body" x={-w / 2} y={-ISO.packet.h / 2} width={w} height={ISO.packet.h} rx={ISO.packet.h / 2} />
        <text y={4.4} textAnchor="middle">
          {packet.label}
        </text>
      </>
    );
  }
  return (
    <>
      <circle className="pk-glow" r={12} />
      <circle className="pk-body" r={ISO.packet.r} />
      <circle className="pk-shine" cx={-2} cy={-2.2} r={2} />
    </>
  );
}

function PacketView({ d, packet, reverse, delay, still }: { d: string; packet: Packet; reverse: boolean; delay: number; still?: Pt | null }) {
  const dur = SPEED[packet.speed ?? 'normal'];
  if (still) {
    return (
      <g className={`packet ${st(packet.status)}`} transform={`translate(${still.x},${still.y})`}>
        <PacketBody packet={packet} />
      </g>
    );
  }
  return (
    <g className={`packet ${st(packet.status)}`} opacity={0}>
      <PacketBody packet={packet} />
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={d} keyPoints={reverse ? '1;1;0;0' : '0;0;1;1'} keyTimes="0;0.06;0.88;1" calcMode="linear" />
      <animate attributeName="opacity" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.07;0.84;0.9;1" />
    </g>
  );
}

const edgePacket = (e: SceneEdge): Packet | null => (e.packet === true ? {} : e.packet && typeof e.packet === 'object' ? e.packet : null);

function EdgeLine({ e, g, leaving }: { e: SceneEdge; g: EdgeGeom; leaving: boolean }) {
  return (
    <g className={`iso-edge ${st(e.status)} style-${e.style ?? 'solid'}${leaving ? ' leaving' : ''}`}>
      <path className="edge-track" d={g.d} />
      <path className="edge-line" d={g.d} />
      {g.heads.map((h, i) => (
        <path key={i} className="edge-head" d={h} />
      ))}
    </g>
  );
}

function EdgePackets({ e, g, reduced }: { e: SceneEdge; g: EdgeGeom; reduced: boolean }) {
  const packet = edgePacket(e);
  if (!packet) return null;
  const dir = packet.direction ?? 'forward';
  const fwd = dir === 'forward' || dir === 'both';
  const back = dir === 'backward' || dir === 'both';
  if (reduced) {
    const a = fwd ? (g.stills ? g.stills.fwd : stillPacket(e, g, 'fwd')) : null;
    const b = back ? (g.stills ? g.stills.back : stillPacket(e, g, 'back')) : null;
    return (
      <>
        {a && <PacketView d={g.d} packet={packet} reverse={false} delay={0} still={a.p} />}
        {b && <PacketView d={g.d} packet={packet} reverse delay={0} still={b.p} />}
      </>
    );
  }
  return (
    <>
      {fwd && <PacketView d={g.d} packet={packet} reverse={false} delay={0} />}
      {back && <PacketView d={g.d} packet={packet} reverse delay={dir === 'both' ? SPEED[packet.speed ?? 'normal'] / 2 : 0} />}
    </>
  );
}

function EdgeLabel({ e, g, leaving }: { e: SceneEdge; g: EdgeGeom; leaving: boolean }) {
  if (!g.label || !e.label) return null;
  const r = g.label;
  return (
    <g className={`iso-elabel ${st(e.status)}${leaving ? ' leaving' : ''}`} transform={`translate(${r.x},${r.y})`}>
      <rect width={r.w} height={r.h} rx={r.h / 2} />
      <text x={r.w / 2} y={r.h / 2 + 4.6} textAnchor="middle">
        {e.label}
      </text>
    </g>
  );
}

function ZonePlate({ z, leaving }: { z: SceneZone; leaving: boolean }) {
  const L = zoneLayout(z);
  const [N, E, S, W] = L.poly;
  const T = ISO.zone.thick;
  const down = (p: Pt) => ({ x: p.x, y: p.y + T });
  return (
    <g className={`iso-zone ${st(z.status)}${leaving ? ' leaving' : ''}`}>
      <polygon className="zone-side l" points={pts([W, S, down(S), down(W)])} />
      <polygon className="zone-side r" points={pts([S, E, down(E), down(S)])} />
      <polygon className="zone-top" points={pts([N, E, S, W])} />
      <polygon className="zone-rim" points={pts([N, E, S, W].map((p, i) => mix(p, [S, W, N, E][i], 0.035)))} />
    </g>
  );
}

function ZoneLabel({ z, r, leaving }: { z: SceneZone; r: Rect | null; leaving: boolean }) {
  if (!r || !z.label) return null;
  return (
    <g className={`iso-zlabel ${st(z.status)}${leaving ? ' leaving' : ''}`} transform={`translate(${r.x},${r.y})`}>
      <rect width={r.w} height={r.h} rx={5} />
      <text x={ISO.zone.padX} y={15.2}>
        {z.label.toUpperCase()}
      </text>
    </g>
  );
}

function NoteBubble({ n, leaving }: { n: SceneNote; leaving: boolean }) {
  const L = noteLayout(n);
  const r = L.rect;
  const cx = r.x + r.w / 2;
  const by = r.y + r.h;
  const tail = `M${cx - 8},${by - 0.5} L${L.anchor.x},${L.anchor.y - 5} L${cx + 6},${by - 0.5}`;
  return (
    <g className={`iso-note ${st(n.status)}${leaving ? ' leaving' : ''}`}>
      <ellipse className="note-dot" cx={L.anchor.x} cy={L.anchor.y} rx={7} ry={3.5} />
      <rect className="note-lip" x={r.x} y={r.y + 3} width={r.w} height={r.h} rx={12} />
      <path className="note-tail" d={tail} />
      <rect className="note-bg" x={r.x} y={r.y} width={r.w} height={r.h} rx={12} />
      <text x={cx} y={r.y + r.h / 2 + 5.3} textAnchor="middle">
        {n.text}
      </text>
    </g>
  );
}

// ------------------------------------------------------------------ legend
const PACKET_MEANING: Record<string, string> = {
  normal: 'data moving',
  active: 'in focus',
  ok: 'allowed / success',
  warn: 'slow or at risk',
  error: 'blocked / failed',
  dim: 'idle',
};

function Legend({ scene }: { scene: ResolvedScene }) {
  const packets = new Set<string>();
  const styles = new Set<string>();
  for (const e of scene.edges) {
    const p = edgePacket(e);
    if (p) packets.add(p.status ?? 'normal');
    if (e.style && e.style !== 'solid') styles.add(e.style);
  }
  if (!packets.size && !styles.size) return null;
  const order = ['normal', 'active', 'ok', 'warn', 'error', 'dim'];
  return (
    <ul className="scene-legend" aria-label="Diagram legend">
      {order.filter((k) => packets.has(k)).map((k) => (
        <li key={k}>
          <span className={`lg-dot ${st(k)}`} aria-hidden="true" />
          {PACKET_MEANING[k]}
        </li>
      ))}
      {styles.has('dashed') && (
        <li>
          <span className="lg-line dashed" aria-hidden="true" />
          optional / async
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

// ------------------------------------------------------------------ main
export function SceneView({ scene, bounds, reduced, stepKey, legend = true }: { scene?: ResolvedScene; bounds: Bounds; reduced: boolean; stepKey: number; legend?: boolean }) {
  const empty = useMemo<ResolvedScene>(() => ({ nodes: [], edges: [], zones: [], notes: [] }), []);
  const s = scene ?? empty;
  const nodes = usePresence(s.nodes, reduced);
  const edges = usePresence(s.edges, reduced);
  const zones = usePresence(s.zones, reduced);
  const notes = usePresence(s.notes, reduced);
  const poses = useTweenedPoses(s.nodes, reduced);
  const lastPose = useRef(new Map<string, Pose>());
  for (const [k, v] of poses) lastPose.current.set(k, v);
  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ l: false, r: false });
  const [swiped, setSwiped] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setFade({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const onTouch = () => setSwiped(true);
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('pointerdown', onTouch);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('pointerdown', onTouch);
      window.removeEventListener('resize', update);
    };
  }, []);

  const bends = useMemo(() => autoBends(s.edges), [s.edges]);

  // layouts at the current (tweened) poses; the same code the validator runs
  const livePoses = new Map<string, Pose>();
  for (const n of s.nodes) {
    const p = poses.get(n.id) ?? lastPose.current.get(n.id);
    if (p) livePoses.set(n.id, p);
  }
  const live = sceneLayout(s, livePoses);
  const layouts = new Map<string, NodeLayout>(live.nodes);
  for (const { item, leaving } of nodes) {
    if (!leaving || layouts.has(item.id)) continue;
    const p = lastPose.current.get(item.id);
    if (p) layouts.set(item.id, nodeLayout(item, p.x, p.y, p.lift));
  }
  const liveEdges = new Map(live.edges.map(({ e, g }) => [e.id, g]));
  const zoneLabels = new Map<string, Rect | null>(live.zones.map((z) => [z.z.id, z.label]));
  const nodeOrder = nodes
    .filter(({ item }) => layouts.has(item.id))
    .sort((a, b) => {
      const A = layouts.get(a.item.id)!, B = layouts.get(b.item.id)!;
      return A.depth - B.depth || A.x - B.x;
    });
  const indexOf = new Map(s.nodes.map((n, i) => [n.id, i]));

  const edgeGeoms = edges.flatMap(({ item, leaving }) => {
    const g = !leaving ? liveEdges.get(item.id) : undefined;
    if (g) return [{ item, leaving, g }];
    const A = layouts.get(item.from);
    const B = layouts.get(item.to);
    if (!A || !B) return [];
    return [{ item, leaving, g: edgeLayout(item, A, B, item.bend ?? bends.get(item.id) ?? 0) }];
  });

  // On narrow screens the diagram scrolls sideways: keep the action in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;
    const focus = s.nodes.filter((n) => n.status && n.status !== 'normal' && n.status !== 'dim');
    const list = focus.length ? focus : s.nodes;
    if (!list.length) return;
    const xs = list.flatMap((n) => {
      const L = nodeLayout(n);
      return [L.card.x, L.card.x + L.card.w];
    });
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const k = el.scrollWidth / bounds.w;
    const span = (hi - lo) * k;
    const left = span <= el.clientWidth - 24 ? ((lo + hi) / 2 - bounds.x) * k - el.clientWidth / 2 : (lo - bounds.x) * k - 12;
    el.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }, [stepKey, s.nodes, bounds, reduced]);

  const caption = s.caption;
  const describe = s.nodes.map((n) => n.label).join(', ');
  const origin = project(0, 0);

  return (
    <figure className={`scene${fade.l ? ' fade-l' : ''}${fade.r ? ' fade-r' : ''}${reduced ? ' still' : ''}`}>
      {(fade.l || fade.r) && !swiped && (
        <span className="swipe-hint" aria-hidden="true">
          Swipe to explore
        </span>
      )}
      <div className="scene-scroll" ref={scroller}>
        <svg
          className="scene-svg"
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          style={{ aspectRatio: `${bounds.w} / ${bounds.h}`, ['--vbw' as string]: bounds.w }}
          role="img"
          aria-label={caption ? `${caption}. Shows: ${describe}` : `Diagram showing: ${describe}`}
        >
          <defs>
            <pattern id="iso-floor" x={origin.x} y={origin.y} width={G * 2} height={G} patternUnits="userSpaceOnUse">
              <path className="floor-line" d={`M0,0 L${G * 2},${G} M0,${G} L${G * 2},0`} />
              <circle className="floor-dot" cx={0} cy={0} r={1.7} />
              <circle className="floor-dot" cx={G * 2} cy={0} r={1.7} />
              <circle className="floor-dot" cx={0} cy={G} r={1.7} />
              <circle className="floor-dot" cx={G * 2} cy={G} r={1.7} />
              <circle className="floor-dot" cx={G} cy={G / 2} r={1.7} />
            </pattern>
            <radialGradient id="iso-floor-fade" cx="50%" cy="50%" r="62%">
              <stop offset="55%" stopColor="#fff" stopOpacity={1} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            <mask id="iso-floor-mask">
              <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#iso-floor-fade)" />
            </mask>
            <linearGradient id="iso-cyl-shade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
              <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
              <stop offset="0.58" stopColor="#000" stopOpacity={0.04} />
              <stop offset="1" stopColor="#000" stopOpacity={0.26} />
            </linearGradient>
            <pattern id="iso-hazard" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
              <rect width={10} height={10} className="hz-a" />
              <rect width={5} height={10} className="hz-b" />
            </pattern>
          </defs>
          <rect className="floor" x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#iso-floor)" mask="url(#iso-floor-mask)" />
          <g className="layer-zones">
            {zones.map(({ item, leaving }) => (
              <ZonePlate key={item.id} z={item} leaving={leaving} />
            ))}
          </g>
          <g className="layer-floor">
            {nodeOrder.map(({ item, leaving }) => (
              <FloorMark key={item.id} n={item} L={layouts.get(item.id)!} leaving={leaving} index={indexOf.get(item.id) ?? 0} />
            ))}
          </g>
          <g className="layer-edges">
            {edgeGeoms.map(({ item, leaving, g }) => (
              <EdgeLine key={item.id} e={item} g={g} leaving={leaving} />
            ))}
          </g>
          <g className="layer-packets">
            {edgeGeoms.filter((x) => !x.leaving).map(({ item, g }) => (
              <EdgePackets key={item.id} e={item} g={g} reduced={reduced} />
            ))}
          </g>
          <g className="layer-blocks">
            {nodeOrder.map(({ item, leaving }) => {
              const p = poses.get(item.id) ?? lastPose.current.get(item.id);
              return <NodeBlock key={item.id} n={item} L={layouts.get(item.id)!} lift={p?.lift ?? 0} leaving={leaving} index={indexOf.get(item.id) ?? 0} />;
            })}
          </g>
          <g className="layer-labels">
            {zones.map(({ item, leaving }) => (
              <ZoneLabel key={item.id} z={item} r={(!leaving && zoneLabels.get(item.id)) || zoneLayout(item).label} leaving={leaving} />
            ))}
            {edgeGeoms.map(({ item, leaving, g }) => (
              <EdgeLabel key={item.id} e={item} g={g} leaving={leaving} />
            ))}
          </g>
          <g className="layer-notes">
            {notes.map(({ item, leaving }) => (
              <NoteBubble key={item.id} n={item} leaving={leaving} />
            ))}
          </g>
          <g className="layer-cards">
            {nodeOrder.map(({ item, leaving }) => (
              <NodeCard key={item.id} n={item} L={layouts.get(item.id)!} leaving={leaving} index={indexOf.get(item.id) ?? 0} />
            ))}
          </g>
        </svg>
      </div>
      {(legend || caption) && (
        <div className="scene-foot">
          {caption && <figcaption className="scene-caption">{caption}</figcaption>}
          {legend && <Legend scene={s} />}
        </div>
      )}
    </figure>
  );
}
