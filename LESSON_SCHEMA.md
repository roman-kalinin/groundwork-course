# Lesson schema

Everything the learner sees is plain JSON in `src/content/`. The app finds files on its own, so you never edit shared code or an index file.

```
src/content/
  data/                          <- module folder = module id
    module.json                  <- module metadata
    00-meet-notely.json          <- the course's story intro ("Start here")
    01-tables-rows-keys.json     <- lesson: NN-slug.json
```

- **Module order** comes from `order` in `module.json`.
- **Lesson order** comes from the two-digit `NN` prefix of the file name (00, 01, 02, ...). Gaps are fine.
- The lesson `id` must equal the slug part of the file name (`tables-rows-keys`).
- The URL of a lesson is `#/l/<moduleId>/<lessonId>`.
- Run `npm run validate -- <module>` after every edit. It checks everything below and points at the exact field.

**The reference lessons are `src/content/data/01-tables-rows-keys.json` (a normal lesson) and `src/content/data/00-meet-notely.json` (the story intro).** When in doubt, copy their patterns. Read `WRITING_GUIDE.md` for the rules behind them.

---

## module.json

```jsonc
{
  "id": "security",                       // must equal the folder name
  "title": "Security for app builders",
  "order": 2,                             // position on the home page
  "summary": "One sentence about the module.",
  "color": "rose",                        // optional: blue | teal | green | amber | rose | violet | slate
  "icon": "shield"                        // optional: a scene icon name, painted on the module's iso block
}
```

The seven modules already exist: `data` (1), `security` (2), `debugging` (3), `production` (4), `ai` (5), `clients` (6), `interviews` (7).

---

## Lesson file: annotated example

Comments (`//`) are only here for explanation. Real JSON files cannot contain comments.

```jsonc
{
  "id": "rate-limiting",                  // = file slug: 05-rate-limiting.json
  "title": "Rate limiting",               // short, under ~60 characters
  "summary": "One sentence: what this lesson gives the learner.",
  "minutes": 10,                          // whole number, honest reading time
  "level": "beginner",                    // beginner | intermediate | advanced
  "youWillLearn": ["Why an AI endpoint needs a limit", "How a <b>token bucket</b> works"],
  "glossary": {                           // term -> one plain sentence (tooltips)
    "rate limit": "A cap on how many requests one user may make in a period of time."
  },

  // OPTIONAL: numbers that tell the story. Shown as tiles ABOVE the diagram,
  // updated per step. 1-4 definitions.
  "metrics": [
    { "id": "cost", "label": "AI cost", "icon": "money", "unit": "$ / day" },
    { "id": "blocked", "label": "Blocked calls", "icon": "ban" }
  ],

  "steps": [
    {
      // STEP 1 IS ALWAYS "setup": where we are, before anything goes wrong.
      "title": "Notely's Summarize button",
      "chapter": "setup",
      "body": [
        "Notely has a Summarize button. Maya clicks it, the app server (the computer running Notely's code) sends her note to the Claude API (Anthropic's AI), and a summary comes back.",
        "Each summary costs Notely a fraction of a cent."
      ],
      "metrics": { "cost": { "value": 2, "tone": "good" }, "blocked": 0 },
      "scene": {
        "caption": "Maya's click goes through the app server to the Claude API.",
        "nodes": [
          { "id": "maya", "x": 0.8, "y": 3.6, "label": "Maya", "icon": "user", "kind": "person" },
          { "id": "app", "x": 4.6, "y": 3.6, "label": "App Server", "icon": "server", "kind": "server" },
          { "id": "llm", "x": 8.4, "y": 3.6, "label": "Claude API", "icon": "sparkle", "kind": "ai" }
        ],
        "edges": [
          { "from": "maya", "to": "app", "packet": { "kind": "request", "direction": "both" } },
          { "from": "app", "to": "llm", "packet": { "kind": "request", "direction": "both" } }
        ]
      }
    },
    {
      "title": "One script, ten thousand clicks",
      "chapter": "problem",
      "body": ["Someone writes a script that presses Summarize all night. Every press costs money."],
      "changes": [                         // REQUIRED from step 2 on: what is different from the step before
        "+ Script: a program clicking Summarize nonstop",
        "~ AI cost $2 → $900 a day"
      ],
      "metrics": { "cost": { "value": 900, "tone": "bad" } },   // only what changed; the rest carries forward
      "scene": {
        "extends": "previous",
        "nodes": [
          { "id": "maya", "status": "dim" },
          { "id": "bot", "x": 4.6, "y": 0.6, "label": "Script", "icon": "robot", "kind": "threat", "status": "active" },
          { "id": "llm", "status": "error", "pill": { "text": "$900/day", "tone": "bad" } }
        ],
        "edges": [
          { "id": "maya>app", "status": "dim", "packet": false },
          { "from": "bot", "to": "app", "packet": { "kind": "error", "speed": "fast" } }
        ]
      }
    }
  ],
  "quiz": [ /* 2-4 questions, see below */ ],
  "takeaways": ["Every paid or slow endpoint needs a limit per user."]
}
```

