PASS

Scope tested: the merge (Timer, Letters, Shapes in one shell), in /home/claude/merged. Round 2 (re-verification of the fix for bug 1). Node v22.23.4. Command: `node --test` from the repo root (about 87 s).
Result of the last full run: 409 tests, 409 pass, 0 fail, 0 todo, 0 skipped, 0 cancelled. tests/unit: 168 tests, all pass. tests/adversarial: 241 tests, all pass.
New this round: tests/adversarial/parent-touch.test.js (30 tests: pure `insideRect` edge cases and the Letters and Shapes parent-button flows through the real tool wiring with the fake DOM).
Real browser: headless Google Chrome via playwright, emulated phone (touch) at 390x844. Scripts and screenshots are in /tmp/tester/ (slide.py, slide2.py, inside.py). Browser console errors and warnings in all runs: none.

The verdict is PASS: bug 1 is fixed in real Chrome and nothing regressed.

## Reproduced bugs
None open.

Fixed since round 1:
1. (was) Sliding a touch off "Parent: got it" did not reset the hold. Re-verified in real Chrome with touch, in both Letters and Shapes (`python3 /tmp/tester/slide2.py`, `slide.py`, `inside.py`):
   - Slide off diagonally up-left, straight up, down, left or right, then keep pressing for 1.3 s: Next stays disabled and the reward stays hidden (10 of 10 cases).
   - Press 0.6 s, slide off and lift: no pass. Stay inside with small finger movement for 1.5 s: passes, with the reward. A hold 3 px inside the corner for 1.3 s passes. Five quick taps never pass.
   - A finger that slides out and comes back in while still down does not pass: not at 1.1 s, not at 2.6 s, not after the lift. The hold is reset by leaving and is not restarted by coming back (see recorded behaviours).
   - Multi-touch: a second finger drawing on the pad during an inside hold does not break the hold (it still passes at 1 s). If the holding finger slides off while a second finger stays on the pad, the hold resets and does not pass.
   - Switching tools mid-hold and returning gives a fresh tool, nothing pending, no errors.
   - Mouse flows unchanged: a 1.3 s hold passes, sliding off resets, an early release does not pass.
   - The earlier node tests (parent-hold, tool DOM, merge) still pass.

No ESCALATE.

