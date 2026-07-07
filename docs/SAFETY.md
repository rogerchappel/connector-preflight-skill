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

## Sharing Guidance

Reports may mention private connector names, scopes, or internal workflow details. Review before posting outside the local workspace.

