## Context

Retrospective doc sync — code is merged and tested. Key structural change: `docs/` → `packages/docs/` as `@open-pencil/docs` workspace package. Repo org changed: dannote/open-pencil → open-pencil/open-pencil.

## Goals / Non-Goals

**Goals:** Update specs and docs to match current codebase state. Fix stale `docs/` paths.

**Non-Goals:** Code changes. New features. Restructuring specs.

## Decisions

1. **Bulk path replacement** `docs/` → `packages/docs/` in specs — mechanical, low risk.
2. **Minimal delta specs** — only MODIFIED requirements for changed behavior, no padding.
3. **AGENTS.md updates** — new commands paths, docs package mention.
