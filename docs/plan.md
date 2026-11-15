# Plan for increment 1: Core countdown timer with shrinking ring

## Decisions for you to confirm
- **Initial duration on page load: 120 s (the first preset).** No requirement fixes this; any value passes every AC. 120 s means the page is usable with one tap on Start. Change `DEFAULT_DURATION_SECONDS` in `src/timer.js` if you prefer another value.
- **Custom entry fields start filled with "0" and "0".** AC11 rejects non-numeric input, and an empty field counts as non-numeric. Prefilling the fields means the parent only has to type the part that matters.
- **Colours (checked, all pass):**

| Name (CSS custom property) | Value | Used for | Check |
|---|---|---|---|
| `--page-bg` | `#FFFFFF` | page background | reference |
| `--ring-running` | `#0072B2` | progress arc (this is "the running colour" for AC21a) | about 5.2:1 vs white (not required) |
| `--ring-track` | `#DDDDDD` | ring track while idle, running or paused | neutral, not checked |
| `--ring-finished` | `#D55E00` | ring track when finished ("the finished colour") | about 3.87:1 vs white, passes AC21a (needs 3:1) |
| `--done-text` | `#222222` | "Done" text | about 15.9:1 vs white, passes AC21b (needs 4.5:1) |
| `--time-text` | `#222222` | mm:ss text | not checked by an AC |

The finished colour is different from both `--ring-running` and `--ring-track`. Blue running and vermillion finished is a colour-blind-safe pair (Okabe-Ito palette).

## Prerequisites
- **Runtime:** Node.js 18 or newer, using the built-in `node:test`, `node:assert/strict`, `node:fs`, `node:path` and `node:url`. No npm install. The engineer runs `node --version` to confirm.
- **Test command:** `node --test`, run from the repo root. With no arguments, Node finds every `*.test.js` file under `tests/`.
- **package.json** at the repo root, exactly:
  ```json
  { "name": "timer", "private": true, "type": "module", "scripts": { "test": "node --test" } }
  ```
  It has no `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies`, and no other scripts.
- **Manual checks on the phone (B1 decision):** the page is served over plain http from the laptop on home Wi-Fi. No build step is involved; the files are served exactly as written.
  1. In a terminal at the repo root, run `python -m http.server 8000` (Python 3; any other one-line static file server is fine too).
  2. Allow it through the Windows firewall for private networks if Windows asks.
  3. Find the laptop's LAN IPv4 address with `ipconfig`.
  4. On the phone (same Wi-Fi), open the laptop address with port 8000 in the browser.
  - Do not open `index.html` by double-clicking it. Browsers block ES modules on `file:` URLs.
- **Banned-word list (B2 decision):** the banned-word list is supplied verbatim to the engineer in the engineer's prompt; do not invent words. It lives only in `tests/unit/no-child-details.test.js`. That file is excluded from its own scan.
  - The list covers these categories: a family-relation word, the child's given name (allowed only inside the project's own name, in both its title form and its hyphenated folder form, as the supplied rule states), patterns for numeric ages, celebration-date words, and words for places of early learning.
  - This plan deliberately writes none of those words.
- **File to delete:** `src/.gitkeep`, once `src/timer.js` exists. Keep `tests/.gitkeep` or delete it; either is fine. The tests ignore dotfiles anyway.

## Approach
All decisions live in `src/timer.js`. It holds a plain immutable timer object, and every function that depends on time takes `now` in milliseconds, so tests use a fake clock and never wait. Remaining time only drops by the positive difference between consecutive `now` values. A clock that jumps backwards costs zero time, and the display rounds remaining seconds up, so a running timer never shows 00:00 early. `src/screen.js` turns a timer into everything the page shows: text, Done, fraction, ring tone and visible controls. `src/views/ring.js` turns progress (0..1) into SVG dash values and nothing else. `src/ui.js` is the only file that touches `document`, `Date.now` and `requestAnimationFrame`. On every frame and every tap it does three things: applies a pure function, calls `getScreen`, and copies the result into the DOM.

