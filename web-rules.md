# Web conventions (engineer and tester read this)

## Layout
```
index.html
src/
  timer.js        pure logic, no DOM, fully unit-testable (start, pause, reset, remaining, progress 0..1)
  ui.js           thin DOM wiring only
  views/          one file per visual representation, each takes progress 0..1 and draws
styles.css
tests/
  unit/           engineer-written tests
  adversarial/    tester-written tests
docs/             requirements.md, plan.md, test-report.md
```

## Rules
- Logic that decides anything lives in pure functions with injected time (pass `now`), so tests never wait.
- Every visual is a function of `progress` (0..1) only. Same input, same picture.
- Use `node --test` (built-in runner, zero dependencies). ES modules (`"type": "module"` in package.json).
- No dependencies. If one seems needed, stop and ask.
- Keep functions small and named for what a child-facing feature does.
- Accessibility: visible text of remaining time, sufficient contrast, respect prefers-reduced-motion.
- Visuals and feel cannot be auto-verified. The tester writes a MANUAL checklist for me to run on the phone.
