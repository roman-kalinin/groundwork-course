#!/usr/bin/env node
// Validates every module.json and lesson JSON under src/content.
// Usage: npm run validate            (all content)
//        npm run validate -- security (only folders whose name matches)
// Exit code 1 if any error. Warnings never fail the run.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ICON_NAMES, GRID, LEVELS, CHAPTERS, CALLOUT_TYPES, NODE_KINDS, STATUSES, EDGE_STYLES, ARROWS,
  PACKET_DIRECTIONS, PACKET_SPEEDS, MODULE_COLORS, CODE_LANGUAGES, LESSON_FILE_RE, TONES,
  resolveLessonScenes, resolveMetrics, parseChange, sanitizeInline, wordCount, plainText,
} from '../shared/schema.js';
import { EDGE_ROUTES, layoutProblems, linkSceneRoutes, NODE_SHAPES, PACKET_KINDS } from '../shared/iso.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content');
const filter = process.argv[2];

const KNOWN_MODULES = {
  data: 1, security: 2, debugging: 3, production: 4, ai: 5, clients: 6, interviews: 7,
};
// The scene rules (see WRITING_GUIDE.md, "Scenes"): few big blocks, the name on
// the block, one pill at most, packets without text, numbers in metric tiles.
const LIMITS = {
  bodyWordsWarn: 60,
  bodyWordsError: 75,
  bodyParagraphs: 2,
  calloutWords: 45,
  stepTitle: 48,
  lessonTitle: 80,
  summary: 220,
  label: 16,
  labelWords: 2,
  pill: 12,
  edgeLabel: 14,
  edgeLabelWords: 2,
  labeledEdges: 2,
  nodes: 6,
  zones: 2,
  zoneLabel: 16,
  changes: 4,
  changeLine: 70,
  metrics: 4,
  metricLabel: 16,
  metricUnit: 6,
  metricValue: 10,
};
const words = (t) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length;

let errorCount = 0;
let warnCount = 0;
let current = '';
const out = [];
const errOuter = (path, msg) => { errorCount++; out.push(`  \x1b[31merror\x1b[0m ${path ? `${path}: ` : ''}${msg}`); };
const warnOuter = (path, msg) => { warnCount++; out.push(`  \x1b[33mwarn \x1b[0m ${path ? `${path}: ` : ''}${msg}`); };
const err = (p, m) => errOuter(p, m);
const warn = (p, m) => warnOuter(p, m);
const flush = () => { if (out.length) { console.log(`\n\x1b[1m${current}\x1b[0m`); console.log(out.join('\n')); out.length = 0; } };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const oneOf = (v, list) => list.includes(v);
const fmtList = (list) => list.map((x) => `"${x}"`).join(', ');

function closest(word, list) {
  let best = null; let bestD = Infinity;
  for (const c of list) {
    const d = lev(word, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

function checkKeys(path, obj, allowed) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) {
      const hint = closest(k, allowed);
      err(path, `unknown field "${k}"${hint ? ` (did you mean "${hint}"?)` : ''}. Allowed: ${allowed.join(', ')}`);
    }
  }
}
function req(path, obj, key, check, what) {
  if (!(key in obj)) { err(path, `missing required field "${key}" (${what})`); return false; }
  if (!check(obj[key])) { err(`${path}.${key}`, `must be ${what} (got ${JSON.stringify(obj[key])?.slice(0, 60)})`); return false; }
  return true;
}
function opt(path, obj, key, check, what) {
  if (!(key in obj)) return false;
  if (!check(obj[key])) { err(`${path}.${key}`, `must be ${what} (got ${JSON.stringify(obj[key])?.slice(0, 60)})`); return false; }
  return true;
}
function enumField(path, obj, key, list, required = false) {
  if (!(key in obj)) { if (required) err(path, `missing required field "${key}" (one of ${fmtList(list)})`); return; }
  if (!oneOf(obj[key], list)) {
    const hint = typeof obj[key] === 'string' ? closest(obj[key], list) : null;
    err(`${path}.${key}`, `"${obj[key]}" is not valid${hint ? ` (did you mean "${hint}"?)` : ''}. Use one of: ${fmtList(list)}`);
  }
}
function maxLen(path, s, n, level = 'warn') {
  if (typeof s === 'string' && plainText(s).length > n) {
    (level === 'error' ? err : warn)(path, `is ${plainText(s).length} characters; keep it under ${n}: "${plainText(s).slice(0, 50)}..."`);
  }
}

