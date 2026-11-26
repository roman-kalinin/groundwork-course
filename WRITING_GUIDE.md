# Writing guide

You are writing lessons for **Groundwork**, an interactive course that takes a senior UX/UI designer who already ships apps with Claude Code (Vercel, Supabase, Cloudflare, GitHub) to an AI engineer who can build and sell end-to-end apps.

Read `LESSON_SCHEMA.md` for the file format. Then open these two lessons in the app and read every step: they are **the quality bar**.

- `src/content/data/00-meet-notely.json`: the course intro ("Start here"). It introduces Notely, Maya and the four parts of the app from zero.
- `src/content/data/01-tables-rows-keys.json`: a normal lesson written to every rule below (setup step, one idea per step, "What changed", metric tiles, a calm diagram).

## Your workflow

1. Edit or create `src/content/<module>/<NN>-<slug>.json`. Use only your module folder. Do not edit `module.json`, app code, `shared/`, or other writers' files. Do not touch `data/00-meet-notely.json`.
2. Write the lesson. Keep the lesson `id` equal to the slug.
3. Run **`npm run validate -- <module>`** and fix every error. Clear warnings unless you have a reason.
4. **Do not run `npm run build`, `npm run dev` or `npm run preview`.** Other writers work in parallel; builds and servers collide. (The build validates every module, so it fails until all modules are migrated. That is expected.)

## The learner

- Six years of senior product design. Sharp, visual, used to crits. Do not talk down.
- **A beginner developer.** Builds apps with Claude Code, so has *seen* words like Postgres, env vars, API routes and deploys, but does not know what is underneath. Assume nothing: if a lesson needs a part of the app, show it and say what it is.
- Is finishing a separate **system design** course (scaling, caching, load balancing, queues, sharding, replication, CDNs). **Do not re-teach those.** Link to them in one line when useful.
- Goal: get hired as an AI engineer, and sell full app builds to clients.

## Tone: explain like I'm 5, but not childish

- Short sentences. Plain words. **One idea per step.**
- The everyday picture first, then the real term. "The browser keeps a small note for each site. That note is a **cookie**."
- One concrete analogy when it truly helps (callout `analogy`). No baby talk, no "magic", no jokes that cost words.
- Name real things (status codes, function names, config flags), but **explain each one the first time**.
- Every lesson answers **why this matters when you build AI apps with Claude Code**, and **what to check when Claude Code does it for you** (a `claude-code` callout in at least one step).
- Be technically correct. If a fact moves fast (prices, model names, versions, free-tier limits), **leave it out** rather than guess. Invented scenario numbers ("12 lost saves a day") are fine when they are clearly the story's numbers.
- American English, no emojis, no exclamation marks in body text, no "simply", "just", "obviously", "easy".

## The running example

**Notely**: a small notes app with a **Summarize** button that asks the AI for a three-line summary. The user is **Maya**. The course intro (`data/00-meet-notely`) introduces its four parts, and every lesson may assume the learner has seen it, **but must still say what each part is the first time it appears in the lesson**:

| Part (block label) | What it is, in plain words | Kind / icon |
| --- | --- | --- |
| `Maya` | a Notely user | `person` / `user` |
| `Browser` | the screen Maya types into, on her laptop | `client` / `browser` |
| `App Server` | the computer running Notely's code (Next.js on Vercel) | `server` / `server` |
| `Database` | keeps every note (Postgres, run by Supabase) | `data` / `database` |
| `Claude API` | Anthropic's AI, which writes the summaries | `ai` / `sparkle` |

Use these labels so blocks look the same in every lesson. Cloudflare, GitHub, queues, caches and so on appear only in the lessons that need them, and are introduced there.

For the `clients` module (and anywhere client work fits better) use **a client's booking app**: a small hair salon that wants online bookings, reminders and payments. The owner is **Sam**. Introduce Sam and the app from zero in step 1, the same way.

Invent nothing that contradicts earlier lessons (Notely does not suddenly use MongoDB).

## Narration rules

These are the rules that make a lesson followable for a beginner. The validator checks the mechanical ones; you are responsible for the rest.

