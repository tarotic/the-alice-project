# Plan: merge Letters and Shapes into the timer repo ("Timer becomes a 3rd tool")

Merge target (Tree A): `/home/claude/merged`, the owner's `main` snapshot. It has 92 tests.
Source (Tree B): `/home/claude/alice`, the Letters and Shapes tools. It has 232 tests.
Result: one static page. A top switcher holds three tools in this order: **Timer, Letters, Shapes**. Switching does not reload the page.

Amendment 1 (owner decision): **switching away from a running Timer pauses it.** This replaces the earlier "keeps counting" default. The off-screen chime design (`finish-alarm.js`, its one-shot timeout, and the catch-up while unmounted) is removed.

## BLOCKERS
None.

These doubts do not block the work. Each one has a fixed resolution below, and the engineer verifies it:
- **D1. No directory listing.** The tech lead had no Bash, Glob or Grep, so the exact file lists of `alice/tests/unit`, `alice/tests/adversarial` and `alice/src/tools/**` are known only from the earlier plans and test reports. Step 0 of the engineer checklist lists the folders and greps them. Any pin it finds that this plan does not cover goes to the owner. The engineer does not improvise around it.
- **D3. A pin in Tree A vs Tree B CSS.** `timer-adversarial.test.js` AC21a forbids the word `transition` anywhere in `styles.css` and allows only the animation names `rocket-shake, flame-flicker, rocket-launch, ring-blast, orbit, none`. Tree B's CSS has `* { transition: none !important; }` and `animation: pop`. Resolution: drop both. Neither one is visible today: there are no transitions, and Tree B's test report (observation 8) says the `pop` animation runs while the reward is still hidden. The fallback, only if a Tree B test pins `pop`: add `'pop'` to the AC21a whitelist (a one-word retarget by the tester) and keep the `pop` keyframes.
- **D4. `tests/adversarial/shell-static.test.js` uses `new URL(...).pathname`.** It works on Linux CI. On a Windows clone whose path contains a space it breaks (Tree A's plan records exactly this hazard). The tester changes it to `fileURLToPath(...)` (listed under "Test changes").
- **D5. Node version.** CI runs Node 20 and Tree B was verified on Node 22. If any Tree B test uses an API added after Node 20 (for example `Object.groupBy`, or `Set.prototype.union`/`intersection`), CI fails. The engineer greps for these in step 0 and, if possible, runs the suite on Node 20.
- **D6. Leaving at the exact end.** If the user switches away at or after the moment the countdown reaches 0, before the next frame has run, `pause(timer, now)` returns `finished`. This is existing pure-logic behaviour (AC6, "pause at exactly the end finishes"). Because the change goes through `setTimer`, the chime plays once, at that moment, while the Timer is being unmounted. On return the timer shows Done. This is intended. The owner can ask for silence in that case instead.

## Prerequisites
- Runtime: **Node.js 20 or newer** (CI uses 20). The engineer checks it with `node --version`.
- Test command: **`node --test`**, run from the repo root `/home/claude/merged`. CI runs `npm test`, which is the same. **The full run takes about 100-110 s**, because of Tree B's letters tap-grid tests. One file runs with `node --test tests/unit/<file>.test.js`.
- Each test file runs in its own process (the default). Never use `--test-isolation=none`: `extend-registry.test.js` registers a `fake` tool into the default registry.
- No npm packages, no `npm install`, no build step. `package.json` stays exactly `{ "name": "timer", "private": true, "type": "module", "scripts": { "test": "node --test" } }`. `timer-adversarial` AC25 pins this with `deepEqual`.
- Desktop look: `python3 -m http.server 8000` at the repo root. ES modules do not load from `file://`.
- Point the engineer at **this file** (`docs/letters-shapes/merge-plan.md`). Its agent definition says `docs/plan.md`, which is Tree A's increment-1 plan and must not be overwritten.

## Approach
Tree B's shell (`registry.js`, `switcher.js`, `ui.js`, `tools/`) becomes the page's entry point. Its tools stay as they are, apart from colour constants. Tree A's pure modules (`timer.js`, `screen.js`, `wheel.js`, `sound.js`, `colours.js`, `views/ring.js`) **do not move**, so every timer test that imports them is untouched. Only Tree A's DOM wiring (`src/ui.js`) moves, into `src/tools/timer/tool.js`, as a tool object `{id:'timer', label:'Timer', mount, unmount}`. Its timer state lives at module level, so it survives switches. A running timer is paused on unmount with the existing pure `pause(timer, now)`. It never runs while off screen, so there is no timeout, no off-screen chime and no catch-up.

The timer's markup stays **static in `index.html`**, inside `#tool-area`, with the same ids and classes, so its CSS and its text-pinned tests still match. On its first mount the timer tool adopts that markup (one root element, `#timer-tool`). After that it moves the same node in and out of the host. Letters and Shapes keep building fresh DOM on every mount.

The CSS keeps Tree A's file almost verbatim and appends Tree B's rules, re-coloured for the dark theme. Every Tree B rule that could collide with the timer is scoped under `#tool-area:not([data-tool="timer"])` or `#switcher`. The shell sets `data-tool` on `#tool-area`.

```
index.html: .space (planets) | nav#switcher (tabs built by ui.js) | main#tool-area[data-tool] > div#timer-tool.app (static timer markup)
src/ui.js (shell) ──> switcher.js ──> registry.js <── tools/index.js: registerTool(timerTool), (lettersTool), (shapesTool)
                                                              │
     tools/timer/tool.js (thin DOM, adopts #timer-tool, pauses on unmount) ──> ../../timer.js, screen.js, wheel.js, sound.js, colours.js, views/ring.js
     tools/letters/tool.js createTraceTool ──> letters/* (unchanged)      tools/shapes/tool.js ──> createTraceTool + shapes.js
```

## 1. File mapping

### Source and page
| Tree B file | Lands at in Tree A | Action |
|---|---|---|
| `src/registry.js` | `src/registry.js` | copy verbatim |
| `src/switcher.js` | `src/switcher.js` | copy verbatim |
| `src/ui.js` (shell) | `src/ui.js` | **replaces** Tree A's `src/ui.js`, plus one change (see §2.4). Tree A's old content moves to `src/tools/timer/tool.js` (§3). |
| `src/tools/index.js` | `src/tools/index.js` | copy, then register the timer first (§3.1) |
| `src/tools/letters/**` (glyphs, geometry, scoring, ink, parent-hold, game, tool, `views/guide.js`, `views/ink.js`, `views/hold-progress.js`, `views/reward.js`, plus any other file in that folder) | `src/tools/letters/**` | copy the whole folder verbatim, then change only the colour constants in `views/guide.js` and `views/ink.js` (§2.5) |
| `src/tools/shapes/**` (`shapes.js`, `tool.js`) | `src/tools/shapes/**` | copy verbatim |
| `index.html` | (none) | not copied. Tree A's `index.html` is edited (§2.1). |
| `styles.css` | (none) | not copied. Its rules are merged by hand into Tree A's `styles.css` (§2.3). |
| `package.json` | (none) | not copied. Tree A's stays unchanged. |
| `docs/**` | already in `docs/letters-shapes/` | not copied again |
| `.claude/**`, `CLAUDE.md`, `web-rules.md`, `.github/**` (if they exist in Tree B) | (none) | not copied. Tree A's own files stay. |

The only new Tree A source file is `src/tools/timer/tool.js`. There is **no** `finish-alarm.js`.

No name collisions in `src/`. Tree A has `src/views/ring.js` and Tree B has `src/tools/letters/views/*`, which are different folders.

### Tests
| Tree B file | Lands at | Action |
|---|---|---|
| `tests/unit/*.test.js`: registry, switcher, extend-registry, static-rules, glyphs, geometry, scoring, glyph-scoring, game, parent-hold, ink, tool-mapping, shapes, shape-scoring, shape-game, tools-switch, shapes-static, g-carry-over, plus any other `*.test.js` there | `tests/unit/` (same names) | copy. Only `tools-switch.test.js` changes (§5.2). |
| `tests/unit/fake-dom.js`, `tests/unit/expected-letters.js` (helpers) | `tests/unit/` (same names) | copy verbatim. They do not collide with Tree A's `tests/unit/helpers/files.js`. |
| `tests/adversarial/*`: tool-dom, full-set, dot-tap, reducers, shell-static, shapes-pure, tools-integration, `freeze.js`, plus any other file there | `tests/adversarial/` (same names) | copy. The **tester** changes `tools-integration.test.js` and `shell-static.test.js` (§5.2). |

Collision rule: none of the known Tree B test names equals a Tree A name. Tree A has unit `timer, screen, ring, colours, page, hard-rules, enhancements, wheel`, `helpers/files.js`, and adversarial `timer-adversarial`. If step 0 finds that any file exists in both trees, copy Tree B's file as `letters-<name>` with its contents unchanged, and report it.

**`static-rules.test.js` (B) vs `hard-rules.test.js` (A): keep both, unmerged.** They scan the same deployable set with different needles, so keeping both enforces the union of both repos' rules automatically, with zero edits. The same goes for `shell-static` (B) and the AC23-AC25 tests in `timer-adversarial` (A).

## 2. Page structure

### 2.1 `index.html` (complete target; the timer's inner markup is byte-for-byte today's)
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Play</title>
<link rel="stylesheet" href="./styles.css?v=3">
</head>
<body>
<div class="space" aria-hidden="true"> ...unchanged: planet-big (rings, body, orbit, moon), planet-small... </div>
<nav id="switcher" aria-label="Tools"></nav>
<main id="tool-area" data-tool="timer">
  <div class="app" id="timer-tool">
    <section class="display"> ...unchanged... </section>
    <section class="controls"> ...unchanged... </section>
  </div>
</main>
<script type="module" src="./src/ui.js"></script>
</body>
</html>
```
- The old `<main class="app">` becomes `<div class="app" id="timer-tool">`, because there is now one `<main>`, `#tool-area`. All inner ids, classes, attributes and texts stay exactly the same: `02:00`, `Done hidden`, 4 preset buttons, 2 wheels, `#colours`, 4 action buttons, the `stroke-dasharray`, and no `xmlns`.
- The switcher tabs are **built by JS**, not written in HTML. This keeps the HTML at exactly 8 `<button>`/`<input>` tags (`timer-adversarial` AC17) and 2 `class="wheel"` (CW5).
- `data-tool="timer"` in the markup makes the first paint correct before JS runs.
- Exactly 1 `<script>` and 1 `<link>`. No `style=`, no `onclick=`, no `<a>`/`<select>`/`<textarea>`/`<input>`. The script `src` keeps its `./` prefix (Tree A AC25). Bump `?v=2` to `?v=3` so GitHub Pages visitors fetch the new CSS. No test pins it.
- **Title: `Play`.** It is neutral, names no project, and is already pinned by Tree B (`static-rules` AC9 and `shell-static` AC9). No Tree A test pins the title.

### 2.2 Shared space background
`.space` (fixed, `z-index:-1`) and `body::before` (stars) sit on `body`, so they show behind every tool with no change. The switcher bar and the tool area must not paint an opaque full-page background. Only the bar itself, the pad and the controls have backgrounds.

### 2.3 `styles.css`
**Keep all 436 lines of Tree A unchanged, with exactly two edits:**
1. Add these lines to the existing `:root` block, after `--control-text` (each is a 6-digit hex, except the height):
   ```css
   --switcher-height: 64px;
   --switch-active-bg: #0072B2;
   --switch-active-text: #FFFFFF;
   --reward-text: #7BD88F;
   --hold-fill: #2E7D32;
   ```
2. In `.app`, change `min-height: 100dvh;` to `min-height: calc(100dvh - var(--switcher-height));`, so the timer still fits without scrolling under the bar.

**Then append this block at the end of the file** (Tree B's rules, scoped and re-coloured):
```css
/* Tool switcher bar: one tab per tool, built by src/ui.js. */
#switcher {
  display: flex;
  justify-content: center;
  gap: 8px;
  height: var(--switcher-height);
  box-sizing: border-box;
  padding: 8px;
  background: var(--control-bg);
  border-bottom: 1px solid var(--control-border);
}

#switcher button[aria-pressed="true"] {
  background: var(--switch-active-bg);
  color: var(--switch-active-text);
  border-color: var(--done-text);
}

/* Letters and Shapes area. Scoped so it never touches the timer's own rules. */
#tool-area:not([data-tool="timer"]) {
  box-sizing: border-box;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
  min-height: calc(100dvh - var(--switcher-height));
}

#tool-area:not([data-tool="timer"]) * {
  box-sizing: border-box;
}

#tool-area:not([data-tool="timer"]) .actions {
  gap: 12px;
}

#tool-area:not([data-tool="timer"]) button:disabled {
  opacity: 0.4;
}

#tool-area:not([data-tool="timer"]) button, #switcher button {
  min-width: 48px;
  min-height: 48px;
  padding: 0 16px;
}

.letter-label { font-size: 1.5rem; font-weight: bold; color: var(--time-text); }
.pad { width: min(92vw, 420px); aspect-ratio: 1 / 1; border: 3px solid var(--control-border); border-radius: 12px; background: var(--control-bg); touch-action: none; display: block; }
.reward { min-height: 56px; display: flex; align-items: center; gap: 8px; font-size: 1.6rem; font-weight: bold; color: var(--reward-text); }
.reward canvas { width: 48px; height: 48px; }
.parent { position: relative; align-self: flex-end; overflow: hidden; min-width: 120px; min-height: 48px; font-size: 0.9rem; background: var(--control-bg); border: 2px dashed var(--control-border); color: var(--control-text); user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; }
.parent-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--hold-fill); pointer-events: none; }
.parent-text { position: relative; }
```
**Tree B rules that are deliberately dropped:**

| Tree B rule | Why it is dropped |
|---|---|
| `* { box-sizing }` | It would change the timer's `.wheel-band` height, so it is scoped instead (above) |
| `html, body { ... background: #fffdf7 ... }` | Light page. Tree A's `html, body` and `body` rules stay. A second `body` background would break `colours.test` and the dark theme. |
| bare `button { ... background: #fff ... }` | Tree A's single `button, input` rule already gives 48px, `touch-action` and dark colours. A second bare rule would override the timer's buttons. |
| bare `.actions {}` | It collides with the timer's `.actions`, so it is scoped instead |
| `.reward-star { animation: pop }`, `@keyframes pop`, and the reduced-motion block containing `transition` | D3 |

**Rules the engineer must keep true (they are pinned by tests):**
- Exactly **one** rule whose selector list contains both `button` and `input`: Tree A's (page AC17). The new rule ends with `#switcher button {` and has `min-width: 48px; min-height: 48px;` in that order, so Tree B's `shell-static` regex `/button\s*\{[^}]*min-width:\s*48px[^}]*min-height:\s*48px/` matches it. Tree A's tests still find only one `button, input` rule.
- `.pad { ... touch-action: none` (`shell-static`).
- No `px` `width`/`height`/`max-width`/`max-height` below 48 in any rule whose selector, or whose preceding comment, contains `button`, `input` or `preset`. `timer-adversarial` AC17 reads the raw text between `}` and `{`, comments included. Write `width: 0` without `px`, and keep the word "button" out of comments.
- The word `transition` appears nowhere in the file, comments included. Add no new `animation:` names. No `url(` and no `@import`.
- Do not declare `--page-bg`, `--ring-running` or any other existing custom property a second time (the tests read the first match). Do not add any selector that ends in `.done {`, `.ring-arc {` or `body {` before Tree A's rules.
- Letters and Shapes CSS must not use `var(--ring-running)`, because the timer's colour picker rewrites that variable globally.

### 2.4 `src/ui.js` (shell; Tree B's file with one change)
In `refresh()`, after the `aria-pressed` loop, add:
```js
toolArea.dataset.tool = state.activeId ?? ''
```
Everything else stays as in Tree B. That covers `import './tools/index.js'`, one `<button>` per `listTools()` entry with `textContent = label`, `aria-pressed`, `trySwitch` with the `err.state` fallback, and `trySwitch(listTools()[0].id)` at the end, which mounts the Timer.

### 2.5 Letters and Shapes readable on dark (canvas colours)
The canvas cannot read CSS variables, so the two views get named, exported constants. These are the only source edits in `src/tools/letters/`:
- `views/guide.js`: add `export const GUIDE_COLOUR = 'rgba(255,255,255,0.28)'` and use it as `ctx.strokeStyle = GUIDE_COLOUR`. The old value was `'rgba(0,0,0,0.18)'`.
- `views/ink.js`: add `export const INK_COLOUR = '#FDD835'` and use it for both `strokeStyle` and `fillStyle`. The old value was `'#2b5fd9'`.
- The canvas has a transparent clear, so its background is the CSS `.pad` background, `var(--control-bg)` `#1A2342`.
- Target ratios, checked by a new test: ink vs `--control-bg` is about 11:1 (≥ 4.5). The guide, blended at 0.28 over `--control-bg`, gives about `#5A6177`, which is about 2.5:1 vs the background. That is "faint" (≥ 1.5 and < 3), and the ink stands out over it at about 4.4:1 (≥ 3).
- Unchanged: the reward star (`#f5b800`), the texts, the line widths, `createTraceTool`, and all DOM structure.

## 3. The timer as a tool

### 3.1 `src/tools/index.js`
```js
import { registerTool } from '../registry.js'
import { timerTool } from './timer/tool.js'
import { lettersTool } from './letters/tool.js'
import { shapesTool } from './shapes/tool.js'

registerTool(timerTool)
registerTool(lettersTool)
registerTool(shapesTool)
```

### 3.2 `src/tools/timer/tool.js` (new: Tree A's `src/ui.js` turned into a tool)
Imports: the same names as today, with paths adjusted to `../../` (`../../timer.js`, `../../screen.js`, `../../views/ring.js`, `../../colours.js`, `../../sound.js`, `../../wheel.js`). `pause` is already among them. Keep Tree A's code style, including semicolons.

```js
export const TIMER_ROOT_ID = 'timer-tool';
export const timerTool = { id: 'timer', label: 'Timer', mount(host), unmount(), getState() };
// mount/unmount/getState must not use `this` (the registry stores a frozen copy of id/label/mount/unmount only).
// getState() returns the current timer object (test seam; tests never mutate it).
```

**Module-level state (persists across mounts):** `timer` (starts as `createTimer(DEFAULT_DURATION_SECONDS)`), `frameId = null`, `ringColour = DEFAULT_RING_COLOUR`.
- Adopted DOM refs: `root = null`, plus `let` bindings with today's names (`timeEl, doneEl, ringEl, arcEl, presetsEl, customEl, startEl, pauseEl, resumeEl, resetEl, rocketEl, coloursEl, presetButtons, wheels`).
- Per-mount values: `mountedHost = null`, `controller = null`.
- **No top-level use of `document`, `window`, `requestAnimationFrame` or `Date`**, so the file imports cleanly in Node and under Tree B's fake DOM. `const $ = (id) => document.getElementById(id);` and `const motion = (query) => window.matchMedia(query);` stay as arrow functions; they run only when called.

**Code that moves unchanged from `src/ui.js`:** `highlight`, `setWheel`, `onWheelScroll`, `checkWheel`, `settleWheel`, `onWheelKey`, `syncWheelsToTimer`, `render`, `setTimer`, `onFrame`, `ensureFrameLoop`, `apply`, `applyCustom`, `renderColours`, and `WHEEL_STILL_FRAMES`. Their bodies stay identical.

**Split today's builders so that DOM is built once and listeners are added per mount:**
- `adopt()` runs on the first mount only:
  - `root = $(TIMER_ROOT_ID)`. If it is null, `throw new Error('timer markup #timer-tool not found')`.
  - Assign every ref with `$()` exactly as today.
  - `buildSwatches()`: as today, but **without** `addEventListener`.
  - `wheels = { min: makeWheel('wheel-min','list-min',WHEEL_MINUTES_MAX), sec: makeWheel('wheel-sec','list-sec',WHEEL_SECONDS_MAX) }`. `makeWheel` builds the `li` items and returns `{el, list, max, value:0, frame:null, lastTop:0, still:0}`, **without** listeners.
- `wire(signal)` runs on every mount. Every call passes `{ signal }`:
  - each swatch `click` → `ringColour = b.dataset.colour; renderColours();`
  - each wheel `li` `click` → `setWheel(w, Number(li.dataset.index), true); applyCustom();`
  - wheel `scroll` → `onWheelScroll(w)`, and wheel `keydown` → `onWheelKey(w, e)`
  - presets, Start (`unlockSound();` first), Pause, Resume (`unlockSound();` first) and Reset: today's handler bodies, unchanged
  - `document.addEventListener('visibilitychange', () => { if (!document.hidden) { setTimer(tick(timer, Date.now())); render(); ensureFrameLoop(); } }, { signal });` This is today's behaviour, and it is live only while mounted.

**`mount(host)`**, in this order:
1. `if (mountedHost !== null) return;`
2. `if (root === null) adopt();`
3. `host.replaceChildren(root); mountedHost = host;`
4. `controller = new AbortController(); wire(controller.signal);`
5. `renderColours(); render(); syncWheelsToTimer(); ensureFrameLoop();`

There is no tick and no catch-up: the timer is never running while unmounted, so `ensureFrameLoop()` starts nothing. The timer stays paused until the user taps Resume. **There is no auto-resume.**

**`unmount()`**, in this order:
1. `if (mountedHost === null) return;`
2. `if (timer.status === 'running') setTimer(pause(timer, Date.now()));` This is the exact remaining time, applied once. It goes through `setTimer`, so if the end had already passed, `pause` returns `finished` and the chime plays once (D6). A paused, idle or finished timer is left exactly as it is.
3. `controller.abort(); controller = null;` This removes every element listener and the `visibilitychange` listener.
4. `if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }`
5. For both wheels: `if (w.frame !== null) cancelAnimationFrame(w.frame); w.frame = null; w.still = 0;` A scroll in progress is discarded. On the next mount, `syncWheelsToTimer()` shows the timer's duration again.
6. `mountedHost.replaceChildren(); mountedHost = null;` The `root` node stays referenced and is reused on the next mount.

**Text that must stay in `tool.js` (the retargeted tests read it):**
- `durationLocked`, `.disabled`, `b.disabled = s.durationLocked`
- `requestAnimationFrame(`, with `requestAnimationFrame(onFrame)` exactly **2** times (in `onFrame` and `ensureFrameLoop`)
- `Date.now()`, `tick(`, `visibilitychange` followed later by `tick(timer, Date.now())`
- `frameId === null && timer.status === 'running'`
- `scrollBehaviour(motion)`, `customEl.hidden = !s.controls.custom`, `setProperty('--ring-running'`, `justFinished(prev, next)`, `unlockSound();`, `rocketEl.toggleAttribute('hidden'`
- **None** of: `setInterval`, `setTimeout`, `fetch(`, `localStorage`, `http://`, `https://`, `import(`

### 3.3 DECISION: switching away from the Timer (owner's explicit choice: pause on switch)
- **Running → paused.** On unmount, `pause(timer, Date.now())` is applied once. The remaining time is preserved to the millisecond, and time spent on other tools costs nothing.
- **Paused, idle and finished timers are left unchanged.** The duration, remaining time, colour choice and finished state stay in memory while another tool is shown. **Nothing is stored** (hard rule).
- While another tool is shown, the Timer has no live listener, no frame and no pending timeout. Nothing can finish off screen, so there is no off-screen chime.
- **On return** the timer shows exactly the state it was left in:
  - **Paused:** the time text, the ring at its fraction, and the **Resume** and **Reset** buttons (the paused row of the controls table). In the final 10 s the rocket is shown still (`'ready'`). The user taps Resume, which also calls `unlockSound()`.
  - **Idle:** the chosen duration on the wheels.
  - **Finished:** Done/00:00 and Reset. The rocket-launch and blast CSS animations replay once on return, because the node is reinserted. This applies only to a timer that had finished before the user left, or at the moment of leaving (D6).
- **The chime** still plays exactly once when the timer finishes while the Timer tool is mounted (unchanged `setTimer`/`justFinished`).
- **How this fits Tree B's fresh-on-mount rule:** the rule is a property of `createTraceTool` instances. The registry and `performSwitch` only call `unmount` and then `mount`. Letters and Shapes keep fresh-on-mount. The Timer is the documented exception: it keeps its (paused) state and adopts the same DOM. Tests T5-T11 prove both rules in the same run.

## 4. Hard rules for everything now in Tree A
Both repos' rules apply together. No rule is relaxed, except the D3 CSS removal.
- Static files only, served by GitHub Pages as written: no build, no `node_modules`, no build configs (Tree A AC25).
- Deployable set = `index.html`, `styles.css`, `src/**`. File types are only `.html`, `.css` and `.js`.
- No network: none of the needles below anywhere in the deployable set.
- No storage, no cookies, no analytics. The paused timer lives in memory only.
- No dependencies. `package.json` stays exact. Its `scripts` contains only `test`.
- Module imports in `src/**` are relative and end in `.js`, including the `index.html` script `src`. No dynamic `import(`.
- All targets are at least 48 CSS px. There is one `button, input` rule, and the switcher and tool buttons get 48px minimums too.
- No project or owner name (`/ramona|alice/i` in `index.html`, `src/**` and `styles.css`). The title is `Play`.
- No `<img|iframe|object|embed|video|audio|source>`, no `xmlns`, no `eval(`/`new Function`/`importScripts`/`serviceWorker`, no `navigator.` (`timer-adversarial` AC23).
- **No timers.** No `setTimeout` or `setInterval` anywhere in `src/`. The amendment removes the only planned use. New test S5 checks this, in addition to Tree A's pin on the timer wiring file.

**Union of forbidden needles:**
- Tree A `hard-rules`: `http:`+`//`, `https:`+`//`, `src="//`, `href="//`, `url(//`, `@import`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `analytics`, `gtag`.
- Tree A `timer-adversarial` regexes: `/https?:/i`, `/\/\/[a-z0-9.-]+\.[a-z]{2,}/i` (so every `//` comment needs a space after `//`), `navigator.`, `eval(`, `new Function`, `importScripts`, `serviceWorker`, `@import`, `url(`, media and frame tags, and on the timer wiring file `setInterval|setTimeout`.
- Tree B `static-rules`/`shell-static`: `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `<script src="http`, `localStorage`, `sessionStorage`, `document.cookie`, `@import url(`, `/ramona|alice/i`.

**Cross-check result.** The tech lead read these files: Tree B `registry.js`, `switcher.js`, `ui.js`, `tools/index.js`, `letters/{tool,game,geometry,scoring,ink,parent-hold,glyphs}.js`, `letters/views/{guide,ink,hold-progress,reward}.js`, `shapes/{shapes,tool}.js`, `styles.css`; and Tree A's whole `src/`, `index.html` and `styles.css`.
- **No needle hits** in source code or comments. None of these files uses `setTimeout` or `setInterval`.
- **Hits to fix, CSS only:** `transition` and `animation: pop` (D3); the light `html, body` background; the bare `button` and `.actions` rules (§2.3).
- The engineer re-checks any Tree B file the tech lead could not see (D1).

## 5. Test plan

### 5.1 Tree A pinned tests: minimal retargets (the path only; no assertion changes)
| File | Line(s) | Now | After | Who |
|---|---|---|---|---|
| `tests/unit/page.test.js` | 8 | `readText('src/ui.js')` | `readText('src/tools/timer/tool.js')` (AC13, AC15) | engineer |
| `tests/unit/wheel.test.js` | 10 | `readText('src/ui.js')` | `readText('src/tools/timer/tool.js')` (CW9, CW11, CW12) | engineer |
| `tests/unit/enhancements.test.js` | 87, 101, 109 | `readText('src/ui.js')` | `readText('src/tools/timer/tool.js')` | engineer |
| `tests/adversarial/timer-adversarial.test.js` | 200, 206 | `read('src/ui.js')` | `read('src/tools/timer/tool.js')` (AC13, AC15) | **tester** |

Everything else in Tree A passes unchanged. That covers all timer, screen, ring and colours tests; page AC12/AC17/AC18/AC21; hard-rules AC23-AC25; enhancements, apart from the three path changes; and timer-adversarial, apart from the two.

The pins and why they still hold:
- page AC17 (one 48px rule, HTML census)
- timer-adversarial AC17 (8 buttons, no sub-48 sizes)
- AC21a (no `transition`, animation whitelist)
- AC23 (1 script, 1 link, no `xmlns`)
- AC25 (package exact)
- CW5 (2 wheels, no `<input`)
- enhancements (`--page-bg` first match, `body::before`, `planet-big` class)
- colours (the first `body`, `.ring-arc`, `.done` rules)

All are covered by §2.1-§2.3.

Until the tester's step, the engineer's run shows **exactly 3 expected failures**: `timer-adversarial` "AC13 ui.js render...", "AC15 ui.js: tab-return..." and `tools-integration` "AC1 real tool index...". Any other failure is a real problem.

### 5.2 Tree B tests: changes
| File | Change | Who |
|---|---|---|
| `tests/unit/tools-switch.test.js` | AC1: rename it to `AC1 registry lists Timer, Letters then Shapes`. Expected value `[['timer','Timer'],['letters','Letters'],['shapes','Shapes']]`, length 3. Nothing else changes. | engineer |
| `tests/adversarial/tools-integration.test.js` | AC1: length 3. Labels `['Timer','Letters','Shapes']`, ids `['timer','letters','shapes']`. Add `getTool('timer').label === 'Timer'`. The duplicate-id probe stays. | **tester** |
| `tests/adversarial/shell-static.test.js` | Line 8: `new URL('../../', import.meta.url).pathname` → `fileURLToPath(new URL('../../', import.meta.url))`, with `import { fileURLToPath } from 'node:url'` (D4) | **tester** |

No import paths change. If step 0 finds another Tree B test that asserts a 2-tool registry, the default registry contents, a bare `button {` rule, `pop`, `transition`, `#fffdf7`, `#2b5fd9`/`rgba(0,0,0` colours, `src/ui.js` text, or mounts every `listTools()` entry with Tree B's fake DOM (the timer would throw without `getElementById`): fix only the expected value, in the same minimal way. Unit tests are fixed by the engineer and adversarial tests by the tester. Every such fix goes in the report.

### 5.3 New tests (the engineer writes them first)
**Helper `tests/unit/helpers/timer-dom.js`** (not a test file; the name must not end in `.test.js`/`-test.js`). `installTimerDom()` calls Tree B's `installFakeDom()` from `../fake-dom.js` and extends it. It returns everything `installFakeDom` returns, plus:
- `document.getElementById`. It is backed by a fake tree that mirrors `index.html`: `#timer-tool` holding `time-text`, `done-text`, `ring`, `ring-arc`, `rocket`, `presets` (4 buttons with `dataset.presetSeconds` 120/180/300/600), `custom`, `wheel-min`/`list-min`, `wheel-sec`/`list-sec`, `colours`, `start-btn`, `pause-btn`, `resume-btn` and `reset-btn`.
- `document.documentElement.style.setProperty`, `document.hidden` (settable), and `document.addEventListener` honouring `{signal}`, counted in `liveListeners()`.
- `document.fire(type)`.
- FakeEl additions: `classList.toggle/contains`, `toggleAttribute`, real `setAttribute`/`getAttribute`/`hasAttribute`, `hidden`, `dataset`, `remove()`, `querySelectorAll('button')` (recursive), `scrollTop`, and `scrollTo({top})`, which sets `scrollTop` and fires no event.
- `window.matchMedia = () => ({ matches: false })`.
- `window.AudioContext`: a fake with `state` `'suspended'` that becomes `'running'` after `resume()`, `currentTime` 0, `destination`, and `createGain`/`createOscillator`. The helper counts `createOscillator().start` calls, so `chimes() = starts / 3`.
- A settable fake `Date.now` (`setClock(ms)`), plus `restore()`.
- No fake `setTimeout` is needed.

**`tests/unit/timer-tool.test.js`** uses `installTimerDom()`, the real `src/tools/index.js`, `performSwitch` and `makeHost()`:
- T1 After `import '../../src/tools/index.js'`, `listTools()` ids are `['timer','letters','shapes']` and labels are `['Timer','Letters','Shapes']`.
- T2 The first mount adopts `#timer-tool`: `host.children` is `[root]`, `time-text` is `02:00`, and `getState().status` is `'idle'`.
- T3 After unmount when idle: `liveListeners() === 0`, `pendingRaf() === 0`, and `host.children.length === 0`. Remount reuses the **same** root node (`===`). The state is unchanged (`===` the same object).
- T4 **Switching away while running pauses, with the exact remaining time.**
  - Click Start at clock 0, then flush one frame at 30 000. Switch to letters at clock 42 500.
  - `getState()` is `{status:'paused', remainingMs: 77500, lastNowMs: null}`, and the timer's own listeners and frames are 0.
  - Set the clock to 3 600 000 and switch back. `remainingMs` is still 77500 and the status is `'paused'`, with **no auto-resume**: `pendingRaf() === 0` and the status is still paused after a `flushRaf()`.
  - `resume-btn.hidden === false`, `reset-btn.hidden === false`, `pause-btn.hidden === true`, `start-btn.hidden === true`, and `time-text` is `01:18`.
  - Click Resume at clock 3 600 000, then flush at 3 601 000: running, with `remainingMs === 76500`.
- T5 **Switching away while paused, idle or finished leaves the state unchanged.**
  - For each status, the state object before unmount `===` the one after unmount, and after remount.
  - Finished: on return `done-text` is not hidden and `time-text` is `00:00`.
  - Idle after choosing preset 300: the wheels show 5/0 on return, and the colour choice is kept (`--ring-running` is the last value set, and the swatch is `aria-pressed`).
- T6 **Chime once while mounted** (unchanged behaviour): Start, then flush frames past 120 000. `chimes() === 1`. More frames, a `visibilitychange`, and a switch away and back: still 1.
- T7 **Switch exactly at the finish time:** running, clock set to exactly 120 000 with no frame flushed, then switch away. The state is `'finished'` and `chimes() === 1` (D6). On return: Done and 00:00, and `chimes()` stays 1.
- T8 **Mid-wheel-scroll switch:** fire `scroll` on `wheel-min`, so a wheel frame is pending, then switch to letters. The timer's frames are 0 (`pendingRaf()` counts only Letters' frames). Back on the timer, `wheel-min` `aria-valuenow` is `'2'`, and the abandoned value was not applied (`durationMs === 120000`).
- T9 **Rapid switching 1000×** cycling timer → letters → shapes, with the timer started first:
  - the first switch away pauses it, and the `remainingMs` captured then is identical after all 1000 switches
  - status `'paused'`, no auto-resume, and `chimes() === 0`
  - listeners return to the active tool's set, and `pendingRaf() <= 1`
  - after a final unmount, everything is 0
- T10 **visibilitychange while on another tool:** `document.hidden = true/false` plus `document.fire('visibilitychange')` while Letters is shown. There is no throw, no timer frame, and the state is unchanged.
- T11 **Fresh vs persistent together:** start the timer, switch to letters, dirty the pad and parent hold, then switch to timer and back to letters. `lettersTool.getState()` deepEquals `createLetterGame()`, while the timer is still paused with the same `remainingMs`. Do the same with shapes (`circle`).
- T12 **Pointer isolation:** after switching to letters, firing `click` on the old `resume-btn` or a preset changes nothing (listeners aborted). After switching to the timer, firing on the old pad changes nothing.

**`tests/unit/merge-shell.test.js`** (static and text; no DOM):
- S1 `index.html`: exactly one `<nav id="switcher"`, one `<main`, `id="tool-area"` with `data-tool="timer"`, and `id="timer-tool"` inside `<main ...>...</main>`. `.space` comes before the nav. The `<title>` is exactly `Play`. The script `src` is `./src/ui.js`.
- S2 Every id that `tool.js` looks up with `$('...')`, `makeWheel('...','...')` or `TIMER_ROOT_ID` occurs exactly once as `id="..."` in `index.html`.
- S3 `styles.css`, after stripping comments:
  - No rule has a selector exactly `button`, `*` or `.actions`, apart from Tree A's `#presets, #custom, .actions`.
  - There is exactly one `html, body` rule and one `body` rule.
  - Every selector containing `.actions`, `*` or a `button`, other than Tree A's `button, input` and `.swatch` rules, starts with `#tool-area:not([data-tool="timer"])` or `#switcher`.
  - The text contains `#switcher` and `--switcher-height`.
- S4 Contrast, using the WCAG formula with values from `:root`:
  - `--switch-active-text` vs `--switch-active-bg` ≥ 4.5
  - `--reward-text` vs `--page-bg` and vs `--control-bg` ≥ 4.5
  - `--control-text` vs `--hold-fill` ≥ 4.5
  - `INK_COLOUR` vs `--control-bg` ≥ 4.5
  - `GUIDE_COLOUR` (alpha-blended over `--control-bg`) vs `--control-bg` from 1.5 up to, but not including, 3
  - `INK_COLOUR` vs the blended guide ≥ 3
- S5 No file under `src/` contains `setTimeout` or `setInterval`, and `src/tools/timer/finish-alarm.js` does not exist.
- S6 `src/ui.js` contains `dataset.tool` and `listTools()[0]`. `src/tools/index.js` registers `timerTool`, `lettersTool` and `shapesTool` in that textual order. `src/tools/timer/tool.js` contains `pause(timer, Date.now())`.
- S7 Importing `src/tools/index.js` with **no** fake DOM installed does not throw: no top-level DOM in any tool.

**Tester (afterwards, `tests/adversarial/merge-adversarial.test.js`):** probes §7 independently, plus the 3 retargets in §5.1/§5.2. The tester writes the report to `docs/letters-shapes/merge-test-report.md` if the orchestrator allows it. Otherwise it goes to `docs/test-report.md`, which overwrites Tree A's increment-1 report: the owner decides.

### 5.4 Expected counts
- Before merge: 92 (A) + 232 (B) = 324.
- After the engineer: about 324 + 12 (T) + 7 (S) ≈ **343**, all passing except the 3 expected failures in §5.1.
- After the tester's retargets: all passing, plus the tester's new adversarial tests (≈ 355 in total).
- The full run takes about 100-110 s. Report the real number.

## 6. Rollout notes for the owner
- The work is delivered as **uncommitted working-tree changes** on your `main` snapshot. Create a branch and commit it yourself. The engineer and tester do not commit or push.
- **New:**
  - `src/registry.js`, `src/switcher.js`, `src/tools/index.js`, `src/tools/timer/tool.js`
  - `src/tools/letters/**`, `src/tools/shapes/**`
  - all Tree B `tests/unit/*` and `tests/adversarial/*` files
  - `tests/unit/helpers/timer-dom.js`, `tests/unit/timer-tool.test.js`, `tests/unit/merge-shell.test.js`
  - the tester's `tests/adversarial/merge-adversarial.test.js` and report
- **Changed:**
  - `index.html`: switcher, tool area, title `Play`, `?v=3`
  - `styles.css`: 5 `:root` variables, `.app` min-height, the appended block
  - `src/ui.js`: now Tree B's shell, plus `dataset.tool`. The old timer wiring lives on in `src/tools/timer/tool.js`.
  - `tests/unit/page.test.js`, `wheel.test.js`, `enhancements.test.js`, `tests/adversarial/timer-adversarial.test.js`: path only
  - `tests/unit/tools-switch.test.js`, `tests/adversarial/tools-integration.test.js`: 3 tools
  - `tests/adversarial/shell-static.test.js`: path helper
  - `src/tools/letters/views/guide.js`, `views/ink.js`: colours
- **Deleted:** none.
- **Unchanged:** `package.json` (name stays `timer`, which the test pins), `.github/workflows/test.yml` (still Node 20 and `npm test`), `src/timer.js`, `screen.js`, `wheel.js`, `sound.js`, `colours.js`, `views/ring.js`, `web-rules.md`.
- `web-rules.md` still describes the timer-only layout. Update it yourself later if you want it to say `src/tools/<id>/`. It does not block anything.
- After deploying, phones may cache the old modules. Do one hard refresh on the phone.

## 7. Edge cases the tester will probe
- **Switch exactly at finish time,** and within a frame after it: the state becomes finished, the chime plays exactly once (during unmount), and the return shows Done. Leaving 1 ms before the end gives paused with 1 ms left: 00:01, then Resume finishes it almost at once with one chime.
- **Switch mid-wheel-scroll** (smooth or momentum scroll, then tap Letters): no frame survives, the wheels show the timer's duration on return, and the abandoned value is not applied.
- **Rapid switching while running** (1000× across all three tools): it pauses on the first switch away, and the remaining time is identical afterwards. There is no auto-resume, no chime, bounded listeners and frames, and no timeout of any kind.
- **Switch while paused, idle, finished, or paused in the final 10 s:** the state is unchanged. A paused timer in the final 10 s shows the rocket still (`ready`), not shaking. A finished timer's launch animation replays on return, which is expected.
- **Return with Resume:** Resume continues from the exact remaining time. Time spent away is never counted, even after a huge forward or backward clock jump while away.
- **Switch mid-letter-stroke and mid parent-hold,** in both directions with the timer: no leftovers, late events on old nodes are inert, and Letters and Shapes are fresh.
- **`visibilitychange` while on another tool:** no timer listener and no effect. Hiding and showing on the Timer itself behaves as before.
- **Sound unlock after switching:** Start, switch away, back, then Resume. Resume unlocks sound again, and a later finish chimes once.
- **Pointer and touch isolation:** the pad's `touch-action: none` applies only on Letters and Shapes. The wheels' `pan-y` and the buttons' `manipulation` are unchanged. No window `resize` listener of Letters survives a switch to the Timer, and the timer adds no window listeners.
- **Resize and orientation** on each tool: the timer layout fits under the bar in portrait and landscape without scrolling (manual). The Letters ink stays in place.
- **Mount failure:** if `#timer-tool` is missing, the switcher catches the error and the other tools still work.

**Manual (phone):**
- 3 tabs (Timer active), each at least 48×48, with the active tab clearly marked and no project name
- the title reads "Play"
- no reload or white flash when switching
- stars and planets behind all tools
- the Letters/Shapes guide is faint but visible on dark, the ink is clearly visible, and the "Parent: got it" fill and the reward text are readable
- start a timer, switch to Letters for 20 s and back: the time has not moved, and Resume and Reset show; tap Resume and it continues
- a timer left to finish on the Timer tab chimes once
- the timer is unchanged in feel: wheels, colours, rocket, chime
- airplane mode: all three tools work

## 8. Model suggestion for the engineer
**sonnet** (the owner approved). About 30 files move or change. The heart of the work is a careful DOM refactor: build once, wire per mount, pause on unmount. Seventeen text pins have to survive it, along with regex-pinned CSS whose comments count. The work also needs a new fake-DOM helper that extends Tree B's, and a sweep of test files the tech lead could not list (D1). The amendment makes the timer part simpler, but the cross-file consistency risk is unchanged. (The engineer agent file defaults to haiku, so pass sonnet explicitly.)

## Engineer checklist (order)
0. Run `node --version` (must be 20 or newer) and `node --test` on Tree A as it is (expect 92 passing). List `alice/src/tools/**`, `alice/tests/unit` and `alice/tests/adversarial`. Grep Tree B's `tests/` for: `'Letters'.*'Shapes'`, `length, 2`, `src/ui.js`, `styles.css`, `pop`, `transition`, `#fffdf7`, `2b5fd9`, `rgba(0,0,0`, `listTools()`, `.pathname`, `groupBy`, `union(`. Grep Tree B `src/` for every needle in §4, including `setTimeout` and `setInterval`. Report the findings before copying.
1. Copy the files (§1).
2. Write the new tests (§5.3) and the unit retargets (§5.1, §5.2).
3. Write `tools/timer/tool.js`. Then edit `tools/index.js`, `ui.js`, `index.html` and `styles.css`, and the two views.
4. Run `node --test`. Show the real counts. The 3 expected failures are listed in §5.1.

## Definition of done
- `node --test` passes everything after the tester's 3 listed retargets. Tree A's 92 and Tree B's 232 tests still pass, with only the path and count retargets listed here.
- The hard rules in §4 all hold, including no `setTimeout`/`setInterval` in `src/`.
- No storage, network or dependency is added, and `package.json` is unchanged.
- The pause-on-switch decision in §3.3 is implemented and proven by T4-T11.
- Uncommitted changes only.

## Assumptions the owner can overturn
1. **Pause on switch was the owner's explicit choice** (amendment 1). A running timer is paused once on switch-away. It never auto-resumes: the user taps Resume. Paused, idle and finished timers are untouched. Nothing is stored.
2. **No off-screen timing.** There is no timeout, no off-screen chime and no catch-up. The chime plays only while the Timer is mounted, or once at the moment of leaving if the end had just passed (D6).
3. **Title `Play`.**
4. **Drop the invisible `pop` animation and the dead `transition` rule** instead of widening the Tree A whitelist.
5. **Colours:** ink `#FDD835`, guide white at 28%, active tab `#0072B2`, reward `#7BD88F`, hold fill `#2E7D32`.
6. **Return to a finished timer** (one that finished before the user left, or exactly at the moment of leaving): it shows Done, 00:00 and Reset, and the rocket-launch and blast animations replay once. Return to a paused timer shows the time, the ring, Resume and Reset, and a still rocket in the final 10 s.
7. **Order Timer, Letters, Shapes,** with Timer as the default tool on load.
8. **`package.json` name stays `timer`.**