```
 tap / frame / visibilitychange
            |
            v
   src/ui.js  (thin DOM; Date.now(); requestAnimationFrame)
            |  timer = start|pause|resume|reset|setDuration|tick(timer, now)
            v
   src/timer.js  (pure)  --->  src/screen.js getScreen(timer)  (pure)
                                     |  fraction
                                     v
                              src/views/ring.js getRingArc(fraction)  (pure)
            |
            v
   ui.js writes: #time-text, #done-text hidden, #ring-arc dasharray,
                 .ring.is-finished class, control hidden/disabled
```

State machine (anything not drawn is ignored and returns the same object):
```
            setDuration (idle only)
              +----+
              v    |
 [idle] --start (duration>0)--> [running] --pause--> [paused]
   ^                               |  ^                  |
   |                               |  +-----resume-------+
   |                     tick: remaining hits 0
   |                               v
   +---------reset (from any)--- [finished]
```

## Files
| File | New/change | Responsibility |
|---|---|---|
| `package.json` | New | `"type": "module"`; the only script is `"test": "node --test"`; no dependencies |
| `index.html` | New | Markup: viewport meta, `styles.css` link, inline SVG ring (no `xmlns` attribute), time text, Done text, four preset buttons, custom entry, Start/Pause/Resume/Reset buttons, `<script type="module" src="./src/ui.js">` |
| `styles.css` | New | `:root` colour custom properties; one 48px minimum rule for `button, input`; ring strokes; phone-first portrait and landscape layout; `[hidden]` rule |
| `src/timer.js` | New | Pure timer logic, presets, formatting, custom parsing |
| `src/screen.js` | New | Pure: timer to display model |
| `src/views/ring.js` | New | Pure: progress to arc drawing values |
| `src/ui.js` | New | Thin DOM wiring, frame loop, event handlers |
| `tests/unit/helpers/files.js` | New | Test helper: repo root path, read file, recursive file walker. Not a test file. |
| `tests/unit/timer.test.js` | New | AC1-AC12 (logic) |
| `tests/unit/screen.test.js` | New | AC13, AC15, AC18, AC21 (logic) |
| `tests/unit/ring.test.js` | New | AC16, AC21 (arc) |
| `tests/unit/page.test.js` | New | AC12, AC13, AC15, AC17, AC18, AC21 (static markup, CSS, ui.js) |
| `tests/unit/colours.test.js` | New | AC21, AC21a, AC21b |
| `tests/unit/hard-rules.test.js` | New | AC23, AC24, AC25 |
| `tests/unit/no-child-details.test.js` | New | AC26; holds the supplied banned-word list |
| `src/.gitkeep` | Delete | Placeholder no longer needed |

Use no other files.

## Interfaces (function signatures the engineer must match)

### Shared definitions
- **Deployable set** = `index.html`, `styles.css`, and every file under `src/`, recursively, skipping names that start with `.`. AC23, AC24 and AC25 scan only this set. They never scan `docs/`, `tests/` or root `.md` files, because the tests themselves contain the strings being searched for.
- **Time unit:** `now` is always milliseconds (a `Date.now()` value). Durations passed in are whole seconds. Internally everything is stored in milliseconds.
- **Immutability:** no function mutates its argument. An "ignored" call returns the **same object** it was given (`===`).

