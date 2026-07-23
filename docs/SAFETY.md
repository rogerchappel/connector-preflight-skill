# Safety

`connector-preflight-skill` is a local preflight tool. It should run before any separate execution tool that can affect external state.

## Safe Uses

- Checking whether a planned connector action has the required scopes.
- Producing a human-readable approval packet.
- Blocking actions that manifests mark as unavailable.
- Separating dry-run planning from execution.

## Stop Conditions

- Verdict is `blocked`.
- Verdict is `missing-scope`.
- Verdict is `needs-approval` and no explicit human approval has been granted.
- The action request does not set `dryRun: true` and the capability has side effects.
- The action request omits or mistypes `connector`, `capability`, `scopes`, `approval`, or `dryRun`.
- The selected capability omits or mistypes `requiredScopes`, `requiresApproval`, or `sideEffect`.

## Validated Shapes

An action must provide non-empty string `connector` and `capability` values, an array of non-empty string `scopes`, an `approval` value of `granted`, `missing`, or `not-required`, and a boolean `dryRun`.

A capability must provide a non-empty string `name`, an array of non-empty string `requiredScopes`, and boolean `requiresApproval` and `sideEffect` policy values. Empty scope arrays are valid and explicitly mean that no scopes are requested or required. Missing fields never inherit permissive defaults.

## Sharing Guidance

Reports may mention private connector names, scopes, or internal workflow details. Review before posting outside the local workspace.
