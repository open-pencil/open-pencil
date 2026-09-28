# Figma API

`FigmaAPI` mimics Figma's Plugin API over the SceneGraph. `openpencil eval`, the AI and MCP tools, and the app bind to it. Tests live under `tests/engine/figma/api/` and mirror the API surface.

- **Shape follows Figma.** Match `@figma/plugin-typings` at the version pinned in the root `package.json`. `packages/core/src/figma-api/compatibility.ts` type-checks the supported surface against `PluginAPI`; add every new member to `SupportedPluginAPI` there. Model unsupported members explicitly rather than approximating them.
- **Behavior follows Figma.** Read the Plugin API documentation for the member, and for anything observable (geometry, ordering, defaults, errors) run the same script in live Figma and record the observed result in the test. `figma-use` and `tests/figma/` are the live oracle; `tests/fixtures/figma-oracles/` holds recorded values.
- **User actions are shared code.** When an editor command does the same thing (group, ungroup, boolean, flatten, instance creation, component sync), call the implementation under `packages/core/src/editor/` or its shared helper. Do not reimplement geometry, placement, or propagation here; new geometry helpers belong in Scene Graph.
- Node proxies live in `packages/core/src/figma-api/proxy.ts` and `packages/core/src/figma-api/accessors/`; `packages/core/src/figma-api/render-bounds.ts` implements Figma's `absoluteRenderBounds` semantics and is the only geometry that is Figma-specific.
- `packages/core/src/figma-api/index.ts` stays under the 600-line limit by moving whole domains into sibling modules such as `components.ts` and `text.ts`, not by extracting generic helpers into this folder.
