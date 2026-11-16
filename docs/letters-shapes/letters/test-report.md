PASS

Scope tested: Letters, 52 glyphs, round 1 after the owner-requested change (i and j dots pass with a tap; g and y redesigned; glyphs.js only). Earlier rounds fixed the move-scoring performance bug and the failed-mount state bug. Node v22.23.4. Command: `node --test` from repo root (takes about 80 s now because of the all-glyph tap-grid test).
Result of the last full run: 173 tests, 173 pass, 0 fail, 0 todo, 0 skipped, 0 cancelled.
Of those, tests/unit: 53 tests, 53 pass. tests/adversarial: 120 tests, 120 pass. New this round: tests/adversarial/dot-tap.test.js. Updated: the DOM reward test in tests/adversarial/tool-dom.test.js (it encoded the old dot loop).
Docs outside docs/letters were not touched.

## Bugs
No open reproduced bugs. All [AUTO] criteria pass for all 52 glyphs.

What changed in the tests:
- The old DOM test asserted that i and j give no reward before the final lift. That is no longer true by design: the dot is a tap and is scored on pointer down. It now asserts, for all 52 glyphs, that pointermove never changes the reward state (nothing passes mid-stroke), that the first stroke alone gives no reward (A excepted, see recorded behaviours), that the stem alone gives no reward for i and j, and that a finger trace gives the reward after the last lift.
- New DOM test for i and j: the stem alone gives no reward; a tap 13 or 15 units away gives none; a tap on the dot gives it (on press, and it stays after lift); a tap before the stem works too. Another test remaps the pad rectangle (scrolled and resized) and the tap still maps correctly.

Re-checked for all 52 glyphs: own trace passes (points, reversed, finger-style via the reducer, jittered, offset); first stroke only fails for every multi-stroke glyph; dense grids, rasters and zigzag scribbles never pass; stray-heavy ink never passes (60% stray fails, 40% passes); 50% partial traces fail; NaN/undefined/huge ink never passes; nextLetter cycles a,A,...,z,Z,a in 52 steps.
Tap probes (dot-tap.test.js), for i and j:
- Stem plus a tap at offsets 0..5 in 16 directions passes. The tap passes in all 16 directions up to radius 5.5 (measured). Taps at 12, 13, 15, 20, 40 units never pass.
- Taps with 2 or 3 points within 2 units of jitter pass; tap before the stem passes; double tap passes; 50 rapid taps on the dot pass with the stem; 6000 taps stay within the 5000-point cap and Clear recovers.
- Stem alone fails; tap alone fails; 50 rapid taps with no stem fail; a tap at the stem end or middle fails; for j, the stem without its hook plus the dot fails.
- No tap-only path passes any glyph: every single tap on a 1-unit grid from -10 to 110 on both axes against all 52 glyphs; 2 and 3 tap clusters and 50 random taps for all 52; dot-centre tap plus one other tap against every non-dot glyph.

No ESCALATE.

## Recorded behaviours (not bugs against any AC; owner may want to know)
- The dot tap scores on pointer down, so for i and j the reward and Next can appear while the finger is still pressed on the dot. Nothing else scores during a move.
- A tap within about 5.5 units of the dot centre passes; the tolerance is 6 around a tiny cluster.
- Letters that i or j drawings also pass: i->l, j->i, j->l. A single long vertical line (y 15 to 85) passes both l and i, because the dot lies on that line. l alone also passes i.
- g (now one stroke: bowl, stem, hook): tracing g also passes a, c, d, n, o, p, q, u; nothing else makes g pass (not a plain circle, not o, not the bowl alone)..
- y (two arms): tracing y passes no other letter and no other letter passes y; either arm alone fails.
- Cross-letter confusion across the 52: 113 other pairs (was 116), plus the same-letter case pairs B->b, H->h, U->u, W->w (I->i no longer occurs). Full list: 'INFO cross-letter confusion matrix' in tests/adversarial/full-set.test.js diagnostics. As before, the common pattern is that a letter containing another letter's shape passes it: c->o, o->c, e->c, s->c, I->l, l->i, i->l, h->n, n->r, b->h, h->b, O->C, g->q. v->V, w->W, w->u, w->U, u->U, y->Y, z->Z, p->P, s->S and S->s do not cross.
- Partial traces: with 70% of every stroke, a, d, i, K, p, q, r, R, Y pass; with 80%, 35 of 52 pass; 50% passes none.
- p and q pass with their bowl stroke alone; A passes with its two legs (reward after the second leg lifts); k with strokes 1 and 3; m with strokes 2 and 3. AC18 only requires the first stroke alone to fail, and that holds.
- A stroke that never receives pointerup/pointercancel gets no reward and blocks further touches until Clear, Next or a parent pass.
- `isDone('1','0')` returns true; `resample` has no size guard (not reachable in normal play).

