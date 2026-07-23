# Connector Preflight Skill

Use this skill before an agent invokes a connector that may read private data, write external state, send messages, update CRM/project-management records, or trigger a workflow.

## Required Inputs

- A local connector manifest JSON file.
- A local action request JSON file.
- An action object with non-empty string `connector` and `capability` fields, a `scopes` array of non-empty strings, an `approval` value of `granted`, `missing`, or `not-required`, and a boolean `dryRun`.
- A selected manifest capability with a non-empty string `name`, a `requiredScopes` array of non-empty strings, and boolean `requiresApproval` and `sideEffect` fields.

Use an empty array (`[]`) to explicitly represent no requested or required scopes. Do not omit scope arrays or policy booleans; malformed or incomplete data is blocked.

## Side-Effect Boundaries

This skill is preflight only. It must not call live connector APIs, store credentials, request OAuth tokens, or mark an action as approved.

## Workflow

1. Load the connector manifest.
2. Load the planned action request.
3. Run `connector-preflight check <connectors.json> <action.json> --format markdown`.
4. Stop if the verdict is `blocked` or `missing-scope`.
5. Ask for explicit approval if the verdict is `needs-approval`.
6. Continue only when the downstream workflow separately authorizes execution.

## Approval Requirements

Human approval is required for any connector action with side effects unless the manifest explicitly says approval is not required and the action request is dry-run only.

## Examples

```bash
connector-preflight inspect fixtures/connectors.json
connector-preflight check fixtures/connectors.json fixtures/action.pass.json --format json
```

## Verification

Run `npm test`, `npm run check`, and `npm run smoke` before release.
