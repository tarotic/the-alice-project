# Plan for increment 2: Shapes tool (second tool in the switcher) + carry-over g fix

Scope: docs/requirements.md (Shapes, AC1-AC30, approved), plus two owner decisions made after the requirements were written (approved):
1. The page title changes from "Letters" to "Play". This is an approved exception to AC25 (see "Existing tests that change").
2. Carry-over: a data-only g tweak, so that tracing a plain 'a' no longer passes g (see "Carry-over: g").

The Letters tool is done and working on the phone. Its behaviour must not change. The only letters source edits are (a) a behaviour-neutral refactor of `src/tools/letters/tool.js` into a factory, and (b) the g data line in `glyphs.js`.

## BLOCKERS
None.

Doubts that do not block the work are listed under "Risks and edge cases". The main ones are R1 (the g numbers are hand-calculated, so the engineer measures them first) and R2 (the tech lead could not list `tests/adversarial/`).

## Prerequisites
- Runtime and minimum version: **Node.js 20 or newer**. The tech lead cannot check the machine. The last test report ran Node v22. The engineer checks with `node --version`.
- Test command: **`node --test`**, run from the repo root `/home/claude/alice`. Every test file must end in `.test.js`, and helper files must not (for example `tests/unit/fake-dom.js`). The full run takes about 80 s today because of the letters tap-grid test. The new tests add only a few seconds.
- A single file runs with `node --test tests/unit/<file>.test.js`. Use this for the g and shape measurements (they print with `t.diagnostic`).
- Isolation: each test file must run in its own process, which is the default in Node 20 and 22. `tests/unit/extend-registry.test.js` registers a `fake` tool into the default registry, so AC1 would fail if files shared a process. **Never run with `--test-isolation=none`.**
- Other tools or files:
  - No npm packages. Do not run `npm install` or `npx`.
  - `package.json` is not touched.
  - For a desktop look, use any static server from the repo root, for example `python3 -m http.server 8000`. ES modules do not load from `file://`. It is not needed for tests.
  - The tester and the owner need the phone for the [MANUAL] checks.
- Files the engineer reads first: `src/tools/letters/tool.js`, `game.js`, `glyphs.js`, `scoring.js`, and `tests/adversarial/tool-dom.test.js`. That test pins letters DOM behaviour, and its fake DOM is the model for the new `tests/unit/fake-dom.js`.

## Approach
Shapes is the same trace game with a different item list, so the plan reuses the letters modules instead of copying them.

The pure layer is already generic:
- `game.js` takes the item list as a parameter (`inkEvent(state, e, items)`, `goNext(state, items)`, `currentGlyph(state, items)`, `nextLetter(i, items)`).
- `scoreInk` only reads `item.strokes`.
- `ink.js`, `parent-hold.js`, `scoring.js`, `geometry.js` and the views know nothing about letters.

So shapes imports them unchanged from `../letters/*.js`. The shapes game state is exactly `createLetterGame()`, with items = `SHAPES` instead of `GLYPHS`.

The only generalisation is in `letters/tool.js`. Its DOM wiring moves into an exported factory, `createTraceTool({ id, label, items, labelText })`. It holds its controller, rAF ids, host and game state per instance, not per module. `lettersTool` becomes one call to that factory, with the same id, label, items and label text, and DOM and behaviour identical to today. `shapesTool` is a second call. Each tool cleans up its own listeners, frames and children on unmount, exactly as letters does today.

Shape data is one closed stroke per shape, built from `arc()` (imported from `letters/glyphs.js`) and a tiny `closedPolygon()` helper, then resampled at 2 like glyphs.

```
                      ui.js (unchanged) ──> switcher.js ──> registry.js
                                                              ^
tools/index.js: registerTool(lettersTool); registerTool(shapesTool)   (order = Letters, Shapes)
                         │                                │
       letters/tool.js:  createTraceTool({...GLYPHS})    shapes/tool.js: createTraceTool({...SHAPES})
                         └──────────────┬─────────────────┘
                     one factory = thin DOM (canvas pad, Clear, Next, reward, Parent: got it)
                                        │ uses, unchanged
        letters/game.js (createLetterGame, inkEvent, parentEvent, clearInk, goNext, currentGlyph, isLetterDone)
          ├─ letters/ink.js   ├─ letters/parent-hold.js   └─ letters/scoring.js ── letters/geometry.js
        letters/views/* (drawGuide, drawInk, holdProgressWidth, rewardView, drawRewardShape)
                                        │ items
              letters/glyphs.js: GLYPHS (52)        shapes/shapes.js: SHAPES (6)  <- imports arc, resample
```