function readJson(file) {
  const raw = readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const pos = Number((/position (\d+)/.exec(e.message) || [])[1]);
    let where = '';
    if (Number.isFinite(pos)) {
      const before = raw.slice(0, pos);
      const line = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      where = ` at line ${line}, column ${col}`;
    }
    err('', `invalid JSON${where}: ${e.message}`);
    return undefined;
  }
}

// ---------------------------------------------------------------- module.json
function validateModule(dir, folder) {
  const file = join(dir, 'module.json');
  current = relative(ROOT, file).replace(/\\/g, '/');
  if (!existsSync(file)) { err('', `module folder "${folder}" has no module.json`); flush(); return null; }
  const m = readJson(file);
  if (!m) { flush(); return null; }
  if (!isObj(m)) { err('', 'must be a JSON object'); flush(); return null; }
  checkKeys('module', m, ['id', 'title', 'order', 'summary', 'color', 'icon']);
  if (req('module', m, 'id', isStr, 'a string') && m.id !== folder) err('module.id', `"${m.id}" must equal the folder name "${folder}"`);
  req('module', m, 'title', isStr, 'a non-empty string');
  req('module', m, 'order', (v) => Number.isInteger(v) && v > 0, 'a positive integer');
  req('module', m, 'summary', isStr, 'a non-empty string');
  maxLen('module.summary', m.summary, 200);
  enumField('module', m, 'color', MODULE_COLORS);
  if (m.icon !== undefined && !ICON_NAMES.includes(m.icon)) err('module.icon', `unknown icon "${m.icon}". Use one of the scene icon names (see LESSON_SCHEMA.md).`);
  if (KNOWN_MODULES[folder] && m.order !== KNOWN_MODULES[folder]) warn('module.order', `expected ${KNOWN_MODULES[folder]} for "${folder}"`);
  flush();
  return m;
}

// ---------------------------------------------------------------- inline HTML
function checkInline(path, html, glossaryKeys, usedTerms) {
  sanitizeInline(html, (msg) => err(path, msg), (key) => {
    const k = key.toLowerCase();
    usedTerms.add(k);
    if (!glossaryKeys.has(k)) {
      err(path, `term "${key}" is not in the lesson glossary. Add "${key}": "<one-sentence definition>" to "glossary", or use data-term="<existing key>". Glossary keys: ${[...glossaryKeys].join(', ') || '(none)'}`);
    }
  });
}

