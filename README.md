# Groundwork

An interactive, plain-language course for designers who build with Claude Code and want to become AI engineers: data, security, debugging, production, AI engineering, client delivery and interview basics.

Static site: Vite + React + TypeScript, hash routing, progress saved in `localStorage`.

```bash
npm install
npm run dev        # local dev server
npm run validate   # check all lesson / module JSON
npm run build      # validate + typecheck + build to dist/
npm run preview    # serve dist/
```

Deploy: import the repo in Vercel (framework preset Vite, output `dist`). No server, no env vars.

## Where things live

| Path | What |
| --- | --- |
| `src/content/<module>/module.json` | Module metadata (id, title, order, summary, color) |
| `src/content/<module>/NN-slug.json` | One lesson. Discovered automatically. |
| `shared/schema.js` | Constants, scene resolver and inline-HTML sanitizer shared by the app and the validator |
| `shared/icons.js` | The fixed icon set for scene nodes |
| `scripts/validate.mjs` | `npm run validate` |
| `src/components/SceneView.tsx` | SVG diagram renderer and step-to-step animation |
| `LESSON_SCHEMA.md` | The lesson format, annotated |
| `WRITING_GUIDE.md` | Rules for content writers |
