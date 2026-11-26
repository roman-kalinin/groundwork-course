// Shared by the app (src/) and the validator (scripts/validate.mjs).
// Plain JS so Node can run it without a build step. Types live in schema.d.ts.

export { ICONS, ICON_NAMES } from './icons.js';

export const GRID = { cols: 12, rows: 8 };

export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const CHAPTERS = ['setup', 'problem', 'idea', 'how', 'example', 'watch-out', 'recap'];
/** Tones of a metric tile or a pill. */
export const TONES = ['neutral', 'good', 'warn', 'bad'];

/**
 * One line of a step's "What changed" list: "+ added", "~ changed", "− removed"
 * (a plain "-" works too). Returns null when the prefix is missing.
 */
export function parseChange(line) {
  const m = /^\s*([+~−-])\s+(\S.*)$/.exec(String(line ?? ''));
  if (!m) return null;
  return { op: m[1] === '+' ? '+' : m[1] === '~' ? '~' : '-', text: m[2] };
}

/**
 * Metric values per step. Each step's `metrics` patches the values of the step
 * before (a value carries forward until a step changes it). Returns, per step,
 * one entry per lesson metric: { def, value (null before the first value), tone, changed }.
 */
export function resolveMetrics(lesson) {
  const defs = Array.isArray(lesson?.metrics) ? lesson.metrics : [];
  const cur = new Map(defs.map((d) => [d.id, { value: null, tone: 'neutral' }]));
  return (lesson?.steps ?? []).map((step) => {
    const patch = step && typeof step.metrics === 'object' && step.metrics ? step.metrics : {};
    const changed = new Set();
    for (const [id, raw] of Object.entries(patch)) {
      if (!cur.has(id)) continue;
      const v = raw !== null && typeof raw === 'object' ? raw : { value: raw };
      const before = cur.get(id);
      const next = { value: v.value ?? before.value, tone: v.tone ?? 'neutral' };
      if (next.value !== before.value || next.tone !== before.tone) changed.add(id);
      cur.set(id, next);
    }
    return defs.map((def) => ({ def, ...cur.get(def.id), changed: changed.has(def.id) }));
  });
}
export const CALLOUT_TYPES = ['tip', 'warn', 'analogy', 'claude-code'];
export const NODE_KINDS = ['neutral', 'person', 'client', 'server', 'data', 'ai', 'external', 'threat'];
export const STATUSES = ['normal', 'active', 'ok', 'warn', 'error', 'dim'];
export const EDGE_STYLES = ['solid', 'dashed', 'dotted'];
export const ARROWS = ['end', 'start', 'both', 'none'];
export const PACKET_DIRECTIONS = ['forward', 'backward', 'both'];
export const PACKET_SPEEDS = ['slow', 'normal', 'fast'];
export const MODULE_COLORS = ['blue', 'teal', 'green', 'amber', 'rose', 'violet', 'slate'];
export const CODE_LANGUAGES = [
  'ts', 'tsx', 'js', 'jsx', 'sql', 'bash', 'json', 'http', 'env', 'yaml', 'toml', 'python', 'diff', 'text',
];

// Glyph advance widths (tenths of a px) for printable ASCII 32..126, measured
// in Chromium by scripts/measure-glyphs.mjs with the scene fonts:
//   label: Bricolage Grotesque 650, 20px, semi-condensed (node card title)
//   sub:   Instrument Sans 500, 14.5px (node card second line)
//   note:  Instrument Sans 550, 15.5px (speech-bubble notes)
// Edge labels, tags and packets use IBM Plex Mono (see monoWidth).
// Other characters fall back to a typical width.
const GLYPHS = {
  label: [42,51,64,114,110,177,138,31,59,60,80,89,33,58,37,63,113,62,103,103,108,106,112,87,111,111,40,35,89,89,89,75,175,117,117,116,120,101,97,121,123,53,68,117,88,164,132,123,113,124,117,112,98,124,115,170,118,113,97,61,64,60,100,97,57,102,110,99,110,101,69,104,109,50,52,102,50,162,109,106,110,110,77,96,69,108,100,151,100,106,89,63,49,61,89],
  sub: [29,41,60,105,90,114,110,35,61,61,61,78,38,72,38,64,97,56,80,84,88,84,88,79,86,89,38,38,78,78,78,83,125,106,93,108,109,92,87,111,106,37,64,102,85,131,106,115,96,115,96,90,95,103,106,158,101,100,91,61,64,61,78,65,51,79,89,79,89,82,52,89,88,36,36,79,36,135,88,86,89,89,56,70,57,86,77,114,83,77,73,61,35,61,78],
  note: [30,45,67,112,98,122,119,39,67,67,66,84,42,77,42,69,104,60,86,90,95,90,95,86,92,96,42,42,84,84,84,89,134,113,100,116,117,98,92,118,113,39,67,110,91,139,113,123,103,124,103,98,102,109,113,169,109,108,97,67,69,67,84,71,55,86,96,85,96,88,57,96,94,40,40,86,40,145,94,92,96,96,60,76,62,93,83,123,90,83,79,67,37,67,84],
};
const FALLBACK = { label: 125, sub: 90, note: 95 };