### `src/timer.js`
```js
export const MAX_DURATION_SECONDS = 5999;
export const PRESET_SECONDS = Object.freeze([120, 180, 300, 600]);
export const DEFAULT_DURATION_SECONDS = 120;

// Timer shape (plain object):
// { status: 'idle'|'running'|'paused'|'finished',
//   durationMs: number,   // last chosen duration
//   remainingMs: number,  // exact, 0..durationMs
//   lastNowMs: number|null } // last clock reading while running, else null

export function createTimer(durationSeconds)
// Requires Number.isInteger(durationSeconds) && 0 <= durationSeconds <= 5999.
// Otherwise throws RangeError.
// Returns { status:'idle', durationMs: s*1000, remainingMs: s*1000, lastNowMs: null }.
// 0 is allowed so that AC8 can be tested.

export function setDuration(timer, durationSeconds)
// Applies only when timer.status === 'idle' and durationSeconds is an integer 1..5999.
// Returns a new idle timer with that duration and full remaining time.
// Otherwise returns the same timer (no throw).

export function start(timer, now)
// Applies only when status === 'idle' && durationMs > 0 && Number.isFinite(now).
// Returns { status:'running', durationMs, remainingMs: durationMs, lastNowMs: now }.
// Otherwise returns the same timer.

export function tick(timer, now)
// If status !== 'running' or !Number.isFinite(now): returns the same timer.
// delta = Math.max(0, now - lastNowMs)        // backwards clock costs zero time
// remainingMs = Math.max(0, remainingMs - delta)
// lastNowMs = now                              // re-anchor, even after a backwards jump
// If remainingMs === 0: status 'finished', lastNowMs null.
// Remaining is derived from timestamps, never from counting calls.

export function pause(timer, now)
// If status !== 'running': returns the same timer.
// Otherwise t = tick(timer, now); if t is finished, return t.
// Else return { ...t, status:'paused', lastNowMs: null }.

export function resume(timer, now)
// Applies only when status === 'paused' && Number.isFinite(now).
// Returns { ...timer, status:'running', lastNowMs: now }. Otherwise returns the same timer.

export function reset(timer)
// From any status. Returns { status:'idle', durationMs, remainingMs: durationMs, lastNowMs: null }.

export function remainingSeconds(timer)
// Math.ceil(timer.remainingMs / 1000). This is the display value only.

export function fractionRemaining(timer)
// durationMs === 0 ? 0 : clamp(remainingMs / durationMs, 0, 1). Uses exact ms, not rounded.

export function formatTime(totalSeconds)
// s = Number.isFinite(totalSeconds) ? Math.max(0, Math.ceil(totalSeconds)) : 0
// Returns pad2(Math.floor(s / 60)) + ':' + pad2(s % 60), where pad2 pads to at least 2 digits.
// Examples: 65 -> "01:05", 600 -> "10:00", 0 -> "00:00", 5999 -> "99:59".

export function parseCustomDuration(minutesText, secondsText)
// Each argument: String(arg).trim() must match /^\d{1,2}$/, otherwise return null.
// (Rejects empty, '-', '+', '.', 'e', spaces inside, and 3+ digits.)
// m = Number(minutes), s = Number(seconds); if s > 59 return null.
// total = m*60 + s; if total < 1 or total > 5999 return null.
// Otherwise returns total (an integer number of seconds).
// The function is pure. "No state change" means the caller applies the result only when it is not null.
```

**What AC2, AC3, AC5 and AC6 assert:** these tests assert on the exact `remainingMs` field (for example `remainingMs === (N - T) * 1000`). `remainingSeconds` (ceil) is only for display. A probe with a fractional T such as 0.5 s must compare `remainingMs` (for example 119500), not a rounded value.

### `src/screen.js`
```js
import { remainingSeconds, fractionRemaining, formatTime } from './timer.js';

export function getScreen(timer)
// Returns:
// { status: timer.status,
//   timeText: formatTime(remainingSeconds(timer)),
//   showDone: timer.status === 'finished',
//   fraction: fractionRemaining(timer),
//   ringTone: timer.status === 'finished' ? 'finished' : 'running',
//   durationLocked: timer.status !== 'idle',   // presets and custom entry disabled
//   controls: { presets, custom, start, pause, resume, reset } } // booleans = visible
```

| status | presets | custom | start | pause | resume | reset |
|---|---|---|---|---|---|---|
| idle | true | true | true | false | false | false |
| running | false | false | false | true | false | true |
| paused | false | false | false | false | true | true |
| finished | false | false | false | false | false | true |