---

## Field reference

### Lesson (top level)

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Equals the file slug. |
| `title` | string | Short. Under ~60 characters. |
| `summary` | string | One sentence. Shown on module page and lesson intro. |
| `minutes` | integer | 2-40. |
| `level` | enum | `beginner`, `intermediate`, `advanced`. |
| `youWillLearn` | string[] | 2-5 items. Inline HTML allowed. |
| `glossary` | object | `"term": "one sentence"`. Case-insensitive keys. |
| `metrics` | Metric[] | Optional, 1-4. See "Metric tiles". |
| `steps` | Step[] | Aim for 6-10. Validator warns under 4 or over 14. |
| `quiz` | Question[] | 2-4. |
| `takeaways` | string[] | 2-6. |

### Step

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | Required. Under ~48 characters. |
| `chapter` | enum | Required. `setup` (step 1 only, and step 1 must be `setup`: shown as "Where we are"), `problem`, `idea`, `how`, `example`, `watch-out`, `recap`. |
| `body` | string[] | Required. **At most 2 paragraphs** (error above 2). Warning above 60 words in total, error above 75. |
| `changes` | string[] | **Required on every step except the first** (error on step 1). 1-4 lines, each starting with `+ ` (added), `~ ` (changed) or `− ` (removed; a plain `- ` also works). Inline HTML allowed. Shown as the "What changed" list. See "What changed" below. |
| `metrics` | object | Optional. Metric id -> a number, a short string, or `{ "value", "tone" }`. See "Metric tiles". |
| `callout` | object | Optional, at most one. `{ type, title?, text }`. Warning above 45 words. |
| `code` | object | Optional. `{ language, code, filename?, caption? }`. `code` uses `\n` for new lines. Under 18 lines, lines under 72 characters. |
| `scene` | object | Optional. See "Scenes". Omit it to keep the previous diagram unchanged. |

### What changed (`changes`)

The side panel shows a **What changed** list under the text of every step after the first, comparing it with the step before, like this:

```
+ Database: Postgres, run for us by Supabase
~ Lost saves 12 → 0 a day
− Notes File
```

- `+ ` something new appeared (a block, an edge that matters, a rule). A new block's line **names the block by its label** and says what it is in 5-10 plain words.
- `~ ` something changed: a status, a pill, a metric (`~ Database CPU 92% → 25%`; use `→` between old and new).
- `− ` something was removed. It **names the removed block by its label**.

The validator enforces the match with the diagram and the tiles (errors):
- every block that is new in this step's scene must be named in a `+ ` line (its `label`, case-insensitive);
- every block that left must be named in a `− ` line;
- every metric whose value or tone changed must be named (its `label`) in a `~ ` or `+ ` line.

In the diagram, blocks and edges that were added or changed in this step get a short highlight ring/glow automatically, so the list and the picture point at the same things.

### Metric tiles (`metrics`)

