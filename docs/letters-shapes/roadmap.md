# Roadmap

One line per increment, each finishable in one working session. Only the NEXT one has requirements (docs/requirements.md). Letters history is archived in docs/letters/.

## Increments
1. [done] 1a: app shell, switcher, registry, scoring, parent hold button, first 12 letter glyphs.
2. [done] 1b: the remaining 40 letter glyphs (all 52, paired order).
3. [NEXT] Shapes tool: six traceable shapes (circle, square, triangle, rectangle, oval, star) as the second switcher tool.

## Later ideas (not scoped, order not decided)
- More shapes (heart, diamond, pentagon, and so on).
- A numbers tool (trace 0-9), same play style.
- Countdown timer tool, from the original seed brief (docs/idea.md).
- Free-draw beside a reference letter or shape, no scoring.
- Guided stroke order with start dot and direction for letters.
- Letter picker, only if the owner reverses "Next only".
- Offline reload support (service worker), only if the owner wants install-to-home-screen.

## Honest note on "correct"
The tools never decide a letter or shape "looks right". They measure how much of the guide the child covered and how much ink fell far from it, and a parent can override with the hold button.
