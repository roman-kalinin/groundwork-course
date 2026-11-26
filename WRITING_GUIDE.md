# Writing guide

You are writing lessons for **Groundwork**, an interactive course that takes a senior UX/UI designer who already ships apps with Claude Code (Vercel, Supabase, Cloudflare, GitHub) to an AI engineer who can build and sell end-to-end apps.

Read `LESSON_SCHEMA.md` for the file format. Open `src/content/security/02-sessions-vs-tokens.json` and read it in the app: it is the quality bar.

## Your workflow

1. Create `src/content/<module>/<NN>-<slug>.json`. Use only your module folder. Do not edit `module.json`, app code, `shared/`, or other writers' files.
2. Write the lesson. Keep the lesson `id` equal to the slug.
3. Run **`npm run validate`** (or `npm run validate -- <module>`) and fix every error. Clear warnings unless you have a reason.
4. **Do not run `npm run build`, `npm run dev` or `npm run preview`.** Other writers work in parallel; builds and servers collide.

## The learner

- Six years of senior product design. Sharp, visual, used to crits. Do not talk down.
- Builds real apps with Claude Code, so has *seen* Postgres, env vars, API routes, deploys. Does not yet know what is underneath, or how to judge Claude's output.
- Is finishing a separate **system design** course (scaling, caching, load balancing, queues, sharding, replication, CDNs). **Do not re-teach those.** Link to them in one line when useful: "You met caching in system design; here is the part that matters for…"
- Goal: get hired as an AI engineer, and sell full app builds to clients. Every lesson should make them better at both.

## Tone: explain like I'm 5, but not childish

- Short sentences. Plain words. **One idea per step.**
- Order inside a step: the everyday picture first, then the real term. "The browser keeps a small note for each site. That note is a **cookie**."
- Use a concrete analogy when it truly helps (callout type `analogy`). One per idea, never stacked. No baby talk, no "magic", no jokes that cost words.
- Name real things: real status codes, real function names, real config flags. Vagueness reads as fluff to a senior person.
- Every lesson answers **why this matters when you build AI apps with Claude Code**, and **what to check when Claude Code does it for you** (a `claude-code` callout in at least one step).
- Be technically correct and current. If a fact moves fast (prices, model names, version numbers, free-tier limits, default settings you are not sure of), **leave it out** rather than guess. Prefer timeless mechanisms over product trivia.
- American English, no emojis, no exclamation marks in body text, no "simply", "just", "obviously", "easy".

## The running example

Use **Notely**: a small notes app with an "AI summary" button. Next.js on Vercel, Supabase (Postgres + Auth), the Claude API for summaries, Cloudflare in front, code on GitHub. The user is **Maya**. Reuse it so lessons build on each other ("Notely's notes table", "Maya's summary request").

For the `clients` module (and anywhere client work fits better) use **a client's booking app**: a small hair salon that wants online bookings, reminders and payments. The owner is **Sam**.

Invent nothing that contradicts earlier lessons (Notely does not suddenly use MongoDB).

## Lesson shape

- **6-10 steps**, 8-15 minutes. One lesson = one concept you could explain on a whiteboard.
- A good arc, using the `chapter` tag of each step:
  1. `problem` – a concrete situation in Notely where things break or get confusing.
  2. `idea` – the core idea in one picture.
  3. `how` (2-4 steps) – the mechanism, one moving part per step.
  4. `example` – the idea applied to Notely or a client app, with real code or config.
  5. `watch-out` – the classic mistake, the security hole, the 2 a.m. bug.
  6. `recap` – the whole story in 3-4 sentences.
- Then the quiz and the takeaways (the app adds the intro, quiz and recap screens for you).

## Step limits

