# Lesson schema

Everything the learner sees is plain JSON in `src/content/`. The app finds files on its own, so you never edit shared code or an index file.

```
src/content/
  security/                      <- module folder = module id
    module.json                  <- module metadata
    02-sessions-vs-tokens.json   <- lesson: NN-slug.json
```

- **Module order** comes from `order` in `module.json`.
- **Lesson order** comes from the two-digit `NN` prefix of the file name (01, 02, ...). Gaps are fine.
- The lesson `id` must equal the slug part of the file name (`sessions-vs-tokens`).
- The URL of a lesson is `#/l/<moduleId>/<lessonId>`.
- Run `npm run validate` after every edit. It checks everything below and points at the exact field.

The reference lesson is `src/content/security/02-sessions-vs-tokens.json`. When in doubt, copy its patterns.

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

The seven modules already exist: `data` (1), `security` (2), `debugging` (3), `production` (4), `ai` (5), `clients` (6), `interviews` (7). An empty module shows "Coming soon".

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
  "youWillLearn": [                       // 2-5 bullets, inline HTML allowed
    "Why an AI endpoint needs a limit",
    "How a <b>token bucket</b> works"
  ],

  // term -> one plain sentence. Used by <span class="term"> tooltips.
  // Keys are matched case-insensitively. Every key should be used at least once.
  "glossary": {
    "rate limit": "A cap on how many requests one user may make in a period of time.",
    "429": "The HTTP status code that means: too many requests, slow down."
  },

  "steps": [
    {
      "title": "One user, ten thousand requests",   // under ~48 characters
      "chapter": "problem",                // problem | idea | how | example | watch-out | recap
      "body": [                            // 1-3 short paragraphs, max ~70 words in total
        "Notely's <b>AI summary</b> button calls the Claude API. Each call costs money.",
        "Without a <span class=\"term\">rate limit</span>, one script can press it all night."
      ],
      "callout": {                         // optional
        "type": "analogy",                 // tip | warn | analogy | claude-code
        "title": "Optional custom title",  // optional; each type has a default title
        "text": "A buffet with no plate limit. One guest can empty it."
      },
      "code": {                            // optional
        "language": "ts",                  // ts tsx js jsx sql bash json http env yaml toml python diff text
        "filename": "app/api/summary/route.ts",   // optional label above the code
        "code": "if (!allowed) {\n  return new Response('Slow down', { status: 429 });\n}",
        "caption": "Optional one-line note under the code."
      },
      "scene": {                           // optional diagram, see "Scenes" below
        "caption": "One sentence that says what the diagram shows.",
        "nodes": [
          { "id": "user", "x": 2, "y": 4, "label": "Script", "sublabel": "runs all night", "icon": "robot", "kind": "threat" },
          { "id": "api", "x": 6.4, "y": 4, "label": "Notely API", "icon": "server", "kind": "server", "status": "warn" },
          { "id": "llm", "x": 10.4, "y": 4, "label": "Claude API", "sublabel": "paid per token", "icon": "sparkle", "kind": "ai", "tags": ["$$$"] }
        ],
        "edges": [
          { "from": "user", "to": "api", "label": "POST /summary", "packet": { "label": "x10,000", "speed": "fast" } },
          { "from": "api", "to": "llm", "packet": true }
        ]
      }
    },
    {
      "title": "Put a bouncer at the door",
      "chapter": "idea",
      "body": ["..."],
      "scene": {
        "extends": "previous",             // start from the previous step's diagram
        "remove": ["api>llm"],             // ids of nodes / edges / zones / notes to drop
        "nodes": [
          { "id": "api", "status": "ok", "tags": ["10 / min"] },     // existing id: only changed fields
          { "id": "limiter", "x": 6.4, "y": 1.6, "label": "Rate limiter", "icon": "shield", "kind": "server" }  // new id: full node
        ],
        "edges": [
          { "id": "user>api", "status": "error", "label": "429 after 10" },   // auto id of an edge = "from>to"
          { "from": "limiter", "to": "api", "style": "dashed", "label": "checks" }
        ]
      }
    },
    {
      "title": "Recap",
      "chapter": "recap",
      "body": ["..."]
      // no "scene": the previous diagram stays exactly as it was
    }
  ],

  "quiz": [                                // 2-4 questions (only one shown here)
    {
      "question": "What should the API answer when a user goes over the limit?",
      "options": [                         // 2-4 options, exactly ONE has "correct": true
        { "text": "<code>429</code>", "correct": true, "why": "It tells the client to slow down and retry later." },
        { "text": "<code>500</code>", "why": "500 means the server broke. Nothing broke here." },
        { "text": "Nothing, just drop the request", "why": "Silence makes clients retry immediately, which makes it worse." }
      ]
    }
  ],

  "takeaways": [                           // 2-6 short sentences, shown on the Recap screen
    "Every paid or slow endpoint needs a limit per user.",
    "Over the limit: answer <code>429</code>, do not crash."
  ]
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
| `steps` | Step[] | Aim for 6-10. Validator warns under 4 or over 14. |
| `quiz` | Question[] | 2-4. |
| `takeaways` | string[] | 2-6. |

