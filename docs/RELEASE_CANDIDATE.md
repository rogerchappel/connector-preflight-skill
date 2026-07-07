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

## Release Checklist

- README includes quickstart and safety notes.
- `SKILL.md` documents stop conditions.
- Fixtures cover all verdicts.
- CLI exits non-zero for blocked and missing-scope verdicts.