## What passed (independently checked)
Merge plan and hard rules:
- Registry order is Timer, Letters, Shapes (ids `timer`, `letters`, `shapes`), entries frozen, unmounting an unmounted tool is harmless.
- Timer as a tool: switching away from a running timer pauses it exactly once with the exact remaining time (elapsed to the millisecond, no frame needed): 120000 minus 7777 gave 112223, shown as 01:53 on return. A second unmount, and a round trip through Letters and Shapes, leave the state object identical. No auto-resume even with the clock moved forward by 5e9 ms. Idle, paused, finished and paused-in-the-last-10-seconds timers are untouched (state identity); the paused rocket is "ready", not shaking.
- Finish ladder: leaving 1 ms before the end gives paused with 1 ms left and no chime; leaving at the end, 1 ms after, 5 s after or 1e9 ms after gives finished with exactly one chime at that moment. On return it shows Done and 00:00, and the chime count stays at 1 through 5 more switches, frames and visibilitychange events. After a 1 ms pause, Resume finishes with a single chime.
- Clock jumps while away (back 1e9 ms, forward 1e12 ms, none, one hour) never change the paused remaining time; Resume continues from it exactly.
- 1000 rapid mount/unmount cycles with a running timer: exact accounting (120000 minus 3000 ms of real running time), no leaked frames or listeners at any step, no chime.
- Mid-wheel-scroll switch: pending wheel frames are cancelled, the abandoned value is never applied (also in the real browser), and late scroll events on the old node do nothing.
- A custom duration set with the wheel, a preset, and the colour choice persist across switches. Presets and wheels are hidden and ignored while paused or running; Reset returns to idle with the wheels synced.
- Letters and Shapes start fresh after 30 round trips with a stroke and a parent hold left in progress (first glyph "a", first shape "circle", empty ink, Next disabled), while the timer keeps its paused state. A hold in progress never carries over to another tool, and no frames or listeners remain.
- visibilitychange while another tool is shown does nothing; while the timer is mounted, a finish in the background chimes once.
- Sound unlock: Resume (not only Start) works after switching, then one chime at the finish.
- Listeners: the timer adds no window listeners, Letters and Shapes window listeners vanish on switch, and the document listener exists only while the timer is mounted. A Timer mount failure (markup missing) throws and does not stop Letters from mounting.
- Static rules over index.html, styles.css and src/**, with the union of the needles of both repos (also `import(`, `setTimeout`, `setInterval`, `xmlns`, `url(`, `//host.tld`): no hits. Only .html, .css and .js files; package.json exactly `{name: timer, private, type: module, scripts: {test}}`; title is exactly "Play" (no project or owner name); one script, one link, one `<main>`, no inline handlers; every relative import ends in `.js` and resolves; pure modules use no DOM, clock, frames or randomness; the DOM files import cleanly in a bare Node process.
- No API newer than Node 20 is used in src or tests (CI runs Node 20).
- Windows compatibility: no test builds a path from `URL.pathname` or from string-concatenated paths. Every test uses `fileURLToPath` or `path.join`, and `readFileSync(new URL(...))` is also fine on Windows. One style note: timer-adversarial.test.js builds `dir + '/' + name`, which works on Windows (forward slash).
- CSS (by reading and a rule parser): exactly one rule with a bare `button` selector (Tree A's `button, input`); `.actions` appears bare only in the timer's own `#presets, #custom, .actions` rule; the other new rules are scoped by `#tool-area:not([data-tool="timer"])` or `#switcher`; one `body` rule; no `transition`; animation names are all on the whitelist; the reduced-motion block is present; no width or height below 48 px on buttons, inputs, presets, swatches or `.parent`.

Real browser, layout (all in `layout.py`):
- No horizontal scroll in any tool at 390x844, 360x640 and 844x390 (scrollWidth equals clientWidth everywhere), and nothing clipped on the right or left.
- Every visible button is at least 48x48 CSS px in all three tools and all three viewports: the three tabs (84 to 102 px wide, 48 high), presets, the 10 colour swatches (48x48), Start, Clear, Next and Parent. No button overlaps another button or the canvas.
- The switcher bar is 64 px high and the timer controls sit below it.
- Visual check of the screenshots: dark theme consistent, planets and stars behind all tools, the guide is faint and the ink is clearly visible (yellow), the reward text is readable. Nothing looks broken.

Real browser, behaviour (`flow.py`, `timer2.py`):
- Timer: preset, start, pause (time stays), resume, reset, colour swatch (sets `--ring-running`), custom wheels with ArrowUp and ArrowDown (ArrowDown increases the value), a clicked wheel value, finishing a 00:02 custom timer shows 00:00, Done and the rocket (which flies off and ends invisible). Switching away mid-run and back shows the exact paused time with Resume; it stays paused; Resume continues. A timer that finished shows Done after switching away and back. Switching mid-wheel-scroll leaves the duration unchanged.
- Letters (real touch events via Chrome DevTools): tracing "a" with the finger still down: Next disabled, reward hidden; after the lift: Next enabled and "Well done!". A scribble on "A" does not pass. The i stem alone does not pass; a tap 14 units away and one at the stem do not pass; a quick tap on the dot after the stem passes (Next enabled, reward); a tap before the stem followed by the stem, and the stem followed by the tap, both pass (`itap.py`, also with no pause between the strokes). One earlier run of my own script (flow.py) showed tap-then-stem not passing; I could not reproduce it in three re-runs, so I treat it as a script artefact and do not report it as a bug. Switching mid-stroke and mid-hold: coming back shows a fresh "a", Next disabled.
- Shapes: the circle traced with the finger down does not enable Next; after the lift it does, with the reward. A 60% trace and a scribble do not pass. Parent hold of 0.5 s does not pass, 1.3 s passes; Next advances to "square". 180 rapid tab switches finished with no errors, and Shapes showed "circle".

## Recorded behaviours (not bugs; owner may want to know)
- Sliding out and back in: leaving the button (a move or a release outside its rectangle, boundary inclusive) resets the hold, and returning with the finger still down does not restart it. The child must lift and press again. A hold that already reached 1 s inside is passed and sticky, so moving out afterwards changes nothing. If a move outside arrives at the very same moment as 1000 ms but before the frame tick, the leave wins (no pass); after the tick it is already passed.
- `insideRect` treats NaN, undefined, null and infinite coordinates as outside (a malformed event counts as leaving). It accepts numeric strings (coerced by the comparison; real events give numbers). Zero-size rectangles contain only their single point and inverted rectangles contain nothing.
- A move or release from a different finger is ignored while another finger holds the button (pointer id must match); a second finger pressing the button during a hold does not restart it.
- The parent button is 117.6 px wide in the browser, not the 120 px its rule declares: the scoped `#tool-area:not([data-tool="timer"]) button` rule (specificity 1,1,1) sets `min-width: 48px` and beats `.parent` (0,1,0). It is still at least 48x48 and clearly a corner control; the visible effect is only 2.4 px.
- Landscape (844x390) and small portrait (360x640): each tool needs vertical scrolling. The pad is 420 px wide on landscape and so taller than the 390 px viewport; the Letters/Shapes page is 737 px tall and the Parent button sits at about y 677, below the first screen. The timer page is 468 px tall in landscape (Start at about y 408 to 456, below the fold of 390) and 732 px at 360x640 (Start at about y 672 to 720, below 640). Whether the timer was already this tall before the merge was not measured. The switcher bar is not sticky (static position), so it scrolls away with the page; there is no `env(safe-area-inset-*)` handling and no `viewport-fit` in the meta tag.
- After switching back to a timer that had finished, the rocket launch animation replays over "Done" (it flies off after about 2 s), as the plan states.
- Mounting a mounted timer into a second host is silently ignored (the second host stays empty). Not reachable through the switcher.
- `pop`/transition removal: no `transition` anywhere, as the plan required.
- Letters/Shapes recorded behaviours from earlier reports are unchanged by the merge (cross-letter confusion record of 113 pairs, 80% unclosed traces pass, p and q pass with the bowl alone, A passes with its two legs, i and j drawings also pass l, g is passed by tracing a, c, d, n, o, p, q or u). A tap on the i dot alone does not pass.
- One-point corner case already known: a stroke that never gets pointerup gives no reward and blocks new touches until Clear, Next or a parent pass.

## Code-review observations (by reading; not reproduced unless stated)
1. Besides Bug 1, the pad also calls `setPointerCapture` inside `pointerdown` (works because the capture then sticks). A second finger on the pad is captured and ignored.
2. `src/tools/timer/tool.js` first-mount adoption: `adopt()` runs once and `root` is reused, so any markup change to `#timer-tool` needs a reload (normal for a static page). If `#timer-tool` is missing, the error propagates to `ui.js`'s `trySwitch`, which logs it and keeps the other tools working (tested).
3. `unmount()` of the timer discards a wheel scroll in progress; the wheels show the timer's duration on return (tested in node and in the browser).
4. The timer's `visibilitychange` handler only ticks the timer; while mounted and running, a long background period is handled by one tick (exact for the remaining time, the chime plays once).
5. The Letters pad has no `contextmenu` preventDefault or `user-select`/callout rule (only the parent button has them), so a long press on the pad may show a callout on some phones. Not reproduced in headless Chrome.
6. `body { overflow-x: hidden }` hides horizontal overflow instead of preventing it; the measurements above show no overflow today.
7. The reduced-motion block only removes animations; the Letters reward star has no motion, so nothing else needs handling.

## MANUAL checklist (phone, finger)
- [ ] All three tools are usable with a finger: Timer (presets, wheels by swipe, colours, Start, Pause, Resume, Reset), Letters (trace, Clear, Next, Parent), Shapes (trace, Clear, Next, Parent).
- [ ] Switching feel: tap Timer, Letters, Shapes many times quickly (also while drawing a stroke and while holding the Parent button); no flash or reload, no freeze, active tab clearly marked. The tab title reads "Play".
- [ ] Timer pause on switch: start a 2 minute timer, switch to Letters for about 20 seconds, come back: the time has not moved, Resume and Reset show, and the time stays still until you tap Resume; it then continues from the same second.
- [ ] Chime sound after switching: start a short timer (for example 00:10), switch to Letters and back, tap Resume, let it finish: the chime plays once and Done with the rocket shows. Also let a timer finish while staying on the Timer tab: one chime.
- [ ] Switching away to the Timer exactly when time is nearly up (for example at 00:01): note what you hear and see.
- [ ] Letters: trace "a" and check the reward appears when you lift your finger, not while drawing. On "i" and "j": draw the stem (no reward), then tap the dot with a quick press and confirm it passes; tap far from the dot and confirm it does not.
- [ ] g and y: look natural and trace naturally.
- [ ] Parent button: "Parent: got it" sits in the bottom right corner, away from the pad and Next, on small phones too (for example 360x640 and a 5-inch phone); a quick tap does nothing, a 1 second hold shows progress and passes. Slide your finger off the button (any direction) and keep pressing for over a second: it must NOT pass; slide out and back in without lifting: it must not pass either; lift and press again for 1 second: it passes.
- [ ] Shapes: circle versus oval and square versus rectangle look and trace distinctly; the reward timing is on lift; the new g and the 6 shapes in order.
- [ ] Landscape: rotate the phone in each tool; check that you can still reach every button (the page scrolls), the Start button, Next and Parent.
- [ ] Every button is comfortable to tap (at least 48 px), the bar and controls do not overlap anything, nothing is clipped, no horizontal scrolling.
- [ ] Airplane mode: load the page once, then use all three tools.
