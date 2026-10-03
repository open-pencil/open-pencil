---
title: Native JavaScript APIs
description: Find OpenPencil's public document, editor, layout, and design-authoring APIs.
---

# Native JavaScript APIs

OpenPencil's native APIs are the ordinary JavaScript libraries used by the editor itself. There is no separate RPC-style authoring language or parallel agent implementation.

| Responsibility | Public entry point | Start here |
| --- | --- | --- |
| Document nodes, hierarchy, variables, instances, geometry | `@open-pencil/scene-graph` | [Scene Graph](../reference/scene-graph) |
| Editing actions, selection, undo, component properties, events | `@open-pencil/core/editor` | `createEditor()` and its inferred `Editor` type; [custom editor shell](./sdk/guides/custom-editor-shell) |
| Declarative scene construction | `@open-pencil/design-jsx` for elements, helpers, and JSX export; `@open-pencil/core/design-jsx` to render them | [JSX guide](./jsx-renderer) and [authoring reference](../reference/design-authoring) |
| Layout computation | `@open-pencil/core/layout` | `computeLayout(graph, frameId)` and `computeAllLayouts(graph, scopeId)` |
| Figma-compatible scripting | `@open-pencil/core/figma-api` | [Compatibility](../reference/figma-compatibility) |
| Schema-backed agent operations | `@open-pencil/core/tools` | [MCP](./mcp-server) |

Use the owning package's public exports, not workspace source paths. Package declarations describe the current callable signatures; the table above identifies ownership rather than duplicating every method.

## Mutation boundaries

Graph operations are low-level document mutations. They do not automatically constitute an editor undo transaction. Use editor actions for interactive edits that need selection, undo, component synchronization, and layout orchestration. Direct layout functions compute geometry; they are not replacements for editor actions.

## Agent access

Library imports, agent tools, and the `eval` scripting environment are distinct entry points. The installed execution environment determines which objects and functions an agent can access. Do not assume `graph`, `editor`, or arbitrary package imports are available in `eval` simply because those APIs exist in the library. Existing Figma-compatible scripting remains supported.

Shared authoring guidance is maintained in Core and composed into chat/codegen prompts and the installable skill. Examples belong with their implementation and should be exercised against the public API.
