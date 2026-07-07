# connector-preflight-skill

`connector-preflight-skill` checks whether a planned connector action is ready to execute. It reads local connector manifests and an intended action request, then returns a deterministic verdict: `pass`, `needs-approval`, `missing-scope`, or `blocked`.

## Quickstart

```bash
npm install
npm test
node bin/connector-preflight.js check fixtures/connectors.json fixtures/action.needs-approval.json --format markdown
node bin/connector-preflight.js inspect fixtures/connectors.json
```

## Commands

- `connector-preflight inspect <connectors.json>` lists available connectors and capabilities.
- `connector-preflight check <connectors.json> <action.json> --format markdown` renders a reviewable preflight report.
- `connector-preflight check <connectors.json> <action.json> --format json` emits machine-readable output.

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

## Safety Notes

This tool never executes the connector action. It only evaluates local manifests and local action requests. A `pass` verdict means the local preflight checks passed; it is not a guarantee that the live connector will succeed.

## Limitations

- JSON manifests only in V1.
- No OAuth, credential checks, or network calls.
- Policies are embedded in connector manifests rather than fetched from a service.

