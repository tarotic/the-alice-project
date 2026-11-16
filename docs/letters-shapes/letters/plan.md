# Plan for increment 1a: shell + switcher + scoring + parent button + 12 glyphs

Scope: requirements.md increment 1, split part **1a** only (approved by owner). Glyphs in 1a: a, A, b, B, c, C, l, L, o, O, t, T.
Increment 1b (the remaining 40 glyphs) is not planned here. 1a is designed so that 1b means adding glyph data plus changing one test constant.

## BLOCKERS
None. Doubts that do not block 1a are listed under "Risks and edge cases".

## Prerequisites
- Runtime and minimum version: **Node.js 20 or newer** (built-in `node:test`, `node:assert/strict`, ES modules, and test file discovery with no arguments). The engineer checks this with `node --version`.
- Test command: **`node --test`**, run from the repo root (`/home/claude/alice`). With no arguments Node finds `**/*.test.js`, so **every test file must end in `.test.js`**. The folder is `tests/`, not `test/`, so the name pattern is what makes discovery work.
- Other tools or files:
  - No npm packages. Do not run `npm install`, and do not use `npx`.
  - The engineer creates `package.json` (contents below).
  - For the manual check in a desktop browser, any local static file server, for example `python3 -m http.server 8000`. ES modules do not load from `file://`. It is not needed for `node --test`.
  - The tester and the owner need a phone browser for the [MANUAL] checks, through GitHub Pages or the LAN.
- Current state: the tech lead could not list the folder. Reads of `package.json`, `index.html`, `src/ui.js` and `docs/plan.md` found no file, so the plan assumes a fresh project. If code already exists, the engineer stops and reports any conflict with this plan.

## Approach
A pure tool registry and a pure switcher run a shell: a top bar with one button per tool, and a tool area below it. Each tool owns its folder under `src/tools/<id>/`. The letters tool is built in layers. Glyph data comes first: it is authored sparse, then densified into the `{x,y}` 0..100 space. Next are pure geometry and scoring functions on point lists, pure ink, parent-hold and game reducers that take `now` as an argument, and small view functions. On top sits one thin DOM file (`tool.js`) that turns pointer events into reducer calls and redraws a `<canvas>` from state. Drawing uses Canvas 2D, not SVG. The SVG namespace string contains `http://`, which AC30 forbids. All ink is stored in glyph space (0..100), so a resize or orientation change only needs a redraw.

```
pointer events ──> tool.js (thin DOM) ──> game.js reducers ──> state
                                              │   ├─ ink.js        (strokes, multi-touch guard, cap)
                                              │   ├─ parent-hold.js(now injected)
                                              │   └─ scoring.js ── geometry.js (resample, distance)
                                              ▼
                     views/* (pure-ish draw functions of state/progress) ──> canvas / elements
ui.js (thin DOM) ──> switcher.js ──> registry.js <── tools/index.js registers lettersTool
```

## Adapted layout (replaces the timer layout in web-rules.md for this project; approved)
```
index.html                 <title>Letters</title>, top bar <nav id="switcher">, <main id="tool-area">, <script type="module" src="src/ui.js">
styles.css
package.json
src/
  registry.js              pure: tool registry
  switcher.js              pure: switch state + performSwitch (calls mount/unmount, no DOM)
  ui.js                    thin DOM: builds switcher bar, mounts first tool
  tools/
    index.js               registers shipped tools (letters only)
    letters/
      glyphs.js            glyph data + GLYPHS table (pure)
      geometry.js          resample, distance (pure)
      scoring.js           coverage, strayRatio, isDone, constants (pure)
      ink.js               ink strokes reducer (pure)
      parent-hold.js       parentHold reducer, holdProgress (pure, now injected)
      game.js              letter game reducer, nextLetter, scoreInk (pure)
      tool.js              thin DOM: lettersTool {id, label, mount, unmount}
      views/
        guide.js           drawGuide(ctx, glyph, sizePx)
        ink.js             drawInk(ctx, ink, sizePx)
        hold-progress.js   holdProgressWidth(progress) -> CSS width string
        reward.js          rewardView(done) -> {visible, text}; drawRewardShape(ctx, sizePx)
tests/
  unit/                    engineer-written tests (*.test.js)
  adversarial/             tester-written tests (*.test.js)
docs/
```
All other rules in web-rules.md still apply. Pure modules (everything except `ui.js`, `tool.js` and `views/*`) must not touch `document`, `window`, `performance`, `Date` or `requestAnimationFrame`.

