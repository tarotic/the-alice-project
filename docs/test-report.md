PASS

# Test report: increment 1 (countdown timer with shrinking ring)

## Run result
Command: `node --test` from the repo root (Node v26.13.1).

```
ℹ tests 68
ℹ suites 0
ℹ pass 68
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

68 tests = engineer's unit tests (tests/unit/) plus 32 new adversarial tests in `tests/adversarial/timer-adversarial.test.js`. All test names start with their AC id.

## Bug list
None. No bug was reproduced.

(One adversarial test failed on my first run. That was my own wrong expectation: 900 s minus 1 s minus 600 s is 299 s, not 300 s. I corrected the test. The source was right.)

## [AUTO] criteria checked independently
| AC | Adversarial probes | Result |
|---|---|---|
| AC1, AC2 | Fractional elapsed (0.5 s, 0.25 ms) compared on exact `remainingMs` | pass |
| AC3 | One big jump; backwards clock costs zero and re-anchors; 2000 random ticks never raise remaining; NaN/Infinity/undefined/'x' as `now` ignored | pass |
| AC4, AC5 | 100 pause/resume pairs with 0 ms gap lose nothing; 100 pairs with 1 s runs and 1 s pauses lose exactly 100 s; `lastNowMs` is null while paused; paused timer ignores huge, negative and NaN clocks | pass |
| AC6 | Year-long single tick on 5999 s gives 0, finished, "00:00"; pause exactly at the end gives finished; finished is sticky (tick, pause, resume, start, setDuration all return the same object) | pass |
| AC7 | Reset from idle, running, paused and finished after setDuration(300); works on frozen inputs (no mutation) | pass |
| AC8 | Zero duration start ignored; double start ignored; start then instant pause keeps full time; pause when idle or paused, resume when idle or running ignored (same object); createTimer throws RangeError for 6000, -1, 1.5, NaN, "60", null, undefined, Infinity, 1e9; setDuration ignores them | pass |
| AC9 | Fraction is exactly 1, 0.5 and 0 for 1 s, 120 s and 5999 s | pass |
| AC10 | 65, 600, 0, 5999 as specified; also 6000 gives "100:00", negatives, NaN and Infinity give "00:00" | pass |
| AC11 | 28 rejected forms (signs, decimals, exponents, hex, 3 digits, non-ASCII digits, null, undefined, NaN, whitespace-only) all give null; trimmed and zero-padded forms accepted | pass |
| AC12 | Exactly four `data-preset-seconds` buttons; markup default "02:00" matches the 120 s default | pass |
| AC13 | setDuration returns the same object while running or paused for every preset; `ui.js` disables presets, both inputs and Set from `durationLocked` | pass (logic and source text only; see note below) |
| AC15 | A running timer never shows "00:00" (swept every 7 ms over 5 s); 0.4 s remaining shows "00:01"; 10 min background then return gives the right time; return after the end gives Done; `ui.js` has no setInterval or setTimeout, ticks with `Date.now()` on `visibilitychange`, and has a single-loop guard | pass |
| AC16 | Arc length is non-increasing over a full 120 s run sampled every 16 ms; stays between 0 and the circumference; non-finite progress gives 0 | pass |
| AC17 | One `button, input` rule with min 48 px; no rule sets a sub-48 px width or height on controls; no inline `style` or `onclick`; exactly 10 buttons and inputs; no links, selects or textareas | pass |
| AC18 | Controls table for all four states; the returned `controls` object is not shared between calls; `[hidden]` rule uses `!important` | pass |
| AC21, AC21a, AC21b | Finished screen shows Done, "00:00", an empty arc and the finished tone; at 1 ms before the end it does not. Contrast recomputed independently: finished vs page background at least 3:1, Done text at least 4.5:1; finished colour differs from running; no transition or animation in the CSS | pass |
| AC23, AC24, AC25 | Deployable files contain no URL, fetch, XHR, WebSocket, beacon, storage, cookie, eval, service worker, `@import`, `url(`, media or frame tags; one script and one link in `index.html`; no `xmlns`; every file is .html, .css or .js; package.json equals the plan's text exactly | pass |
| AC26 | Covered by the engineer's `tests/unit/no-child-details.test.js`; it passes on the current tree. This report was written without the banned words and should be rescanned by `node --test` after it is saved. | pass |

Note on AC13, AC15, AC18: `src/ui.js` touches `document`, so no node test runs it. The wiring is checked only by reading the source text. Whether the controls really hide, disable and update in a browser is therefore not proven by AUTO tests. The phone checklist below covers it.

## Review of the engineer's deviations
| Deviation | Verdict |
|---|---|
| `stroke-dasharray="339.292 339.292"` hard-coded in `index.html` | Fine. It is a presentation attribute, not an inline `style` (the plan bans `style=` only). It makes the first paint show a full arc before JS runs. A test confirms it equals the real circumference within 0.001. Minor upkeep risk: if the radius changes, this value must change too. |
| Extra wrapper elements (`main.app`, `section.display`, `div.readout`, `section.controls`, `div.actions`) | Fine. They are plain layout elements. They add no script, link, resource or interactive element. |
| Extra `stroke-width` and `fill: none` rules in `.ring-track` and `.ring-arc` | Fine and needed. Without `fill: none` the circles would fill solid. No width, height, transition or animation was introduced. |
| Extra `exists()` helper in `tests/unit/helpers/files.js` | Fine. It is a test helper, not part of the site, and is not named so the runner treats it as a test. It is used by the AC25 checks. |

Hard-rule check against CLAUDE.md and web-rules.md: no network call, no storage or cookie, no analytics, no dependency, no build step, no external script, font or CDN. Static HTML, CSS and JS only. Buttons and inputs have a 48 px minimum. No rule broken. `src/.gitkeep` is deleted. Files match the plan's table.

## Not verifiable here
- AC14, AC19, AC20, AC22, AC27 are [MANUAL] and need a phone (list below). They are UNVERIFIED until you run them.
- The ring's rendering (arc direction, butt cap at zero length, `rotate(-90)` start at 12 o'clock) cannot be checked in node.
- Landscape layout with no scrolling cannot be checked in node.

## MANUAL checklist (run on the phone)
Setup: in a terminal at the repo root run `python -m http.server 8000`. Allow it through the Windows firewall for private networks. Find the laptop IPv4 address with `ipconfig`. On the phone, on the same Wi-Fi, open `http://<laptop-ip>:8000`. Do not open the file directly.

- [ ] AC14 Custom time. Tap the minutes field. The number keyboard opens. Enter 1 and 30, tap Set. The display shows 01:30. Then enter 0 and 0 and tap Set. Nothing changes.
- [ ] AC19 Readability. Hold the phone at about 60 cm. In portrait, then landscape, check idle, running, paused and finished. The time is readable, nothing is cut off, and no scrolling is needed. Also check that the number keyboard does not hide the Set button.
- [ ] AC20 Smoothness. Start a 2 min timer and watch for 15 s. The arc shrinks smoothly with no jumps. Also check that it starts at the top and shrinks in one direction.
- [ ] AC22 Finish look. Set custom 0 and 5, start it and let it finish. From arm's length, the finished state (vermillion ring, "Done") is clearly different from running (blue arc). Check that no blue arc is left behind.
- [ ] AC27 Offline. Open the page, switch on airplane mode, then start, pause, resume and reset, and let a timer finish. All of it works.
- [ ] Extra, from the plan's edge cases: start a timer, lock the phone for 20 s, unlock. The time has moved on by about 20 s. Tap Pause and Resume quickly several times; it must not zoom or lose time. Check that Pause and Reset (and Resume and Reset) are each at least about finger size and not cramped.