Numbers leave the diagram. When the numbers tell the story (rows read, latency, cost, error rate, tokens, lost jobs), define them once at the top of the lesson and set their values per step. They are drawn as a row of tiles above the diagram; numbers count up or down when they change; the tile is coloured by its tone.

Definition (top level, 1-4): `{ "id": "p95", "label": "P95 latency", "icon": "clock", "unit": "ms" }`
- `id`: letters, digits, `-`, `_`. `label`: at most 16 characters. `icon`: optional scene icon name. `unit`: optional, at most 6 characters, shown after the value (`ms`, `%`, `/ day`, `a day`).

Value (per step): `"metrics": { "p95": { "value": 40, "tone": "good" }, "hits": "80%" }`
- `value`: a number (formatted as `2,000,000`, keeps your decimals, animates) or a short string (at most 10 characters, does not animate).
- `tone`: `good` (green), `bad` (red), `warn` (amber), `neutral` (default). Say good when the number is where you want it.
- Values **carry forward**: a step lists only the metrics it changes. Before a metric's first value its tile shows "–".
- Set the first values in step 1 (setup), so the learner sees the starting point.

### Inline HTML (body, changes, callout text, youWillLearn, quiz text, why, takeaways, glossary)

Only these tags are allowed. Everything else is rejected by the validator and escaped by the app.

| Markup | Use for |
| --- | --- |
| `<b>...</b>` | The one or two words that matter most in a paragraph. |
| `<em>...</em>` | Light emphasis. |
| `<code>...</code>` | Code, file names, flags, HTTP status codes, function names. |
| `<span class="term">cookie</span>` | A glossary word. The text must match a glossary key (case-insensitive). |
| `<span class="term" data-term="cookie">cookies</span>` | Glossary word whose visible text differs from the key (plurals etc.). |

Inside JSON strings, quotes must be escaped: `<span class=\"term\">`. Write `&lt;` and `&gt;` for literal `<` and `>`. Plain `&`, `'`, `→`, `−` and `…` are fine.

### Quiz question

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | Inline HTML allowed. |
| `options` | Option[] | 2-4. Exactly one with `"correct": true`. |
| `options[].text` | string | The answer. |
| `options[].correct` | boolean | Only on the right answer. |
| `options[].why` | string | Required on **every** option. Why it is right, or why it is wrong. |

---

## Scenes (interactive diagrams)

A scene is a drawing on a **12 x 8 grid**. `x` goes from 0 to 12, `y` from 0 to 8. Halves are fine (`6.5`).

The app draws this grid as an **isometric floor** (classic 2:1): grid `x` runs down-right on screen, grid `y` runs down-left. Every node is a **big 3D block** (about 1.2 x 1.2 grid units of floor) whose shape follows its `kind` or `shape`. **Its name is printed on a plate fixed to the block's front corner**; its icon is painted on top. There are no floating cards and no second line of text. A block may carry **one pill** (a live value or state) just above it. Edges run along the floor as ink lines with flat arrowheads, along the two grid axes only, with rounded 90° turns. Packets are plain coloured dots; the legend under the diagram says what each colour means.

The app animates between steps: things that leave fade out, new things rise in, nodes that keep their `id` glide to their new position, status colours cross-fade, packets travel along edges, and what changed gets a short highlight. **The camera frames each step on what that step shows.** Each diagram has Replay and Pause. On a phone the diagram fits the screen width, never zooms out so far that the names become unreadable (it centres on what changed instead), and **Whole diagram** opens it full screen.

### Scene object

| Field | Type | Meaning |
| --- | --- | --- |
| `extends` | `"previous"` | Start from the previous step's resolved scene, then apply this one as a patch. |
| `remove` | string[] | Only with `extends`. Ids of nodes, edges or zones to delete. Removing a node also removes its edges. |
| `nodes` | Node[] | Blocks. **At most 6 per scene** (all of them count, dimmed ones too; a crowd counts as 1). |
| `edges` | Edge[] | Arrows between nodes. **At most 2 with a label.** |
| `zones` | Zone[] | At most 2 labelled floor plates ("users table", "Browser"). |
| `caption` | string | One sentence under the diagram. Also read by screen readers. Strongly recommended. |

