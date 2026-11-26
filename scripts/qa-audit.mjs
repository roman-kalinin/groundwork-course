// Crawls every step of every lesson in a running preview server and reports
// layout problems, in two passes:
//  1. still (reduced motion), 1440x900 and 390x844: overlapping diagram text
//     (name plates, pills, edge labels, notes, zone names, resting packets),
//     text overflowing its plate or pill, horizontal page scroll, console errors.
//  2. moving (motion on), 1440x900: the real frames a learner sees. Packets
//     are sampled at four moments of their loop and must not cover other text
//     (their own edge label ducks; the end blocks' pills sit above them)
//     or run into each other.
// Usage: node scripts/qa-audit.mjs [baseUrl] [--still-only] [--only=<module>[/<lesson>],...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4173/';
const stillOnly = process.argv.includes('--still-only');
const root = path.resolve('src/content');
const lessons = [];
for (const m of fs.readdirSync(root)) {
  for (const f of fs.readdirSync(path.join(root, m)).filter((f) => /^\d\d-.*\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(root, m, f), 'utf8'));
    lessons.push({ m, id: j.id ?? f.slice(3, -5), n: j.steps.length });
  }
}
// --only=data or --only=data/tables-rows-keys,data/meet-notely: audit just those modules / lessons
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
if (only) lessons.splice(0, lessons.length, ...lessons.filter((L) => only.some((o) => o === L.m || o === `${L.m}/${L.id}`)));
const browser = await chromium.launch();
const issues = [];

/** Runs in the page: collect diagram text boxes. */
function collect() {
  const r = (el) => el.getBoundingClientRect();
  const items = [];
  const out = [];
  const svg = document.querySelector('.stage .scene-svg');
  if (!svg) return { items, out };
  svg.querySelectorAll('.layer-cards .iso-plate:not(.leaving)').forEach((n) => {
    const box = n.querySelector('.plate-bg');
    const label = n.querySelector('.plate-label')?.textContent ?? '?';
    items.push({ kind: 'plate', name: label, rect: r(box).toJSON(), owner: n.dataset.node });
    const bb = r(box);
    n.querySelectorAll('.plate-label').forEach((t) => {
      const tr = r(t);
      if (tr.right > bb.right - 2 || tr.left < bb.left + 2) out.push(`text overflows name plate "${label}": "${t.textContent}"`);
    });
  });
  svg.querySelectorAll('.layer-tags .iso-pill:not(.leaving)').forEach((g) => {
    const box = g.querySelector('.pill-bg');
    items.push({ kind: 'pill', name: `${g.dataset.node}:${g.textContent}`, rect: r(box).toJSON(), owner: g.dataset.node });
    const tr = r(g.querySelector('text')), bb = r(box);
    if (tr.right > bb.right - 2) out.push(`text overflows pill "${g.textContent}"`);
  });
  svg.querySelectorAll('.iso-elabel:not(.leaving)').forEach((e) => {
    items.push({ kind: 'elabel', name: e.textContent, rect: r(e.querySelector('rect')).toJSON(), edge: e.dataset.edge });
    const tr = r(e.querySelector('text')), bb = r(e.querySelector('rect'));
    if (tr.right > bb.right - 1 || tr.left < bb.left + 1) out.push(`text overflows edge label "${e.textContent}"`);
  });
  svg.querySelectorAll('.iso-note:not(.leaving)').forEach((e) => {
    items.push({ kind: 'note', name: e.textContent, rect: r(e.querySelector('.note-bg')).toJSON() });
    const tr = r(e.querySelector('text')), bb = r(e.querySelector('.note-bg'));
    if (tr.right > bb.right - 1 || tr.left < bb.left + 1) out.push(`text overflows note "${e.textContent}"`);
  });
  svg.querySelectorAll('.iso-zlabel:not(.leaving)').forEach((e) => {
    items.push({ kind: 'zone', name: e.textContent, rect: r(e.querySelector('rect')).toJSON() });
    const tr = r(e.querySelector('text')), bb = r(e.querySelector('rect'));
    if (tr.right > bb.right - 1) out.push(`text overflows zone name "${e.textContent}"`);
  });
  return { items, out };
}

/** Runs in the page: visible packets right now. */
function packets() {
  const list = [];
  document.querySelectorAll('.stage .scene-svg .layer-packets .pk-in').forEach((g) => {
    g.querySelectorAll('.packet').forEach((p) => {
      const op = Number(getComputedStyle(p).opacity);
      if (op < 0.6) return;
      list.push({ edge: g.dataset.edge, from: g.dataset.from, to: g.dataset.to, name: p.textContent || 'dot', rect: p.querySelector('.pk-body').getBoundingClientRect().toJSON() });
    });
  });
  const ducked = new Set();
  document.querySelectorAll('.stage .scene-svg .iso-elabel').forEach((e) => {
    const inner = e.firstElementChild;
    if (inner && Number(getComputedStyle(inner).opacity) < 0.6) ducked.add(e.dataset.edge);
  });
  return { list, ducked: [...ducked] };
}