1. **Step 1 is "Where we are"** (`"chapter": "setup"`, required). In one or two plain sentences, say what Notely (or the example) looks like right now, *before* any problem. Its diagram shows exactly the parts the lesson starts with, and the text names each of them. Set the starting values of the metric tiles here.
2. **Introduce every block the first time it appears**, in the step text: what it is, in 5-10 plain words ("the app server (the computer running Notely's code)"). The `+ ` line in "What changed" names it again.
3. **One new idea per step.** If a step needs a second idea, it is two steps.
4. **The diagram only changes what the text talks about.** If the text does not mention it, it does not move, appear or change colour. Push what the step is not about into the background with `"status": "dim"` instead of deleting it.
5. **"What changed" matches exactly** what changed in the diagram and the tiles: `+ ` for each new block (by its label), `− ` for each removed block, `~ ` for each changed status, pill or metric (`~ Notes checked 2,000,000 → 1`). Nothing listed that did not change; nothing changed that is not listed. 1-4 lines; group small things ("− 10,000 users, App Server and Database: we zoom inside").
6. **No unexplained jargon or product names.** If Next.js, Vercel, JSON, an HTTP verb or a status code appears, say what it is in a few words, or leave it out. A glossary term (`<span class="term">`) helps but does not replace the short explanation.
7. **Flow: problem → idea → how → watch-out → recap**, after the setup step (see "Lesson shape").
8. **Body: at most 2 short paragraphs and about 60 words** (error above 75). **At most one callout.** Put details in a code block, a callout or the next step.

## Lesson shape

- **7-10 steps**, 8-15 minutes. One lesson = one concept you could explain on a whiteboard.
- The arc, using each step's `chapter`:
  1. `setup`: where we are (always step 1).
  2. `problem`: a concrete situation in Notely where things break or get confusing. Numbers turn red.
  3. `idea`: the core idea in one picture.
  4. `how` (2-4 steps): the mechanism, one moving part per step.
  5. `example`: the idea applied to Notely, with real code or config.
  6. `watch-out`: the classic mistake, the security hole, the 2 a.m. bug.
  7. `recap`: the whole story in 3-4 sentences.
- Then the quiz and the takeaways (the app adds the intro, quiz and recap screens for you).
- Module openers: the app shows a "New here? Meet Notely first" link on the intro screen of every module's first lesson, so you do not need to explain the course itself. Still write a full setup step.

## Step limits

| What | Limit |
| --- | --- |
| Step title | under 48 characters, sentence case, no full stop. Make it say something: "Cookies: the browser's pocket", not "Cookies". |
| Body | at most 2 paragraphs, about 60 words in total (warning above 60, error above 75) |
| `<b>` | at most one or two per paragraph |
| Callout | at most one per step, under 45 words |
| What changed | 1-4 lines, each under ~70 characters, from step 2 on |
| Code | under 18 lines, lines under 72 characters, only what illustrates the idea |
| Glossary definition | one sentence, under 40 words, no jargon that itself needs a definition |

## Callouts

| Type | Use it for |
| --- | --- |
| `analogy` | An everyday comparison that makes the idea click. |
| `tip` | A practical shortcut, a good default, or a link to the system design course. |
| `warn` | A common mistake or a security risk, stated plainly with the consequence. |
| `claude-code` | **What to check when Claude Code does this for you.** Concrete questions or things to grep for. Required in at least one step per lesson. |

## Scenes: calm, big, few

The diagram is the hero of the screen. The learner clicks Next and watches it change, so the scenes are **frames of one animation**. The rules come from what makes a good system design diagram readable: the name is on the block, there are few blocks, text lives in the side panel, numbers live in tiles.

**Blocks**
- **Few, big blocks: usually 3-5, never more than 6** (error). A crowd is **one** block: `"shape": "crowd"` with a count in the label ("10,000 users"), never ten person blocks.
- **The name is printed on the block.** `label` is 1-2 words, at most 16 characters ("App Server", "Worker", "Database", "notes"). There is no second line: `sublabel` is gone. Anything longer belongs in the step text.
- **At most one pill per block, and only for a live value or state**: `"25%"`, `"23 queued"`, `"round robin"`, `"id 101"`, `{ "text": "92% CPU", "gauge": 92, "tone": "bad" }`. Not a description, not a list of columns.
- Use `kind` for **what a thing is** (person, client, server, data, ai, external, threat); colour is only ever meaning. Use `shape` only when the kind's default would mislead: `tile` for a row or list item, `stack` for a file or pile, `token` for a tree node, `flag` for a pointer, `crowd` for many users.

