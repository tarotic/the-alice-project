# Increment brief: Custom time with scrollable pickers

## Story
As a parent, I want to set a custom time by scrolling two wheels (minutes and seconds), like a phone's time picker, so that I can set it quickly with a thumb and never fight the on-screen keyboard.

## Likely reading of the request
"Scrollable selectors" is read as a phone-style time wheel: two vertical columns, one for minutes and one for seconds. The column is flicked or dragged, and it settles with one value centred in a highlighted band. The alternatives were a dropdown (opens a system menu, small targets, 100 entries), or +/- steppers (many taps). They are not chosen, but see open question 1.

"Fix/improve" is read as covering the current pain points: the number keyboard covers the screen, the field must be selected before typing, and partial values are silently ignored with no feedback. If the owner meant a specific bug, it is not known to me (open question 2).

## Behaviour the child/parent sees
- In the idle state, next to the presets, two wheels labelled "min" and "sec" are shown. Each wheel shows the selected value centred, with the neighbouring values visible above and below.
- Minutes run 0 to 99. Seconds run 0 to 59. Each wheel starts at 0 (or at the value of the last chosen preset or custom time).
- Scrolling by touch drag or flick moves the wheel. When it stops, it snaps so one value is exactly centred. That value becomes the chosen one and the timer duration and the displayed remaining time update (same as today's "applies immediately").
- Tapping a visible value in a wheel scrolls it to the centre.
- Choosing a preset moves both wheels to match it (for example 5 sets min 5, sec 0).
- With both wheels at 0 the duration is 0 and Start does nothing (existing AC8). No error text is added.
- Once the timer is running, paused or finished, the wheels are not shown (existing AC18).
- There is no number keyboard and no typing.
- Wheels are plain scrollable HTML/CSS (CSS scroll-snap plus a small JS reader of the scroll position). No library.

## Acceptance criteria
Numbering is local to this brief (CW = custom wheel) so as not to collide with the existing AC numbers.

Logic (node, no browser)
- CW1 [AUTO] A function maps a scroll offset and item height to a wheel index by rounding, clamped to 0..max (max 99 for minutes, 59 for seconds). Offsets below 0 give 0 and offsets beyond the end give max.
- CW2 [AUTO] The inverse (index to scroll offset) round-trips: for every index 0..99 and 0..59, offset(index) maps back to the same index.
- CW3 [AUTO] The wheel's chosen minutes and seconds are passed through the existing custom duration parser (AC11), so the same function decides validity. Any pair from 0..99 and 0..59 other than 0/0 gives minutes*60+seconds. 0/0 is rejected with no state change.
- CW4 [AUTO] Choosing a preset produces wheel positions equal to its minutes and seconds (120 gives 2/0, 180 gives 3/0, 300 gives 5/0, 600 gives 10/0). A custom duration of N seconds gives positions floor(N/60) and N mod 60.

Markup and style (checked from the files)
- CW5 [AUTO] The page has exactly two wheel elements, labelled "min" and "sec", and no `<input type="number">` or `<input type="text">` for custom time.
- CW6 [AUTO] Minute wheel contains 100 items (0 to 99) and the second wheel contains 60 items (0 to 59), each item's text being the value.
- CW7 [AUTO] Each wheel item is at least 48 CSS px tall and each wheel is at least 48 CSS px wide, from the stylesheet or the constants file (extends AC17).
- CW8 [AUTO] The wheels use `scroll-snap-type` with `scroll-snap-align` on items, so snapping is done by the browser.
- CW9 [AUTO] The stylesheet turns off scroll animation and any transition on the wheels inside `@media (prefers-reduced-motion: reduce)`. Programmatic scrolling (preset sync, tap-to-centre) uses instant behaviour when that query matches, tested with a stubbed `matchMedia`.
- CW10 [AUTO] Each wheel has `role="spinbutton"` (or listbox) with an accessible name, `aria-valuenow`, `aria-valuemin` and `aria-valuemax`, and `tabindex="0"`. Arrow Up/Down changes the value by 1 and Page Up/Down by 10, clamped. `aria-valuenow` updates with the value. (Keyboard and screen-reader use; this also makes the wheel testable in node.)
- CW11 [AUTO] When state is running, paused or finished, the wheels are hidden or disabled; when idle they are shown (extends AC13 and AC18).

Hard rules
- CW12 [AUTO] The existing hard-rule tests (AC23 no network, AC24 no storage or cookies, AC25 no dependencies or build step, AC26 banned words) still pass with the new files included in their scan.

On the phone
- CW13 [MANUAL] Dragging a wheel with a thumb scrolls smoothly and, when released, always rests with one value centred, never between two values.
- CW14 [MANUAL] A fast flick on the minutes wheel can reach 99 and return to 0 in a few flicks, without the page behind scrolling or the browser pull-to-refresh triggering.
- CW15 [MANUAL] The centred value is clearly distinguishable from its neighbours (larger or bolder, plus a visible band) when seen at arm's length.
- CW16 [MANUAL] After choosing, say 4 min 30 sec, the remaining-time text shows 04:30 and Start begins counting down from 04:30.
- CW17 [MANUAL] With the phone's reduce-motion setting on, tapping a preset jumps the wheels to the new values with no animated scroll.
- CW18 [MANUAL] In portrait and landscape the wheels, presets and Start all fit with no page scrolling (extends AC19).
- CW19 [MANUAL] No on-screen keyboard appears at any point when setting a custom time.

## Conflicts with existing acceptance criteria
- AC14 [MANUAL] ("custom time can be entered with its on-screen number keyboard") is superseded. It would be replaced by CW13 to CW19. This is a deliberate change that the owner needs to approve. Nothing else in this brief should be applied until it is.
- AC11 [AUTO] stays valid and is reused unchanged (CW3). The wheels cannot produce non-numeric, negative or out-of-range values, so most of its rejections become unreachable from the UI, but the parser keeps them as a safety net. If its tests refer to input elements or text strings from fields, they need review.
- AC17 [AUTO] says "every button and input has a minimum size of 48 by 48". The wheels are scroll containers, not inputs. CW7 restates it for wheels. If the AC17 test locates the custom fields by selector (for example `input`), it will fail or pass vacuously and needs updating.
- AC18 [AUTO] says the idle state shows "custom entry". That wording still holds, now meaning the wheels. If the test looks for the text fields, it needs updating.
- AC13 [AUTO] (controls disabled while running or paused) is kept, and met by CW11. AC12 (exactly four preset buttons) is unchanged.
- AC24 [AUTO]: nothing is stored, no change.
- AC19 [MANUAL] (nothing cut off, no page scrolling): taller wheels might push the layout. CW18 re-checks this.
- The old "tapping a field selects its number" behaviour disappears.

## Out of scope
- Looping (wrap-around) wheels, haptic ticks, sound, and a "select" animation beyond browser snapping.
- Hours, and any range beyond 00:00 to 99:59.
- Typing into a wheel, and any alternative entry method such as a keyboard fallback field.
- Remembering the last custom time (increment 8).
- Visual changes to the ring, finish state or presets.
- Third-party picker libraries and anything that needs a network or a build step.

## Open questions for the owner
1. Is a two-wheel time picker (minutes and seconds) what you meant, rather than a dropdown or +/- buttons?
2. Is there a specific thing that feels broken today (for example the keyboard covering the ring, the number being hard to select, or partial values being ignored)? That would change what "fix" means.
3. Should seconds move in steps of 1 (60 positions, assumed) or steps of 5 (12 positions, quicker for a thumb)?
4. Should the wheels do nothing when set to 0/0, or should Start be visibly disabled (assumed: nothing; existing AC8)?
5. Is approving the replacement of AC14 okay?
6. Should the wheels apply on each stop (assumed, as today) or only after a separate "Set" button?
