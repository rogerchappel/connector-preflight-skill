# Examples

## Passing Read-Only Action

```bash
connector-preflight check fixtures/connectors.json fixtures/action.pass.json --format markdown
```

This checks a read-only CRM contact lookup with the required `contacts:read` scope.

A capability that needs no scopes must still declare `"requiredScopes": []`, and its action must provide `"scopes": []`. The capability must also declare boolean `requiresApproval` and `sideEffect` values; the action must provide an `approval` state and boolean `dryRun`.

## Approval Required

```bash
connector-preflight check fixtures/connectors.json fixtures/action.needs-approval.json --format markdown
```

This reports `needs-approval` because `contact.update` has side effects and the action request does not include granted approval.

## Stop Conditions

```bash
connector-preflight check fixtures/connectors.json fixtures/action.missing-scope.json --format json
connector-preflight check fixtures/connectors.json fixtures/action.blocked.json --format json
```

Both commands should stop a live connector workflow.

Malformed or incomplete input is also a stop condition. For example, an action without `scopes`, `approval`, and `dryRun` returns `blocked`, lists each invalid field in a stable order, and exits with status 2:

```json
{
  "connector": "crm-lite",
  "capability": "contact.read"
}
```