## Code-review observations (by reading src/ui.js, src/tools/letters/tool.js, styles.css; NOT reproduced)
1. A lost `pointerup` leaves the pad dead (and, since scoring is now on lift, with no reward). `startStroke` ignores any new down while `activePointerId !== null`, and there is no `lostpointercapture` handler. `pointercancel` is handled. Clear and Next recover it.
2. A hold that is interrupted by the page being hidden may pass on return. `holdLoop` ticks on elapsed time only and does not check that the finger is still down. If the page is backgrounded mid-hold and no pointerup/cancel/leave is delivered, the first tick after resume would pass. Whether browsers deliver pointercancel in that case is unverified.
3. The pad has no `contextmenu` preventDefault and no `user-select`/`-webkit-touch-callout` rule (only the parent button has them). A long-press on the canvas may show a callout or menu on some phones. `touch-action: none` is set, which is correct for AC20.
4. Multi-touch on the pad: a second finger gets `setPointerCapture` but its events are ignored. If the first finger lifts while the second stays down, the second finger's movement draws nothing until a fresh touch. This is acceptable but may feel odd.
5. `tool.js` keeps `controller`, `rafId` and `mountedHost` at module level. A second `mount` without `unmount` would orphan the first instance's listeners. `performSwitch` never does this (same-id switch is a no-op).
6. The reward star's `pop` animation runs at mount while the reward is `visibility:hidden`, so it will not be seen when the reward appears. This is cosmetic and AC21 is still met.
7. `body { overflow-x: hidden }` hides horizontal overflow instead of preventing it. For AC33, check that nothing is clipped, not only that nothing scrolls.
8. Pointer events are not coalesced (`getCoalescedEvents`). A very fast stroke gets gaps, but `resample` interpolates linearly, so scoring is mostly unaffected.
9. Resize/orientation: the backing store is resized from `clientWidth * devicePixelRatio` and redrawn from glyph-space state, so ink survives rotation. This looks correct from the code. `ui.js` previously had no error handling around `performSwitch` (Bug 2 is fixed there: `trySwitch` catches and uses `err.state`).

## MANUAL checklist (run on a phone, portrait; serve over LAN or GitHub Pages)
- [ ] AC6: bar at the top, one button "Letters", shown active, no project name or logo.
- [ ] AC7: tap the Letters button; no reload, no white flash, address bar unchanged.
- [ ] AC19: faint guide visible; finger draws a clearly visible line over it.
- [ ] AC20: drawing on the pad does not scroll or zoom the page, including a stroke that ends outside the pad.
- [ ] AC21: after tracing "a" correctly, the reward appears when the finger lifts (not while drawing): text + star shape, no sound, and Next becomes enabled. Before that, Next is disabled.
- [ ] AC22: Clear wipes the ink; the same letter can be retried; Next goes back to disabled.
- [ ] AC23: "a · lowercase" is visible. Check "A · uppercase" after Next.
- [ ] AC24b: Next button exists, no letter picker; first letter is "a"; order a, A, b, B, c, C, d, D ... z, Z, then back to a (52 letters).
- [ ] AC25/AC28: quick tap on "Parent: got it" does nothing; holding about 1 s fills the bar and passes the letter; sliding the finger off or lifting early resets the bar; a passed letter with empty ink shows the reward.
- [ ] AC27: the parent control is labelled with text, looks different from Clear/Next, and sits in a corner away from the pad and Next.
- [ ] AC29: switcher, Clear, Next and parent buttons are each at least 48x48 CSS px (finger test or devtools).
- [ ] AC31: load the page, switch on airplane mode, play a letter, use Clear and Next.
- [ ] AC33: portrait layout has no horizontal scrolling and nothing clipped on the right.
- [ ] All 52 letters: step through every Next tap and check that each guide is recognisable as the letter named in the label, especially s, S, u, g, j, f (also q, Q, i, I, which were reshaped).
- [ ] Longest letters m, M, w, W (and B, Q, D, N, R): comfortable to trace on a phone with a finger; the reward appears when you lift after a reasonable effort, and a scribble gets none.
- [ ] i and j: draw the stem; confirm no reward. Then tap the dot with a quick press (no dragging) and confirm it passes (the reward may show while the finger is still down). Tap far from the dot (for example near the middle of the stem or the side of the pad) and confirm it does not pass.
- [ ] g and y: look natural and trace naturally with a finger (g in one stroke ending in the left hook; y as two arms with the right arm curving into the descender).
- [ ] Extra (from the observations): scribble hard over the whole pad for 10+ seconds and note any lag (expected: none); long-press the pad and see whether a menu appears; rotate the phone mid-stroke and after tracing; lock the screen during a parent hold and see whether the letter passes on return.
