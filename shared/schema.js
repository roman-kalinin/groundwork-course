// Shared by the app (src/) and the validator (scripts/validate.mjs).
// Plain JS so Node can run it without a build step. Types live in schema.d.ts.

export { ICONS, ICON_NAMES } from './icons.js';

export const GRID = { cols: 12, rows: 8, unit: 100 };
export const NODE_DEFAULT_W = 1.8; // grid units (minimum; nodes grow to fit their text)
export const NODE_H = 0.74; // grid units

export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const CHAPTERS = ['problem', 'idea', 'how', 'example', 'watch-out', 'recap'];
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

/**
 * Rendered width of a node in grid units. Nodes grow automatically to fit
 * their label/sublabel; "w" sets a minimum width.
 */
export function nodeWidth(n) {
  const hasIcon = !!n.icon;
  const textPx = Math.max(
    String(n.label ?? '').length * 11.8,
    String(n.sublabel ?? '').length * 8.6,
  );
  const px = (hasIcon ? 58 : 18) + textPx + 16;
  return Math.max(n.w ?? NODE_DEFAULT_W, Math.round(px / 10) / 10);
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