// ---------------------------------------------------------------- scene
let sceneSeen = new Set();
function checkResolvedScene(path, scene, stepSpec) {
  // Problems in items inherited unchanged from an earlier step are reported once, at the step that introduced them.
  let curId = 'scene';
  const keyOf = (p, msg) => `${curId}|${(p.match(/\.(\w+)$/) || [])[1] ?? ''}|${msg.slice(0, 40)}`;
  const err = (p, msg) => { const k = keyOf(p, msg); if (sceneSeen.has(k)) return; sceneSeen.add(k); errOuter(p, msg); };
  const warn = (p, msg) => { const k = `w|${keyOf(p, msg)}`; if (sceneSeen.has(k)) return; sceneSeen.add(k); warnOuter(p, msg); };
  const ids = new Map();
  const claim = (id, what, p) => {
    if (!isStr(id)) { err(p, `${what} needs a string "id"`); return; }
    const ok = what === 'edge' ? /^[a-zA-Z0-9_-]+(>[a-zA-Z0-9_-]+)?$/ : /^[a-zA-Z0-9_-]+$/;
    if (!ok.test(id)) err(p, `id "${id}" may only contain letters, digits, "-" and "_"`);
    if (ids.has(id) && ids.get(id) !== what) err(p, `id "${id}" is used by both a ${ids.get(id)} and a ${what}; ids must be unique across the scene`);
    ids.set(id, what);
  };
  const nodeIds = new Set();
  // Where did each item come from? (for error paths, point at the step's own spec when possible)
  const where = (list, id) => {
    const idx = (stepSpec?.[list] || []).findIndex((x) => (x.id ?? `${x.from}>${x.to}`) === id);
    return idx >= 0 ? `${path}.${list}[${idx}]` : `${path} (${list.slice(0, -1)} "${id}", inherited)`;
  };

  for (const n of scene.nodes) {
    curId = `node:${n.id}`;
    const p = where('nodes', n.id);
    claim(n.id, 'node', p);
    nodeIds.add(n.id);
    checkKeys(p, n, ['id', 'x', 'y', 'label', 'icon', 'kind', 'shape', 'status', 'pill', 'sublabel', 'tags', 'w']);
    if (!isNum(n.x) || n.x < 0 || n.x > GRID.cols) err(p, `x must be a number from 0 to ${GRID.cols} (got ${JSON.stringify(n.x)})${n.x === undefined ? ' - a new node needs x and y; to change an existing node, make sure the id matches exactly' : ''}`);
    if (!isNum(n.y) || n.y < 0 || n.y > GRID.rows) err(p, `y must be a number from 0 to ${GRID.rows} (got ${JSON.stringify(n.y)})`);
    if (!isStr(n.label)) err(p, `node "${n.id}" needs a non-empty "label"`);
    else if (n.label.length > LIMITS.label || words(n.label) > LIMITS.labelWords) {
      err(`${p}.label`, `"${n.label}" is too long for the name printed on the block: at most ${LIMITS.labelWords} words and ${LIMITS.label} characters ("App Server", "Database", "20,000 users"). Say the rest in the step text.`);
    }
    if ('pill' in n) {
      const pl = n.pill;
      if (isStr(pl)) { if (pl.length > LIMITS.pill) err(`${p}.pill`, `"${pl}" is ${pl.length} characters; a pill holds a short live value or state (at most ${LIMITS.pill}): "25%", "23 queued", "round robin"`); }
      else if (isObj(pl)) {
        checkKeys(`${p}.pill`, pl, ['text', 'icon', 'gauge', 'tone']);
        if (!isStr(pl.text)) err(`${p}.pill`, 'needs "text" (a short live value or state)');
        else if (pl.text.length > LIMITS.pill) err(`${p}.pill.text`, `"${pl.text}" is ${pl.text.length} characters; keep pills to ${LIMITS.pill}`);
        if (pl.icon !== undefined && !ICON_NAMES.includes(pl.icon)) err(`${p}.pill.icon`, `unknown icon "${pl.icon}"`);
        if (pl.gauge !== undefined && !(isNum(pl.gauge) && pl.gauge >= 0 && pl.gauge <= 100)) err(`${p}.pill.gauge`, 'must be a number from 0 to 100 (how full the little gauge is)');
        enumField(`${p}.pill`, pl, 'tone', TONES);
      } else err(`${p}.pill`, 'must be a short string, or { text, icon?, gauge?, tone? }');
    }
    if (n.icon !== undefined && !ICON_NAMES.includes(n.icon)) {
      const hint = typeof n.icon === 'string' ? closest(n.icon, ICON_NAMES) : null;
      err(`${p}.icon`, `unknown icon "${n.icon}"${hint ? ` (did you mean "${hint}"?)` : ''}. See WRITING_GUIDE.md for the icon list.`);
    }
    enumField(p, n, 'kind', NODE_KINDS);
    enumField(p, n, 'shape', NODE_SHAPES);
    enumField(p, n, 'status', STATUSES);
    if ('sublabel' in n) err(`${p}.sublabel`, 'sublabels are not drawn any more: the block shows only its name. Put the detail in the step text, or a live value in "pill".');
    if ('tags' in n) err(`${p}.tags`, 'tags were replaced by one "pill" per node (a live value or state). Facts and column lists go in the step text or code.');
    if ('w' in n) err(`${p}.w`, '"w" is not used any more; remove it');
  }
  // Isometric layout: blocks standing on each other, and text (cards, tags,
  // edge labels, notes, zone names) covering other text, measured in screen
  // space with the same geometry the renderer uses (shared/iso.js).
  curId = 'scene';
  if (scene.nodes.every((n) => isNum(n.x) && isNum(n.y))) {
    for (const pr of layoutProblems(scene)) (pr.level === 'error' ? err : warn)(path, `${pr.msg}`);
  }
  curId = 'scene';
  if (scene.nodes.length > LIMITS.nodes) err(path, `${scene.nodes.length} blocks (${scene.nodes.map((n) => n.id).join(', ')}); a scene holds at most ${LIMITS.nodes}. Remove what this step does not talk about, or draw a crowd as one "shape": "crowd" block with a count ("1,000 users").`);
  const labeled = scene.edges.filter((e) => e.label);
  if (labeled.length > LIMITS.labeledEdges) err(path, `${labeled.length} edges have labels (${labeled.map((e) => `"${e.label}"`).join(', ')}); at most ${LIMITS.labeledEdges} per scene. Most edges should be unlabeled; packet colours and the step text say what moves.`);
  if (scene.notes.length) err(path, `notes (${scene.notes.map((n) => n.id).join(', ')}) are not allowed: text belongs in the step panel. Remove them${scene.notes.length ? ' (add "remove": [...] in a patch)' : ''}.`);
  if (scene.zones.length > LIMITS.zones) err(path, `${scene.zones.length} zones; at most ${LIMITS.zones}`);

  for (const e of scene.edges) {
    curId = `edge:${e.id}`;
    const p = where('edges', e.id);
    claim(e.id, 'edge', p);
    checkKeys(p, e, ['id', 'from', 'to', 'label', 'style', 'status', 'arrow', 'route', 'bend', 'packet']);
    for (const end of ['from', 'to']) {
      if (!isStr(e[end])) err(p, `edge needs "${end}" (a node id)`);
      else if (!nodeIds.has(e[end])) {
        const hint = closest(e[end], [...nodeIds]);
        err(`${p}.${end}`, `unknown node "${e[end]}"${hint ? ` (did you mean "${hint}"?)` : ''}. Nodes in this scene: ${[...nodeIds].join(', ') || '(none)'}`);
      }
    }
    if (e.from && e.from === e.to) err(p, 'an edge cannot connect a node to itself');
    if (opt(p, e, 'label', isStr, 'a non-empty string') && (e.label.length > LIMITS.edgeLabel || words(e.label) > LIMITS.edgeLabelWords)) {
      err(`${p}.label`, `"${e.label}" is too long for an edge label: at most ${LIMITS.edgeLabelWords} words and ${LIMITS.edgeLabel} characters ("pull", "enqueue job")`);
    }
    enumField(p, e, 'style', EDGE_STYLES);
    enumField(p, e, 'status', STATUSES);
    enumField(p, e, 'arrow', ARROWS);
    enumField(p, e, 'route', EDGE_ROUTES);
    opt(p, e, 'bend', (v) => isNum(v) && v >= -3 && v <= 3, 'a number from -3 to 3 (legacy: its sign picks the side of the elbow; prefer "route")');
    if ('packet' in e) {
      const pk = e.packet;
      if (typeof pk === 'boolean') { /* ok */ } else if (!isObj(pk)) err(`${p}.packet`, 'must be true, false, or an object { kind?, direction?, returns?, speed? }');
      else {
        if ('label' in pk) err(`${p}.packet.label`, 'packets carry no text. Its colour says what it is: set "kind" (request, response, data, secret, job, error); the legend explains it.');
        if ('status' in pk) err(`${p}.packet.status`, 'packets are coloured by "kind" now (request, response, data, secret, job, error), not by status');
        checkKeys(`${p}.packet`, pk, ['kind', 'direction', 'returns', 'speed', 'label', 'status']);
        enumField(`${p}.packet`, pk, 'kind', PACKET_KINDS);
        enumField(`${p}.packet`, pk, 'returns', PACKET_KINDS);
        if ('returns' in pk && pk.direction !== 'both') err(`${p}.packet.returns`, 'only makes sense with "direction": "both" (it is the kind of the packet travelling back)');
        enumField(`${p}.packet`, pk, 'direction', PACKET_DIRECTIONS);
        enumField(`${p}.packet`, pk, 'speed', PACKET_SPEEDS);
      }
    }
  }
  for (const z of scene.zones) {
    curId = `zone:${z.id}`;
    const p = where('zones', z.id);
    claim(z.id, 'zone', p);
    checkKeys(p, z, ['id', 'x', 'y', 'w', 'h', 'label', 'status']);
    for (const k of ['x', 'y', 'w', 'h']) if (!isNum(z[k])) err(p, `zone "${z.id}" needs a number "${k}" (zones use top-left x,y plus width w and height h, in grid units)`);
    if ([z.x, z.y, z.w, z.h].every(isNum) && (z.x < 0 || z.y < 0 || z.x + z.w > GRID.cols || z.y + z.h > GRID.rows)) err(p, `zone "${z.id}" goes outside the ${GRID.cols}x${GRID.rows} grid`);
    if (opt(p, z, 'label', isStr, 'a non-empty string') && (z.label.length > LIMITS.zoneLabel || words(z.label) > 2)) err(`${p}.label`, `"${z.label}" is too long for a zone name (at most 2 words, ${LIMITS.zoneLabel} characters)`);
    enumField(p, z, 'status', STATUSES);
  }
  for (const n of scene.notes) {
    curId = `note:${n.id}`;
    const p = where('notes', n.id);
    claim(n.id, 'note', p);
    // (notes are refused at scene level)
    if (!isNum(n.x) || n.x < 0 || n.x > GRID.cols) err(p, `x must be a number from 0 to ${GRID.cols}`);
    if (!isNum(n.y) || n.y < 0 || n.y > GRID.rows) err(p, `y must be a number from 0 to ${GRID.rows}`);
    if (!isStr(n.text)) err(p, `note "${n.id}" needs "text"`);
    maxLen(`${p}.text`, n.text, LIMITS.note);
    enumField(p, n, 'status', STATUSES);
  }
  if (scene.caption !== undefined && !isStr(scene.caption)) err(`${path}.caption`, 'must be a non-empty string');
}