`notes` (speech bubbles) are **not allowed** any more: text belongs in the side panel.

**Three ways to write a step's scene:**

1. **Omit `scene`**: the diagram stays exactly as in the previous step.
2. **Full scene** (no `extends`): replaces everything. Items whose `id` matches the previous step still animate smoothly from where they were.
3. **Patch** (`"extends": "previous"`): items with an existing `id` are merged (only the fields you write change), new ids are added, `remove` deletes. Setting a field to `null` removes it (`"pill": null`, `"route": null`).

The first step that has a scene must be a full scene.

### Node

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | | Letters, digits, `-`, `_`. Unique across the scene. |
| `x`, `y` | number | | Centre of the block, in grid units. |
| `label` | string | | **The name printed on the block. At most 2 words and 16 characters** ("App Server", "Database", "Claude API", "20,000 users"). Error above. |
| `icon` | string | none | One of the icon names below, painted on top of the block. |
| `kind` | enum | `neutral` | What the thing is; sets the colour and the default shape: `neutral`, `person`, `client`, `server`, `data`, `ai`, `external`, `threat`. |
| `shape` | enum | by kind | Optional: `tile` (flat slab: a row, a list item), `token` (round disc: a tree or graph node), `flag` (a pointer or marker), `stack` (a pile, a file), `block` (plain box), **`crowd`** (a group of people on one plinth: many users drawn as ONE block; put the count in the label, "1,000 users"; colour is `person` unless you set `kind`). |
| `status` | enum | `normal` | `normal`, `active` (floats up, accent ring: "look here"), `ok` (green ring), `warn` (amber ring), `error` (red, small shake), `dim` (strongly faded: not part of this step). A badge (check, !, x) appears on the name plate only in the step where the status changes. |
| `pill` | string or object | none | **At most one per node**: a short **live value or state**, at most 12 characters: `"25%"`, `"23 queued"`, `"round robin"`, `"id 101"`. Object form: `{ "text": "92% CPU", "icon": "chart", "gauge": 92, "tone": "bad" }` (`gauge` 0-100 draws a small bar; `tone`: neutral, good, warn, bad). |

Removed fields (errors): `sublabel` (say it in the text), `tags` (use `pill`), `w`.

Spacing: a block covers about 1.2 x 1.2 grid units, and its name plate hangs below its front corner. Keep **connected blocks about 3.5-4 grid units apart** along the line (so the edge and its packet have room), and **at least 2.2 apart** for blocks stacked in `y` or `x` without an edge between them (rows of a table: about 2.3). The validator measures the real picture and tells you when plates, pills or labels touch.

### Edge

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | `"from>to"` | Only needed if two edges join the same two nodes in the same direction. |
| `from`, `to` | node id | | Required. |
| `label` | string | | **Mostly leave it out.** At most 2 words and 14 characters ("pull", "enqueue job", "user_id 7"), and at most 2 labelled edges per scene. |
| `style` | enum | `solid` | `solid`, `dashed` (optional or later), `dotted` (weak, background). |
| `status` | enum | `normal` | Same values as nodes; colours the line and arrow. |
| `arrow` | enum | `end` | `end`, `start`, `both`, `none`. |
| `route` | enum | automatic | `x-first`, `y-first` (an L) or `mid` (a Z). Only when the automatic route tells the story less well. |
| `packet` | `true` / `false` / object | none | A dot travelling along the edge, on a loop. |

**Packet object:** `{ "kind"?: "request", "direction"?: "forward" | "backward" | "both", "returns"?: "<kind>", "speed"?: "slow" | "normal" | "fast" }`. `true` = a request. **Packets carry no text** (`label` and `status` are errors). The colour is the meaning, explained by the legend under the diagram:

