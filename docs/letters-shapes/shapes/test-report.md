PASS

Scope tested: Shapes increment (second tool in the switcher), requirements AC1-AC30, plus the Letters refactor into `createTraceTool`, the title change to "Play" and the g carry-over. Round 1 for this increment. Node v22.23.4. Command: `node --test` from the repo root (about 100 s).
Result of the last full run: 232 tests, 232 pass, 0 fail, 0 todo, 0 skipped, 0 cancelled.
Of those, tests/unit: 80 tests, 80 pass. tests/adversarial: 152 tests, 152 pass. New this round: tests/adversarial/shapes-pure.test.js (18 tests) and tests/adversarial/tools-integration.test.js (14 tests). I updated tests/adversarial/shell-static.test.js (title is now "Play"). No other adversarial test assumed one tool.
New tests avoid the all-glyph tap grid; they add about 20 s.

## Bugs
No open reproduced bugs. Every [AUTO] criterion AC1-AC30 that is tagged [AUTO] passed my own checks (AC1-3, AC6-17, AC19, AC21, AC23, AC25-27).

How each was checked (own tests, not a rerun of the engineer's):
1. AC1-AC3: real tool index gives exactly two tools, ids `letters` then `shapes`, labels "Letters" and "Shapes". Using the real registry and `performSwitch` against a fake DOM, a switch Letters->Shapes unmounts then mounts exactly once each; the same tool and an unknown id do neither. 1000 rapid switches alternate strictly clear/build with nothing left running (0 listeners, 0 pending frames). After Letters->Shapes->Letters and the reverse, the state is fresh (first glyph "a" / first shape "circle", empty ink, not done, hold idle, Next disabled, reward hidden, hold bar at 0%) and the switch state has only `activeId`. Switching mid-stroke, mid parent hold and with pending frames (both directions, and 200 times mid-hold at 900 ms) leaves no frames or listeners, old DOM events do nothing, and the new tool never passes by inheritance.
2. AC6-AC9: six shapes in order circle, square, triangle, rectangle, oval, star; one closed stroke each (first and last point within 1 unit, in fact well under); all points within 0..100; no gap above 2 units within a stroke. Measured boxes: circle 79.9x80.0, square 56.0x56.0, rectangle 80.0x40.0 (ratio 2.00), oval 47.9x80.0 (w/h 0.60, 0.60 of circle width).
3. AC10: tolerance 6, coverage 0.85, stray 0.5, hold 1000 ms.
4. AC11-AC15: own trace passes (points, reversed, 0.5-spaced, finger-style via the reducer and the DOM, with a pad that was scrolled and resized). Empty ink fails. 60% and 50% unclosed traces fail for all six. All six shapes are single-stroke (count asserted, so AC13 holds vacuously). Grids at spacings 0.5 to 10 and a raster never pass. Also failing: a tiny circle (at the centre and on the outline), lines through the middle (horizontal, vertical, both diagonals), single taps anywhere on a 1-unit grid from -5 to 105 (all six), 50 rapid taps, NaN and huge ink, 1.2x far stray ink, 55% stray. 40% stray is tolerated.
5. AC16/AC17: no ordered pair of different shapes passes (30 pairs). Circle/oval and square/rectangle fail in both directions. Pair numbers are under Recorded behaviours.
6. AC19/AC21: DOM label is the lowercase name for each of the six; Next is disabled until done, clicking a disabled Next does nothing, and the order is circle, square, triangle, rectangle, oval, star, circle (wrap checked over 7 steps and through `goNext`/`nextLetter`).
7. AC23: parent hold passes at 1000 ms with empty ink and with scribble ink; a tap, 999 ms, leave and cancel do not; time going backwards does not; the hold loop stops after pass or release; the fill bar shows progress.
8. AC26/AC27: `src/tools/shapes/` exists with 2 files and is scanned; forbidden strings and Ramona/Alice are absent from it, from src, index.html and styles.css; `<title>` is exactly "Play"; `package.json` unchanged rules.
9. Letters unchanged: all 52 glyphs pass the earlier full-set properties (own trace; first stroke only fails; dense grids never pass; stray-heavy never passes; i/j tap behaviour including the 5.5-unit radius; nextLetter wraps). Driving the real shell through 53 letters via the DOM gives labels a, A, b, B ... Z, then a again. The letters DOM tests from earlier rounds (reward on lift, parent hold, cleanup, pad rect remapping) still pass against the refactored factory.
10. g carry-over: a plain "a" trace now gives coverage 0.735 against g (stray 0.000) and does not pass. g's own trace passes, every g point is within 0..100, and its lowest point is below the baseline (a descender).

No ESCALATE.

## Recorded behaviours (not bugs against any AC; owner may want to know)
- Unclosed traces start to pass at about 78 to 80% of the outline: circle 80%, square 80%, triangle 79%, rectangle 80%, oval 79%, star 78% (steps of 1%). At 70% none pass (coverage 0.75 to 0.77). So a child can finish a shape without closing the last fifth.
- Pairwise matrix, ink of A against B's guide, as coverage / stray (a pass needs coverage >= 0.85 and stray <= 0.5). Highest coverage is 0.58, so none is close: circle->oval 0.38/0.66, oval->circle 0.34/0.62, square->rectangle 0.23/0.75, rectangle->square 0.25/0.77, circle->rectangle 0.55/0.56, square->oval 0.58/0.45, oval->square 0.55/0.42, triangle->star 0.49/0.46, star->triangle 0.55/0.52, star->square 0.49/0.49, rectangle->circle 0.45/0.45, oval->star 0.46/0.45. The full 30 are in the diagnostic output of tests/adversarial/shapes-pure.test.js.
- Look-alikes under sloppy tracing: circle or oval offset by 5, scaled 0.85 or 1.15 does not pass the other; likewise square and rectangle. AC17's known limitation (a sloppy trace can pass a similar shape) was not reproduced with these variations.
- Tolerance to a shaky finger: random jitter of up to plus or minus 10 units on a dense trace still passes all six shapes in 20 of 20 trials. Offsets up to 4 units and plus or minus 5% scale pass. The pass criteria are generous, which fits "jitter 2-3 units passes".
- The hold progress bar shows 100% at 999 ms because of rounding; the pass still needs 1000 ms.
- Letters: cross-letter confusion record is unchanged by the refactor (113 pairs, plus case pairs B->b, H->h, U->u, W->w). g: tracing g also passes a, c, d, n, o, p, q, u; no other letter's trace passes g. The g change made "a over g" fail (0.735) but "o" and "q" do not pass g either. i and j drawings also pass l (i->l, j->l, j->i); a long vertical line passes i and l; p and q pass with the bowl alone; A passes with its two legs; k with strokes 1 and 3; m with strokes 2 and 3. A plain circle passes a.
- Scoring happens on pointer down/up/cancel; a stroke that never gets pointerup/pointercancel gives no reward and blocks new touches until Clear, Next or a parent pass.
- `isDone('1','0')` returns true; `resample` has no size guard (not reachable in normal play).

## Code-review observations (by reading src/ui.js, src/tools/letters/tool.js, src/tools/shapes/tool.js; NOT reproduced on a phone)
1. Per-instance state is correct: `controller`, both frame ids, host and game state are inside the factory, so Letters and Shapes do not share state. `unmount` aborts, cancels both frames, empties the host and clears state. A second `mount` on the same instance without `unmount` would orphan the first controller; `performSwitch` never does that.
2. Pointer capture: the pad calls `setPointerCapture` on every pointerdown, including a second finger, whose events are then ignored; if the first finger lifts while the second stays down, the second draws nothing until it lifts and touches again. There is no `lostpointercapture` handler. A lost `pointerup` leaves the pad dead until Clear or Next, and now (scoring on lift) with no reward.
3. A parent hold interrupted by the page being hidden: `holdLoop` ticks on elapsed time only. If the page is backgrounded mid-hold and no `pointerup`, `pointercancel` or `pointerleave` arrives, the first tick after resume could pass the item. Whether browsers deliver a cancel is unverified.
4. `touch-action: none` is set on the pad (no scroll or zoom while drawing) and on the parent button; other buttons use `manipulation`. The pad has no `contextmenu` preventDefault and no `user-select` or `-webkit-touch-callout` rule, so a long press on the canvas may show a callout or menu on some phones.
5. Resize and orientation: the canvas backing store is resized from `clientWidth * devicePixelRatio` and redrawn from glyph-space state, so ink survives rotation. The Shapes tool reuses the same CSS classes (`letter-label`, `pad`, and so on), so the layout is identical to Letters; the guide is a polygon path without `closePath`, but the last point equals the first, so the outline is closed.
6. `body { overflow-x: hidden }` hides horizontal overflow instead of preventing it. For the layout checks, look for clipping, not only for scrolling.
7. `ui.js`: `trySwitch` catches a failing mount and uses `err.state`. If a mount throws a primitive (for example a string), the assignment `err.state = ...` in `performSwitch` throws a TypeError that replaces the original error; the fallback to an empty switch state still works. Not reachable with the two shipped tools.
8. The reward star's `pop` animation runs at mount while the reward is hidden, so it is not seen when the reward appears (cosmetic).

## MANUAL checklist (run on a phone, portrait)
- [ ] AC4: the bar shows two buttons, "Letters" then "Shapes", the active one visibly marked; no project name or logo. Both buttons are visible and each at least 48x48 CSS px. The page title (browser tab) reads "Play".
- [ ] AC4/AC5: tap the other button; no reload and no white flash. Switch between the tools several times quickly (10 or more taps, also while drawing a stroke and while holding the parent button); nothing freezes, and each time you return you see a clear pad and the first item ("a" in Letters, "circle" in Shapes).
- [ ] AC18: the shape guide is faint, your finger draws a visible line, and drawing does not scroll or zoom the page.
- [ ] AC20: trace a shape and check the reward timing: nothing while the finger is down (except an i or j dot), the reward (text plus star, no sound) and Next when you lift. Clear wipes the ink and Next goes back to disabled.
- [ ] AC22: Next button exists; no shape picker; first shape is "circle"; order circle, square, triangle, rectangle, oval, star, then back to circle.
- [ ] Circle versus oval, square versus rectangle: they look clearly different, and tracing one does not complete the other. Note how easily each one completes, and whether finishing at about 80% of the outline feels too generous.
- [ ] AC24: the parent control reads "Parent: got it", looks different from Clear and Next, sits in a corner away from the pad and Next; a quick tap does nothing; holding 1 second shows progress and passes the shape.
- [ ] AC28: every button (switcher, Clear, Next, parent) is at least 48x48 CSS px, in both tools.
- [ ] AC29: Shapes layout in portrait with no horizontal scrolling and nothing clipped on the right; the pad is square and fits the width.
- [ ] AC30: load the page, switch on airplane mode, use both tools (trace, Clear, Next, parent hold, switch).
- [ ] Letters still feel the same: all 52 letters appear in order and are recognisable, especially s, S, u, g, j, f.
- [ ] New g: trace the lowercase g naturally; check that tracing a plain "a" does not complete it.
- [ ] i and j: draw the stem, no reward; tap the dot with a quick press (no dragging) and confirm it passes; tap far from the dot and confirm it does not.
- [ ] The longest letters m, M, w, W are comfortable to trace.
- [ ] Extra: scribble hard for 10+ seconds (no lag expected); long-press the pad and see whether a menu appears; rotate the phone mid-stroke and after tracing; lock the screen during a parent hold and see whether the item passes on return.