### Step

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | Required. Under ~48 characters. |
| `chapter` | enum | Required. `problem`, `idea`, `how`, `example`, `watch-out`, `recap`. Shown as a small label ("The problem", "How it works", "Watch out"...). |
| `body` | string[] | Required. Paragraphs. Warning above 70 words total, error above 110. |
| `callout` | object | Optional. `{ type, title?, text }`. |
| `code` | object | Optional. `{ language, code, filename?, caption? }`. `code` uses `\n` for new lines. Under 18 lines, lines under 72 characters. |
| `scene` | object | Optional. See below. Omit it to keep the previous diagram unchanged. |

### Inline HTML (body, callout text, youWillLearn, quiz text, why, takeaways, glossary)

Only these tags are allowed. Everything else is rejected by the validator and escaped by the app.

| Markup | Use for |
| --- | --- |
| `<b>...</b>` | The one or two words that matter most in a paragraph. |
| `<em>...</em>` | Light emphasis. |
| `<code>...</code>` | Code, file names, flags, HTTP status codes, function names. |
| `<span class="term">cookie</span>` | A glossary word. The text must match a glossary key (case-insensitive). |
| `<span class="term" data-term="cookie">cookies</span>` | Glossary word whose visible text differs from the key (plurals etc.). |

Inside JSON strings, quotes must be escaped: `<span class=\"term\">`. Write `&lt;` and `&gt;` for literal `<` and `>` in text (for example `&lt;div&gt;`). Plain `&`, `'`, `→` and `…` are fine.

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

The app draws this grid as an **isometric floor** (classic 2:1 isometric): grid `x` runs down-right on screen, grid `y` runs down-left. Every node becomes a 3D block whose shape follows its `kind` (server = rack block, data = cylinder, person = figure on a plinth, client = laptop or phone, ai = chip with a sparkle, external = crate with a lid, threat = block with hazard stripes, neutral = plain block), or its `shape` when one is set (tile, token, flag, stack, block). Text stays upright: a card with the label and sublabel floats above each block, tags lie on the floor in front of it, edges run along the floor as ink lines with flat arrowheads, always along the two grid axes with rounded 90° turns (see "How edges are routed" below), zones are floor plates and notes are speech bubbles. The geometry lives in `shared/iso.js`, used by both the renderer and the validator.

The app animates between steps: things that leave fade out first, then new things rise in; nodes that keep their `id` glide to their new position (block and card move as one), status colours cross-fade, and packets travel along edges, staying off other text (their own edge label fades while they pass). **The camera frames each step on what that step shows** and pans and zooms smoothly between steps. Each diagram has Replay and Pause buttons. On a phone the diagram fits the screen width, zooms in on what changed when the whole step would be too small to read, and opens full screen with **Whole diagram**.

### Scene object

| Field | Type | Meaning |
| --- | --- | --- |
| `extends` | `"previous"` | Start from the previous step's resolved scene, then apply this one as a patch. |
| `remove` | string[] | Only with `extends`. Ids of nodes, edges, zones or notes to delete. Removing a node also removes its edges. |
| `nodes` | Node[] | Boxes. |
| `edges` | Edge[] | Arrows between nodes. |
| `zones` | Zone[] | Labelled dashed areas behind nodes ("Browser", "Server", "Sessions"). |
| `notes` | Note[] | Free text on the canvas ("Who is this?"). |
| `caption` | string | One sentence under the diagram. Also read by screen readers. Strongly recommended. |