| What | Limit |
| --- | --- |
| Step title | under 48 characters, sentence case, no full stop. Make it say something: "Cookies: the browser's pocket", not "Cookies". |
| Body | 1-3 paragraphs, **70 words max in total** (validator warns above 70, fails above 110) |
| `<b>` | at most one or two per paragraph |
| Callout | one per step, under 60 words |
| Code | under 18 lines, lines under 72 characters, only what illustrates the idea |
| Glossary definition | one sentence, under 40 words, no jargon that itself needs a definition |

If a step needs more words, it is two steps.

## Callouts

| Type | Use it for |
| --- | --- |
| `analogy` | An everyday comparison that makes the idea click. "Think of it like this" is the default title. |
| `tip` | A practical shortcut, a good default, or a link to the system design course. |
| `warn` | A common mistake or a security risk, stated plainly with the consequence. |
| `claude-code` | **What to check when Claude Code does this for you.** Concrete questions or things to grep for: "Is the token in `localStorage`?", "Does the migration have a down step?" Required in at least one step per lesson. |

## Designing scenes that tell a story

The diagram is the lesson's whiteboard. The learner clicks Next and watches it change, so think of the scenes as **frames of one animation**, not separate pictures.

- **Plan the layout for the whole lesson first.** Sketch the final, busiest frame on the 12 x 8 grid, then work backwards. Nodes should keep their place across steps; when one moves, it should mean something.
- **Change one or two things per step**, and make it the thing the text talks about. Use `"extends": "previous"` and patch only what changes: a status, a new node, a packet.
- Show **flow with packets** (`"packet": { "label": "JWT" }`). Show **trouble with status**: `error` on the node that breaks, `warn` for risk, `ok` once fixed, `active` for "look here". Use `dim` to push the rest of the story into the background instead of deleting it.
- Use `kind` for **what a thing is** (client, server, data, ai, external, threat, person). Colour is only ever meaning: do not pick a kind for its colour.
- Use `shape` only when the kind's default block would mislead: `tile` for a row, an array cell or a list item, `token` for a tree or graph node, `flag` for a pointer or marker ("left", "head", "target"), `stack` for a folder or a pile of things, `block` for a plain box. A SQL row drawn as a database cylinder reads wrong; a tile reads right.
- **Trees read top-down when the root is at the back.** Put the root at a small x and y, the left child straight along y from its parent and the right child straight along x, off by at most 0.4 on the other axis (for example root `(0.9, 0.9)`, children `(1.3, 4.9)` and `(4.5, 1.3)`, then `(1.7, 7.3)` and `(3.9, 5.3)` under the left child): every branch is then a straight line, depth runs down the screen and left/right runs across it. A child off both axes of its parent gets an elbow that crosses its sibling or runs under a card.
- **The grid is drawn in isometric 3D.** Grid x runs down-right on screen, grid y runs down-left, and each node is a block with an upright card (label + sublabel) floating above it and its tags on the floor in front. So a row (same y) becomes a diagonal going down-right, and a column (same x) a diagonal going down-left.
- **Edges run along those two directions only**, never across: straight when the two nodes line up (same x or same y, within about 0.4), otherwise with one or two rounded 90° turns that the app picks to stay clear of blocks, text and other edges. **Line up nodes that are connected** (a request path on one row, a lookup in one column) and the diagram stays calm; scatter them and every edge needs an elbow. A request and its answer between the same two nodes run side by side automatically. Set an edge's `route` (`x-first`, `y-first`, `mid`) only when the automatic elbow tells the story less well. Nodes in a column need more room than on a flat board: keep **at least ~1.7 grid units between nodes stacked in y** (about 2 when the lower one is `active`, because active blocks float up), and ~2.2 between nodes in a row.
- **The camera frames each step on what that step shows** and glides between steps, so a step with three nodes is drawn large and a busy step smaller. Fewer, closer nodes means bigger, more readable diagrams.
- The validator measures the real isometric picture, at rest and in motion. It fails when two pieces of text cover each other (cards, tags, edge labels, notes, zone names), two blocks stand on each other, two zone plates partly overlap, an arrowhead hides under a card, tag or note, or a moving packet has no clear stretch of its edge to travel without covering text. It warns when a card hides most of another block, an edge runs mostly underneath cards, two edges run on top of each other, or two packets run into each other. Fix it by moving coordinates (or setting an edge's `route`), not by shortening words. Edge labels slide along their edge and zone names move to another spot on their plate on their own when their first spot is taken; a label fades while its own packet passes over it.
- **Status badges appear only where a status changes in that step** (and never more than three at once); the coloured ring on the floor carries the status everywhere else. So set `ok` / `warn` / `error` on the step where the change happens, and the badge marks it.
- **Keep it small**: 3-6 visible nodes. Labels of 1-2 words (the card grows with the text). Edge labels of 1-3 words; they are never cut, so write them short. On phones the diagram fits the screen width; when the whole step would be too small to read, the camera zooms in on what changed in the step and **Whole diagram** opens the full picture.
- A note whose spot is next to a block (within ~1.5 grid units) gets a tail pointing at it. Further away it is drawn as a free-standing sticker without a tail, so place a note next to the thing it talks about, or treat it as a caption.
- Use `zones` to group things ("Browser" vs "Server", "Before" vs "After") and `notes` for the thought bubble ("Who is this?").
- Always write a `caption`: one sentence that says what the learner should notice in this frame.
- Steps without a meaningful picture can omit `scene` (the previous frame stays). A lesson with no scenes at all shows text only; that is fine for a few topics, but most lessons should have a diagram.

### Icons

```
user users incognito browser phone laptop
server database table cloud function api globe queue bolt box layers rocket
key lock unlock shield cookie token id-card eye ban
file folder list search chart
code terminal git bug log gear flask pencil
sparkle brain chat robot vector
clock check x alert bell refresh link upload download trash
mail calendar money cart handshake graduation-cap
```

`incognito` = attacker / someone else, `function` = serverless function, `vector` = embeddings, `bolt` = cache or fast, `sparkle` = AI feature, `robot` = agent or script. Need another icon? Ask the maintainer; do not add it yourself.

## Glossary and terms

- Wrap a word in `<span class=\"term\">...</span>` the **first time** it matters in the lesson. Do not wrap every occurrence.
- The text must match a glossary key (case-insensitive). For plurals or other forms use `data-term`: `<span class=\"term\" data-term=\"cookie\">cookies</span>`.
- Define each term in one plain sentence that a designer understands without other jargon.

## Quiz rules

- 2-4 questions. 3 is ideal.
- Test **understanding and judgment**, not recall of wording. Best questions are small scenarios: "A client asks…", "Claude Code wrote…, what do you change?"
- 3 options per question is ideal (max 4). Exactly one correct. Wrong options must be plausible mistakes a real beginner makes, not jokes.
- Every option needs a `why`: for the right one, why it is right; for each wrong one, what misunderstanding it reflects. One or two sentences.
- Vary the position of the correct answer across questions.

## Takeaways

3-5 sentences a learner could paste into their notes. Each one stands alone and is actionable or memorable. Use `<b>` for the key word and `<code>` for real names.

## File naming

- `src/content/<module>/<NN>-<slug>.json`, e.g. `src/content/ai/03-streaming-responses.json`.
- `NN` sets the order inside the module (01, 02, ...). Use the numbers you were assigned so writers do not collide.
- Slug: lowercase words separated by dashes, matching the lesson `id`.

## Before you finish

- [ ] `npm run validate` passes with no errors (and ideally no warnings) for your files
- [ ] Every step: one idea, under 70 words, a title that says something
- [ ] At least one `claude-code` callout, at least one analogy or tip, at least one realistic code snippet
- [ ] Scenes change step by step and every scene has a caption
- [ ] Facts you were not sure about are removed, not hedged
- [ ] You did **not** run `npm run build` or a dev server, and touched only your own lesson files
