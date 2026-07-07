# Release Candidate Notes

## Classification

ship

## Verification

Run:

```bash
npm test
npm run check
npm run smoke
```

2026-07-08 release-candidate verification:

- `npm test`: pass, 7 tests.
- `npm run check`: pass, Node syntax checks.
- `npm run smoke`: pass, rendered the approval-required preflight fixture as Markdown.
- `bash scripts/validate.sh`: pass, runs the full local verification set.

## Release Checklist

- README includes quickstart and safety notes.
- `SKILL.md` documents stop conditions.
- Fixtures cover all verdicts.
- CLI exits non-zero for blocked and missing-scope verdicts.