**Three ways to write a step's scene:**

1. **Omit `scene`**: the diagram stays exactly as in the previous step.
2. **Full scene** (no `extends`): replaces everything. Items whose `id` matches the previous step still animate smoothly from where they were.
3. **Patch** (`"extends": "previous"`): items with an existing `id` are merged (only the fields you write change), new ids are added, `remove` deletes. Setting a field to `null` removes it (for example `"tags": null`, `"route": null`).

The first step that has a scene must be a full scene.

### Node

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | | Letters, digits, `-`, `_`. Unique across the scene. |
| `x`, `y` | number | | Centre of the box, in grid units. |
| `label` | string | | Main text. Under ~18 characters. |
| `sublabel` | string | | Second line, smaller. Under ~24 characters. |
| `icon` | string | none | One of the icon names below. |
| `kind` | enum | `neutral` | What the thing is; sets the colour and the default shape: `neutral`, `person`, `client`, `server`, `data`, `ai`, `external`, `threat`. |
| `shape` | enum | by kind | Optional shape override: `tile` (flat slab: a row, an array cell, a list item), `token` (round disc: a tree or graph node), `flag` (pin with a flag: a pointer or marker), `stack` (stacked slabs: a folder or a pile), `block` (plain box). |
| `status` | enum | `normal` | `normal`, `active` (block floats up with a bright top, accent ring on the floor, gentle bob), `ok` (green ring), `warn` (amber ring), `error` (red block and ring, small shake), `dim` (faded). A badge (check, !, x) is added to the card only in the step where the status changes, at most three per step. |
| `tags` | string[] | | Up to 3 small monospace chips on the floor in front of the block (`"HttpOnly"`, `"10 / min"`). |
| `w` | number | | Kept for older lessons; the isometric renderer ignores it (cards size themselves to their text). |

A block covers about 1 x 1 grid unit of floor. Its card is as wide as the longer of label and sublabel. Two nodes stacked in `y` (same `x`) need about 1.7 grid units between centres so their cards do not touch, about 2 when the lower one is `active`.

### Edge

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | `"from>to"` | Only needed if two edges join the same two nodes in the same direction. |
| `from`, `to` | node id | | Required. |
| `label` | string | | Pill on the line, in the middle of its longest straight leg (it slides along when that spot is taken). Under ~26 characters. |
| `style` | enum | `solid` | `solid`, `dashed` (optional, async, "uses"), `dotted` (weak, background). |
| `status` | enum | `normal` | Same values as nodes; colours the line, arrow and label. |
| `arrow` | enum | `end` | `end`, `start`, `both`, `none`. |
| `route` | enum | automatic | Only when the automatic route is not the one you want: `x-first` (along grid x, then turn into y: an L), `y-first` (along y, then x), `mid` (along the longer axis to halfway, a turn, the rest: a Z). See "How edges are routed". |
| `bend` | number | | Legacy, prefer `route`. On its own edge, its sign picks the side of the elbow (positive = the elbow on the left of the travel direction, in grid terms); when the two ends line up, the line steps sideways by about `bend` grid units and back (a bracket). Ignored on an edge that shares its two nodes with another edge. -3 to 3. |
| `packet` | `true` / `false` / object | none | Something travelling along the edge, on a loop. |

**Packet object:** `{ "label"?: "JWT", "status"?: "active", "direction"?: "forward" | "backward" | "both", "speed"?: "slow" | "normal" | "fast" }`. `true` = a plain glowing dot. Keep packet labels under ~10 characters. Packets are drawn above cards and labels and follow the line round its turns; each one travels only along the longest stretch of its edge where it covers no other text (it may slip under the floor tags of its own end blocks), and packets on different edges are timed so they do not run into each other. The packet colour follows `status`; the legend under the diagram explains the colours in use (blue = data moving, orange = in focus, green = allowed / success, amber = slow or at risk, red = blocked / failed). With reduced motion the packet rests beside the edge label, or is left out when there is no free spot.

