export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Chapter = 'problem' | 'idea' | 'how' | 'example' | 'watch-out' | 'recap';
export type CalloutType = 'tip' | 'warn' | 'analogy' | 'claude-code';
export type NodeKind = 'neutral' | 'person' | 'client' | 'server' | 'data' | 'ai' | 'external' | 'threat';
export type Status = 'normal' | 'active' | 'ok' | 'warn' | 'error' | 'dim';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrow = 'end' | 'start' | 'both' | 'none';

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  icon?: string;
  kind?: NodeKind;
  status?: Status;
  tags?: string[];
  w?: number;
}
export interface Packet {
  label?: string;
  status?: Status;
  direction?: 'forward' | 'backward' | 'both';
  speed?: 'slow' | 'normal' | 'fast';
}
export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: EdgeStyle;
  status?: Status;
  arrow?: Arrow;
  bend?: number;
  packet?: Packet | boolean;
}
export interface SceneZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  status?: Status;
}
export interface SceneNote {
  id: string;
  x: number;
  y: number;
  text: string;
  status?: Status;
}
export interface ResolvedScene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  zones: SceneZone[];
  notes: SceneNote[];
  caption?: string;
}
export type SceneSpec = Partial<ResolvedScene> & { extends?: 'previous'; remove?: string[] } & Record<string, unknown>;

export interface Callout {
  type: CalloutType;
  title?: string;
  text: string;
}
export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
  caption?: string;
}
export interface Step {
  title: string;
  chapter: Chapter;
  body: string[];
  callout?: Callout;
  code?: CodeSnippet;
  scene?: SceneSpec;
}
export interface QuizOption {
  text: string;
  correct?: boolean;
  why: string;
}
export interface QuizQuestion {
  question: string;
  options: QuizOption[];
}
export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: Level;
  youWillLearn: string[];
  glossary: Record<string, string>;
  steps: Step[];
  quiz: QuizQuestion[];
  takeaways: string[];
}
export interface ModuleMeta {
  id: string;
  title: string;
  order: number;
  summary: string;
  color?: string;
  icon?: string;
}

export const ICONS: Record<string, string>;
export const ICON_NAMES: string[];
export const GRID: { cols: number; rows: number };
export const LEVELS: Level[];
export const CHAPTERS: Chapter[];
export const CALLOUT_TYPES: CalloutType[];
export const NODE_KINDS: NodeKind[];
export const STATUSES: Status[];
export const EDGE_STYLES: EdgeStyle[];
export const ARROWS: Arrow[];
export const PACKET_DIRECTIONS: string[];
export const PACKET_SPEEDS: string[];
export const MODULE_COLORS: string[];
export const CODE_LANGUAGES: string[];
export const LESSON_FILE_RE: RegExp;
export function edgeId(e: { id?: string; from: string; to: string }): string;
export function resolveScene(
  prev: ResolvedScene | undefined,
  spec: SceneSpec | undefined,
  report?: (path: string, msg: string) => void,
): ResolvedScene | undefined;
export function resolveLessonScenes(
  steps: Step[],
  report?: (stepIndex: number, path: string, msg: string) => void,
): (ResolvedScene | undefined)[];
export function plainText(html: string): string;
export function wordCount(html: string): number;
export function sanitizeInline(
  html: string,
  report?: (msg: string) => void,
  onTerm?: (key: string) => void,
): string;
export function textWidth(text: string | undefined, kind?: 'label' | 'sub' | 'note'): number;
export function monoWidth(text: string | undefined, size: number): number;
