import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GRID, ICONS, NODE_H, nodeWidth } from '../../shared/schema.js';
import type { ResolvedScene, SceneEdge, SceneNode, SceneNote, SceneZone, Packet } from '../../shared/schema.js';

const U = GRID.unit;
const H = NODE_H * U;
const TWEEN_MS = 620;

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const tagWidth = (t: string) => t.length * 8.4 + 18;
const noteWidth = (t: string) => t.length * 9.6 + 8;

/** Bounding box (px) of everything any step of the lesson shows, so the view never jumps. */
export function sceneBounds(scenes: (ResolvedScene | undefined)[]): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (a: number, b: number, c: number, d: number) => {
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  };
  for (const s of scenes) {
    if (!s) continue;
    for (const n of s.nodes) {
      const w = nodeWidth(n) * U;
      const tags = n.tags?.length ? 44 : 0;
      const tw = n.tags ? n.tags.reduce((a, t) => a + tagWidth(t) + 6, 0) : 0;
      const half = Math.max(w, tw) / 2;
      add(n.x * U - half, n.y * U - H / 2 - 14, n.x * U + half, n.y * U + H / 2 + tags);
    }
    for (const z of s.zones) add(z.x * U, z.y * U, (z.x + z.w) * U, (z.y + z.h) * U);
    for (const n of s.notes) add(n.x * U - noteWidth(n.text) / 2, n.y * U - 16, n.x * U + noteWidth(n.text) / 2, n.y * U + 12);
  }
  if (!Number.isFinite(x0)) return null;
  const pad = 28;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

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
    const t = setTimeout(() => setLeaving((old) => old.filter((o) => !gone.includes(o))), 380);
    return () => clearTimeout(t);
  }, [items, reduced]);
  const ids = new Set(items.map((i) => i.id));
  return [
    ...leaving.filter((l) => !ids.has(l.id)).map((item) => ({ item, leaving: true })),
    ...items.map((item) => ({ item, leaving: false })),
  ];
}

// ------------------------------------------------------------------ tween
type Pos = { x: number; y: number; w: number; tb?: number };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function useTweenedPositions(nodes: SceneNode[], reduced: boolean): Map<string, Pos> {
  const target = useMemo(() => {
    const m = new Map<string, Pos>();
    for (const n of nodes) m.set(n.id, { x: n.x * U, y: n.y * U, w: nodeWidth(n) * U, tb: n.tags?.length ? 36 : 0 });
    return m;
  }, [nodes]);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const moving = [...target].some(([id, p]) => {
      const f = from.get(id);
      return f && (f.x !== p.x || f.y !== p.y || f.w !== p.w);
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
        next.set(id, { x: f.x + (p.x - f.x) * k, y: f.y + (p.y - f.y) * k, w: f.w + (p.w - f.w) * k, tb: p.tb });
      }
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}

// ------------------------------------------------------------------ geometry
function clipToBox(cx: number, cy: number, w: number, tx: number, ty: number, margin = 8, tagsBelow = 0) {
  const hw = w / 2 + margin;
  const dx = tx - cx;
  const dy = ty - cy;
  // edges leaving through the bottom also clear the tag chips under the node
  const hh = H / 2 + margin + (dy > 0 ? tagsBelow : 0);
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

interface EdgeGeom {
  d: string;
  mid: { x: number; y: number };
  at: (t: number) => { x: number; y: number };
}

function edgeGeometry(a: Pos, b: Pos, bend: number): EdgeGeom {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (a.x + b.x) / 2 + nx * bend * U;
  const my = (a.y + b.y) / 2 + ny * bend * U;
  if (Math.abs(bend) < 0.001) {
    const s = clipToBox(a.x, a.y, a.w, b.x, b.y, 8, a.tb);
    const e = clipToBox(b.x, b.y, b.w, a.x, a.y, 12, b.tb);
    const at = (t: number) => ({ x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t });
    return { d: `M${s.x},${s.y} L${e.x},${e.y}`, mid: at(0.5), at };
  }
  // quadratic curve: control point so that the curve passes through (mx,my)
  const cx = 2 * mx - (a.x + b.x) / 2;
  const cy = 2 * my - (a.y + b.y) / 2;
  const s = clipToBox(a.x, a.y, a.w, cx, cy, 8, a.tb);
  const e = clipToBox(b.x, b.y, b.w, cx, cy, 12, b.tb);
  const mid = { x: 0.25 * s.x + 0.5 * cx + 0.25 * e.x, y: 0.25 * s.y + 0.5 * cy + 0.25 * e.y };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * s.x + 2 * (1 - t) * t * cx + t * t * e.x,
    y: (1 - t) * (1 - t) * s.y + 2 * (1 - t) * t * cy + t * t * e.y,
  });
  return { d: `M${s.x},${s.y} Q${cx},${cy} ${e.x},${e.y}`, mid, at };
}