### How edges are routed

Edges never cut diagonally across the floor. Every edge runs along the two grid axes only (grid x = down-right on screen, grid y = down-left), with small rounded corners where it turns:

- **Straight** when the two blocks line up on one axis: their centres differ by less than about 0.4 grid units on the other axis (up to ~0.9 still works when both blocks are wide enough to share a straight line). This is the cleanest picture, so line up nodes that talk to each other when you can.
- **An L** (one turn) or **a Z** (two turns, the middle leg sideways) otherwise. The app tries both Ls and several Zs and keeps the one that stays off other blocks, cards, tags, notes and edge labels, does not run on top of another edge, keeps its arrowhead and its label visible, leaves room for its packet, and meets its blocks on their visible front faces. When a straight line is blocked by a block in the way, it steps around it as a bracket.
- **Two edges between the same two nodes** (a request and its answer, for example) run side by side in two lanes, so both lines, labels and packets stay visible. Edges fanning out of one block take separate lanes when they carry packets; without packets they may share a trunk, as in a tree.
- **Arrowheads** point along the last leg. The **label** sits on the longest straight leg. **Packets** follow the line round its corners.
- **Steps keep their routes.** An edge keeps the route it had in the previous step unless the new step really needs another one, so lines do not jump while the learner clicks Next.

Set `route` only when the automatic choice tells the story less well: `"x-first"` and `"y-first"` pick an L, `"mid"` a Z. To straighten a line, move a node instead so the two ends line up. `"route": null` in a patch goes back to automatic.


### Zone

`{ "id", "x", "y", "w", "h", "label"?, "status"? }`. Here `x`/`y` is the **top-left corner** (unlike nodes), `w`/`h` the size. Must fit inside the 12 x 8 grid. It is drawn as a low plate on the floor, inset a little so neighbouring plates keep a gap; its name sits on a tab at the plate's left corner (or another spot when that one would cover text or an edge). Zones may nest, but two zones must not partly overlap. Neutral blocks standing in a zone take a faint tint of the zone's colour.

### Note

`{ "id", "x", "y", "text", "status"? }`. A speech bubble above the floor spot (`x`, `y`). When the spot is within ~1.5 grid units of a block, the bubble has a tail pointing at it; otherwise it is a free-standing sticker without a tail (a caption). Under ~40 characters. Use `status` to colour it (`warn`, `error`, `ok`, `active`).

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

`incognito` is the "attacker / someone else" icon. `function` is a serverless function (ƒ). `vector` means embeddings. `bolt` means cache or "fast". The artwork comes from [Lucide](https://lucide.dev) (ISC licence); the names are the stable contract. The source of truth is `shared/icons.js`, generated by `node scripts/build-icons.mjs`.

---

## What the validator checks

`npm run validate` (or `npm run validate -- security` to check one module folder) reports, with file name and exact path such as `steps[3].scene.edges[1].to`:

- invalid JSON (with line and column), unknown fields (with "did you mean"), missing required fields, wrong types
- file name pattern, `id` = slug, duplicate `NN` in a module, module `id` = folder, duplicate module `order`
- enum values (chapter, level, kind, status, style, arrow, route, callout type, code language) with suggestions
- inline HTML: only allowed tags, tags closed, stray `<`/`>`, every term exists in the glossary
- scenes: `extends` without a previous scene, `remove` of unknown ids, nodes without `x`/`y`/`label`, edges pointing at unknown nodes, unknown icons, coordinates outside the grid, duplicate ids
- isometric layout, measured in screen space with `shared/iso.js`, at rest and in motion: blocks standing on each other, any two pieces of text covering each other (cards, tags, edge labels, notes, zone names), zone plates partly overlapping, an arrowhead hidden under a card, tag or note, and a packet with no clear stretch of its edge to travel are errors; a card hiding most of another block, an edge running mostly underneath cards, two edges running on top of each other, or packets on different edges running into each other is a warning. All edge checks use the routed elbow lines, the same ones the app draws
- quiz: 2-4 questions, 2-4 options, exactly one correct, a `why` on every option
- warnings (do not fail): long text, too many tags/nodes, glossary terms never used, long code lines
