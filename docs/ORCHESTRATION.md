# Orchestration

## Agent Flow

1. Draft the intended connector action as JSON.
2. Select the relevant connector manifest.
3. Run `connector-preflight check`.
4. Treat `blocked` and `missing-scope` as stop conditions.
5. Treat `needs-approval` as a human handoff.
6. Preserve the report with the run artifacts.

## Failure Handling

- Unknown connector or capability: stop and revise the action request.
- Missing scopes: request narrower action or updated scopes.
- Approval missing: ask before any live side effect.

## External Actions

This project does not execute external actions and should be used before any separate execution tool.

