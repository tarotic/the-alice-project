# Increment 1: Core countdown timer with shrinking ring

## Story
As a parent, I want to set a countdown time and hand the phone over so that my child can watch a ring shrink and see when time is up.

## Assumptions (change if you disagree; see open questions)
- Visual for this increment is the shrinking ring (option A).
- Presets are 2, 3, 5 and 10 minutes (decided).
- Finished look is a colour change plus the text "Done" (decided).
- The ring is drawn as two parts: a track (a full circle outline, always present) and a progress arc (the part that shrinks, per AC16). In the finished state the progress arc is empty and the track is drawn in the finished colour.
- Custom entry is minutes and seconds, from 00:01 to 99:59 (provisional).
- Manual checks use a static server on the laptop over home Wi-Fi; deployment to GitHub Pages is increment 9.

## Acceptance criteria
Each is a checkable fact. Tag how it is verified: [AUTO] node test, or [MANUAL] I check on the phone.

Timer logic (testable in node without a browser, using a fake clock)
- AC1 [AUTO] Creating a timer with a duration of N seconds starts in state "idle" with remaining time N seconds.
- AC2 [AUTO] After start, with the fake clock advanced by T seconds (T < N), remaining time is N - T seconds and state is "running".
- AC3 [AUTO] Remaining time is computed from clock timestamps, not by counting ticks: advancing the fake clock by 30 s in one jump gives remaining = N - 30.
- AC4 [AUTO] After pause, advancing the clock does not change remaining time and state is "paused".
- AC5 [AUTO] After resume, the countdown continues from the paused remaining time (pause for 60 s does not consume any time).
- AC6 [AUTO] When elapsed time reaches or exceeds N, remaining time is exactly 0, state is "finished", and it never goes negative.
- AC7 [AUTO] Reset from running, paused or finished returns state to "idle" with remaining time equal to the last chosen duration.
- AC8 [AUTO] Start is ignored when the duration is 0 or when already running; pause is ignored unless running; resume is ignored unless paused.
- AC9 [AUTO] Fraction remaining (remaining / duration) is 1 at start, 0.5 at half time, 0 at finish, and always within 0 to 1.
- AC10 [AUTO] Time formatting: 65 s shows "01:05", 600 s shows "10:00", 0 s shows "00:00", 5999 s shows "99:59".
- AC11 [AUTO] Custom duration parsing: minutes 0-99 and seconds 0-59 give minutes*60+seconds; total 0, negative, non-numeric, seconds above 59, or total above 5999 are rejected with no state change.

Presets and custom time
- AC12 [AUTO] The page contains exactly four preset buttons labelled 2, 3, 5 and 10 minutes; choosing one sets the duration and remaining time to that value (120, 180, 300, 600 seconds).
- AC13 [AUTO] Choosing a preset or custom time while running or paused is not possible (controls disabled) until reset.
- AC14 [MANUAL] A custom time can be entered on the phone with its on-screen number keyboard and applied.

Display and controls
- AC15 [AUTO] The page shows remaining time as mm:ss text, updated at least once per second while running.
- AC16 [AUTO] The progress arc's drawn amount is derived from the fraction remaining (AC9): a full arc at 1, none at 0.
- AC17 [AUTO] Every button and input (presets, custom entry, start, pause/resume, reset) has a minimum size of 48 by 48 CSS px, checked from the stylesheet or markup.
- AC18 [AUTO] Controls shown per state: idle shows presets, custom entry and Start; running shows Pause and Reset; paused shows Resume and Reset; finished shows Reset only.
- AC19 [MANUAL] On the phone the remaining time is readable from arm's length (about 60 cm) in both portrait and landscape, with nothing cut off or needing scroll.
- AC20 [MANUAL] The ring visibly shrinks smoothly while running, with no jumps larger than one second's worth of ring.

Finish state
- AC21 [AUTO] When state is "finished", the page shows the text "Done" and the time "00:00", the progress arc is empty (consistent with AC16), and the ring track is drawn in the single finished colour, not the running colour.
- AC21a [AUTO] The finished colour and the running colour are defined as named constants in the stylesheet (or a JS constants file); they are not equal, and the finished colour has a contrast ratio of at least 3:1 (WCAG non-text) against the page background colour, computed by the test from the constants.
- AC21b [AUTO] The "Done" text colour has a contrast ratio of at least 4.5:1 against the page background, computed from the constants.
- AC22 [MANUAL] The finish state is clearly different from a running timer when glanced at from arm's length (child can tell it has ended).

Hard rules
- AC23 [AUTO] No file in the deployable site contains "http://" or "https://" references that load resources (no external scripts, fonts, CDNs, images, fetch, XMLHttpRequest, WebSocket, sendBeacon).
- AC24 [AUTO] No analytics, cookies, or localStorage use appears in the code (nothing stored this increment).
- AC25 [AUTO] The site is plain static HTML, CSS and JS files served as-is; no build step, no bundler, no package dependencies. For manual checks it is served over http from the laptop on home Wi-Fi (for example with a one-line static server such as python -m http.server), and the phone opens that address. [AUTO] check: only .html/.css/.js files in the site, no build script, no dependencies in package.json, module imports are relative paths ending in .js.
- AC26 [AUTO] No file in the scanned set contains a banned word, case-insensitive. Banned words are defined only in tests/unit/no-child-details.test.js. Scanned set: index.html, styles.css, src/**, tests/**, docs/requirements.md, docs/plan.md, docs/test-report.md (if present), excluding tests/unit/no-child-details.test.js. Excluded (human-written or pipeline setup): docs/idea.md, docs/roadmap.md, CLAUDE.md, web-rules.md, .claude/**, templates/**. The words 'child' and 'kid' are allowed.
- AC27 [MANUAL] With the phone in airplane mode after the page has been opened once, the timer still works. (Full offline install is increment 5; this only checks the already-open page.)

## Out of scope
- Second and third visuals (bar, jar), and any switcher between visuals.
- Sound, vibration, notifications, or any finish cue beyond the visual finish state (colour change plus "Done"); no finish animation.
- Ring colour changing as time runs low (only running colour and finished colour exist).
- Service worker, manifest, home-screen install, GitHub Pages deployment.
- Keep-screen-awake, parent lock, saved settings.
- Multiple timers, alarms, stopwatch, other tools or games.
- Accounts, analytics, ads, tracking, Android app.

## Open questions for me
1. Which visual first: ring (proposed), bar, or jar?
2. Custom time range: is 00:01 to 99:59 fine?
3. Should the finished state stay until reset (assumed yes, no auto-return to idle)?
4. Colours: which colour for the running ring and which for the finished ring? Colour-blind friendly choices matter. If you have no preference, the tech lead picks a default pair that meets AC21a.
5. Should remaining time text be visible by default, or hidden so the visual is the main thing? (Assumed visible.)
6. If the page is sent to the background or the phone sleeps while running, should the timer keep true time (assumed yes, from timestamps) and show Done on return?
7. Is the screen sleeping during a run acceptable for now (deferred to increment 6)?

Answered: presets are 2, 3, 5, 10 minutes; finished look is colour change plus "Done"; manual checks use a laptop static server on home Wi-Fi (AC25); the banned-word list for AC26 lives only in tests/unit/no-child-details.test.js.
