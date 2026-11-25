# Groundwork

An interactive, plain-language course for designers who build with Claude Code and want to become AI engineers. It has 7 modules and 46 lessons: data and SQL, security, debugging, running in production, AI engineering, client delivery, and coding-interview basics.

Each lesson is a short whiteboard story. You click through steps with an animated diagram, then take a quiz and read a recap. Progress is saved in the browser (`localStorage`). There are no accounts and no server.

**Live site:** https://ai-engineer-path-sigma.vercel.app

Stack: Vite + React + TypeScript, hash routing (`#/l/<module>/<lesson>`), a static build in `dist/`.

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # dev server with hot reload (http://localhost:5173)
npm run validate   # check every module and lesson JSON file
npm run build      # validate + typecheck + production build to dist/
npm run preview    # serve dist/ at http://localhost:4173
```

### Visual QA (optional)

`npm run qa` opens every step of every lesson in headless Chromium at 1440x900 and 390x844. It reports overlapping diagram parts, text that overflows nodes, horizontal page scroll and console errors. Start `npm run preview` first. The first time, run `npx playwright install chromium`.

## Add a lesson

1. Pick the module folder in `src/content/<module>/`. The seven modules are `data`, `security`, `debugging`, `production`, `ai`, `clients` and `interviews`.
2. Create `NN-slug.json`. `NN` is the two-digit position (`07`) and `slug` is the lesson id in kebab-case. The `id` inside the file must equal the slug.
3. Write it by following `LESSON_SCHEMA.md` (the format, annotated) and `WRITING_GUIDE.md` (voice, word budgets, diagram rules). `src/content/security/02-sessions-vs-tokens.json` is the reference lesson to copy from.
4. Run `npm run validate`. It names the exact field for each problem. It also warns when diagram nodes overlap or an edge label is too wide for the gap between its nodes.
5. Check it in the browser with `npm run dev`. The lesson is at `#/l/<module>/<slug>`.

No index file needs editing: the app finds lessons and modules automatically. To add a whole module, create a folder with a `module.json` (see `LESSON_SCHEMA.md`).

## Redeploy

The site is the Vercel project `ai-engineer-path`. This folder is already linked to it (`.vercel/`, not committed). The build settings are in `vercel.json`: build command `npm run build`, output `dist`, framework Vite.

```bash
npm run build                 # make sure it passes locally first
vercel deploy --prod --yes    # build on Vercel and publish to production
```

A preview deploy without `--prod` gives a separate URL and leaves production alone. On a new machine, run `vercel link --project ai-engineer-path` first. The site needs no environment variables.

## Where things live

| Path | What |
| --- | --- |
| `src/content/<module>/module.json` | Module metadata (id, title, order, summary, color) |
| `src/content/<module>/NN-slug.json` | One lesson. Discovered automatically. |
| `shared/schema.js` | Constants, scene resolver, text-width measurements and inline-HTML sanitizer, shared by the app and the validator |
| `shared/icons.js` | The fixed icon set for diagram nodes |
| `scripts/validate.mjs` | `npm run validate` |
| `scripts/qa-audit.mjs` | `npm run qa` (browser layout audit) |
| `src/components/SceneView.tsx` | SVG diagram renderer and step-to-step animation |
| `src/components/LessonPage.tsx` | Lesson player: intro, steps, quiz, recap |
| `LESSON_SCHEMA.md` | The lesson format, annotated |
| `WRITING_GUIDE.md` | Rules for content writers |
