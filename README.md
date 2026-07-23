# connector-preflight-skill

`connector-preflight-skill` checks whether a planned connector action is ready to execute. It reads local connector manifests and an intended action request, then returns a deterministic verdict: `pass`, `needs-approval`, `missing-scope`, or `blocked`.

## Quickstart

```bash
npm install
npm test
node bin/connector-preflight.js check fixtures/connectors.json fixtures/action.needs-approval.json --format markdown
node bin/connector-preflight.js inspect fixtures/connectors.json
npm run release:check
```

## Commands

- `connector-preflight inspect <connectors.json>` lists available connectors and capabilities.
- `connector-preflight check <connectors.json> <action.json> --format markdown` renders a reviewable preflight report.
- `connector-preflight check <connectors.json> <action.json> --format json` emits machine-readable output.
- `connector-preflight --help` prints command usage.
- `connector-preflight --version` prints the package version.

## Action Request

```json
{
  "connector": "crm-lite",
  "capability": "contact.update",
  "scopes": ["contacts:write"],
  "approval": "missing",
  "dryRun": true
}
```

Every action request must be a JSON object with:

- `connector` and `capability`: non-empty strings.
- `scopes`: an array of non-empty strings. Use `[]` to explicitly request no scopes.
- `approval`: one of `granted`, `missing`, or `not-required`.
- `dryRun`: a boolean.

Each manifest capability must define `name`, `requiredScopes`, `requiresApproval`, and `sideEffect`. `requiredScopes` is an array of non-empty strings; use `[]` to explicitly declare a capability that needs no scopes. Both policy flags are booleans. `blocked` is an optional boolean policy flag.

Incomplete or wrongly typed action or capability data produces a deterministic `blocked` verdict. The CLI prints the diagnostics and exits with status 2.

## Verification

Run the same checks used for release-readiness before publishing or opening a release PR:

```bash
npm run check
npm test
npm run smoke
npm run release:check
npm pack --dry-run
```

CI runs `npm run release:check` on pull requests and pushes to `main`, including the package smoke that verifies publish contents.

## Safety Notes

This tool never executes the connector action. It only evaluates local manifests and local action requests. A `pass` verdict means the local preflight checks passed; it is not a guarantee that the live connector will succeed.

## Limitations

- JSON manifests only in V1.
- No OAuth, credential checks, or network calls.
- Policies are embedded in connector manifests rather than fetched from a service.