// ---------------------------------------------------------------- lesson
function validateLesson(file, name) {
  current = relative(ROOT, file).replace(/\\/g, '/');
  sceneSeen = new Set();
  const fm = LESSON_FILE_RE.exec(name);
  if (!fm) {
    err('', `file name must look like "NN-some-slug.json" (two digits, a dash, lowercase words separated by dashes)`);
    flush();
    return null;
  }
  const L = readJson(file);
  if (!L) { flush(); return null; }
  if (!isObj(L)) { err('', 'must be a JSON object'); flush(); return null; }
  checkKeys('lesson', L, ['$schema', 'id', 'title', 'summary', 'minutes', 'level', 'youWillLearn', 'glossary', 'metrics', 'steps', 'quiz', 'takeaways']);
  const metricIds = new Map();
  if ('metrics' in L) {
    if (!Array.isArray(L.metrics) || !L.metrics.length || L.metrics.length > LIMITS.metrics) err('metrics', `must be an array of 1 to ${LIMITS.metrics} metric definitions { id, label, icon?, unit? }`);
    else L.metrics.forEach((m, i) => {
      const p = `metrics[${i}]`;
      if (!isObj(m)) { err(p, 'must be an object { id, label, icon?, unit? }'); return; }
      checkKeys(p, m, ['id', 'label', 'icon', 'unit']);
      if (req(p, m, 'id', (v) => isStr(v) && /^[a-zA-Z0-9_-]+$/.test(v), 'an id (letters, digits, - and _)')) {
        if (metricIds.has(m.id)) err(`${p}.id`, `duplicate metric id "${m.id}"`);
        metricIds.set(m.id, m);
      }
      if (req(p, m, 'label', isStr, 'a short label ("P95 latency", "Rows read")') && m.label.length > LIMITS.metricLabel) err(`${p}.label`, `"${m.label}" is ${m.label.length} characters; keep metric labels to ${LIMITS.metricLabel}`);
      if (m.icon !== undefined && !ICON_NAMES.includes(m.icon)) err(`${p}.icon`, `unknown icon "${m.icon}"`);
      if (opt(p, m, 'unit', isStr, 'a short unit ("ms", "%", "$")') && m.unit.length > LIMITS.metricUnit) err(`${p}.unit`, `keep units to ${LIMITS.metricUnit} characters`);
    });
  }

  if (req('lesson', L, 'id', isStr, 'a string') && L.id !== fm[2]) err('id', `"${L.id}" must equal the file name slug "${fm[2]}"`);
  req('lesson', L, 'title', isStr, 'a non-empty string');
  maxLen('title', L.title, LIMITS.lessonTitle);
  req('lesson', L, 'summary', isStr, 'a non-empty string (one sentence)');
  maxLen('summary', L.summary, LIMITS.summary);
  req('lesson', L, 'minutes', (v) => Number.isInteger(v) && v >= 2 && v <= 40, 'a whole number of minutes from 2 to 40');
  enumField('lesson', L, 'level', LEVELS, true);
  if (req('lesson', L, 'youWillLearn', (v) => Array.isArray(v) && v.every(isStr), 'an array of strings')) {
    if (L.youWillLearn.length < 2 || L.youWillLearn.length > 5) err('youWillLearn', `needs 2 to 5 bullets (has ${L.youWillLearn.length})`);
  }

  const glossaryKeys = new Set();
  if (req('lesson', L, 'glossary', isObj, 'an object of "term": "one-sentence definition"')) {
    for (const [k, v] of Object.entries(L.glossary)) {
      if (glossaryKeys.has(k.toLowerCase())) err(`glossary["${k}"]`, 'duplicate term (keys are case-insensitive)');
      glossaryKeys.add(k.toLowerCase());
      if (!isStr(v)) err(`glossary["${k}"]`, 'definition must be a non-empty string');
      else if (wordCount(v) > 40) warn(`glossary["${k}"]`, `definition is ${wordCount(v)} words; keep it to one sentence (under 40 words)`);
      else checkInline(`glossary["${k}"]`, v, new Set(), new Set());
    }
  }
  const usedTerms = new Set();

  if (req('lesson', L, 'steps', (v) => Array.isArray(v) && v.length > 0, 'a non-empty array')) {
    if (L.steps.length < 4) warn('steps', `only ${L.steps.length} steps; most lessons need 6 to 10`);
    if (L.steps.length > 14) warn('steps', `${L.steps.length} steps; consider splitting the lesson (aim for 6 to 10)`);
    L.steps.forEach((s, i) => {
      const p = `steps[${i}]`;
      if (!isObj(s)) { err(p, 'must be an object'); return; }
      checkKeys(p, s, ['title', 'chapter', 'body', 'changes', 'metrics', 'callout', 'code', 'scene']);
      req(p, s, 'title', isStr, 'a non-empty string');
      maxLen(`${p}.title`, s.title, LIMITS.stepTitle);
      enumField(p, s, 'chapter', CHAPTERS, true);
      if (i === 0 && s.chapter !== 'setup') err(`${p}.chapter`, `the first step must be "setup" ("Where we are"): say in plain words what Notely (or the example) looks like right now, and introduce every block in the diagram, before any problem`);
      if (i > 0 && s.chapter === 'setup') err(`${p}.chapter`, '"setup" is only for the first step');
      if (i === 0 && 'changes' in s) err(`${p}.changes`, 'the first step has nothing to compare with; remove "changes"');
      if (i > 0) {
        if (!('changes' in s)) err(p, 'missing "changes": 1 to 4 lines saying what changed since the previous step, each starting with "+ " (added), "~ " (changed) or "− " (removed)');
        else if (!Array.isArray(s.changes) || s.changes.length < 1 || s.changes.length > LIMITS.changes || !s.changes.every(isStr)) err(`${p}.changes`, `must be an array of 1 to ${LIMITS.changes} strings`);
        else s.changes.forEach((c, j) => {
          if (!parseChange(c)) err(`${p}.changes[${j}]`, `"${c.slice(0, 40)}" must start with "+ ", "~ " or "− " (a plain "- " works too)`);
          else if (plainText(c).length > LIMITS.changeLine) warn(`${p}.changes[${j}]`, `is ${plainText(c).length} characters; keep each line under ${LIMITS.changeLine}`);
          checkInline(`${p}.changes[${j}]`, c, glossaryKeys, usedTerms);
        });
      }
      if ('metrics' in s) {
        if (!isObj(s.metrics)) err(`${p}.metrics`, 'must be an object: metric id -> value, or { value, tone }');
        else if (!metricIds.size) err(`${p}.metrics`, 'the lesson defines no "metrics"; add the definitions at the top level first');
        else for (const [id, v] of Object.entries(s.metrics)) {
          const mp = `${p}.metrics.${id}`;
          if (!metricIds.has(id)) { err(mp, `unknown metric "${id}". Defined: ${[...metricIds.keys()].join(', ')}`); continue; }
          const val = isObj(v) ? v.value : v;
          if (isObj(v)) { checkKeys(mp, v, ['value', 'tone']); enumField(mp, v, 'tone', TONES); }
          if (!(isNum(val) || (isStr(val) && val.length <= LIMITS.metricValue))) err(mp, `value must be a number or a short string (at most ${LIMITS.metricValue} characters), got ${JSON.stringify(val)}`);
        }
      }
      if (req(p, s, 'body', (v) => Array.isArray(v) && v.length > 0 && v.every(isStr), 'a non-empty array of paragraph strings')) {
        s.body.forEach((para, j) => checkInline(`${p}.body[${j}]`, para, glossaryKeys, usedTerms));
        const words = s.body.reduce((n, para) => n + wordCount(para), 0);
        if (words > LIMITS.bodyWordsError) err(`${p}.body`, `${words} words; the hard limit is ${LIMITS.bodyWordsError} (aim for ${LIMITS.bodyWordsWarn} or less). Split the step.`);
        else if (words > LIMITS.bodyWordsWarn) warn(`${p}.body`, `${words} words; aim for ${LIMITS.bodyWordsWarn} or less`);
        if (s.body.length > LIMITS.bodyParagraphs) err(`${p}.body`, `${s.body.length} paragraphs; at most ${LIMITS.bodyParagraphs} short ones`);
      }
      if ('callout' in s) {
        const c = s.callout;
        if (!isObj(c)) err(`${p}.callout`, 'must be an object { type, title?, text }');
        else {
          checkKeys(`${p}.callout`, c, ['type', 'title', 'text']);
          enumField(`${p}.callout`, c, 'type', CALLOUT_TYPES, true);
          opt(`${p}.callout`, c, 'title', isStr, 'a non-empty string');
          if (req(`${p}.callout`, c, 'text', isStr, 'a non-empty string')) {
            checkInline(`${p}.callout.text`, c.text, glossaryKeys, usedTerms);
            if (wordCount(c.text) > LIMITS.calloutWords) warn(`${p}.callout.text`, `${wordCount(c.text)} words; keep callouts under ${LIMITS.calloutWords}`);
          }
        }
      }
      if ('code' in s) {
        const c = s.code;
        if (!isObj(c)) err(`${p}.code`, 'must be an object { language, code, filename?, caption? }');
        else {
          checkKeys(`${p}.code`, c, ['language', 'code', 'filename', 'caption']);
          enumField(`${p}.code`, c, 'language', CODE_LANGUAGES, true);
          if (req(`${p}.code`, c, 'code', isStr, 'a non-empty string (use \\n for new lines)')) {
            const lines = c.code.split('\n');
            if (lines.length > 18) warn(`${p}.code.code`, `${lines.length} lines; keep snippets under 18 lines`);
            lines.forEach((ln, k) => { if (ln.length > 72) warn(`${p}.code.code`, `line ${k + 1} is ${ln.length} chars; keep lines under 72 so they fit without scrolling`); });
          }
          opt(`${p}.code`, c, 'filename', isStr, 'a non-empty string');
          opt(`${p}.code`, c, 'caption', isStr, 'a non-empty string');
        }
      }
      if ('scene' in s) {
        if (!isObj(s.scene)) err(`${p}.scene`, 'must be an object (omit "scene" to keep the previous step\'s diagram)');
        else checkKeys(`${p}.scene`, s.scene, ['extends', 'remove', 'nodes', 'edges', 'zones', 'notes', 'caption']);
      }
    });
    if (L.steps[0] && L.steps[0].scene === undefined && L.steps.some((s) => s && s.scene)) {
      warn('steps[0]', 'has no scene but later steps do; the first steps will show an empty diagram area');
    }
    const scenes = resolveLessonScenes(L.steps.filter(isObj), (i, path, msg) => err(`steps[${i}].${path}`, msg));
    linkSceneRoutes(scenes);
    scenes.forEach((sc, i) => {
      if (sc && L.steps[i] && isObj(L.steps[i].scene)) checkResolvedScene(`steps[${i}].scene`, sc, L.steps[i].scene);
    });
    // "What changed" must match the diagram and the metric tiles
    const metricSteps = metricIds.size ? resolveMetrics(L) : [];
    scenes.forEach((sc, i) => {
      const s = L.steps[i];
      if (i === 0 || !isObj(s) || !Array.isArray(s.changes)) return;
      const lines = s.changes.map((c) => ({ ...(parseChange(c) ?? { op: '?', text: c }), low: plainText(c).toLowerCase() }));
      const prev = scenes[i - 1];
      const before = new Map((prev?.nodes ?? []).map((n) => [n.id, n]));
      const now = new Map((sc?.nodes ?? []).map((n) => [n.id, n]));
      const mentions = (op, label) => lines.some((l) => l.op === op && l.low.includes(String(label).toLowerCase()));
      for (const [id, n] of now) {
        if (!before.has(id) && n.label && !mentions('+', n.label)) err(`steps[${i}].changes`, `block "${n.label}" (${id}) is new in this step: add a "+ " line that names it ("+ ${n.label}: <what it is, in 5-10 plain words>")`);
      }
      for (const [id, n] of before) {
        if (!now.has(id) && n.label && !mentions('-', n.label)) err(`steps[${i}].changes`, `block "${n.label}" (${id}) is gone in this step: add a "− " line that names it`);
      }
      for (const m of metricSteps[i] ?? []) {
        if (m.changed && !lines.some((l) => (l.op === '~' || l.op === '+') && l.low.includes(m.def.label.toLowerCase()))) {
          err(`steps[${i}].changes`, `metric "${m.def.label}" changed in this step: add a "~ " line that names it ("~ ${m.def.label} <old> → <new>")`);
        }
      }
    });
    const chapters = L.steps.map((s) => s?.chapter);
    if (!chapters.includes('recap') && L.steps.length >= 6) warn('steps', 'no step has chapter "recap"; consider ending with a short recap step');
  }

  if (req('lesson', L, 'quiz', (v) => Array.isArray(v), 'an array of 2 to 4 questions')) {
    if (L.quiz.length < 2 || L.quiz.length > 4) err('quiz', `needs 2 to 4 questions (has ${L.quiz.length})`);
    L.quiz.forEach((q, i) => {
      const p = `quiz[${i}]`;
      if (!isObj(q)) { err(p, 'must be an object { question, options }'); return; }
      checkKeys(p, q, ['question', 'options']);
      if (req(p, q, 'question', isStr, 'a non-empty string')) checkInline(`${p}.question`, q.question, glossaryKeys, usedTerms);
      if (req(p, q, 'options', Array.isArray, 'an array of 2 to 4 options')) {
        if (q.options.length < 2 || q.options.length > 4) err(`${p}.options`, `needs 2 to 4 options (has ${q.options.length})`);
        let correct = 0;
        q.options.forEach((o, j) => {
          const op = `${p}.options[${j}]`;
          if (!isObj(o)) { err(op, 'must be an object { text, correct?, why }'); return; }
          checkKeys(op, o, ['text', 'correct', 'why']);
          if (req(op, o, 'text', isStr, 'a non-empty string')) checkInline(`${op}.text`, o.text, glossaryKeys, usedTerms);
          if (req(op, o, 'why', isStr, 'a non-empty string explaining why this answer is right or wrong')) checkInline(`${op}.why`, o.why, glossaryKeys, usedTerms);
          if ('correct' in o && typeof o.correct !== 'boolean') err(`${op}.correct`, 'must be true or false');
          if (o.correct === true) correct++;
        });
        if (correct !== 1) err(`${p}.options`, `must have exactly one option with "correct": true (found ${correct})`);
      }
    });
  }
  if (req('lesson', L, 'takeaways', (v) => Array.isArray(v) && v.every(isStr), 'an array of strings')) {
    if (L.takeaways.length < 2 || L.takeaways.length > 6) err('takeaways', `needs 2 to 6 items (has ${L.takeaways.length})`);
    L.takeaways.forEach((t, i) => checkInline(`takeaways[${i}]`, t, glossaryKeys, usedTerms));
  }
  for (const k of glossaryKeys) if (!usedTerms.has(k)) warn(`glossary["${k}"]`, 'is never used as a <span class="term"> in the lesson');
  flush();
  return { ...L, nn: fm[1] };
}

