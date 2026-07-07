# Examples

## Passing Read-Only Action

```bash
connector-preflight check fixtures/connectors.json fixtures/action.pass.json --format markdown
```

This checks a read-only CRM contact lookup with the required `contacts:read` scope.

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