### `src/views/ring.js`
```js
export const RING_RADIUS = 54;                       // SVG viewBox "0 0 120 120", centre (60,60)
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function getRingArc(progress)
// p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0
// drawnLength = RING_CIRCUMFERENCE * p
// Returns { circumference: RING_CIRCUMFERENCE, drawnLength,
//           dashArray: `${drawnLength} ${RING_CIRCUMFERENCE}` }
// The view is a function of progress only. The track colour is NOT decided here;
// ui.js applies screen.ringTone as the class `is-finished` on the SVG.
```

### `index.html` (exact ids and attributes the tests rely on)
- `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<link rel="stylesheet" href="./styles.css">`, `<script type="module" src="./src/ui.js"></script>`.
- Ring: `<svg class="ring" id="ring" viewBox="0 0 120 120" aria-hidden="true">` with **no `xmlns` attribute**. Inline SVG in HTML does not need it, and its namespace URL would trip AC23.
  - Inside it: `<circle class="ring-track" id="ring-track" cx="60" cy="60" r="54">` and `<circle class="ring-arc" id="ring-arc" cx="60" cy="60" r="54" transform="rotate(-90 60 60)">`.
- `<p id="time-text" class="time">02:00</p>` and `<p id="done-text" class="done" hidden>Done</p>`.
- `<div id="presets">` holding exactly four buttons, each in the form `<button type="button" class="preset" data-preset-seconds="120">2 min</button>`. The values are 120, 180, 300 and 600, labelled `2 min`, `3 min`, `5 min` and `10 min`.
- `<div id="custom">` with:
  - `<input id="custom-minutes" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="0" aria-label="Minutes">`
  - the same for `custom-seconds` (`aria-label="Seconds"`)
  - `<button type="button" id="custom-apply">Set</button>`.
- `<button type="button" id="start-btn">Start</button>`, `id="pause-btn"` (Pause, `hidden`), `id="resume-btn"` (Resume, `hidden`), `id="reset-btn"` (Reset, `hidden`).
- No inline `style` attributes, no `onclick` attributes, and no other `<script>` or `<link>` tags.

### `styles.css` (exact text patterns the tests rely on)
- One `:root { ... }` block declaring the six custom properties from the colour table. Each value is a 6-digit hex, written as `--name: #RRGGBB;`. Tests read them with `/--ring-finished:\s*(#[0-9a-fA-F]{6})\s*;/` (and the same for each name).
- `body { ... background: var(--page-bg); ... }` (or `background-color`).
- `.ring-track { stroke: var(--ring-track); }`
- `.ring-arc { stroke: var(--ring-running); stroke-linecap: butt; }`. Butt caps mean nothing is drawn at length 0.
- `.ring.is-finished .ring-track { stroke: var(--ring-finished); }`
- `.done { color: var(--done-text); }` and `.time { color: var(--time-text); }`
- Exactly one rule whose selector list includes both `button` and `input`, containing `min-width: 48px;` and `min-height: 48px;`. Add `touch-action: manipulation;` there (this stops double-tap zoom on rapid taps).
- No other rule may set `width`, `height`, `max-width` or `max-height` below 48px on `button`, `input`, `.preset` or the control ids.
- `[hidden] { display: none !important; }`
- No `transition` or `animation` properties anywhere. The ring is redrawn from state, so there is no decorative motion and `prefers-reduced-motion` needs no special case.
- Layout:
  - `html, body { margin: 0; height: 100%; }`, with the main area sized to `100dvh`.
  - Ring width about `min(70vmin, 60vh)`, and time text large (about `12vmin`, at least `2.5rem`).
  - `@media (orientation: landscape)` puts the ring and the controls side by side so nothing scrolls.
  - Tune these values for AC19 on the phone.

