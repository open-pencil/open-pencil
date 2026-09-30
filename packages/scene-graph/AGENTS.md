# Scene Graph

Framework-neutral document model. Owns node types, primitives, geometry, matrices, copy/snap/undo helpers, variables, instances, hit testing, and checkpoint recovery.

- Nodes live in a flat `Map<string, SceneNode>`; runtime hierarchy uses `parentId` and `childIds`. Frames do not clip by default.
- Geometry is built on the matrices in `packages/scene-graph/src/matrix.ts` and `packages/scene-graph/src/coordinate.ts` (`getWorldMatrix`, `getAxisAlignedWorldBounds`, `getNodeLocalMatrix`). Add new transform, bounds, or inverse helpers here beside them; do not interpret ancestor rotations or reflections independently elsewhere. LINE pivots remain at the origin; other nodes rotate around their centers.
- Bounds accumulation goes through the helpers in `packages/scene-graph/src/geometry.ts` (`computeBounds`, `computeAbsoluteBounds`, `computeVisualBounds`); do not add another min/max loop.
- Reparenting preserves child world positions; groups preserve them too. Sort children geometrically before creating auto-layout. Consumers such as layer trees must react to reparenting rather than retaining stale child references.
- Use the copy helpers in `packages/scene-graph/src/copy.ts` for nested values (fills, strokes, effects); never hand-copy node properties.
- Instance children map to component children through `componentId`; runtime overrides use the structured `InstanceOverrideState` (`self` and `descendants` maps) in `packages/scene-graph/src/instance-overrides.ts`.
- Shared primitives that format packages need live here: color conversion and management under `@open-pencil/scene-graph/color` and text/layout direction under `@open-pencil/scene-graph/text-direction`.
- Vector network types live here; the reverse-engineered `vectorNetworkBlob` codecs live in `packages/core/src/vector/`.
- `packages/scene-graph/src/checkpoint.ts` owns transaction checkpoint recovery, including hierarchy and indexes; Core's atomic tool execution relies on it.
- Export named types and primitives (`Color`, `Vector`, `Rect`, `SceneNode`, `Effect`, `Fill`, `Stroke`) from the public entry; downstream packages reuse them instead of respelling shapes.