/** Approximate rendered width (px, scene units) of scene text. kind: 'label' | 'sub' | 'note'. */
export function textWidth(text, kind = 'label') {
  const table = GLYPHS[kind];
  let w = 0;
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0);
    w += table && c >= 32 && c <= 126 ? table[c - 32] : FALLBACK[kind];
  }
  return w / 10;
}

/** Width (px) of monospaced scene text (IBM Plex Mono advance = 0.6 em). */
export function monoWidth(text, size) {
  return [...String(text ?? '')].length * size * 0.6;
}

export const LESSON_FILE_RE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;

/** Default id for an edge without an explicit id. */
export const edgeId = (e) => e.id ?? `${e.from}>${e.to}`;

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Merge patch into base; a `null` value in the patch deletes that key. */
function mergeItem(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = clone(v);
  }
  return out;
}

/**
 * Turn a step's `scene` field into a full scene, given the previous step's
 * resolved scene. Rules:
 *  - scene omitted (undefined): identical to the previous scene.
 *  - scene without "extends": a brand-new scene (ids that match the previous
 *    scene still animate smoothly from their old position/state).
 *  - scene with "extends": "previous": start from the previous scene, then
 *    remove ids listed in "remove", then merge nodes/edges/zones/notes by id
 *    (existing id = shallow merge, new id = add). "caption" replaces.
 *
 * `report(path, message)` is called for problems (used by the validator).
 */
export function resolveScene(prev, spec, report = () => {}) {
  if (spec === undefined) return prev;
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    report('scene', 'must be an object');
    return prev;
  }
  const extending = spec.extends === 'previous';
  if (spec.extends !== undefined && !extending) {
    report('scene.extends', `must be "previous" (got ${JSON.stringify(spec.extends)})`);
  }
  if (extending && !prev) {
    report('scene.extends', 'there is no previous scene to extend (first scene of the lesson must be a full scene)');
  }
  if (!extending && spec.remove !== undefined) {
    report('scene.remove', '"remove" only makes sense together with "extends": "previous"');
  }
  const base = extending && prev ? prev : { nodes: [], edges: [], zones: [], notes: [], caption: undefined };
  let nodes = base.nodes.map((n) => ({ ...n }));
  let edges = base.edges.map((e) => ({ ...e }));
  let zones = base.zones.map((z) => ({ ...z }));
  let notes = base.notes.map((n) => ({ ...n }));

  if (extending && Array.isArray(spec.remove)) {
    spec.remove.forEach((id, i) => {
      const before = nodes.length + edges.length + zones.length + notes.length;
      nodes = nodes.filter((n) => n.id !== id);
      edges = edges.filter((e) => e.id !== id && e.from !== id && e.to !== id);
      zones = zones.filter((z) => z.id !== id);
      notes = notes.filter((n) => n.id !== id);
      const after = nodes.length + edges.length + zones.length + notes.length;
      if (before === after) {
        report(`scene.remove[${i}]`, `nothing with id "${id}" exists in the previous scene. Existing ids: ${listIds(base)}`);
      }
    });
  }

  const mergeList = (list, patchList, key, getId, isNew) => {
    if (patchList === undefined) return list;
    if (!Array.isArray(patchList)) {
      report(`scene.${key}`, 'must be an array');
      return list;
    }
    const out = [...list];
    patchList.forEach((item, i) => {
      if (!item || typeof item !== 'object') {
        report(`scene.${key}[${i}]`, 'must be an object');
        return;
      }
      const id = getId(item);
      const idx = out.findIndex((x) => getId(x) === id);
      if (idx >= 0) {
        if (!extending) report(`scene.${key}[${i}]`, `duplicate id "${id}"`);
        out[idx] = mergeItem(out[idx], item);
      } else {
        out.push(isNew(clone(item)));
      }
    });
    return out;
  };

  nodes = mergeList(nodes, spec.nodes, 'nodes', (n) => n.id, (n) => n);
  edges = mergeList(edges, spec.edges, 'edges', edgeId, (e) => ({ ...e, id: edgeId(e) }));
  zones = mergeList(zones, spec.zones, 'zones', (z) => z.id, (z) => z);
  notes = mergeList(notes, spec.notes, 'notes', (n) => n.id, (n) => n);
  // keep edge ids stable after merges
  edges = edges.map((e) => ({ ...e, id: edgeId(e) }));

  const caption = spec.caption !== undefined ? spec.caption : extending ? base.caption : undefined;
  return { nodes, edges, zones, notes, caption };
}