## Files
| File | New/change | Responsibility |
|---|---|---|
| index.html | Change | `<title>Play</title>` (owner decision 1). Nothing else changes. |
| src/tools/index.js | Change | Register `lettersTool`, then `shapesTool`. |
| src/tools/letters/tool.js | Change (refactor, behaviour-neutral) | Add `createTraceTool`. `lettersTool` is built with it. `toGlyphSpace` is unchanged. |
| src/tools/letters/glyphs.js | Change (data only) | Only the `g:` entry of `GLYPH_SOURCE` (see "Carry-over: g"). |
| src/tools/shapes/shapes.js | New | Shape data, `SHAPES`, `getShape`, `shapeLabel`, helpers, re-exported rule constants. Pure. |
| src/tools/shapes/tool.js | New | `shapesTool = createTraceTool({...})`. No top-level DOM use. |
| tests/unit/static-rules.test.js | Change (approved exception) | Title assertion `'Letters'` becomes `'Play'`. |
| tests/unit/fake-dom.js | New (helper, not a test) | Minimal fake DOM for mount/unmount tests. |
| tests/unit/shapes.test.js | New | Tests AC6-AC10, AC19 (pure). |
| tests/unit/shape-scoring.test.js | New | Tests AC11-AC17. |
| tests/unit/shape-game.test.js | New | Tests AC21 and AC23 (pure). |
| tests/unit/tools-switch.test.js | New | Tests AC1-AC3, AC19 and AC21 through the DOM, plus cleanup. |
| tests/unit/shapes-static.test.js | New | AC26 (the shapes folder exists and is scanned). |
| tests/unit/g-carry-over.test.js | New | Carry-over g test. |

`styles.css`, `src/ui.js`, `src/registry.js`, `src/switcher.js`, `package.json` and every other letters file are **not** changed. Shapes reuses the existing CSS classes (`letter-label`, `pad`, `actions`, `reward`, `reward-star`, `parent`, `parent-fill`, `parent-text`). The class name `letter-label` is kept for shapes too, so no CSS change is needed.

## Interfaces (function signatures the engineer must match)
The types are the same as in docs/letters/plan.md: `Point = {x, y}`, `Stroke = Point[]`, `Tool = {id, label, mount(host), unmount()}`.
A shape is `Item = {id: string, strokes: Stroke[]}`. A shape has no `case` field.

### src/tools/letters/tool.js (refactor, behaviour-neutral)
```js
export function toGlyphSpace(clientX, clientY, rect)            // UNCHANGED
export function createTraceTool({ id, label, items, labelText })
  // id, label: strings, passed straight through to the returned object
  // items: Item[] (non-empty); labelText: (item) => string
  // -> { id, label, mount(host), unmount(), getState() }
export const lettersTool = createTraceTool({
  id: 'letters', label: 'Letters', items: GLYPHS, labelText: (g) => `${g.id} · ${g.case}`,
})
```
Make exactly these edits and nothing else:
1. The module-level `let controller = null; let rafId = 0; let holdRafId = 0; let mountedHost = null` move inside `createTraceTool`, together with a new `let state = null`. Each tool instance then has its own copy.
2. Move the current `mount` and `unmount` bodies into the returned object, unchanged, with these exceptions:
   - `let state = createLetterGame()` in mount becomes the assignment `state = createLetterGame()`. It now assigns the factory-level variable.
   - Every `GLYPHS` inside mount becomes `items`. That is 4 places: `currentGlyph(state, GLYPHS)`, `inkEvent(..., GLYPHS)`, and the two `goNext` / Next-handler uses.
   - Rename the local element `label` to `labelEl`, so it does not shadow the factory parameter. The line that writes the label becomes `labelEl.textContent = labelText(g)`.
   - `unmount` additionally sets `state = null` at its end.
