# Increment 2: Shapes tool (second tool in the switcher)

## Story
As a parent handing over the phone, I want a second tool where my child traces six basic shapes with a finger, reachable from the same top switcher, so that she can practice shapes the way she practices letters.

## Acceptance criteria
Each is a checkable fact. Tag how it is verified: [AUTO] node test, or [MANUAL] I check on the phone.
"Letters rules" below means the existing letters constants and functions (TRACE_TOLERANCE, COVERAGE_THRESHOLD, STRAY_THRESHOLD, coverage, strayRatio, isDone, resample, parentHold, PARENT_HOLD_MS). Whether the shapes tool imports them or wraps them is the tech lead's call; the criteria only fix the behaviour.

### Switcher and tool switching
- AC1 [AUTO] With the real tools registered (the app's tool index, not fakes), `listTools()` returns exactly two tools, ids and labels in this order: Letters, then Shapes (label text exactly "Letters" and "Shapes").
- AC2 [AUTO] Using the real registry and `performSwitch`, switching Letters -> Shapes calls Letters' `unmount` exactly once, then Shapes' `mount` exactly once, in that order. Switching back does the reverse, each exactly once. Switching to the already active tool calls neither.
- AC3 [AUTO] After Letters -> Shapes -> Letters, the switch state still contains only the active tool id, and the Letters tool starts as a fresh game (first glyph "a", empty ink, not done). Same for Shapes -> Letters -> Shapes (first shape "circle", empty ink, not done). Nothing carries across.
- AC4 [MANUAL] The top bar shows two buttons, "Letters" then "Shapes", with the active one visibly marked. Tapping the other one changes the tool area with no page reload. Still no project name or logo.
- AC5 [MANUAL] After tracing on one tool, switching away and back shows a clear pad and the first item (letter "a" or shape "circle").

### Shape data (6 shapes)
- AC6 [AUTO] Shapes exist for exactly these ids, in this order: circle, square, triangle, rectangle, oval, star. Each is defined in code as stroke data: a list of strokes, each a list of at least 2 `{x, y}` points. No images, fonts or fetches.
- AC7 [AUTO] Every point of every shape lies within 0..100 on both axes (the same box as letters).
- AC8 [AUTO] Each shape is a closed outline: for every stroke that forms the outline, first and last point are within 1 unit of each other (or the shape's strokes together form a closed loop; the tech lead states which in the plan).
- AC9 [AUTO] Rectangle guide bounding box is at least 1.8 times wider than tall. Square guide bounding box is within 5% of equal width and height. Circle bounding box is within 5% of equal width and height. Oval bounding box width is at most 0.7 times its height, and at most 0.7 times the circle's width. These are starting values, tunable.

### Scoring (Letters rules, unchanged)
- AC10 [AUTO] Thresholds and tolerance for shapes are the same values as letters (tolerance 6, coverage 0.85, stray 0.5, hold 1000 ms). Changing a value for shapes only needs a stated reason in the plan.
- AC11 [AUTO] For all 6 shapes, ink equal to the shape's own stroke points (all strokes) is done.
- AC12 [AUTO] For all 6 shapes, ink equal to the first 60% of the outline's length (in drawing order, resampled), left unclosed, is not done. Circle is the named case: 60% of the circle is not done.
- AC13 [AUTO] For every shape with 2 or more strokes, ink equal to only its first stroke is not done. (If all six are single stroke, this holds vacuously and the test asserts that count.)
- AC14 [AUTO] For all 6 shapes, a dense grid of points over the whole 0..100 box (a scribble) is not done (strayRatio above 0.5).
- AC15 [AUTO] For all 6 shapes, empty ink is not done.

### Distinct shapes
- AC16 [AUTO] For every ordered pair of different shapes (A, B) except the two inherent pairs in AC17, ink equal to shape A's own points is not done against shape B's guide.
- AC17 [AUTO] For the pairs circle/oval and square/rectangle, in both directions, ink equal to one shape's own points is not done against the other's guide. This holds because of the AC9 aspect ratios. Known limitation: a sloppy or off-centre trace can still pass a similar shape, so the game is not a test of which shape the child drew (only parent judgment or later work could say that).

### Play (same as letters)
- AC18 [MANUAL] The current shape shows as a faint guide on a drawing pad; the finger draws a visible line; drawing does not scroll or zoom the page.
- AC19 [AUTO] The shape's name is shown as visible text in lowercase (for example "circle"); the test asserts the label for each of the six.
- AC20 [MANUAL] When done (AC11 rule) or passed by the parent, the same visible reward (text plus a shape, no sound) appears and "Next" becomes available. "Clear" wipes the ink so the shape can be retried.
- AC21 [AUTO] `Next` goes circle, square, triangle, rectangle, oval, star, then wraps to circle. Applying it 6 times returns to index 0, visiting each shape once. Next is disabled until the shape is done. The list order is asserted.
- AC22 [MANUAL] There is a "Next" button and no shape picker or menu. The first shape shown is "circle".
- AC23 [AUTO] The parent hold works for shapes as in letters: a hold of at least 1000 ms marks the current shape done whatever the ink; a tap or earlier release does not.
- AC24 [MANUAL] The parent control reads "Parent: got it", looks different from Clear and Next, sits in a corner away from the pad and Next, and shows progress while held.

### Existing tool and rules
- AC25 [AUTO] All tests that passed before this increment still pass unchanged (the whole letters suite and the shell tests). Any existing test that must change needs the owner's approval first and is listed in the plan.
- AC26 [AUTO] The existing static-rules checks (forbidden strings: http://, https://, fetch(, XMLHttpRequest, localStorage, sessionStorage, document.cookie, @import url(; and no "Ramona" or "Alice" case-insensitive) pass, and a test asserts that `src/tools/shapes/` exists with at least one file, so the scan really covers it. `index.html` and `styles.css` are covered as before.
- AC27 [AUTO] `package.json` still has no `dependencies` or `devDependencies` and keeps `"type": "module"`.
- AC28 [MANUAL] Every button (switcher, Clear, Next, parent control) is at least 48 by 48 CSS px, in both tools.
- AC29 [MANUAL] Shapes layout is usable in portrait on a phone with no horizontal scrolling; the pad is square and fits the width.
- AC30 [MANUAL] In airplane mode, once loaded, both tools work fully.

## Assumptions (owner can overturn)
- Shape order is the order in your brief: circle, square, triangle, rectangle, oval, star.
- Page `<title>` stays "Letters" (an existing test pins it); a neutral title would need that test changed.
- Reward, look, hold time and thresholds are the same as letters; thresholds may need tuning on the phone since shapes are simpler than letters.
- Shape names are lowercase English words, no case label like letters have.
- Whether the guide may be one closed stroke per shape is left to the tech lead.

## Out of scope
- More shapes, colours, sizes, rotation, or filled-shape play.
- A shape picker, saving progress or scores, sound, themes, offline reload support.
- Free-draw with reference, stroke order or direction checks.
- Recognising which shape the child drew; judging that a trace "looks right" beyond the coverage and stray rules.
- Deciding how code is shared with letters (tech lead).
- Changing letters behaviour or its look.

## Open questions for me
None that block work. The assumptions above are the only decisions I made; overturn any of them before the plan.
