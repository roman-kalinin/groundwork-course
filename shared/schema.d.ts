export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Chapter = 'setup' | 'problem' | 'idea' | 'how' | 'example' | 'watch-out' | 'recap';
export type Tone = 'neutral' | 'good' | 'warn' | 'bad';
export type PacketKind = 'request' | 'response' | 'data' | 'secret' | 'job' | 'error';
export interface Pill {
  text: string;
  icon?: string;
  /** 0-100: draws a small gauge bar */
  gauge?: number;
  tone?: Tone;
}
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
  shape?: 'block' | 'tile' | 'token' | 'flag' | 'stack' | 'crowd';
  status?: Status;
  /** at most one small pill: a live value or state */
  pill?: string | Pill;
  /** legacy (pre-declutter lessons): only the first tag is drawn, as the pill */
  tags?: string[];
  w?: number;
}
export interface Packet {
  /** colour = meaning (see the legend); packets carry no text */
  kind?: PacketKind;
  /** kind of the packet travelling back when direction is "both" (default: response for a request) */
  returns?: PacketKind;
  /** legacy */
  label?: string;
  /** legacy: maps onto a kind */
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
  route?: 'x-first' | 'y-first' | 'mid';
  /** legacy: its sign picks the side of the elbow */
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
export interface MetricDef {
  id: string;
  label: string;
  icon?: string;
  unit?: string;
}
export interface MetricValue {
  value: number | string;
  tone?: Tone;
}
export interface Step {
  title: string;
  chapter: Chapter;
  body: string[];
  /** "+ added", "~ changed", "− removed" lines (required on steps 2+) */
  changes?: string[];
  /** metric id -> value (or { value, tone }); carries forward to later steps */
  metrics?: Record<string, number | string | MetricValue>;
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
  /** optional numbers that tell the story, shown as tiles above the diagram */
  metrics?: MetricDef[];
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
export const TONES: Tone[];
export function parseChange(line: string): { op: '+' | '~' | '-'; text: string } | null;
export function resolveMetrics(lesson: Lesson): ({ def: MetricDef; value: number | string | null; tone: Tone; changed: boolean })[][];
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
