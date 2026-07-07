# PRD

## Problem

Agents need a reliable checkpoint before using connectors with side effects. Without a preflight, missing scopes or approvals may only surface after a live action has already been attempted.

## Goal

Provide a local-first CLI and skill that checks connector action readiness from manifests and action requests.

## Users

- Agent builders implementing connector workflows.
- Maintainers reviewing proposed external actions.
- Operators preparing dry-run plans for CRM, messaging, and project-management tools.

## V1 Features

- Inspect connector manifests.
- Check requested connector, capability, scopes, approval state, and blocked capabilities.
- Render Markdown and JSON preflight reports.
- Include fixtures and tests.

## Non-Goals

- Live connector execution.
- Credential handling.
- OAuth.
- Automatic approval.