`package.json` must be exactly this content (field order free):
```json
{ "name": "letters", "private": true, "type": "module", "scripts": { "test": "node --test" } }
```

## Files
| File | New/change | Responsibility |
|---|---|---|
| package.json | New | type module, no deps, test script |
| index.html | New | Shell markup, title "Letters", viewport meta (`width=device-width, initial-scale=1`; do NOT disable user zoom globally) |
| styles.css | New | Top bar, 48px min targets, `touch-action:none` on pad, `touch-action:manipulation` on buttons, no-select on parent button, reduced-motion rule, portrait layout with no horizontal scroll |
| src/registry.js | New | createRegistry, default registry, registerTool/listTools/getTool |
| src/switcher.js | New | createSwitchState, switchTo, performSwitch |
| src/ui.js | New | Thin DOM shell |
| src/tools/index.js | New | `registerTool(lettersTool)` |
| src/tools/letters/*.js | New | See Interfaces |
| src/tools/letters/views/*.js | New | Drawing helpers |
| tests/unit/expected-letters.js | New | Test-only constants EXPECTED_LETTERS and FULL_PAIRED_ALPHABET (not a test file itself, so no `.test.js` suffix) |
| tests/unit/*.test.js | New | See Test list |

## Interfaces (function signatures the engineer must match)
Types used below:
`Point = {x:number, y:number}`. `Stroke = Point[]`. `Glyph = {id:string, case:'lowercase'|'uppercase', strokes:Stroke[]}`. `Tool = {id:string, label:string, mount:(host)=>void, unmount:()=>void}`.
All reducers are pure. They never mutate inputs (tests pass `Object.freeze`d or deep-frozen input) and always return new objects, except where "same object" is stated.

### src/registry.js
```js
export function createRegistry()  // -> { registerTool(tool), listTools(), getTool(id) }, independent instance
export const defaultRegistry      // = createRegistry()
export function registerTool(tool) // delegates to defaultRegistry; returns the stored (frozen) tool
export function listTools()        // delegates; returns a NEW array copy, registration order
export function getTool(id)        // delegates; unknown id -> undefined
```
`registerTool` throws `Error` when: `tool` is not an object; `id` is not a non-empty string (missing, `''`, or a non-string); `id` is already registered; `label` is not a string or `label.trim() === ''`; `mount` or `unmount` is not a function. It stores `Object.freeze({id, label, mount, unmount})`.

### src/switcher.js
```js
export function createSwitchState(activeId = null) // -> { activeId }  (exactly one key)
export function switchTo(state, id, registry = defaultRegistry)
  // registry.getTool(id) undefined -> return the SAME state object
  // id === state.activeId          -> return the SAME state object
  // else -> { activeId: id }
export function performSwitch(state, id, host, registry = defaultRegistry)
  // next = switchTo(state, id, registry); if next === state -> return state, call nothing.
  // else: if state.activeId !== null -> registry.getTool(state.activeId).unmount() once,
  //       then registry.getTool(id).mount(host) once; return next.
```

### src/ui.js (thin, not unit-tested)
Import `./tools/index.js`. Build one `<button>` per `listTools()` item in `#switcher`. The button text is `label`, and the active button gets `aria-pressed="true"`. Do not render a project name or logo. On click, `state = performSwitch(state, tool.id, toolArea)` and refresh `aria-pressed`. At start, `performSwitch(createSwitchState(), listTools()[0].id, toolArea)`.

### src/tools/letters/geometry.js
```js
export function distance(a, b)            // Euclidean
export function nearestDistance(p, points) // min distance; empty points -> Infinity
export function resample(stroke, spacing)
```
`resample` rules:
- It throws `Error` if `spacing` is not a finite number greater than 0.
- An empty stroke gives `[]`. A 1-point stroke gives `[copy of that point]`.
- Otherwise it walks the polyline and outputs the first point, a point at every multiple of `spacing` along the cumulative arc length, and the last point. The last point is added unless it equals the previous output point. Consecutive output points are therefore at most `spacing` apart, within 1e-9.
- Zero-length segments (repeated points) are allowed and must not produce NaN.
- It returns new point objects.

### src/tools/letters/glyphs.js
```js
export const PAIRED_ORDER = 'aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ'
export const GLYPH_POINT_SPACING = 2
export function arc(cx, cy, rx, ry, startDeg, endDeg, steps = 24)
  // steps+1 points: x = cx + rx*cos(θ), y = cy + ry*sin(θ), θ linear from startDeg to endDeg.
  // Screen y is down: 0° = right, 90° = bottom, 180° = left, 270° = top. Decreasing θ = counter-clockwise on screen.
export const GLYPH_SOURCE  // { [id]: Stroke[] } sparse authored strokes (may use arc() and array concat)
export const GLYPHS        // Glyph[]: for each char of PAIRED_ORDER that is a key of GLYPH_SOURCE, in that order:
                           // { id, case: id === id.toLowerCase() ? 'lowercase' : 'uppercase',
                           //   strokes: GLYPH_SOURCE[id].map(s => resample(s, GLYPH_POINT_SPACING)) }
                           // deep-frozen.
export function getGlyph(id) // -> Glyph | undefined
```
Increment 1b only adds keys to `GLYPH_SOURCE`. The order comes from `PAIRED_ORDER`, so no other source change is needed.

Coordinate conventions: the box is 0..100 and y points down. Cap and ascender top is y=15, x-height is y=45, baseline is y=85. Keep x within 15..85.

1a glyph data (stroke order as listed; the engineer copies these):
| id | strokes |
|---|---|
| l | `[[50,15],[50,85]]` |
| L | `[[30,15],[30,85],[75,85]]` (1 stroke) |
| t | s1 `[[50,20],[50,85]]`; s2 `[[30,45],[70,45]]` |
| T | s1 `[[20,15],[80,15]]`; s2 `[[50,15],[50,85]]` |
| o | `arc(50,65,20,20,270,-90)` |
| O | `arc(50,50,30,35,270,-90)` |
| c | `arc(50,65,20,20,315,45)` |
| C | `arc(50,50,30,35,315,45)` |
| a | 1 stroke: `arc(50,65,18,20,300,-60)` then `[68,45],[68,85]` appended |
| b | s1 `[[32,15],[32,85]]`; s2 `arc(50,65,18,20,180,540)` |
| B | s1 `[[30,15],[30,85]]`; s2 `[[30,15],[55,15]]` + `arc(55,32.5,15,17.5,270,450)` + `[[55,50],[30,50]]`; s3 `[[30,50],[58,50]]` + `arc(58,67.5,17,17.5,270,450)` + `[[58,85],[30,85]]` |
| A | s1 `[[50,15],[25,85]]`; s2 `[[50,15],[75,85]]`; s3 `[[35,57],[65,57]]` |
(Pairs like `[50,15]` stand for `{x:50,y:15}`. `a` is one stroke on purpose: as two strokes, the bowl alone would cover more than 85% of the guide and break AC18.)

### src/tools/letters/scoring.js
```js
export const TRACE_TOLERANCE = 6       // glyph units (box is 100)
export const SAMPLE_SPACING = 2        // guide resampling spacing
export const COVERAGE_THRESHOLD = 0.85 // owner-approved starting value
export const STRAY_THRESHOLD = 0.5     // owner-approved starting value
export function guidePoints(guide)                // guide: Stroke[] -> flat resample(s, SAMPLE_SPACING) of each stroke
export function coverage(guide, ink, tolerance)   // guide: Stroke[], ink: Point[] -> 0..1
export function strayRatio(guide, ink, tolerance) // guide: Stroke[], ink: Point[] -> 0..1
export function isDone(coverage, strayRatio)      // boolean
```
- `coverage` is the share of `guidePoints(guide)` with `nearestDistance(g, ink) <= tolerance`. Empty ink gives 0, and empty guide gives 0.
- `strayRatio` is the share of ink points with `nearestDistance(p, guidePoints(guide)) > tolerance`. Empty ink gives 0. Empty guide with non-empty ink gives 1.
- `isDone` is `coverage >= COVERAGE_THRESHOLD && strayRatio <= STRAY_THRESHOLD`. A NaN argument gives false.

### src/tools/letters/ink.js
```js
export const MAX_INK_POINTS = 5000
export const INK_SPACING = 2
export function emptyInk()                         // -> { strokes: [], activePointerId: null, pointCount: 0 }
export function startStroke(ink, pointerId, point) // ignored (same object) if activePointerId !== null, point non-finite, or pointCount >= MAX
export function extendStroke(ink, pointerId, point)// ignored (same object) if pointerId !== activePointerId, point non-finite, or pointCount >= MAX
export function endStroke(ink, pointerId)          // ignored (same object) if pointerId !== activePointerId; else activePointerId = null (stroke kept, even with 1 point)
export function inkPoints(ink)                     // flat: each stroke resample(s, INK_SPACING); a 1-point stroke stays 1 point
```

### src/tools/letters/parent-hold.js
```js
export const PARENT_HOLD_MS = 1000
export function initialHold()            // -> { pointerId: null, startedAt: null, passed: false }
export function parentHold(state, event, now)
  // event: { type: 'down'|'up'|'leave'|'cancel'|'tick', pointerId?: number }
export function holdProgress(state, now) // 0..1; passed -> 1; idle -> 0; clamp((now-startedAt)/PARENT_HOLD_MS, 0, 1)
```
`parentHold` rules. In each case below, "same object" means the function returns its input state unchanged.
- If `passed` is already true, it returns the same object. Passed is sticky until the game resets the hold.
- `down` while idle: `{pointerId, startedAt: now, passed:false}`. A `down` while already holding returns the same object, so a second finger does not restart the hold.
- `tick` while holding with `now - startedAt >= PARENT_HOLD_MS`: `{pointerId:null, startedAt:null, passed:true}`. Other ticks return the same object.
- `up` from the holding pointer: if `now - startedAt >= PARENT_HOLD_MS` it gives passed (as above), else `initialHold()`. An `up` from another pointer returns the same object.
- `leave` or `cancel` from the holding pointer gives `initialHold()` (never passes). From another pointer it returns the same object.
- If `now < startedAt` (the clock went backwards), elapsed counts as 0.
- A `pointerId` of `undefined` matches a hold whose pointerId is `undefined`. This is so tests can omit ids.

### src/tools/letters/game.js
```js
export function nextLetter(index, list)        // (index + 1) % list.length; throws Error if list is empty
export function createLetterGame()             // -> { index: 0, ink: emptyInk(), done: false, hold: initialHold() }
export function currentGlyph(state, glyphs = GLYPHS)
export function scoreInk(glyph, ink)           // -> { coverage, stray, done } using inkPoints(ink), TRACE_TOLERANCE, isDone
export function inkEvent(state, event, glyphs = GLYPHS)
  // event: { type: 'down'|'move'|'up'|'cancel', pointerId, point? }
  // down -> startStroke, move -> extendStroke, up/cancel -> endStroke, then done = state.done || scoreInk(...).done
export function parentEvent(state, event, now) // hold = parentHold(state.hold, event, now); done = state.done || hold.passed
export function clearInk(state)                // ink = emptyInk(), done = false, hold = initialHold(), same index
export function goNext(state, glyphs = GLYPHS) // index = nextLetter(index, glyphs), ink empty, done false, hold reset
export function isLetterDone(state)            // state.done === true
```
`done` stays true until `clearInk` or `goNext` resets it. There is no separate "passed" flag in the game state, so a parent pass and a traced pass give the same state shape (AC26).

### src/tools/letters/tool.js (thin DOM, manual-tested)
`export const lettersTool = { id: 'letters', label: 'Letters', mount(host), unmount() }`

**mount** builds these elements:
- a case label (e.g. "a · lowercase")
- a square `<canvas>` pad
- **Clear** and **Next** buttons. Next is disabled or hidden until `done`.
- a reward element (text + shape, shown when `done`)
- a corner button "Parent: got it", with a fill bar whose width is `holdProgressWidth(holdProgress(...))`

All listeners use one `AbortController` signal.

Pad:
- `pointerdown`: `setPointerCapture`, then `inkEvent` 'down'
- `pointermove`: 'move'
- `pointerup` and `pointercancel`: 'up' / 'cancel'

Points are mapped with this local helper:
```js
export function toGlyphSpace(clientX, clientY, rect) // -> {x,y} in 0..100 scale of rect (not clamped); null if rect.width or rect.height <= 0
```
It is exported so it can be tested. It is pure.

Parent button:
- `pointerdown`: call `releasePointerCapture(e.pointerId)` so `pointerleave` fires when the finger slides off, then `parentEvent` 'down' with `performance.now()`, and start a `requestAnimationFrame` loop that sends 'tick' until the hold is idle or passed.
- `pointerup`, `pointerleave` and `pointercancel` map to 'up', 'leave' and 'cancel'.
- `contextmenu` gets `preventDefault()`.

Redraws are batched to one per animation frame. `resize` and `orientationchange` re-size the canvas backing store to `clientWidth * devicePixelRatio` and redraw from state.

**unmount** aborts the controller, cancels any pending rAF and empties the host with `host.replaceChildren()`.

### views (draw helpers; a pure function of their arguments)
```js
drawGuide(ctx, glyph, sizePx)      // faint strokes, scale sizePx/100
drawInk(ctx, ink, sizePx)          // visible line; 1-point stroke drawn as a dot
holdProgressWidth(progress)        // -> `${Math.round(clamp(progress,0,1)*100)}%`
rewardView(done)                   // -> { visible: done, text: done ? 'Well done!' : '' }
drawRewardShape(ctx, sizePx)       // a star; no animation when prefers-reduced-motion (CSS)
```

## Test list (every [AUTO] criterion maps to at least one test)
`tests/unit/expected-letters.js` exports:
```js
export const FULL_PAIRED_ALPHABET = [...'aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ']
export const EXPECTED_LETTERS = [...'aAbBcClLoOtT'] // 1a. In 1b: set to FULL_PAIRED_ALPHABET.
export const FULL_SET_TODO = EXPECTED_LETTERS.length < 52 ? 'increment 1b adds the remaining glyphs' : false
```
**How the "52" ACs are handled in 1a.** Every glyph test iterates over the full `GLYPHS` table, so 1b data is covered automatically. Tests that need exactly 52 use the `node:test` option `{ todo: FULL_SET_TODO }`. In 1a they run and report as TODO without failing the suite. In 1b the only test change is `EXPECTED_LETTERS = FULL_PAIRED_ALPHABET`, which turns them into real, required tests. Increment 1 is not done until no TODO remains (requirements.md: "All glyph ACs still apply to the full set").

| AC | Test file | What it asserts |
|---|---|---|
| AC1 | registry.test.js | `createRegistry()` instance: register 3 fake tools, `listTools()` ids in registration order; `getTool(id)` returns the tool; unknown → undefined; mutating the returned array does not change the registry. Named exports `registerTool/listTools/getTool` exist and are functions |
| AC2 | registry.test.js | `assert.throws` for: missing id, `''` id, numeric id, duplicate id, `''` label, `'   '` label, missing label, `mount` not a function, `unmount` not a function, non-object tool |
| AC3 | switcher.test.js | `switchTo` to known id gives `{activeId:id}` (new object); unknown id returns the same object (`strictEqual`); switching to active id returns the same object |
| AC4 | switcher.test.js | Fake tools log calls: `performSwitch` from a→b gives log `['a:unmount','b:mount']`, mount got `host`; from `null`→a only `['a:mount']`; unknown id and same id give empty log |
| AC5 | switcher.test.js | `Object.keys(createSwitchState())` and keys after `switchTo` deepEqual `['activeId']` |
| AC8 | extend-registry.test.js | Using the default module exports only: `registerTool(fakeTool)` makes it appear in `listTools()`; `performSwitch(createSwitchState(), 'fake', {})` calls fake mount once (fake defined only in the test) |
| AC9 | static-rules.test.js | `index.html` `<title>` text is exactly `Letters`; no file in `index.html` or recursively under `src/` matches `/ramona|alice/i` |
| AC10 | glyphs.test.js | For every glyph in `GLYPHS`: `strokes` is a non-empty array, each stroke has >= 2 points, each point has finite numeric `x`,`y`; `glyphs.js` source has no `fetch(`, `url(`, `.png`, `.svg`, `@font-face`, `new Image` |
| AC11 | glyphs.test.js | ids are unique; `GLYPHS.map(g=>g.id)` deepEqual `EXPECTED_LETTERS`; each `case` matches its id; every point within 0..100. Plus `{todo: FULL_SET_TODO}`: `GLYPHS.length === 52` and ids deepEqual `FULL_PAIRED_ALPHABET` |
| AC12 | geometry.test.js | `resample` on a straight line, an L-shape, an arc and a line with repeated points: first and last points equal the input's ends, consecutive gaps <= spacing + 1e-9, no NaN; 1-point → 1 point; empty → []; spacing 0, -1, NaN throw; input not mutated |
| AC13 | scoring.test.js | `coverage(guide, [], t) === 0`; ink = `guidePoints(guide)` → 1; ink covering only the left half of a line → about 0.5 (±0.1); a point exactly at distance `t` counts as covered |
| AC14 | scoring.test.js | `strayRatio` ink on guide → 0; ink at (95,95) far from a guide at x=10 → 1; empty ink → 0; half on, half off → 0.5 |
| AC15 | scoring.test.js | Constants equal 0.85 and 0.5; `isDone(0.85,0.5)` true; `isDone(0.84,0)` false; `isDone(1,0.51)` false; `isDone(NaN,0)` false |
| AC16 | glyph-scoring.test.js | For every glyph in `GLYPHS`: grid x,y = 0,2,…,100 (51×51) gives `strayRatio(g.strokes, grid, TRACE_TOLERANCE) > 0.5` and `isDone` false |
| AC17 | glyph-scoring.test.js | For every glyph: ink = `g.strokes.flat()` gives `isDone(coverage, strayRatio)` true. Also via `game.js`: replay each stroke as down/move…/up `inkEvent`s and get `isLetterDone` true |
| AC18 | glyph-scoring.test.js | For every glyph with `strokes.length >= 2`: ink = `g.strokes[0]` gives `isDone` false. Sanity: at least one glyph in the table has 2+ strokes |
| AC24 | game.test.js | `nextLetter(GLYPHS.length-1, GLYPHS) === 0`; applying it `GLYPHS.length` times from 0 returns to 0 and visits each index exactly once; ids in order deepEqual `EXPECTED_LETTERS`; `GLYPHS[0].id === 'a'` and `createLetterGame().index === 0`; `nextLetter(0, [])` throws. `{todo: FULL_SET_TODO}`: 52 steps returns to 0 |
| AC25 | parent-hold.test.js | `PARENT_HOLD_MS === 1000`. down@0, tick@999 not passed, tick@1000 passed. down@0, up@500 is idle (reset), then down@600, tick@1599 not passed, tick@1600 passed. Tap down@0/up@0 not passed. down@0, leave@800, tick@1200 not passed. Same with cancel. down@0, up@1000 (no tick) passed. Second pointer down during a hold keeps `startedAt`; up/leave from the other pointer is ignored. Tick when idle returns the same object. `now` backwards gives not passed. Passed is sticky through up/leave. `holdProgress` is 0 idle, 0.5 at 500 ms, 1 when passed, clamped at 1. Frozen input not mutated |
| AC26 | game.test.js | Empty-ink game + `parentEvent` down@0, tick@1000 gives `isLetterDone` true and `done === true`. Same with scribble ink far from the guide. A traced-done state and a parent-done state have the same key set and the same `done` value. `clearInk` and `goNext` reset `done` to false |
| AC30 | static-rules.test.js | No file in `index.html`, `styles.css` or recursively under `src/` contains any of: `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `<script src="http`, `localStorage`, `sessionStorage`, `document.cookie`, `@import url(`. Scanning `styles.css` too is stricter than the AC; it enforces the CLAUDE.md no-external-fonts rule |
| AC32 | static-rules.test.js | Parsed `package.json`: `type === 'module'`, no `dependencies` key, no `devDependencies` key |
| (support) | ink.test.js | multi-touch: a second pointer's down/move/up is ignored while a stroke is active; a 1-point stroke is kept; non-finite points are ignored; `pointCount` stops at `MAX_INK_POINTS`; `endStroke` from the wrong pointer is ignored; inputs not mutated |
| (support) | tool-mapping.test.js | `toGlyphSpace` maps rect corners to (0,0) and (100,100) and the centre to (50,50); a zero-size rect gives null. Import it only from `tool.js` if that module has no top-level DOM access; the engineer keeps `tool.js` free of top-level `document` use so the import works in Node |

Test helpers read files with `fs` and paths from `new URL('../../', import.meta.url)`. Write a small recursive directory walk; do not rely on `readdirSync({recursive})`.

## Risks and edge cases (the tester will probe these)
- **Rapid taps.** On the pad, each tap is a 1-point stroke, which is kept, scored and drawn as a dot. On Next, each tap advances one letter, and buttons use `touch-action: manipulation` so double taps do not zoom. On the parent button, taps under 1000 ms never pass.
- **Multi-touch.** The pad tracks only the first pointer until it lifts. The parent hold tracks only the pointer that started it. A child drawing while a parent holds works, because the two state parts are independent.
- **A stroke of one point.** `resample` returns 1 point, `inkPoints` keeps it, and scoring works.
- **Empty ink.** Coverage 0 and stray 0 give not done. A parent pass still gives done (AC26).
- **Huge point counts.** Ink is capped at `MAX_INK_POINTS` (5000) raw points. Scoring is O(guide × ink), about 200 × 5000 per stroke end, which is fine. The redraw happens at most once per frame.
- **Parent hold interrupted or released early.** Up before 1000 ms resets, and leave or cancel always resets. Long-press side effects are suppressed: `contextmenu` is prevented, and `user-select:none` and `-webkit-touch-callout:none` are set on the button. A missed tick is covered because `up` at 1000 ms or later passes.
- **Switching tools mid-stroke.** With one tool, tapping the active switcher button is a no-op (AC3), so the stroke continues. In general, `unmount` aborts all listeners and the rAF, and discards tool state. Nothing leaks into switch state (AC5).
- **Window resize or orientation change.** Ink lives in glyph space, so only the canvas backing store is re-sized and redrawn. Ink is not lost and does not shift. A zero-size pad (`toGlyphSpace` null) ignores events.
- **pointercancel** (a system gesture during a stroke) ends the stroke and scores it.
- **No SVG namespace.** `document.createElementNS('http://…svg')` would fail AC30. Use canvas, or inline `<svg>` markup without the xmlns attribute in index.html.
- **Risk for 1b, AC16.** Long glyphs (m, M, w, W) cover more of the box at tolerance 6. If one fails the grid test in 1b, shrink the glyph within the box. Do not change `TRACE_TOLERANCE` without the tech lead.
- **Risk for 1b, AC18.** For i and j, the stem alone would cover more than 85% of the guide if the dot is a tiny stroke. In 1b, author the dot as a small loop (e.g. `arc(cx, 25, 4, 4, 0, 360)`) placed more than 6 units above the stem.
- **Risk, thresholds feel.** 0.85 / 0.5 / tolerance 6 are starting guesses, tuned on the phone after first play (owner-approved).

## Model suggestion for the engineer
**sonnet.** The plan fixes every signature, the glyph coordinates and every test, but it spans about 20 files. It also includes pointer-event DOM work (capture, leave, contextmenu, rAF, canvas DPR) whose mistakes only show on a phone. That is more than a "single-file-ish" task, where haiku tends to slip. Increment 1b is data only against fixed tests, so haiku is the right choice there.

## Definition of done
- All [AUTO] criteria pass with `node --test`. The only TODO tests are those gated by `FULL_SET_TODO`, and they belong to 1b.
- No rule in CLAUDE.md or web-rules.md (as adapted above) is broken.
- No package dependencies, no build step, and the site works as static files from the repo root.
