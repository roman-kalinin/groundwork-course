#!/usr/bin/env node
// Measures glyph advance widths of the scene fonts in Chromium and rewrites
// the GLYPHS table in shared/schema.js. Run after changing scene typography
// (the specs below must match the .iso-* text rules in src/styles.css):
//   node scripts/measure-glyphs.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = (p) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'node_modules', p)).toString('base64')}`;
const SPECS = {
  label: { family: 'Bricolage Grotesque Variable', weight: 650, size: 20, stretch: 'semi-condensed' },
  sub: { family: 'Instrument Sans Variable', weight: 500, size: 14.5, stretch: 'normal' },
  note: { family: 'Instrument Sans Variable', weight: 550, size: 15.5, stretch: 'normal' },
};
const html = `<style>
@font-face { font-family: 'Bricolage Grotesque Variable'; font-weight: 200 800; font-stretch: 75% 100%; src: url(${font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2')}) format('woff2-variations'); }
@font-face { font-family: 'Instrument Sans Variable'; font-weight: 400 700; font-stretch: 75% 100%; src: url(${font('@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2')}) format('woff2-variations'); }
</style><body>x</body>`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const tables = await page.evaluate(async (specs) => {
  const out = {};
  for (const [k, s] of Object.entries(specs)) {
    await document.fonts.load(`${s.weight} ${s.size}px "${s.family}"`);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${s.weight} ${s.size}px "${s.family}"`;
    ctx.fontStretch = s.stretch;
    const row = [];
    for (let c = 32; c <= 126; c++) row.push(Math.round(ctx.measureText(String.fromCharCode(c)).width * 10));
    out[k] = row;
  }
  return out;
}, SPECS);
await browser.close();
const file = path.join(ROOT, 'shared', 'schema.js');
const src = fs.readFileSync(file, 'utf8');
const block = `const GLYPHS = {\n${Object.entries(tables).map(([k, r]) => `  ${k}: [${r.join(',')}],`).join('\n')}\n};`;
const next = src.replace(/const GLYPHS = \{[\s\S]*?\n\};/, block);
if (next === src) console.log('GLYPHS table unchanged');
fs.writeFileSync(file, next);
console.log('specs:', JSON.stringify(SPECS));
