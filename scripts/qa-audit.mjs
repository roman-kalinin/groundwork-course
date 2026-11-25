// Crawls every step of every lesson in a running preview server and reports
// layout problems: overlapping diagram text (cards, tags, edge labels, notes,
// zone names, resting packets), text overflowing its pill or card, horizontal
// page scroll and console errors.  Usage: node scripts/qa-audit.mjs [baseUrl]
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
        const svg = document.querySelector('.stage .scene-svg');
        if (svg) {
          const items = [];
          svg.querySelectorAll('.layer-cards .iso-card:not(.leaving)').forEach((n) => {
            const box = n.querySelector('.card-bg');
            const label = n.querySelector('.card-label')?.textContent ?? '?';
            items.push({ kind: 'card', name: label, rect: r(box), owner: label });
            n.querySelectorAll('.iso-tag').forEach((t) => items.push({ kind: 'tag', name: `${label}:${t.textContent}`, rect: r(t.querySelector('rect')), owner: label }));
            // label overflow inside the card
            const bb = r(box);
            n.querySelectorAll('.card-label, .card-sub').forEach((t) => {
              const tr = r(t);
              if (tr.right > bb.right - 2 || tr.left < bb.left + 2) out.push(`text overflows card "${label}": "${t.textContent}"`);
            });
          });
          svg.querySelectorAll('.iso-elabel:not(.leaving)').forEach((e) => {
            items.push({ kind: 'elabel', name: e.textContent, rect: r(e.querySelector('rect')) });
            const tr = r(e.querySelector('text')), bb = r(e.querySelector('rect'));
            if (tr.right > bb.right - 1 || tr.left < bb.left + 1) out.push(`text overflows edge label "${e.textContent}"`);
          });
          svg.querySelectorAll('.layer-packets .packet').forEach((e) => items.push({ kind: 'packet', name: e.textContent || 'dot', rect: r(e.querySelector('.pk-body')) }));
          svg.querySelectorAll('.iso-note:not(.leaving)').forEach((e) => {
            items.push({ kind: 'note', name: e.textContent, rect: r(e.querySelector('.note-bg')) });
            const tr = r(e.querySelector('text')), bb = r(e.querySelector('.note-bg'));
            if (tr.right > bb.right - 1 || tr.left < bb.left + 1) out.push(`text overflows note "${e.textContent}"`);
          });
          svg.querySelectorAll('.iso-zlabel:not(.leaving)').forEach((e) => {
            items.push({ kind: 'zone', name: e.textContent, rect: r(e.querySelector('rect')) });
            const tr = r(e.querySelector('text')), bb = r(e.querySelector('rect'));
            if (tr.right > bb.right - 1) out.push(`text overflows zone name "${e.textContent}"`);
          });
          for (let i = 0; i < items.length; i++)
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i], b = items[j];
              if (a.owner && a.owner === b.owner) continue;
              const o = inter(a.rect, b.rect, 1);
              if (o > 2) out.push(`overlap ${a.kind} "${a.name}" x ${b.kind} "${b.name}" (${o.toFixed(0)}px)`);
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