**Edges and packets**
- **Edges are mostly unlabeled.** At most 2 labelled edges per scene, each label at most 2 words ("pull", "enqueue job", "user_id 7").
- **Packets carry no text.** Their colour is their meaning, explained by one legend under the diagram: `request` (blue), `response` (green), `data` (teal), `secret` (amber), `job` (violet), `error` (red). For a request and its answer use one edge with `"direction": "both"`.
- **Line up blocks that talk to each other** (same `y` for a request path, same `x` for a lookup): their edge is a straight line.

**Numbers leave the diagram**
- When numbers tell the story (notes checked, latency, cost, error rate, tokens, lost jobs), define 1-4 lesson `metrics` and set them per step. They show as tiles above the diagram, count up or down, and turn green or red with `tone`. Every change of a metric gets a `~ ` line.
- No numbers in labels or edge labels. A pill may show one live number on the block it belongs to.

**Breathing room**
- Use the whole 12 x 8 floor. **Connected blocks about 3.5-4 grid units apart**, unconnected neighbours at least 2.2 apart. Rows of a table about 2.3 apart.
- Plan the layout for the whole lesson first: sketch the busiest frame, then work backwards. Blocks keep their place across steps; when one moves, it means something.
- **Spotlight**: `"status": "dim"` on blocks and edges that this step is not about (it fades them strongly). `active` marks "look here"; `error`, `warn`, `ok` show trouble and the fix. A badge appears on the name plate in the step where a status changes.
- A step can zoom into one part by replacing the scene (a full scene without `extends`), for example from "App Server + Database" to the rows inside one table drawn in a zone. Say so in the text and in "What changed" (`− App Server and Database: we zoom inside`).
- Zones (at most 2) group blocks: "notes table", "Browser". Notes (speech bubbles) are not allowed.
- Always write a `caption`: one sentence saying what the learner should notice in this frame.
- The validator measures the real isometric picture, at rest and in motion. Fix overlaps by moving blocks (or setting an edge's `route`), not by shortening words.

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

`incognito` = attacker / someone else, `function` = serverless function, `vector` = embeddings, `bolt` = cache or fast, `sparkle` = AI, `robot` = agent or script. Need another icon? Ask the maintainer; do not add it yourself.

## Glossary and terms

- Wrap a word in `<span class=\"term\">...</span>` the **first time** it matters in the lesson. Do not wrap every occurrence.
- The text must match a glossary key (case-insensitive). For plurals or other forms use `data-term`.
- Define each term in one plain sentence that a designer understands without other jargon.

## Quiz rules

- 2-4 questions. 3 is ideal.
- Test **understanding and judgment**, not recall of wording. Best questions are small scenarios: "Claude Code wrote…, what do you change?"
- 3 options per question is ideal (max 4). Exactly one correct. Wrong options are plausible beginner mistakes, not jokes.
- Every option needs a `why`. Vary the position of the correct answer.

## Takeaways

3-5 sentences a learner could paste into their notes. Each one stands alone. Use `<b>` for the key word and `<code>` for real names.

## File naming

- `src/content/<module>/<NN>-<slug>.json`. `NN` sets the order inside the module (01, 02, ...); `00` is reserved for the course intro in `data`.
- Slug: lowercase words separated by dashes, matching the lesson `id`.

## Before you finish

- [ ] `npm run validate -- <module>` passes with no errors (and ideally no warnings) for your files
- [ ] Step 1 is `setup` and says where we are in plain words; every block is introduced when it first appears
- [ ] Every step: one idea, at most 2 short paragraphs (~60 words), at most one callout, a title that says something
- [ ] Every step after the first has a "What changed" list that matches the diagram and the tiles exactly
- [ ] At most 6 blocks per scene, names of 1-2 words on the blocks, at most one pill each, at most 2 short edge labels, no packet text
- [ ] Numbers that tell the story are metric tiles, not diagram text
- [ ] No product name or jargon without a few plain words saying what it is
- [ ] At least one `claude-code` callout, at least one analogy or tip, at least one realistic code snippet
- [ ] You did **not** run `npm run build` or a dev server, and touched only your own lesson files