function listIds(scene) {
  const ids = [...scene.nodes, ...scene.edges, ...scene.zones, ...scene.notes].map((x) => x.id);
  return ids.length ? ids.join(', ') : '(none)';
}

/** Resolve the scenes of all steps of a lesson. Returns one entry per step (may be undefined). */
export function resolveLessonScenes(steps, report = () => {}) {
  let prev;
  return steps.map((step, i) => {
    prev = resolveScene(prev, step.scene, (path, msg) => report(i, path, msg));
    return prev;
  });
}

// ---------------------------------------------------------------- inline HTML

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g;
const ENTITY_RE = /^&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/;

function escapeText(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '<') out += '&lt;';
    else if (c === '>') out += '&gt;';
    else if (c === '&') out += ENTITY_RE.test(text.slice(i)) ? '&' : '&amp;';
    else if (c === '"') out += '&quot;';
    else out += c;
  }
  return out;
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Visible text of an inline-HTML string (tags removed, entities kept). */
export function plainText(html) {
  return String(html).replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>/g, '');
}

export function wordCount(html) {
  return plainText(html).split(/\s+/).filter(Boolean).length;
}

/**
 * Convert author inline HTML into safe HTML. Allowed:
 *   <b>, <em>, <code>, <span class="term">word</span>,
 *   <span class="term" data-term="glossary key">shown text</span>
 * Anything else is escaped and reported. Terms become focusable buttons.
 * `onTerm(key)` is called for each term (validator checks the glossary).
 */
export function sanitizeInline(html, report = () => {}, onTerm = () => {}) {
  const src = String(html);
  let out = '';
  let last = 0;
  const stack = [];
  let termStart = -1;
  let termKey = null;
  const re = new RegExp(TAG_RE.source, 'g');
  let m;
  while ((m = re.exec(src))) {
    const text = src.slice(last, m.index);
    out += escapeText(text);
    if (/[<>]/.test(text)) report(`stray "<" or ">" in text near "${text.slice(0, 30)}". Write &lt; and &gt; instead.`);
    last = re.lastIndex;
    const raw = m[0];
    const tag = m[1].toLowerCase();
    const closing = raw.startsWith('</');
    const attrs = m[2].trim();
    if (!['b', 'em', 'code', 'span'].includes(tag)) {
      if (!closing) report(`tag <${tag}> is not allowed. Allowed: <b>, <em>, <code>, <span class="term">.`);
      out += escapeText(raw);
      continue;
    }
    if (closing) {
      const open = stack.pop();
      if (open !== tag) {
        report(`closing </${tag}> does not match ${open ? `<${open}>` : 'any open tag'}`);
        if (open) stack.push(open);
        out += escapeText(raw);
        continue;
      }
      if (tag === 'span') {
        const shown = plainText(src.slice(termStart, m.index)).trim();
        const key = (termKey ?? shown).trim();
        onTerm(key);
        out += '</button>';
      } else out += `</${tag}>`;
      continue;
    }
    if (tag === 'span') {
      const am = attrs.match(/^class="term"(?:\s+data-term="([^"]*)")?$/);
      if (!am) {
        report(`<span ${attrs}> is not allowed. Use <span class="term"> or <span class="term" data-term="key">.`);
        out += escapeText(raw);
        continue;
      }
      if (stack.includes('span')) report('terms cannot be nested');
      termKey = am[1] ?? null;
      termStart = re.lastIndex;
      // key is filled in by the renderer at runtime from data-term or text
      const keyAttr = termKey ? ` data-term="${escapeAttr(termKey)}"` : '';
      out += `<button type="button" class="term"${keyAttr}>`;
      stack.push('span');
      continue;
    }
    if (attrs) report(`<${tag}> cannot have attributes`);
    out += `<${tag}>`;
    stack.push(tag);
  }
  const tail = src.slice(last);
  if (/[<>]/.test(tail)) report(`stray "<" or ">" in text near "${tail.slice(0, 30)}". Write &lt; and &gt; instead.`);
  out += escapeText(tail);
  while (stack.length) {
    const t = stack.pop();
    report(`<${t === 'span' ? 'span class="term"' : t}> is never closed`);
    out += t === 'span' ? '</button>' : `</${t}>`;
  }
  return out;
}
