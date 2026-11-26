import type { ResolvedScene, SceneEdge, SceneNode, SceneNote, SceneZone } from './schema.js';

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Shape {
  type: 'server' | 'cylinder' | 'chip' | 'crate' | 'hazard' | 'phone' | 'laptop' | 'person' | 'crowd' | 'box' | 'tile' | 'token' | 'flag' | 'stack';
  hw: number; hd: number; h: number;
  r?: number; cap?: number; capH?: number; lid?: number; lidH?: number; screenH?: number; figure?: number; figH?: number; poleH?: number;
}
export interface PillValue { text: string; icon?: string; gauge?: number; tone?: string }
export interface NodeLayout { c: Pt; shape: Shape; sil: Pt[]; topY: number; plate: Rect; pill: Rect | null; pillValue: PillValue | null; card: Rect; tags: Rect[]; depth: number; x: number; y: number }
export interface PacketMotion { dur: number; fwd: number | null; back: number | null; sa: number; sb: number; w: number }
/** A route on the floor, in the edge's own direction (see shared/iso.js). */
export interface EdgeRoute { kind: 'x' | 'y' | 'zx' | 'zy' | 'sx' | 'sy' | 'u'; f?: number; off?: number; lane?: number }
export interface EdgeSeg { a: Pt; b: Pt; axis: 'x' | 'y' }
export interface EdgeGeom { route: EdgeRoute; segs: EdgeSeg[]; turns: Pt[]; hidden: number; firstLeg: number; lastLeg: number; labelSpots: number[]; motion?: PacketMotion; motionClash?: number; blockers?: string[]; d: string; at: (u: number) => Pt; atS: (s: number) => Pt; sOf: (u: number) => number; mid: Pt; length: number; heads: string[]; label: Rect | null; labelU: number; labelAt: (u: number) => Rect; tip: Pt | null; tail: Pt | null; run?: { a: number; b: number; ok: boolean }; duck?: { a: number; b: number }; stills?: { fwd?: { p: Pt; rect: Rect } | null; back?: { p: Pt; rect: Rect } | null } }
export const ISO: {
  G: number; pad: number; lift: number;
  plate: { size: number; padX: number; h: number; minW: number; overlap: number };
  card: { tail: number; gap: number };
  edge: { size: number; padX: number; h: number };
  pill: { size: number; padX: number; h: number; gap: number; icon: number; gauge: number };
  note: { padX: number; h: number; rise: number };
  packet: { size: number; padX: number; h: number; r: number };
  zone: { size: number; padX: number; h: number; thick: number; inset: number };
  minView: { w: number; h: number };
};
export const NODE_SHAPES: string[];
export const PACKET_KINDS: string[];
export const PACKET_MEANING: Record<string, string>;
export const TONES: string[];
export function packetKind(pk: unknown, back?: boolean): string;
export function nodePill(n: SceneNode): PillValue | null;
export function pillWidth(p: PillValue | null): number;
export function plateSize(n: SceneNode): { w: number; h: number };
export const PACKET_SPEED: Record<'slow' | 'normal' | 'fast', number>;
export const PACKET_MOVE: { start: number; end: number; visibleFrom: number; visibleTo: number };
export function packetRectAt(g: EdgeGeom, m: PacketMotion, begin: number, reverse: boolean, t: number): Rect | null;
export const FLAG_W: number;
export function sansWidth(text: string, size: number): number;
export function project(x: number, y: number, z?: number): Pt;
export function nodeShape(n: SceneNode): Shape;
export function shapeHeight(s: Shape): number;
export function boxCorners(hw: number, hd: number, z: number): { N: Pt; E: Pt; S: Pt; W: Pt };
export function silhouette(s: Shape, lift?: number): Pt[];
export function cardSize(n: SceneNode): { w: number; h: number };
export function tagWidth(t: string): number;
export function edgeLabelWidth(label?: string): number;
export function packetWidth(label?: string): number;
export function noteWidth(text: string): number;
export function zoneLabelWidth(label: string): number;
export function nodeLayout(n: SceneNode, x?: number, y?: number, lift?: number): NodeLayout;
export function pointInPoly(p: Pt, poly: Pt[]): boolean;
export function polyBox(poly: Pt[]): Rect;
export function rectOverlap(a: Rect, b: Rect, pad?: number): number;
export const EDGE_ROUTES: string[];
export function linkSceneRoutes<T extends ResolvedScene | undefined>(scenes: T[]): T[];
export function edgeLayout(e: SceneEdge, A: NodeLayout, B: NodeLayout, route?: EdgeRoute): EdgeGeom;
export function stillPacket(e: SceneEdge, g: EdgeGeom, which: 'fwd' | 'back', avoid?: (r: Rect) => number): { p: Pt; rect: Rect } | null;
export function zoneLayout(z: SceneZone): { poly: Pt[]; label: Rect | null; candidates: Rect[]; depth: number };
export function noteLayout(n: SceneNote): { anchor: Pt; rect: Rect };
export function sceneLayout(scene: ResolvedScene, poses?: Map<string, { x: number; y: number; lift: number }>, routes?: Map<string, EdgeRoute>): {
  nodes: Map<string, NodeLayout>;
  edges: { e: SceneEdge; g: EdgeGeom }[];
  zones: { z: SceneZone; poly: Pt[]; label: Rect | null; depth: number }[];
  notes: { n: SceneNote; anchor: Pt; rect: Rect; attached: boolean }[];
};
export function layoutBounds(scenes: (ResolvedScene | undefined)[]): Rect | null;
export function layoutProblems(scene: ResolvedScene): { level: 'error' | 'warn'; msg: string }[];