| `kind` | Colour | Legend says | Use for |
| --- | --- | --- | --- |
| `request` | blue | request | something asked for or sent: a click, an API call, a prompt |
| `response` | green | response | the answer coming back |
| `data` | teal | data / rows | rows, files, query results moving to or from storage |
| `secret` | amber | key or token | a password, API key, cookie or token travelling |
| `job` | violet | background job | queued work, events, webhooks |
| `error` | red | error or attack | a failure, a blocked call, a malicious request |

With `"direction": "both"`, a second dot travels back; its kind is `returns`, by default `response` for a request (otherwise the same kind). Use it for request/response pairs instead of drawing two edges.

### How edges are routed

Edges never cut diagonally. Every edge runs along the two grid axes (x = down-right, y = down-left) with small rounded corners:

- **Straight** when the two blocks line up on one axis (centres within ~0.4 on the other axis). The cleanest picture: line up blocks that talk to each other.
- **An L** or **a Z** otherwise; the app keeps the one that stays off other blocks and text.
- **Two edges between the same two nodes** run side by side in two lanes.
- **Steps keep their routes**, so lines do not jump while the learner clicks Next.

### Zone

`{ "id", "x", "y", "w", "h", "label"?, "status"? }`. `x`/`y` is the **top-left corner**, `w`/`h` the size. Must fit inside the grid. Drawn as a low plate on the floor with its name on a tab. At most 2 per scene; label at most 2 words / 16 characters. Zones may nest, but must not partly overlap. Use them for "inside the database" pictures (`"notes table"`) or "Browser" vs "Server".

### Icons

```
people & devices   user users incognito browser phone laptop
infrastructure     server database table cloud function api globe queue bolt box layers rocket
security           key lock unlock shield cookie token id-card eye ban
files & data       file folder list search chart
dev tools          code terminal git bug log gear flask pencil
AI                 sparkle brain chat robot vector
status & time      clock check x alert bell refresh link upload download trash
business           mail calendar money cart handshake graduation-cap
```

`incognito` = attacker / someone else. `function` = serverless function. `vector` = embeddings. `bolt` = cache or fast. Artwork from [Lucide](https://lucide.dev) (ISC); the names are the stable contract (`shared/icons.js`).

---

## What the validator checks

`npm run validate -- <module>` (one module folder; `npm run validate` checks all) reports, with file name and exact path such as `steps[3].scene.edges[1].to`. **Errors** (the run fails):

- invalid JSON, unknown fields, missing required fields, wrong types, file name pattern, `id` = slug, duplicate `NN`, module checks, enum values
- inline HTML: only allowed tags, tags closed, every term exists in the glossary
- **narration**: step 1 is `setup`; `setup` only on step 1; body at most 2 paragraphs and 75 words; `changes` required on steps 2+ (1-4 lines, `+ `/`~ `/`− ` prefixes), absent on step 1; new blocks named in a `+ ` line, removed blocks in a `− ` line, changed metrics in a `~ ` line
- **metrics**: 1-4 definitions with short labels and units; step values only for defined ids, numbers or short strings, valid tones
- **scene declutter**: at most 6 nodes; node label at most 2 words / 16 characters; no `sublabel`, `tags`, `w` or `notes`; pill at most 12 characters (one per node by construction); at most 2 labelled edges, edge labels at most 2 words / 14 characters; no packet `label` or `status`; packet `kind`/`returns` valid; at most 2 zones with short names
- scenes: `extends` without a previous scene, `remove` of unknown ids, edges to unknown nodes, unknown icons, coordinates outside the grid, duplicate ids
- isometric layout, measured in screen space with `shared/iso.js` (the renderer's own geometry), at rest and in motion: blocks standing on each other, any two pieces of text covering each other (name plates, pills, edge labels, zone names), zones partly overlapping, an arrowhead hidden under a plate or pill, a packet with no clear stretch of its edge
- quiz: 2-4 questions, 2-4 options, exactly one correct, a `why` on every option

**Warnings**: body above 60 words, callout above 45 words, long change lines, a plate hiding most of another block, edges on top of each other, packets running into each other, glossary terms never used, long code lines.