const inter = (a, b, pad = 0) => {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > pad && y > pad ? Math.min(x, y) : 0;
};

// ---------------------------------------------------------------- pass 1: still
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') issues.push(`[${vp.name}] console: ${msg.text()}`); });
  page.on('pageerror', (e) => issues.push(`[${vp.name}] pageerror: ${e.message}`));
  for (const L of lessons) {
    for (let s = 1; s <= L.n + 2; s++) {
      const at = s <= L.n ? String(s) : s === L.n + 1 ? 'quiz' : 'recap';
      await page.goto(`${base}#/l/${L.m}/${L.id}/${at}`);
      await page.waitForSelector('.step, .quiz, .recap', { timeout: 10000 });
      await page.waitForTimeout(140);
      const found = await page.evaluate(({ collectSrc }) => {
        const collect = new Function(`return (${collectSrc})`)();
        const { items, out } = collect();
        const r = (el) => el.getBoundingClientRect();
        // resting packets (reduced motion)
        document.querySelectorAll('.stage .scene-svg .layer-packets .packet').forEach((p) => items.push({ kind: 'packet', name: p.textContent || 'dot', rect: r(p.querySelector('.pk-body')).toJSON() }));
        const inter = (a, b, pad = 0) => {
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return x > pad && y > pad ? Math.min(x, y) : 0;
        };
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (a.owner && a.owner === b.owner) continue;
            const o = inter(a.rect, b.rect, 1);
            if (o > 2) out.push(`overlap ${a.kind} "${a.name}" x ${b.kind} "${b.name}" (${o.toFixed(0)}px)`);
          }
        const de = document.documentElement;
        if (de.scrollWidth > window.innerWidth + 1) out.push(`page horizontal scroll ${de.scrollWidth} > ${window.innerWidth}`);
        document.querySelectorAll('.step-body, .step-title, .callout, .opt-btn, .takeaways li, .scene-caption').forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 2) out.push(`text overflow in .${el.className.split(' ')[0]}: ${el.textContent.slice(0, 50)}`);
        });
        return out;
      }, { collectSrc: collect.toString() });
      for (const f of found) issues.push(`[${vp.name}] ${L.m}/${L.id}/${at}: ${f}`);
    }
  }
  await ctx.close();
}

// ---------------------------------------------------------------- pass 2: moving
if (!stillOnly) {
  const jobs = [];
  for (const L of lessons) for (let s = 1; s <= L.n; s++) jobs.push({ L, s });
  const workers = 4;
  const run = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') issues.push(`[motion] console: ${msg.text()}`); });
    page.on('pageerror', (e) => issues.push(`[motion] pageerror: ${e.message}`));
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const { L, s } = job;
      await page.goto(`${base}#/l/${L.m}/${L.id}/${s}`);
      await page.waitForSelector('.step', { timeout: 10000 });
      await page.waitForTimeout(1300); // camera, glide and entrances settle
      const { items } = await page.evaluate(collect);
      const seen = new Set();
      for (let k = 0; k < 4; k++) {
        if (k) await page.waitForTimeout(430);
        const { list, ducked } = await page.evaluate(packets);
        for (const p of list) {
          for (const it of items) {
            if (it.kind === 'elabel' && (it.edge === p.edge || ducked.includes(it.edge))) continue;
            if (it.kind === 'pill' && (it.owner === p.from || it.owner === p.to)) continue;
            const o = inter(p.rect, it.rect, 1);
            if (o > 3) seen.add(`moving packet "${p.name}" (${p.edge}) covers ${it.kind} "${it.name}" (${o.toFixed(0)}px)`);
          }
        }
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          if (list[i].edge === list[j].edge) continue;
          const o = inter(list[i].rect, list[j].rect, 1);
          if (o > 4) seen.add(`moving packets "${list[i].name}" (${list[i].edge}) and "${list[j].name}" (${list[j].edge}) collide (${o.toFixed(0)}px)`);
        }
      }
      for (const f of seen) issues.push(`[motion] ${L.m}/${L.id}/${s}: ${f}`);
    }
    await ctx.close();
  };
  await Promise.all(Array.from({ length: workers }, run));
}

await browser.close();
console.log(issues.join('\n'));
console.log(`\n${issues.length} issues across ${lessons.length} lessons`);