3. Add `getState() { return state }`. It returns the live game state while mounted, and `null` before the first mount and after unmount. This is a test seam only. The registry stores only `{id, label, mount, unmount}`, so `ui.js` never sees it. Tests must not mutate what it returns.
4. Keep these exactly as they are:
   - element order and class names
   - the texts "Clear", "Next", "Parent: got it" and "Well done!"
   - capture and release logic, the rAF batching, the hold loop, `contextmenu`, and the resize and orientation listeners
   - unmount order: abort, cancel both rAFs, `replaceChildren()`
   - No top-level `document`, `window` or `requestAnimationFrame` use, so the file stays importable in Node.

Letters behaviour is unchanged: the same DOM, the same reducers, the same items. The 120 adversarial and 53 unit tests must still pass. `tests/adversarial/tool-dom.test.js` is the main guard.

### src/tools/shapes/shapes.js (pure)
```js
import { resample } from '../letters/geometry.js'
import { arc } from '../letters/glyphs.js'
export { TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD } from '../letters/scoring.js'
export { PARENT_HOLD_MS } from '../letters/parent-hold.js'

export const SHAPE_ORDER = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'star']
export const SHAPE_POINT_SPACING = 2          // same as GLYPH_POINT_SPACING
export function closedPolygon(vertices)       // [[x,y],...] (>= 3) -> NEW array [...copies of vertices, copy of vertices[0]]
export function starVertices(cx, cy, outerR, innerR)
  // -> 10 [x,y] pairs; for i = 0..9: deg = -90 - 36*i, r = (i % 2 === 0) ? outerR : innerR,
  //    [cx + r*cos(deg), cy + r*sin(deg)]  (degrees -> radians; screen y down; decreasing deg = counter-clockwise)
export const SHAPE_SOURCE = {
  circle:    [arc(50, 50, 40, 40, 270, -90, 48)],
  square:    [closedPolygon([[22, 22], [22, 78], [78, 78], [78, 22]])],
  triangle:  [closedPolygon([[50, 15], [15, 85], [85, 85]])],
  rectangle: [closedPolygon([[10, 30], [10, 70], [90, 70], [90, 30]])],
  oval:      [arc(50, 50, 24, 40, 270, -90, 48)],
  star:      [closedPolygon(starVertices(50, 52, 40, 16))],
}
export const SHAPES   // deep-frozen Item[] in SHAPE_ORDER:
                      // { id, strokes: SHAPE_SOURCE[id].map(s => resample(s.map(([x, y]) => ({ x, y })), SHAPE_POINT_SPACING)) }
export function getShape(id)     // -> Item | undefined
export function shapeLabel(shape) // -> shape.id   (lowercase English name, e.g. 'circle')
```
- Write `deepFreeze` and the `[x,y]` to `{x,y}` mapping as 2 local lines, the same as in glyphs.js. Do not export new helpers from glyphs.js.
- The file must not contain `fetch(`, `url(`, `.png`, `.svg`, `@font-face`, `new Image`, `http`, or the project or owner names.

