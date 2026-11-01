# Design JSX

OpenPencil's design JSX: the elements (`Frame`, `Text`, …) and the trees they build, paint and effect helpers, design variables, the prop schema and authoring reference, component transforms, the string renderer, and `sceneNodeToJSX`/`selectionToJSX` export.

Rules:

- Depend only on `@open-pencil/scene-graph` and `@open-pencil/emit`. Engine work the renderer needs — icon lookup, SVG path conversion, vector node creation, and layout — comes in through `DesignJSXServices` (`src/services.ts`). Core binds them in `packages/core/src/design-jsx/renderer.ts` and exports the bound `renderJSX`, `renderTree`, and `renderRoots` from `@open-pencil/core/design-jsx`.
- The `layout` service receives the rendered roots. A caller that moves them into place afterwards passes `deferLayout` and lays them out once (`packages/core/src/design-jsx/placement.ts`).
- `src/streaming/` parses JSX as it streams in and projects the static subset into trees without evaluating expressions; Core's `packages/core/src/design-jsx/preview/` stages and records those trees on the canvas.
- Each element is one entry in `DESIGN_JSX_ELEMENTS` (`src/elements/index.ts`): its name, the layer type it builds and the types it writes, and its props. The runtime bindings, renderer, export tag, unsupported-prop warnings, schema, and reference read it; do not add a parallel tag or type map (`tests/elements/index.test.ts`).
- An element that draws its own layer, such as `<Sticky>` or `<Connector>`, declares its props as a Valibot `schema` and its renderer as `ownLayer` on its entry; a value that does not fit warns and is left out. Its layer props (`OwnLayerProps`) go through `propsToOverrides` like any layer's, so variables bind; the element reads only its own props (`packages/core/tests/design-jsx/figjam/stickies.test.ts`).
- Export writes each generated frame through `OWN_ELEMENTS`, keyed by `GeneratedFrameType`, so a new generated frame does not compile until it has an exporter (`src/export/index.ts`).
- An enum prop is one `jsxEnum` table in `src/enums.ts` that both reads and writes it, and an unknown value warns instead of falling back silently (`tests/enums.test.ts`).
- JSX export (`src/export/`) collects typed props in `props.ts` and prints them with `@open-pencil/emit`'s JSX builders; never build JSX from string fragments.
- `src/reference/authoring.md` is the source of the shared authoring reference. Run `bun run generate:authoring-reference` after changing it or the schema; never edit the generated copies.
- Tests that need icons, layout, or the bound renderer live in `packages/core/tests/design-jsx` (existing ones still in `tests/engine/render/jsx`); tests of trees, parsing, schema, and export live in `packages/design-jsx/tests`.
