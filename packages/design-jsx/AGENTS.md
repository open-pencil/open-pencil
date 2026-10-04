# Design JSX

OpenPencil's design JSX: the elements (`Frame`, `Text`, …) and the trees they build, paint and effect helpers, design variables, the prop schema and authoring reference, component transforms, the string renderer, and `sceneNodeToJSX`/`selectionToJSX` export.

Rules:

- Depend only on `@open-pencil/scene-graph` and `@open-pencil/emit`. Engine work the renderer needs — icon lookup, SVG path conversion, vector node creation, and layout — comes in through `DesignJSXServices` (`src/services.ts`). Core binds them in `packages/core/src/design-jsx/renderer.ts` and exports the bound `renderJSX` and `renderTree` from `@open-pencil/core/design-jsx`.
- `src/streaming/` parses JSX as it streams in and projects the static subset into trees without evaluating expressions; Core's `packages/core/src/design-jsx/preview/` stages and records those trees on the canvas.
- JSX export (`src/export/`) collects typed props in `props.ts` and prints them with `@open-pencil/emit`'s JSX builders; never build JSX from string fragments.
- `src/reference/authoring.md` is the source of the shared authoring reference. Run `bun run generate:authoring-reference` after changing it or the schema; never edit the generated copies.
- Tests that need icons, layout, or the bound renderer live in `packages/core/tests/design-jsx` (existing ones still in `tests/engine/render/jsx`); tests of trees, parsing, schema, and export live in `packages/design-jsx/tests`.