### `src/ui.js` (thin; not imported by any test, only read as text)
```js
import { createTimer, setDuration, start, pause, resume, reset, tick, parseCustomDuration,
         DEFAULT_DURATION_SECONDS } from './timer.js';
import { getScreen } from './screen.js';
import { getRingArc } from './views/ring.js';

let timer = createTimer(DEFAULT_DURATION_SECONDS);
let frameId = null;

function render() {
  // s = getScreen(timer)
  // #time-text.textContent = s.timeText
  // #done-text.hidden = !s.showDone
  // #ring-arc stroke-dasharray = getRingArc(s.fraction).dashArray
  // #ring classList.toggle('is-finished', s.ringTone === 'finished')
  // #presets.hidden = !s.controls.presets; each preset button and both inputs and
  //   #custom-apply: .disabled = s.durationLocked; #custom.hidden = !s.controls.custom
  // start/pause/resume/reset buttons: .hidden = !s.controls.<name>
}
function onFrame() {               // the only loop
  frameId = null;
  timer = tick(timer, Date.now());
  render();
  if (timer.status === 'running') frameId = requestAnimationFrame(onFrame);
}
function ensureFrameLoop() { if (frameId === null && timer.status === 'running') frameId = requestAnimationFrame(onFrame); }
function apply(next) { timer = next; render(); ensureFrameLoop(); }   // every handler goes through this
```
- **Handlers:**
  - preset click: `apply(setDuration(timer, Number(btn.dataset.presetSeconds)))`
  - Set: `const s = parseCustomDuration(minEl.value, secEl.value); if (s !== null) apply(setDuration(timer, s));`
  - Start: `apply(start(timer, Date.now()))`
  - Pause: `apply(pause(timer, Date.now()))`
  - Resume: `apply(resume(timer, Date.now()))`
  - Reset: `apply(reset(timer))`
- **Visibility:** `document.addEventListener('visibilitychange', () => { if (!document.hidden) { timer = tick(timer, Date.now()); render(); ensureFrameLoop(); } })`.
- **On load:** call `render()` once.
- Use no `setInterval`, no storage, no network.

## Test list (every [AUTO] criterion maps to at least one test)
Every test name starts with its AC id, so a failing test shows which criterion broke. The fake clock is plain numbers passed as `now`.

