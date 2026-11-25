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

The app draws this grid as an **isometric floor** (classic 2:1 isometric): grid `x` runs down-right on screen, grid `y` runs down-left. Every node becomes a 3D block whose shape follows its `kind` (server = rack block, data = cylinder, person = figure on a plinth, client = laptop or phone, ai = chip with a sparkle, external = crate with a lid, threat = block with hazard stripes, neutral = plain block). Text stays upright: a card with the label and sublabel floats above each block, tags lie on the floor in front of it, edges run along the floor with flat arrowheads, zones are floor plates and notes are speech bubbles. The geometry lives in `shared/iso.js`, used by both the renderer and the validator.

The app animates between steps: nodes that keep their `id` glide to their new position, new things fade in, removed things fade out, status colours cross-fade, and packets travel along edges. The view is framed around everything the lesson ever shows, so it does not jump.

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
3. **Patch** (`"extends": "previous"`): items with an existing `id` are merged (only the fields you write change), new ids are added, `remove` deletes. Setting a field to `null` removes it (for example `"tags": null`, `"bend": null`).

The first step that has a scene must be a full scene.

### Node

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | | Letters, digits, `-`, `_`. Unique across the scene. |
| `x`, `y` | number | | Centre of the box, in grid units. |
| `label` | string | | Main text. Under ~18 characters. |
| `sublabel` | string | | Second line, smaller. Under ~24 characters. |
| `icon` | string | none | One of the icon names below. |
| `kind` | enum | `neutral` | Shape and colour of the block: `neutral`, `person`, `client`, `server`, `data`, `ai`, `external`, `threat`. |
| `status` | enum | `normal` | `normal`, `active` (block floats up, accent ring on the floor, gentle bob), `ok` (green check badge), `warn` (amber ! badge), `error` (red block + x badge, small shake), `dim` (faded). |
| `tags` | string[] | | Up to 3 small monospace chips on the floor in front of the block (`"HttpOnly"`, `"10 / min"`). |
| `w` | number | | Kept for older lessons; the isometric renderer ignores it (cards size themselves to their text). |

A block covers about 0.8 x 0.8 grid units of floor. Its card is as wide as the longer of label and sublabel. Two nodes stacked in `y` (same `x`) need about 1.7 grid units between centres so their cards do not touch, about 2 when the lower one is `active`.

### Edge

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | `"from>to"` | Only needed if two edges join the same two nodes in the same direction. |
| `from`, `to` | node id | | Required. |
| `label` | string | | Pill in the middle of the line. Under ~26 characters. |
| `style` | enum | `solid` | `solid`, `dashed` (optional, async, "uses"), `dotted` (weak, background). |
| `status` | enum | `normal` | Same values as nodes; colours the line, arrow and label. |
| `arrow` | enum | `end` | `end`, `start`, `both`, `none`. |
| `bend` | number | 0 | Curve along the floor, -3 to 3 grid units. Two edges going opposite ways between the same nodes curve apart automatically. |
| `packet` | `true` / `false` / object | none | Something travelling along the edge, on a loop. |

**Packet object:** `{ "label"?: "JWT", "status"?: "active", "direction"?: "forward" | "backward" | "both", "speed"?: "slow" | "normal" | "fast" }`. `true` = a plain glowing dot. Keep packet labels under ~10 characters. The packet colour follows `status`; the legend under the diagram explains the colours in use (blue = data moving, orange = in focus, green = allowed / success, amber = slow or at risk, red = blocked / failed). With reduced motion the packet rests beside the edge label, or is left out when there is no free spot.

### Zone

`{ "id", "x", "y", "w", "h", "label"?, "status"? }`. Here `x`/`y` is the **top-left corner** (unlike nodes), `w`/`h` the size. Must fit inside the 12 x 8 grid. It is drawn as a low plate on the floor; its name sits on a tab at the back corner (or another corner when that spot would cover text).

### Note

`{ "id", "x", "y", "text", "status"? }`. A speech bubble whose tail points at the floor spot (`x`, `y`). Under ~40 characters. Use `status` to colour it (`warn`, `error`, `ok`, `active`).

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
- enum values (chapter, level, kind, status, style, arrow, callout type, code language) with suggestions
- inline HTML: only allowed tags, tags closed, stray `<`/`>`, every term exists in the glossary
- scenes: `extends` without a previous scene, `remove` of unknown ids, nodes without `x`/`y`/`label`, edges pointing at unknown nodes, unknown icons, coordinates outside the grid, duplicate ids
- isometric layout, measured in screen space with `shared/iso.js`: blocks standing on each other and any two pieces of text covering each other (cards, tags, edge labels, notes, zone names) are errors; a card hiding most of another block, or an edge running mostly underneath cards, is a warning
- quiz: 2-4 questions, 2-4 options, exactly one correct, a `why` on every option
- warnings (do not fail): long text, too many tags/nodes, glossary terms never used, long code lines
