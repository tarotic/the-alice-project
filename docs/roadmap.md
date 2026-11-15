# Roadmap

Each line is one increment, finishable in one session. Only increment 1 has requirements so far.

## Visual options for the timer (human picks which goes first)
| Option | What the child sees | Notes |
|---|---|---|
| A. Shrinking ring/pie | A colored disc or ring that loses a slice as time passes | Reads at a glance, works in portrait and landscape. Proposed for increment 1. |
| B. Draining bar | A wide bar that empties left to right (or top to bottom) | Simplest to build. Landscape-friendly. |
| C. Filling jar | A jar that fills (or empties) with colored liquid | Most playful and most work (drawing, level animation). |

## Increments
1. Core timer + ONE visual (default: shrinking ring): presets, custom time, start, pause, resume, reset, remaining time text, finish state. (requirements written: docs/requirements.md)
2. Second visual (draining bar) plus a way to switch visuals without losing the running timer.
3. Third visual (filling jar).
4. Finish polish: gentle finish cue (optional vibration and/or soft sound, off by default, no audio files fetched).
5. Offline support: service worker + manifest so it installs to the home screen and works with no signal.
6. Keep-screen-awake while running (Wake Lock, with graceful fallback) and landscape/portrait layout pass.
7. Parent lock: stop the child changing the duration or leaving mid-run by accident (shape decided with the human).
8. Remember last visual and last duration on the device (localStorage only, nothing leaves the phone).
9. Deploy to GitHub Pages and verify on the real phone.

Order after increment 3 is a proposal and can change after each review.
