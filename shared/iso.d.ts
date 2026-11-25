import type { ResolvedScene, SceneEdge, SceneNode, SceneNote, SceneZone } from './schema.js';

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Shape {
  type: 'server' | 'cylinder' | 'chip' | 'crate' | 'hazard' | 'phone' | 'laptop' | 'person' | 'box';
  hw: number; hd: number; h: number;
  r?: number; cap?: number; capH?: number; lid?: number; lidH?: number; screenH?: number; figure?: number; figH?: number;
}
export interface NodeLayout { c: Pt; shape: Shape; sil: Pt[]; topY: number; card: Rect; tags: Rect[]; depth: number; x: number; y: number }
export interface EdgeGeom { d: string; at: (u: number) => Pt; mid: Pt; length: number; heads: string[]; label: Rect | null; labelU: number; labelAt: (u: number) => Rect; stills?: { fwd?: { p: Pt; rect: Rect } | null; back?: { p: Pt; rect: Rect } | null } }
export const ISO: {
  G: number; pad: number; lift: number;
  card: { label: number; sub: number; padX: number; h1: number; h2: number; gap: number; tail: number; minW: number };
  edge: { size: number; padX: number; h: number };
  tag: { size: number; padX: number; h: number; gap: number; below: number };
  note: { padX: number; h: number; rise: number };
  packet: { size: number; padX: number; h: number; r: number };
  zone: { size: number; padX: number; h: number; thick: number };
};
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
export function edgeLayout(e: SceneEdge, A: NodeLayout, B: NodeLayout, bend?: number): EdgeGeom;
export function stillPacket(e: SceneEdge, g: EdgeGeom, which: 'fwd' | 'back', avoid?: (r: Rect) => number): { p: Pt; rect: Rect } | null;
export function zoneLayout(z: SceneZone): { poly: Pt[]; label: Rect | null };
export function noteLayout(n: SceneNote): { anchor: Pt; rect: Rect };
export function autoBends(edges: SceneEdge[]): Map<string, number>;
export function sceneLayout(scene: ResolvedScene, poses?: Map<string, { x: number; y: number; lift: number }>): {
  nodes: Map<string, NodeLayout>;
  edges: { e: SceneEdge; g: EdgeGeom }[];
  zones: { z: SceneZone; poly: Pt[]; label: Rect | null }[];
  notes: { n: SceneNote; anchor: Pt; rect: Rect }[];
};
export function layoutBounds(scenes: (ResolvedScene | undefined)[]): Rect | null;
export function layoutProblems(scene: ResolvedScene): { level: 'error' | 'warn'; msg: string }[];
