# Increment 1: App shell with tool switcher + trace-a-letter game (full alphabet)

## Story
As a parent handing over the phone, I want a page with a switcher at the top and a letter game where my child traces lowercase and uppercase letters with a finger, so that she can practice writing them now and more tools can be added to the same switcher later.

## Size warning (read first)
Scope is the full alphabet (52 glyphs) as requested. This is the largest risk for "one session": hand-authoring 52 stroke paths plus the shell, scoring and tests. It stays in scope. If the engineer runs out of session, the agreed split is:
- 1a: shell + switcher + scoring + parent button + the glyphs a, A, b, B, c, C, l, L, o, O, t, T.
- 1b: the remaining 40 glyphs (data only, same tests). All glyph ACs still apply to the full set before 1 is called done.

## Acceptance criteria
Each is a checkable fact. Tag how it is verified: [AUTO] node test, or [MANUAL] I check on the phone.

Architecture (web-rules.md): pure logic in `src/` modules with no DOM; `src/ui.js` is thin DOM wiring only; tests in `tests/unit`. The tech lead chooses file names for the registry and letter modules.

### Tool registry and switcher
- AC1 [AUTO] A pure registry module exposes `registerTool({id, label, mount, unmount})`, `listTools()` and `getTool(id)`. `listTools()` returns tools in registration order.
- AC2 [AUTO] Registering a tool with a missing or duplicate `id`, an empty `label`, or non-function `mount`/`unmount` throws an error.
- AC3 [AUTO] A pure `switchTo(state, id)` returns a new state whose active tool is `id`. An unknown `id` leaves the state unchanged. Switching to the active tool is a no-op.
- AC4 [AUTO] When switching, the old tool's `unmount` is called exactly once before the new tool's `mount` is called exactly once (fake tools).
- AC5 [AUTO] Switch state contains only the active tool id (no strokes, no letter history); asserted by checking the state's keys.
- AC6 [MANUAL] The switcher is a bar at the top of the page with one button per registered tool and no project name or logo. With only the letter game registered it shows one button, marked active.
- AC7 [MANUAL] Tapping a switcher button changes the tool area without a page reload (no white flash, address bar unchanged).
- AC8 [AUTO] A test registers a throwaway fake tool and shows it appears in `listTools()` and can be switched to, using only `registerTool` (no edits to registry or switcher code). The fake tool is not shipped.
- AC9 [AUTO] `index.html` `<title>` is exactly "Letters" and no file in `index.html` or `src/` contains the strings "Ramona" or "Alice" (case-insensitive).

### Letter data (52 glyphs)
- AC10 [AUTO] Each glyph is defined in code as stroke data: a list of strokes, each a list of at least 2 `{x, y}` points. No fonts, images or fetches.
- AC11 [AUTO] Glyphs exist for every letter a-z and A-Z (52 total, ids unique), and every point lies within 0..100 on both axes.
- AC12 [AUTO] `resample(stroke, spacing)` returns points at most `spacing` apart along the stroke, including both end points.

### Scoring (pure functions on point lists)
- AC13 [AUTO] `coverage(guide, ink, tolerance)` returns 0..1: the fraction of resampled guide points with at least one ink point within `tolerance`. Empty ink gives 0; ink exactly on the guide gives 1.
- AC14 [AUTO] `strayRatio(guide, ink, tolerance)` returns the fraction of ink points farther than `tolerance` from every guide point. Ink on the guide gives 0; ink entirely away gives 1; empty ink gives 0.
- AC15 [AUTO] `isDone(coverage, strayRatio)` is true when coverage >= 0.85 and strayRatio <= 0.5. Both are named constants (starting values, tunable).
- AC16 [AUTO] For all 52 glyphs, a dense grid of points over the whole 0..100 box is not done (strayRatio above 0.5).
- AC17 [AUTO] For all 52 glyphs, ink equal to the glyph's own stroke points (all strokes) is done.
- AC18 [AUTO] For every glyph with 2 or more strokes, ink equal to only its first stroke is not done.

### Play style A: trace over a guide
- AC19 [MANUAL] The current letter shows as a faint guide on a drawing pad. The child's finger draws a visible line over it.
- AC20 [MANUAL] Drawing with a finger does not scroll or zoom the page.
- AC21 [MANUAL] When the letter is done (AC15) or passed by the parent (AC25), the child sees a visible reward made of text plus a shape, with no sound, and the "Next" button is available.
- AC22 [MANUAL] A "Clear" button wipes the ink so the same letter can be retried.
- AC23 [MANUAL] The current letter's case is shown as visible text (for example "a" and "lowercase").

### Navigation
- AC24 [AUTO] `nextLetter(index, list)` goes in the paired order a, A, b, B, ... z, Z and wraps from Z to a. Applying it 52 times from index 0 returns to index 0, visiting each glyph once. The list order is asserted by a test.
- AC24b [MANUAL] There is a "Next" button and no letter picker or menu of letters. The first letter shown is "a".

### Parent "got it" button
- AC25 [AUTO] A pure `parentHold(state, event, now)` marks the current letter passed only after the parent control has been held continuously for at least `PARENT_HOLD_MS` (named constant, 1000). A press released earlier, or a tap, does not pass the letter. Releasing or leaving the control resets the hold.
- AC26 [AUTO] Passing via the parent control produces the same "done" state as `isDone` returning true, whatever the ink is (including empty ink).
- AC27 [MANUAL] The parent control is labelled with visible text "Parent: got it" (not an icon alone), differs in style from the child's Clear and Next buttons, and sits in a corner away from the drawing pad and from Next.
- AC28 [MANUAL] A quick tap on the parent control does not pass the letter; holding it for 1 second does, with visible progress or feedback while holding.

### Rules from CLAUDE.md
- AC29 [MANUAL] Every button (switcher, Clear, Next, parent control) is at least 48 by 48 CSS px.
- AC30 [AUTO] No file under `src/` or `index.html` contains `http://`, `https://`, `fetch(`, `XMLHttpRequest`, `<script src="http`, `localStorage`, `sessionStorage`, `document.cookie`, or `@import url(`.
- AC31 [MANUAL] In airplane mode, once the page is loaded, the game works fully (true offline reload is a later increment).
- AC32 [AUTO] `package.json` has no `dependencies` or `devDependencies`, and has `"type": "module"`.
- AC33 [MANUAL] Layout is usable in portrait on a phone with no horizontal scrolling.

## Assumptions (owner can overturn)
- Reward is simple: text plus a shape, no sound.
- Portrait-first layout; no left-handed/right-handed work.
- The tech lead may adapt the timer-specific layout in web-rules.md into a tool registry with per-tool folders.
- Page title is "Letters" because a title is required and no name is wanted.
- Hold time 1000 ms and the 0.85 / 0.5 thresholds are starting guesses.

## Out of scope
- Free-draw with reference (style B) and stroke-by-stroke guided order (style C).
- Digits, punctuation, words; a letter picker.
- Handwriting recognition or any judgment that a letter "looks right" beyond AC13-AC15.
- Saving anything: no scores, progress, settings or history.
- The countdown timer or any second shipped tool.
- Sound, themes, service worker / installable app.
- Mouse/desktop polish.

## Open questions for me
1. Do you accept the 1a/1b split above if 52 glyphs do not fit in one session?
2. Are the thresholds (0.85 coverage, 0.5 stray) acceptable, to be tuned on the phone after first play?
3. Is a 1-second hold the right "hard to hit by accident" for the parent control, or would you prefer another approach (for example, hold longer or a two-step tap)?