| AC | Test file | Test name: what it asserts |
|---|---|---|
| AC1 | timer.test.js | "AC1 new timer is idle with full remaining time": `createTimer(90)` gives status `idle`, `remainingMs` 90000 |
| AC2 | timer.test.js | "AC2 running timer loses exactly the elapsed time": start at now 1000, tick at 1000+T*1000 (T=10, N=120) gives `remainingMs` (N-T)*1000, status `running` |
| AC3 | timer.test.js | "AC3 one 30 s clock jump removes 30 s": a single tick 30000 ms after start gives `remainingMs` (N-30)*1000. Also, 1 tick and 300 ticks spread over the same 30 s give equal results |
| AC4 | timer.test.js | "AC4 paused timer ignores the clock": after pause, ticks at +60 s leave `remainingMs` unchanged and status `paused` |
| AC5 | timer.test.js | "AC5 resume continues from paused remaining": run 10 s, pause, resume 60 s later, run 10 s more gives `remainingMs` (N-20)*1000 |
| AC6 | timer.test.js | "AC6 finishes at exactly zero and never negative": tick at exactly N s gives `remainingMs` 0, status `finished`. A tick at N*10 s gives 0 too, and a pause past the end gives `finished` |
| AC7 | timer.test.js | "AC7 reset returns to idle with last chosen duration": reset from running, paused and finished each gives `idle`, `remainingMs === durationMs`, after an earlier `setDuration(…, 300)` |
| AC8 | timer.test.js | "AC8 ignored actions return the same timer": `start` on a 0 s timer, `start` while running, `pause` when idle/paused/finished, and `resume` when idle/running/finished each return the input (`===`) |
| AC9 | timer.test.js | "AC9 fraction is 1, 0.5, 0 and stays within 0..1": checks 1 at start, 0.5 at half, 0 at finish, and 0..1 across 200 random ticks including backwards clock values |
| AC10 | timer.test.js | "AC10 formats mm:ss": 65 gives "01:05", 600 gives "10:00", 0 gives "00:00", 5999 gives "99:59" |
| AC11 | timer.test.js | "AC11 parses valid custom time": ("1","5") gives 65, ("99","59") gives 5999, ("0","1") gives 1 |
| AC11 | timer.test.js | "AC11 rejects invalid custom time": ("0","0"), ("-1","0"), ("a","5"), ("", "5"), ("1","60"), ("100","0"), ("1.5","0"), (" 1e1","0") each give `null`. A timer passed through the UI rule (apply only if not null) is unchanged |
| AC12 | timer.test.js | "AC12 presets are 2, 3, 5, 10 minutes": `PRESET_SECONDS` deep-equals [120,180,300,600]. `setDuration(idle, p)` gives `durationMs`, `remainingMs` p*1000 for each |
| AC12 | page.test.js | "AC12 page has exactly four labelled preset buttons": regex `/<button\b[^>]*\bdata-preset-seconds="(\d+)"[^>]*>\s*([^<]*?)\s*<\/button>/g` on index.html gives exactly 4 matches. Values deep-equal `PRESET_SECONDS`; labels are "2 min","3 min","5 min","10 min" |
| AC13 | screen.test.js | "AC13 duration locked while running or paused": `setDuration` on running and on paused timers returns the same object. `getScreen(...).durationLocked` is true for running and paused, false for idle |
| AC13 | page.test.js | "AC13 ui disables duration controls from durationLocked": ui.js text contains `durationLocked` and `.disabled` |
| AC15 | screen.test.js | "AC15 time text advances every whole second": for N=5, ticking each 1000 ms gives `timeText` "00:05","00:04",…,"00:00". At start+200 ms the text is still "00:05" (ceil) |
| AC15 | page.test.js | "AC15 ui re-renders every frame while running": ui.js text contains `requestAnimationFrame(`, `Date.now()`, `tick(` and `visibilitychange`. index.html has `id="time-text"` |
| AC16 | ring.test.js | "AC16 arc length follows progress": `getRingArc(1).drawnLength === RING_CIRCUMFERENCE`; 0.5 gives half; 0 gives 0; -1, 2 and NaN are clamped (0, full, 0); `dashArray` starts with the drawn length |
| AC17 | page.test.js | "AC17 one 48px minimum rule covers buttons and inputs": exactly one rule whose selector list has `button` and `input` with `min-width: 48px` and `min-height: 48px`. No rule sets width/height/max-width/max-height below 48px on those selectors. index.html has no `style=` attribute. All controls are `<button>` or `<input>` |
| AC18 | screen.test.js | "AC18 visible controls per state": `getScreen(...).controls` matches the screen.js table for all four states |
| AC18 | page.test.js | "AC18 page has every control id": index.html contains ids `presets`, `custom`, `custom-minutes`, `custom-seconds`, `custom-apply`, `start-btn`, `pause-btn`, `resume-btn`, `reset-btn` |
| AC21 | screen.test.js | "AC21 finished screen shows Done, 00:00, empty arc, finished tone": a finished timer gives `showDone` true, `timeText` "00:00", `fraction` 0, `ringTone` "finished". Running gives `showDone` false, `ringTone` "running" |
| AC21 | ring.test.js | "AC21 finished arc is empty": `getRingArc(getScreen(finished).fraction).drawnLength === 0` |
| AC21 | page.test.js | "AC21 markup has Done text and finished track rule": index.html has `id="done-text"` containing `Done` with `hidden`. styles.css has `.ring.is-finished .ring-track` stroking `var(--ring-finished)` and `.ring-arc` with `stroke-linecap: butt` |
| AC21a | colours.test.js | "AC21a finished colour differs from running colour and is at least 3:1": reads `--ring-finished`, `--ring-running`, `--ring-track`, `--page-bg` from `:root`. Finished differs from running and from track. WCAG contrast(finished, page-bg) >= 3 |
| AC21a | colours.test.js | "AC21a colour constants are the ones the page uses": `body` background is `var(--page-bg)`; `.ring-arc` stroke is `var(--ring-running)`; `.ring.is-finished .ring-track` stroke is `var(--ring-finished)` |
| AC21b | colours.test.js | "AC21b Done text is at least 4.5:1": contrast(`--done-text`, `--page-bg`) >= 4.5, and `.done` colour is `var(--done-text)` |
| AC23 | hard-rules.test.js | "AC23 no external resource references in the deployable site": no file in the deployable set contains (case-insensitive) `http:` followed by `//`, `https:` followed by `//`, `src="//`, `href="//`, `url(//`, `@import`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` |
| AC24 | hard-rules.test.js | "AC24 no storage, cookies or analytics": no file in the deployable set contains `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `analytics`, `gtag` (case-insensitive) |
| AC25 | hard-rules.test.js | "AC25 deployable site is only html, css and js": every file in the deployable set ends `.html`, `.css` or `.js` |
| AC25 | hard-rules.test.js | "AC25 package.json has no dependencies and no build": `type` is "module". It has none of the four dependency keys. `scripts` keys are only `test`, with value `node --test`. The repo root has no `node_modules`, `webpack.config.*`, `vite.config.*`, `rollup.config.*`, `esbuild.*`, `tsconfig.json`, `.babelrc` |
| AC25 | hard-rules.test.js | "AC25 module imports are relative and end in .js": every `from '…'`, `from "…"` and `import(` specifier in `src/**/*.js`, plus the index.html script `src`, starts with `./` or `../` and ends with `.js` |
| AC26 | no-child-details.test.js | "AC26 no banned word in the scanned set": scans `index.html`, `styles.css`, `src/**`, `tests/**`, `docs/requirements.md`, `docs/plan.md`, and `docs/test-report.md` if present. It skips `tests/unit/no-child-details.test.js` (relative paths compared with `/` separators) and checks every banned entry case-insensitively. On failure it reports the file and the entry |