// ---------------------------------------------------------------- main
if (!existsSync(CONTENT)) { console.error(`No content folder at ${CONTENT}`); process.exit(1); }
const folders = readdirSync(CONTENT).filter((f) => statSync(join(CONTENT, f)).isDirectory()).sort();
const orders = new Map();
let lessonCount = 0;
let moduleCount = 0;
for (const folder of folders) {
  if (filter && !folder.includes(filter)) continue;
  const dir = join(CONTENT, folder);
  const mod = validateModule(dir, folder);
  if (mod) {
    moduleCount++;
    if (orders.has(mod.order)) { current = `src/content/${folder}/module.json`; err('module.order', `${mod.order} is also used by "${orders.get(mod.order)}"`); flush(); }
    orders.set(mod.order, folder);
  }
  const files = readdirSync(dir).filter((f) => f !== 'module.json').sort();
  const nns = new Map();
  for (const f of files) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { current = relative(ROOT, full); err('', 'nested folders are not supported inside a module'); flush(); continue; }
    if (!f.endsWith('.json')) { current = relative(ROOT, full).replace(/\\/g, '/'); warn('', 'not a .json file; it will be ignored'); flush(); continue; }
    const lesson = validateLesson(full, f);
    if (!lesson) continue;
    lessonCount++;
    if (nns.has(lesson.nn)) { current = relative(ROOT, full).replace(/\\/g, '/'); err('', `number prefix ${lesson.nn} is also used by ${nns.get(lesson.nn)}; each lesson in a module needs its own NN`); flush(); }
    nns.set(lesson.nn, f);
  }
}
for (const [id] of Object.entries(KNOWN_MODULES)) {
  if (!filter && !folders.includes(id)) { current = 'src/content'; warn('', `expected module folder "${id}" is missing`); flush(); }
}

const color = errorCount ? '\x1b[31m' : '\x1b[32m';
console.log(`\n${color}${errorCount ? 'FAILED' : 'OK'}\x1b[0m  ${moduleCount} modules, ${lessonCount} lessons, ${errorCount} errors, ${warnCount} warnings`);
process.exit(errorCount ? 1 : 0);
