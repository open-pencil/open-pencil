# Scene graph (`packages/scene-graph`)

SceneGraph, node types, copy/snap/undo helpers, variables, instances, hit testing. Framework-agnostic.

- Nodes live in flat `Map<string, SceneNode>`, tree via `parentIndex` references
- Frames clip content by default is OFF (unlike what you'd assume)
- When creating auto-layout, sort children by geometric position first
- Dragging a child outside a frame should reparent it, not clip it
- Layer panel tree must react to reparenting — watch for stale children refs
- Groups: creating a group must preserve children's visual positions

## Shared types

- Shared geometry/color primitives live in `packages/scene-graph/src/primitives.ts`; scene/node domain types live in `packages/scene-graph/src/types.ts` and are exported from `@open-pencil/scene-graph`.
- Import `SceneNode` / `Effect` / `Fill` / `Stroke` from `@open-pencil/scene-graph` instead of re-spelling their shapes.

## Components & instances

- Purple (#9747ff) for COMPONENT, COMPONENT_SET, INSTANCE — matches Figma
- Instance children map to component children via `componentId` for 1:1 sync
- Override key format: `"childId:propName"` in instance's `overrides` record
- Editing a component must propagate to instances through the editor/component sync path; do not hand-copy instance fields in app UI code.
- Instance property copying lives in `@open-pencil/scene-graph` helpers and uses structured copies for nested values.