Count check: AC1-AC13, AC15-AC18, AC21, AC21a, AC21b and AC23-AC26 (24 criteria) each have at least one row.

### Test helper rules (`tests/unit/helpers/files.js`)
- Export `REPO_ROOT`, `readText(relPath)`, `listFiles(relDir)` (recursive, returns relative paths with `/` separators, skips names starting with `.` and `node_modules`), and `deployableFiles()`.
- Build paths with `fileURLToPath(new URL('../../../', import.meta.url))`. **Never use `.pathname`**: the repo path contains a space, and on Windows `.pathname` gives `%20` and a leading slash.
- Write the walker by hand with `readdirSync(dir, { withFileTypes: true })`. Do not use `{ recursive: true }`, which needs Node 18.17 or later.
- The helper must not be named `*.test.js`, `test-*.js`, `*-test.js`, `*_test.js` or `test.js`, and must not sit in a folder named `test`. Otherwise the runner executes it as a test.
- Regexes must accept CRLF line endings (use `\s`, not `\n`-only matches).
- Tests never import `src/ui.js`, because it touches `document`. They only read it as text.

### Contrast formula (used in colours.test.js)
WCAG 2.x:
- For each sRGB channel c in 0..1: if c <= 0.04045 use c/12.92, else ((c+0.055)/1.055)^2.4.
- L = 0.2126 R + 0.7152 G + 0.0722 B.
- Ratio = (Lhi + 0.05) / (Llo + 0.05).

Self-check: white against `#000000` must give 21 (assert to 2 decimals).

