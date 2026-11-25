// Crawls every step of every lesson in a running preview server and reports
// layout problems: overlapping scene elements, text overflow, horizontal scroll
// and console errors.  Usage: node scripts/qa-audit.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4173/';
const root = path.resolve('src/content');
const lessons = [];
for (const m of fs.readdirSync(root)) {
  for (const f of fs.readdirSync(path.join(root, m)).filter((f) => /^\d\d-.*\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(root, m, f), 'utf8'));
    lessons.push({ m, id: j.id ?? f.slice(3, -5), n: j.steps.length });
  }
}
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const browser = await chromium.launch();
const issues = [];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') issues.push(`[${vp.name}] console: ${msg.text()}`); });
  page.on('pageerror', (e) => issues.push(`[${vp.name}] pageerror: ${e.message}`));
  for (const L of lessons) {
    for (let s = 1; s <= L.n + 2; s++) {
      const at = s <= L.n ? String(s) : s === L.n + 1 ? 'quiz' : 'recap';
      await page.goto(`${base}#/l/${L.m}/${L.id}/${at}`);
      await page.waitForSelector('.step, .quiz, .recap', { timeout: 10000 });
      await page.waitForTimeout(120);
      const found = await page.evaluate(() => {
        const out = [];
        const r = (el) => el.getBoundingClientRect();
        const inter = (a, b, pad = 0) => {
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return x > pad && y > pad ? Math.min(x, y) : 0;
        };
        const svg = document.querySelector('.scene-svg');
        if (svg) {
          const items = [];
          svg.querySelectorAll('.layer-nodes .node:not(.leaving)').forEach((n) => {
            const box = n.querySelector('.node-box');
            const label = n.querySelector('.node-label')?.textContent ?? '?';
            items.push({ kind: 'node', name: label, rect: r(box) });
            n.querySelectorAll('.node-tags > g').forEach((t) => items.push({ kind: 'tag', name: `${label}:${t.textContent}`, rect: r(t), owner: label }));
            // label overflow inside node box
            const bb = r(box);
            n.querySelectorAll('.node-label, .node-sub').forEach((t) => {
              const tr = r(t);
              if (tr.right > bb.right - 2 || tr.left < bb.left + 2) out.push(`text overflows node "${label}": "${t.textContent}"`);
            });
          });
          svg.querySelectorAll('.edge:not(.leaving) .edge-label').forEach((e) => items.push({ kind: 'elabel', name: e.textContent, rect: r(e.querySelector('rect')) }));
          svg.querySelectorAll('.edge:not(.leaving) .packet').forEach((e) => items.push({ kind: 'packet', name: e.textContent || 'dot', rect: r(e) }));
          svg.querySelectorAll('.layer-notes .note:not(.leaving)').forEach((e) => items.push({ kind: 'note', name: e.textContent, rect: r(e) }));
          for (let i = 0; i < items.length; i++)
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i], b = items[j];
              if (a.owner && (a.owner === b.owner || a.owner === b.name)) continue;
              if (b.owner && b.owner === a.name) continue;
              const o = inter(a.rect, b.rect, 1);
              if (o) out.push(`overlap ${a.kind} "${a.name}" x ${b.kind} "${b.name}" (${o.toFixed(0)}px)`);
            }
        }
        // horizontal overflow of page
        const de = document.documentElement;
        if (de.scrollWidth > window.innerWidth + 1) out.push(`page horizontal scroll ${de.scrollWidth} > ${window.innerWidth}`);
        // overflowing text containers (excluding intentional scrollers)
        document.querySelectorAll('.step-body, .step-title, .callout, .opt-btn, .takeaways li, .scene-caption').forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 2) out.push(`text overflow in .${el.className.split(' ')[0]}: ${el.textContent.slice(0, 50)}`);
        });
        return out;
      });
      for (const f of found) issues.push(`[${vp.name}] ${L.m}/${L.id}/${at}: ${f}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(issues.join('\n'));
console.log(`\n${issues.length} issues across ${lessons.length} lessons`);