// ------------------------------------------------------------------ pieces
const st = (s?: string) => `st-${s ?? 'normal'}`;

function Icon({ name, x, y, size = 24 }: { name: string; x: number; y: number; size?: number }) {
  const markup = ICONS[name];
  if (!markup) return null;
  const k = size / 24;
  return (
    <g
      className="scene-icon"
      transform={`translate(${x},${y}) scale(${k})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function Badge({ status, x, y }: { status?: string; x: number; y: number }) {
  if (status !== 'ok' && status !== 'warn' && status !== 'error') return null;
  return (
    <g className={`badge ${st(status)}`} transform={`translate(${x},${y})`}>
      <circle r={12} />
      {status === 'ok' && <path d="M-5 0.5l3.2 3.2L5.5-4" />}
      {status === 'error' && <path d="M-4-4l8 8M4-4l-8 8" />}
      {status === 'warn' && <path d="M0-5.5v6.5M0 4.6v.1" />}
    </g>
  );
}

function NodeView({ n, p, leaving }: { n: SceneNode; p: Pos; leaving: boolean }) {
  const w = p.w;
  const hasIcon = !!n.icon && !!ICONS[n.icon];
  const textX = -w / 2 + (hasIcon ? 58 : 18);
  let tx = 0;
  const tagsW = (n.tags ?? []).reduce((a, t) => a + tagWidth(t) + 6, -6);
  return (
    <g
      className={`node kind-${n.kind ?? 'neutral'} ${st(n.status)}${leaving ? ' leaving' : ''}`}
      transform={`translate(${p.x},${p.y})`}
      role="img"
      aria-label={`${n.label}${n.sublabel ? `, ${n.sublabel}` : ''}${n.status && n.status !== 'normal' ? ` (${n.status})` : ''}${n.tags?.length ? `. Tags: ${n.tags.join(', ')}` : ''}`}
    >
      <g className="node-inner">
        <rect className="node-halo" x={-w / 2 - 7} y={-H / 2 - 7} width={w + 14} height={H + 14} rx={20} />
        <rect className="node-box" x={-w / 2} y={-H / 2} width={w} height={H} rx={14} />
        {hasIcon && (
          <>
            <rect className="node-icon-bg" x={-w / 2 + 12} y={-18} width={36} height={36} rx={10} />
            <g className="node-icon">
              <Icon name={n.icon!} x={-w / 2 + 18} y={-12} size={24} />
            </g>
          </>
        )}
        <text className="node-label" x={textX} y={n.sublabel ? -2 : 7.5}>
          {n.label}
        </text>
        {n.sublabel && (
          <text className="node-sub" x={textX} y={19}>
            {n.sublabel}
          </text>
        )}
        <Badge status={n.status} x={w / 2 - 3} y={-H / 2 + 3} />
        {n.tags && n.tags.length > 0 && (
          <g className="node-tags" transform={`translate(${-tagsW / 2},${H / 2 + 10})`}>
            {n.tags.map((t) => {
              const tw = tagWidth(t);
              const g = (
                <g key={t} transform={`translate(${tx},0)`}>
                  <rect width={tw} height={26} rx={7} />
                  <text x={tw / 2} y={17.6} textAnchor="middle">
                    {t}
                  </text>
                </g>
              );
              tx += tw + 6;
              return g;
            })}
          </g>
        )}
      </g>
    </g>
  );
}

const SPEED = { slow: 3.2, normal: 2.2, fast: 1.3 } as const;

function PacketView({ d, packet, reverse, delay, reduced, still }: { d: string; packet: Packet; reverse: boolean; delay: number; reduced: boolean; still: { x: number; y: number } }) {
  const label = packet.label;
  const w = label ? label.length * 8.8 + 24 : 0;
  const dur = SPEED[packet.speed ?? 'normal'];
  const body = label ? (
    <>
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} />
      <text y={5.5} textAnchor="middle">
        {label}
      </text>
    </>
  ) : (
    <circle r={9} />
  );
  if (reduced) {
    return (
      <g className={`packet ${st(packet.status)}`} transform={`translate(${still.x},${still.y})`}>
        {body}
      </g>
    );
  }
  return (
    <g className={`packet ${st(packet.status)}`} opacity={0}>
      {body}
      <animateMotion
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        path={d}
        keyPoints={reverse ? '1;1;0;0' : '0;0;1;1'}
        keyTimes="0;0.08;0.85;1"
        calcMode="linear"
      />
      <animate attributeName="opacity" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.08;0.8;0.88;1" />
    </g>
  );
}

function EdgeView({ e, g, leaving, reduced, part }: { e: SceneEdge; g: EdgeGeom; leaving: boolean; reduced: boolean; part: 'line' | 'label' | 'packets' }) {
  const arrow = e.arrow ?? 'end';
  const status = e.status ?? 'normal';
  const marker = `url(#arrow-${status})`;
  const packet: Packet | null = e.packet === true ? {} : e.packet && typeof e.packet === 'object' ? e.packet : null;
  const dir = packet?.direction ?? 'forward';
  const lw = e.label ? e.label.length * 8.4 + 22 : 0;
  return (
    <g className={`edge ${st(status)} style-${e.style ?? 'solid'}${leaving ? ' leaving' : ''}`}>
      {part === 'line' && <path
        className="edge-line"
        d={g.d}
        markerEnd={arrow === 'end' || arrow === 'both' ? marker : undefined}
        markerStart={arrow === 'start' || arrow === 'both' ? marker : undefined}
      />}
      {part === 'label' && e.label && (
        <g className="edge-label" transform={`translate(${g.mid.x},${g.mid.y})`}>
          <rect x={-lw / 2} y={-14} width={lw} height={28} rx={8} />
          <text y={5.5} textAnchor="middle">
            {e.label}
          </text>
        </g>
      )}
      {part === 'packets' && packet && !leaving && (
        <>
          {(dir === 'forward' || dir === 'both') && <PacketView d={g.d} packet={packet} reverse={false} delay={0} reduced={reduced} still={g.at(e.label ? 0.22 : 0.5)} />}
          {(dir === 'backward' || dir === 'both') && (
            <PacketView d={g.d} packet={packet} reverse delay={dir === 'both' ? SPEED[packet.speed ?? 'normal'] / 2 : 0} reduced={reduced} still={g.at(e.label ? 0.78 : 0.5)} />
          )}
        </>
      )}
    </g>
  );
}

function ZoneView({ z, leaving }: { z: SceneZone; leaving: boolean }) {
  return (
    <g className={`zone ${st(z.status)}${leaving ? ' leaving' : ''}`}>
      <rect x={z.x * U} y={z.y * U} width={z.w * U} height={z.h * U} rx={20} />
      {z.label && (
        <text x={z.x * U + 18} y={z.y * U + 28}>
          {z.label.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function NoteView({ n, leaving }: { n: SceneNote; leaving: boolean }) {
  return (
    <g className={`note ${st(n.status)}${leaving ? ' leaving' : ''}`}>
      <text x={n.x * U} y={n.y * U + 6} textAnchor="middle">
        {n.text}
      </text>
    </g>
  );
}

// ------------------------------------------------------------------ main
export function SceneView({ scene, bounds, reduced, stepKey }: { scene?: ResolvedScene; bounds: Bounds; reduced: boolean; stepKey: number }) {
  const empty = useMemo<ResolvedScene>(() => ({ nodes: [], edges: [], zones: [], notes: [] }), []);
  const s = scene ?? empty;
  const nodes = usePresence(s.nodes, reduced);
  const edges = usePresence(s.edges, reduced);
  const zones = usePresence(s.zones, reduced);
  const notes = usePresence(s.notes, reduced);
  const pos = useTweenedPositions(s.nodes, reduced);
  const lastPos = useRef(new Map<string, Pos>());
  for (const [k, v] of pos) lastPos.current.set(k, v);
  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ l: false, r: false });
  const [swiped, setSwiped] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setFade({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const onScroll = () => update();
    const onTouch = () => setSwiped(true);
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('pointerdown', onTouch);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('pointerdown', onTouch);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Auto-bend edges that run both ways between the same two nodes.
  const autoBend = useMemo(() => {
    const keys = new Set(s.edges.map((e) => `${e.from}>${e.to}`));
    const m = new Map<string, number>();
    for (const e of s.edges) if (e.bend === undefined && keys.has(`${e.to}>${e.from}`)) m.set(e.id, 0.45);
    return m;
  }, [s.edges]);

  // On narrow screens the diagram scrolls sideways: keep the action in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 4) return;
    const focus = s.nodes.filter((n) => n.status && n.status !== 'normal' && n.status !== 'dim');
    const list = focus.length ? focus : s.nodes;
    if (!list.length) return;
    const cx = list.reduce((a, n) => a + n.x * U, 0) / list.length;
    const ratio = (cx - bounds.x) / bounds.w;
    el.scrollTo({ left: ratio * el.scrollWidth - el.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [stepKey, s.nodes, bounds, reduced]);

  const edgeGeoms = edges.flatMap(({ item, leaving }) => {
    const a = pos.get(item.from) ?? lastPos.current.get(item.from);
    const b = pos.get(item.to) ?? lastPos.current.get(item.to);
    if (!a || !b) return [];
    return [{ item, leaving, g: edgeGeometry(a, b, item.bend ?? autoBend.get(item.id) ?? 0) }];
  });
  const caption = s.caption;
  const describe = s.nodes.map((n) => n.label).join(', ');

  return (
    <figure className={`scene${fade.l ? ' fade-l' : ''}${fade.r ? ' fade-r' : ''}`}>
      {(fade.l || fade.r) && !swiped && (
        <span className="swipe-hint" aria-hidden="true">
          Swipe to see the whole diagram
        </span>
      )}
      <div className="scene-scroll" ref={scroller}>
        <svg
          className="scene-svg"
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          style={{ aspectRatio: `${bounds.w} / ${bounds.h}` }}
          role="img"
          aria-label={caption ? `${caption}. Shows: ${describe}` : `Diagram showing: ${describe}`}
        >
          <defs>
            {['normal', 'active', 'ok', 'warn', 'error', 'dim'].map((k) => (
              <marker key={k} id={`arrow-${k}`} className={`arrowhead st-${k}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M1.5 1.5 L10.5 6 L1.5 10.5" />
              </marker>
            ))}
            <pattern id="scene-grid" width={U / 2} height={U / 2} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1.2} className="grid-dot" />
            </pattern>
          </defs>
          <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#scene-grid)" className="grid-bg" />
          <g className="layer-zones">
            {zones.map(({ item, leaving }) => (
              <ZoneView key={item.id} z={item} leaving={leaving} />
            ))}
          </g>
          {(['line', 'label', 'packets'] as const).map((part) => (
            <g key={part} className={`layer-edges-${part}`}>
              {edgeGeoms.map(({ item, leaving, g }) => (
                <EdgeView key={item.id} e={item} g={g} leaving={leaving} reduced={reduced} part={part} />
              ))}
            </g>
          ))}
          <g className="layer-notes">
            {notes.map(({ item, leaving }) => (
              <NoteView key={item.id} n={item} leaving={leaving} />
            ))}
          </g>
          <g className="layer-nodes">
            {nodes.map(({ item, leaving }) => {
              const p = pos.get(item.id) ?? lastPos.current.get(item.id);
              if (!p) return null;
              return <NodeView key={item.id} n={item} p={p} leaving={leaving} />;
            })}
          </g>
        </svg>
      </div>
      {caption && <figcaption className="scene-caption">{caption}</figcaption>}
    </figure>
  );
}