Shape decisions (the tech lead's call, recorded here):
- **One closed stroke per shape (AC8, first option).** For each shape, the first and last stored points are equal, within float error (< 1e-9). `closedPolygon` appends an exact copy of the first vertex, `arc(...,270,-90)` ends where it starts, and `resample` always keeps the last point. So AC13 holds vacuously: the count of multi-stroke shapes is 0.
- **Start and direction (child friendly, all the same):** start at the top and go **counter-clockwise**, which is the same as the letter o (`arc(..., 270, -90)`).

  | Shape | Starts at | Path |
  |---|---|---|
  | circle, oval | top centre (50,10) | toward the left |
  | square | top-left corner | down, across, up, back |
  | rectangle | top-left corner | the same as the square |
  | triangle | the apex | down-left, across the base, back up |
  | star | the top tip (50,12) | toward the upper-left inner corner |

  Direction is not scored (out of scope). It only fixes the stored order, which is the drawing order for AC12.
- Exact vertices, so the engineer cannot guess:
  - square: 22..78 on both axes (56 x 56)
  - rectangle: x 10..90, y 30..70 (80 x 40)
  - triangle: apex (50,15), base (15,85)-(85,85)
  - star vertices, rounded to 2 decimals: (50,12), (40.60,39.06), (11.96,39.64), (34.78,56.94), (26.49,84.36), (50,68), (73.51,84.36), (65.22,56.94), (88.04,39.64), (59.40,39.06), then back to (50,12)
  - circle: bbox 10..90 (80 x 80)
  - oval: bbox x 26..74, y 10..90 (48 x 80)

  With `steps = 48`, the arcs include exactly the angles 270, 180, 90, 0 and -90. Polygon side lengths (56, 40, 80) are multiples of 2, so resampling keeps the corners exactly. The star and triangle corners may be cut by up to 1 unit along the edge, which is harmless.
- All rule constants are the letters values, imported and not redefined (AC10): tolerance 6, coverage 0.85, stray 0.5, hold 1000 ms. No value is changed for shapes.

### src/tools/shapes/tool.js (thin)
```js
import { createTraceTool } from '../letters/tool.js'
import { SHAPES, shapeLabel } from './shapes.js'
export const shapesTool = createTraceTool({ id: 'shapes', label: 'Shapes', items: SHAPES, labelText: shapeLabel })
```

### src/tools/index.js
```js
import { registerTool } from '../registry.js'
import { lettersTool } from './letters/tool.js'
import { shapesTool } from './shapes/tool.js'
registerTool(lettersTool)
registerTool(shapesTool)
```
`ui.js` already builds one button per `listTools()` entry, in order, marks the active one with `aria-pressed`, and mounts the first tool. So the bar shows "Letters" (active) and "Shapes", and needs no change.

### How a switch cleans up (AC3, AC5)
`performSwitch` calls `old.unmount()` and then `new.mount(host)`. The unmount of any `createTraceTool` instance:
- aborts its `AbortController`, which removes all pad, button, parent and window `resize`/`orientationchange` listeners
- cancels its pending render rAF and its hold-loop rAF, and sets both to 0
- calls `host.replaceChildren()`
- sets its `state = null`

The next mount always starts from `createLetterGame()` (index 0, empty ink, `done:false`, idle hold). The two tools share no state: each factory call has its own closure. Switch state stays `{activeId}`. The same-tool tap is a no-op, as before.

### index.html
Only the `<title>` text changes: `Letters` becomes `Play`. No project name anywhere.

## Carry-over: g
Problem: `g` is one stroke: the same bowl and connector as `a`, the stem (68,45)-(68,74), and the hook `arc(44,74,24,21,0,130,16)`. Tracing a plain `a` covers the bowl, the stem and the start of the hook. By hand, about 173 of 211 guide units are covered, which is about 0.82. This matches the owner's measurement. The pass line is 0.85.

Fix (data only): make the left hook longer, so that a larger share of g is tail that `a` never reaches. The look stays the same: bowl, stem and a left hook that now curls round to point up at the end.
```js
g: [[...arc(50, 65, 18, 20, 300, -60), [68, 45], [68, 76], ...arc(42, 76, 26, 22, 0, 180, 24)]],
```
- The hook starts at the stem bottom (68,76), dips to (42,98), and ends at (16,76).
- All points lie within x 16..68 and y 45..98, so the descender stays within 0..100.
- The tail end is 16 units from the bowl's left edge (32,65), so it stays a hook and does not touch the bowl.
- Hand estimate:
  - the hook is about 75 units, of which only the first ~14 lie within 6 of a's stem end (68,85)
  - g total is about 235 units
  - `a` covers about 174 units, so **coverage(g, a) ≈ 0.74**
  - **This is a risk (R1). Measure it first.**

Fallback ladder. Use it only if the measured value is > 0.75, and try the steps in order, so that each step changes only the hook arc:
1. `arc(42, 76, 26, 22, 0, 195, 26)`: the tail end is about (16.9,70.3), still more than 15 from the bowl. Expected value about 0.72.
2. `arc(40, 76, 28, 22, 0, 190, 26)`: x min is about 12. Expected value about 0.71.

If none reaches ≤ 0.75 while every check below passes, stop and report the measured numbers. Do not change any other glyph, any constant or the stem.

Do not touch any other glyph, `dot()`, the i/j data or any scoring constant.

Checks that must still hold after the g change:
- these already exist and are run by `node --test`: own trace, reversed and via the reducer; ±3/±2 jitter and +4 offset still pass; first 40% and 50% of the stroke fail; the "g bowl only" check (first 49 stored points) fails; the letter `o` does not pass g; the grid fails; all points are within 0..100
- the new test below

How to measure: `node --test tests/unit/g-carry-over.test.js`. The test prints the diagnostics.
1. Before editing, write the test and run it once against the old g. Record the old value. It should be about 0.82 and the test should fail.
2. Then apply the data change and run it again.

`tests/unit/g-carry-over.test.js`, test name **`carry-over g: tracing a plain a scores <= 0.75 on g and is not done`**. It asserts:
- `coverage(G('g').strokes, G('a').strokes.flat(), TRACE_TOLERANCE) <= 0.75`
- `isDone(coverage, strayRatio)` is false for that ink
- g's own points give done
- every g point is within 0..100
- `G('g').strokes.length === 1`

A second test, **`INFO carry-over g: c o d n p q u against g (recorded only)`**, prints coverage, stray and done for each of c, o, d, n, p, q, u traced against g, with `t.diagnostic`, and asserts nothing.

Known behaviour, not required to change: some of these may still pass g, q being the most likely because its stem runs to y=95. The tester records whatever is measured.

## Existing tests that change (approved exception to AC25)
Only the page title is pinned:

| File | Lines | Now | After | Who updates |
|---|---|---|---|---|
| tests/unit/static-rules.test.js | 20 (test name `AC9 title is exactly Letters ...`), 24 (`assert.equal(m[1], 'Letters')`) | `'Letters'` | `'Play'` (test name: `AC9 title is exactly Play and no names in html/src`) | **engineer** (unit test) |
| tests/adversarial/* | none found in tool-dom.test.js, full-set.test.js, dot-tap.test.js, reducers.test.js (read in full) | - | - | **tester** |

The tech lead had no directory listing and could not open the other adversarial files (see R2). The **tester** (not the engineer) searches `tests/adversarial/` for `<title>`, `'Letters'` used as a title, and any assertion that the real tool index has exactly one tool, and updates those. The engineer never edits `tests/adversarial/`.

`tests/adversarial/tool-dom.test.js` uses `'Letters'` only as a tool label, which stays. No other existing test may change.

## Test list (every [AUTO] criterion maps to at least one test)
Helpers:
- `const done = (item, ink) => isDone(coverage(item.strokes, ink, TRACE_TOLERANCE), strayRatio(item.strokes, ink, TRACE_TOLERANCE))`
- `grid` = x,y = 0,2,…,100 (51×51 points)
- `prefix60(item)` = `item.strokes.flatMap(s => resample(s, 0.5))` sliced to its first `Math.floor(0.6 * length)` points. That is the first 60% of the outline's length in drawing order, left unclosed.

**`tests/unit/fake-dom.js`** (helper, modelled on tests/adversarial/tool-dom.test.js) exports `installFakeDom()`, which does two things:
- It sets `globalThis.document`, `window` (with `devicePixelRatio` and a listener list that honours `{signal}` abort), `requestAnimationFrame`, `cancelAnimationFrame` and a controllable `performance.now`.
- It returns `{ FakeEl, makeHost, flushRaf, pendingRaf(), liveListeners(), setNow(ms), find(el, pred), text(el) }`.

`makeHost()` returns a FakeEl whose `replaceChildren(...c)` also pushes `c.length === 0 ? 'clear' : 'build'` to `host.log`. Call `installFakeDom()` at the top of the test file, before any `mount`.

| AC | Test file | What it asserts |
|---|---|---|
| AC1 | tools-switch.test.js | After `import '../../src/tools/index.js'`, `listTools().map(t => [t.id, t.label])` deepEqual `[['letters','Letters'],['shapes','Shapes']]`; length is exactly 2 |
| AC2 | tools-switch.test.js | Real registry and `performSwitch`, with host = `makeHost()`. Start at `null` → letters, then clear `host.log`. letters → shapes: `host.log` deepEqual `['clear','build']` (Letters unmount once, then Shapes mount once), `lettersTool.getState() === null`, `shapesTool.getState() !== null`, host text has `circle`. shapes → letters: log `['clear','build']`, `shapesTool.getState() === null`, text has `a · lowercase`. `performSwitch(state,'letters',host)` while letters is active: log empty and the same state object is returned |
| AC3 | tools-switch.test.js | First dirty the letters game: pad `pointerdown`/`pointermove`, plus parent `pointerdown`. Then letters → shapes → letters. Switch state deepEqual `{activeId:'letters'}` with keys `['activeId']`; `lettersTool.getState()` deepEqual `createLetterGame()`; host text has `a · lowercase`; `pendingRaf() === 0` after each unmount. Mirror case: dirty shapes, then shapes → letters → shapes. `shapesTool.getState()` deepEqual `createLetterGame()`, `currentGlyph(state, SHAPES).id === 'circle'`, text has `circle` |
| AC3 (support) | tools-switch.test.js | 50 rapid letters↔shapes switches, each after a pad `pointerdown` and a parent `pointerdown`: at the end `liveListeners()` counts only the active tool's listeners (equal to the count right after a fresh mount of that tool) and `pendingRaf() <= 1`. After a final unmount, both are 0 and `host.children.length === 0` |
| AC6 | shapes.test.js | `SHAPES.map(s=>s.id)` deepEqual `['circle','square','triangle','rectangle','oval','star']` and equals `SHAPE_ORDER`. Every shape has a non-empty `strokes`; every stroke has ≥ 2 points with finite numeric `x`,`y`. The `shapes.js` source contains none of `fetch(`, `url(`, `.png`, `.svg`, `@font-face`, `new Image`. `getShape('circle').id === 'circle'`; `getShape('x') === undefined` |
| AC7 | shapes.test.js | Every point of every shape has `0 <= x,y <= 100` |
| AC8 | shapes.test.js | Every shape has exactly 1 stroke (the plan's choice), and that stroke's first and last points are within 1 unit (`distance <= 1`) |
| AC9 | shapes.test.js | Bounding box (min/max over all stored points): rectangle `w/h >= 1.8`; square `abs(w-h)/max(w,h) <= 0.05`; circle the same; oval `w <= 0.7*h` and `w <= 0.7*circleW`. Expected about 2.0, 1.0, 1.0 and 0.6 (oval width 48 vs a limit of 56) |
| AC10 | shapes.test.js | The re-exports from `shapes.js` equal 6, 0.85, 0.5 and 1000, and are `===` the letters exports (`scoring.js`, `parent-hold.js`) |
| AC11 | shape-scoring.test.js | For all 6: `done(s, s.strokes.flat())` is true. Also through the reducer: `{...createLetterGame(), index:i}`, replay each stroke as down/move…/up with `inkEvent(…, SHAPES)`, and `isLetterDone` is true |
| AC12 | shape-scoring.test.js | For all 6, `done(s, prefix60(s))` is false. A separate named test for the circle: `'AC12 circle: 60% of the circle is not done'` |
| AC13 | shape-scoring.test.js | `SHAPES.filter(s => s.strokes.length >= 2).length === 0`. Then the (vacuous) loop over multi-stroke shapes asserts that first-stroke-only is not done |
| AC14 | shape-scoring.test.js | For all 6: `strayRatio(s.strokes, grid, TRACE_TOLERANCE) > 0.5` and `done(s, grid)` is false. The same grid through the reducer, as one zigzag stroke then up, gives `isLetterDone` false |
| AC15 | shape-scoring.test.js | For all 6: `done(s, [])` is false, and `scoreInk(s, emptyInk()).done` is false |
| AC16 | shape-scoring.test.js | For every ordered pair A≠B, except circle/oval and square/rectangle in both directions: `done(B, A.strokes.flat())` is false. Also `t.diagnostic` prints the 6×6 coverage/stray matrix |
| AC17 | shape-scoring.test.js | `done(oval, circle)`, `done(circle, oval)`, `done(rectangle, square)` and `done(square, rectangle)` are all false (own points as ink). Each is a separate assertion message |
| AC19 | shapes.test.js | `shapeLabel(getShape(id)) === id` and matches `/^[a-z]+$/` for each of the 6 ids |
| AC19 (DOM) | tools-switch.test.js | Mount shapes. Six times: read the `.letter-label` text, then parent-pass (pointerdown, `setNow(+1100)`, flushRaf ×2) and click Next. The labels seen deepEqual `['circle','square','triangle','rectangle','oval','star']`, and the 7th label is `circle` |
| AC21 | shape-game.test.js | `nextLetter(5, SHAPES) === 0`; 6 steps from 0 return to 0, visiting each index once; ids in order as in AC6; `createLetterGame().index === 0` and `currentGlyph(createLetterGame(), SHAPES).id === 'circle'`; `goNext(state, SHAPES)` advances index and resets ink, done and hold |
| AC21 (DOM) | tools-switch.test.js | On a fresh shapes mount, Next is `disabled`. Clicking it does nothing (label stays `circle`). After a parent pass Next is enabled, and a click shows `square` |
| AC23 | shape-game.test.js | On a shapes game with empty ink: down@0, tick@999 not done; tick@1000 done. A tap (down@0, up@0) is not done. down@0, up@500 is not done. A scribble far from the circle plus a 1000 ms hold is done. `scoreInk` is not called by the hold path: done without ink |
| AC25 | all | `node --test`: every pre-existing unit and adversarial test passes, unchanged, except the approved title edit listed above |
| AC26 | static-rules.test.js (existing AC30 test, walks `src/` recursively, so it now covers `src/tools/shapes/`) + shapes-static.test.js | New: `src/tools/shapes/` is a directory containing ≥ 1 file, and both `shapes.js` and `tool.js` are in the recursive walk of `src/`. The existing tests keep covering `index.html` and `styles.css` |
| AC27 | static-rules.test.js (existing `AC32 package.json` test) | `type === 'module'`, no `dependencies`, no `devDependencies`. It is unchanged and must still pass |
| Carry-over g | g-carry-over.test.js | See "Carry-over: g" |

Expected measurements for AC16/AC17 (hand estimates of coverage, B's guide covered by A's ink; all should be far below 0.85). Before writing assertions, the engineer prints the matrix. **Any pair measuring ≥ 0.75 is reported as a risk, not tuned silently:**

| A ink → B guide | expected coverage | why it fails |
|---|---|---|
| circle → oval / oval → circle | ≈ 0.35-0.45 / ≈ 0.35-0.45 | They only meet near the top and bottom (oval is 48 wide vs 80). |
| square → rectangle / rectangle → square | ≈ 0.2 / ≈ 0.2 | The horizontal edges are 8 apart (y 22 vs 30, 78 vs 70), so they meet only at the crossings. |
| circle → square / square → circle | ≈ 0.3-0.4 / ≈ 0.3-0.4 | Side midpoints are 12 apart; only the corners touch the circle. |
| circle → rectangle | ≈ 0.45 | Only the short sides (x=10/90) lie on the circle. Stray is about 0.5. |
| rectangle → circle | ≈ 0.5 | The same. |
| oval → square | ≈ 0.5-0.6 | The highest pair. The oval's sides are 4 from the square's sides. |
| square → oval | ≈ 0.5 | The same. |
| triangle ↔ circle / oval / square / star | ≈ 0.25-0.45 | The triangle base y=85 is 5 from the circle and oval bottoms. |
| star ↔ anything | ≈ 0.2-0.45 | Star tips touch the circle; the edges cross the square. |

AC12 expected values: about 0.65 for the circle, square, rectangle and triangle, about 0.67 for the oval, and about 0.67 for the star. The star's cut lands on a tip; the other side of that spike adds about 10 units.

AC14 expected stray: about 0.65-0.75. The longest outline is the star at about 286 units, and stray stays above 0.5 while the outline is under about 430 units.

## Risks and edge cases (the tester will probe these)
- **R1 g numbers are hand-calculated.** The old g estimate (0.82) matches the owner's measurement, so the model is calibrated. Even so, the new value of about 0.74 is close to 0.75. Run the measurement before and after, and use the fallback ladder.
- **R2 the adversarial folder could not be listed.** The tech lead read tool-dom, full-set, dot-tap and reducers (and the freeze.js helper); none pins the title. About 60 adversarial tests live in files the tech lead did not see. The tester greps all of `tests/adversarial/` for title pins and for "exactly one tool" assertions against the real index, and updates only those.
- **R3 the refactor of letters/tool.js.** It must be a pure move: the same DOM, events and rAF behaviour. If any tool-dom adversarial test fails after the refactor, revert and redo it. Do not edit the test.
- **R4 shape measurements.** The AC16/AC17 table is hand-estimated. If a pair measures ≥ 0.75, or AC12 measures ≥ 0.8, stop and report. Do not change thresholds, and do not reshape beyond the stated coordinates.
- **Switching mid-stroke.** pointerdown and move on the shapes pad, then tap Letters. Unmount aborts the pad listeners; a late `pointermove` or `pointerup` on the old pad does nothing and does not throw; switching back gives a clear pad and "circle". The same holds Letters → Shapes.
- **A stroke that never gets pointerup, then a switch.** The pad is fresh after returning (the stuck stroke is not carried over).
- **Parent hold interrupted by a switch.** Parent `pointerdown` on Shapes, then tap Letters before 1 s. The hold rAF is cancelled (`pendingRaf() === 0`), nothing passes on either tool, and a late `pointerup` on the old button does nothing. Hold timers left running after unmount: none. Both rAF ids are cancelled and zeroed.
- **Rapid switching** (×50 or ×200 alternating, with a pad and parent press in between): live listeners stay at one tool's set, no rAF piles up, and the host only holds the active tool's children.
- **Multi-touch.** A second finger on the pad is ignored, as in letters. One finger drawing while another taps the switcher: the switch happens and the stroke is dropped with the unmounted tool. A child drawing while a parent holds works on Shapes too.
- **Resize or orientation change** on Shapes, mid-stroke and after a trace: the ink stays in place (it is stored in 0..100 space), and redraws are batched into one frame. After switching away, window resize events reach no listener of the old tool.
- **Separate state per tool.** Letters' factory state is `null` while Shapes is mounted, and vice versa. Nothing is shared at module level any more.
- **Recorded behaviours (not bugs):**
  - Because coverage is 0.85, an unclosed shape trace that leaves only about 10% undone can pass. 60% always fails (AC12); the tester may record 80% and 90%.
  - A sloppy or off-centre circle can pass the oval or the circle, and a square can be confused with a rectangle (AC17 known limitation).
  - Direction is not checked: a clockwise trace passes too.
- **Next on Shapes** is disabled until done. After star it wraps to circle. Clear resets ink, done and hold.
- **Title.** `index.html` `<title>` is exactly "Play", with no project or owner names.
- **Letters regression.** The whole letters suite passes. g looks natural on the phone: bowl, stem, and a left hook curling up (manual check).

## Model suggestion for the engineer
**sonnet.** The plan fixes every signature, coordinate and test. But the work spans about 12 files, including a behaviour-neutral refactor of DOM code that a 120-test adversarial suite pins, and a new fake-DOM test harness. It also includes two measure-then-adjust loops (the g ladder, and the shape matrix with stop-and-report rules). A refactor slip there only shows up as subtle DOM test failures, which is where haiku tends to slip. This is not "single-file-ish", so haiku is not suggested.

## Definition of done
- All [AUTO] criteria pass with `node --test`, with no TODO or skipped tests.
- Every pre-existing test passes unchanged, except the approved title edit in tests/unit/static-rules.test.js (and any adversarial title pins, which the tester updates).
- Carry-over g: coverage of a plain 'a' on g is ≤ 0.75 and measured. The c/o/d/n/p/q/u values are recorded.
- No rule in CLAUDE.md or web-rules.md (as adapted in docs/letters/plan.md) is broken: static files only, no network, no dependencies, pure logic with injected time, thin DOM.
