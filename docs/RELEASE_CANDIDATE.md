# Release Candidate Notes

## Classification

ship

## Verification

Run:

```bash
npm ci
npm run release:check
```

Run these commands from a clean checkout. The frozen install detects drift between `package.json` and `package-lock.json`; `release:check` runs syntax checks, tests, the CLI smoke test, and the package-content smoke test.

2026-07-08 release-candidate verification:

- `npm test`: pass, 7 tests.
- `npm run check`: pass, Node syntax checks.
- `npm run smoke`: pass, rendered the approval-required preflight fixture as Markdown.
- `bash scripts/validate.sh`: pass, runs the full local verification set.

## Release Checklist

- README includes quickstart and safety notes.
- `SKILL.md` documents stop conditions.
- Fixtures cover all verdicts.
- CLI exits 0 only for `pass` and exits 2 for `needs-approval`, `missing-scope`, and `blocked` verdicts.
