# connector-preflight-skill

`connector-preflight-skill` checks whether a planned connector action is ready to execute. It reads local connector manifests and an intended action request, then returns a deterministic verdict: `pass`, `needs-approval`, `missing-scope`, or `blocked`.

## Quickstart

```bash
npm ci
npm test
node bin/connector-preflight.js check fixtures/connectors.json fixtures/action.pass.json --format markdown
node bin/connector-preflight.js inspect fixtures/connectors.json
npm run release:check
```

The primary sequence uses a passing action so every command is reached in a fail-fast shell.

### Needs-approval example

Non-pass verdicts intentionally stop shell and CI automation. This example reports `needs-approval` and exits with the documented status:

```bash
node bin/connector-preflight.js check fixtures/connectors.json fixtures/action.needs-approval.json --format markdown
# expected status: 2
```

## Commands

- `connector-preflight inspect <connectors.json>` lists available connectors and capabilities.
- `connector-preflight check <connectors.json> <action.json> [--format markdown|json]` checks an action. JSON is the default; `markdown` renders a reviewable report.
- `connector-preflight check <connectors.json> <action.json> --format json` emits machine-readable output.
- `connector-preflight --help` prints command usage.
- `connector-preflight --version` prints the package version.

### Exit codes

`check` uses a fail-closed exit-code contract for shell and CI automation:

| Verdict | Exit status | Meaning |
| --- | ---: | --- |
| `pass` | 0 | Local preflight checks passed. |
| `needs-approval` | 2 | Stop until explicit approval is granted. |
| `missing-scope` | 2 | Stop until all required scopes are supplied. |
| `blocked` | 2 | Stop because policy or input validation blocked the action. |

Status 0 therefore means only `pass`; callers must not treat any other verdict as ready to execute. CLI usage errors—including unknown flags, extra positionals, duplicate options, and missing option values—or file/JSON errors exit with status 1 and write a diagnostic to stderr without producing a verdict or report. `inspect` exits 0 on success and 1 on invalid input.

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

A manifest must be a JSON object with a `connectors` array. Every connector is an object with a non-empty string `id` and a `capabilities` array. Connectors may also define a non-empty string `name` and a `sideEffects` array containing only non-empty strings; when omitted, inspection falls back to the connector ID and an empty side-effect list. Every capability is an object with a non-empty string `name`. Connector IDs must be unique across the manifest, and capability names must be unique within their connector. Duplicate identities are reported with the indexes of both definitions and invalidate the entire manifest before lookup.

For `check`, incomplete or wrongly typed action, connector, or capability data produces a deterministic `blocked` verdict. The CLI prints the diagnostics and follows the exit-code contract above. `inspect` prints malformed-manifest diagnostics to stderr and exits with status 1.

## Verification

Start from a clean checkout and run the same frozen install and checks used by CI before publishing or opening a release PR:

```bash
npm ci
npm run release:check
```

`npm ci` fails if `package.json` and `package-lock.json` drift, and it installs exactly the committed dependency graph. CI uses this same command on pull requests and pushes to `main`, then runs `npm run release:check`, including the package smoke that verifies publish contents.

## Safety Notes

This tool never executes the connector action. It only evaluates local manifests and local action requests. A `pass` verdict means the local preflight checks passed; it is not a guarantee that the live connector will succeed.

## Limitations

- JSON manifests only in V1.
- No OAuth, credential checks, or network calls.
- Policies are embedded in connector manifests rather than fetched from a service.