## Manual checklist ([MANUAL] criteria, done by you on the phone over the laptop static server)
| AC | How to check |
|---|---|
| AC14 | Tap the minutes field. The number keyboard opens. Enter 1 and 30, tap Set, and the display shows 01:30. Then try 0 and 0, tap Set: nothing changes |
| AC19 | Hold the phone at about 60 cm in portrait, then in landscape. The time is readable, nothing is cut off, and no scrolling is needed in idle, running, paused or finished |
| AC20 | Start a 2 min timer and watch for 15 s. The arc shrinks smoothly with no visible jumps |
| AC22 | Let a short timer finish (custom 0:05). From arm's length, finished (vermillion ring, "Done") is clearly different from running (blue arc) |
| AC27 | Open the page, switch on airplane mode, then start, pause, resume and reset, and let a timer finish. All of it works |

## Risks and edge cases (the tester will probe these)
- **Pause/resume repeatedly:** 100 pause/resume pairs with 0 ms between them consume no time. Pairs with 1 s pauses consume exactly the running time only. `lastNowMs` is null whenever the timer is not running.
- **Zero duration:**
  - `createTimer(0)` is idle with fraction 0.
  - `start` is ignored.
  - `setDuration(t, 0)` is ignored.
  - `parseCustomDuration("0","0")` is null.
- **Huge or bad durations:**
  - `createTimer(6000)`, `createTimer(-1)`, `createTimer(1.5)`, `createTimer(NaN)` and `createTimer("60")` throw RangeError.
  - `setDuration` with the same values returns the same timer.
  - `createTimer(5999)` runs to finish with a single tick of a year's worth of ms and shows "00:00".
  - `formatTime(6000)` gives "100:00". This is not reachable from the UI.
- **Rapid taps:**
  - Double Start: the second call is ignored.
  - Start then an instant Pause: paused with full remaining time, give or take a few ms.
  - Reset during a frame: the loop stops because status is not running.
  - `ensureFrameLoop` guarantees only one frame loop at a time.
  - `touch-action: manipulation` prevents double-tap zoom.
  - Pause and Resume may share a screen position, so a fast double tap pauses then resumes. That is expected and costs no time.
- **Tab backgrounded or phone asleep, then back:** `requestAnimationFrame` stops in the background, but remaining time comes from timestamps. On return, `visibilitychange` ticks with `Date.now()`, so the display is correct immediately. If the end time passed, the page shows Done and 00:00.
- **Clock going backwards:**
  - A tick with `now` earlier than `lastNowMs` costs zero time and re-anchors.
  - Later ticks count forward from the new anchor.
  - Remaining time never increases.
  - Non-finite `now` (NaN, Infinity) is ignored.
- **Fractional times:** remaining time 0.4 s shows "00:01" (ceil), never "00:00" while running. Probes compare `remainingMs`, not rounded seconds.
- **Finished is sticky:** finished stays until Reset. `tick`, `pause` and `resume` on a finished timer return it unchanged.
- **Custom input oddities:** leading/trailing spaces are trimmed. "05" is accepted as 5. Non-ASCII digits, signs, decimals, exponents and 3+ digits are rejected.
- **AC23 vs the SVG namespace:** an `xmlns` attribute on the SVG would contain an http URL and fail AC23. It is deliberately omitted.
- **Hidden vs CSS display:** without `[hidden] { display: none !important; }`, a `display` rule on buttons would show hidden controls.

## Model suggestion for the engineer
**sonnet**. The interfaces are fully specified, but the work spans 7 source/config files and 8 test files, including SVG markup, CSS layout tuned for portrait and landscape, DOM wiring with a single frame loop, and text-scanning tests with Windows path handling. Haiku would likely handle `timer.js` alone, but the cross-file consistency is where a cheaper model is likely to slip: ids, CSS custom property names, exact regex patterns and the helper naming rules. Retries would cost more than the savings.

## Definition of done
- All [AUTO] criteria pass with `node --test`
- No rule in CLAUDE.md or web-rules.md broken
- `src/.gitkeep` removed; no files beyond the Files table
- Manual checklist ready for you to run over the laptop static server
