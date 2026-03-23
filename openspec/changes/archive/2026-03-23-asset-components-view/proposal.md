## Why

There's no way to browse or search existing components in a document. Users who create reusable COMPONENT / COMPONENT_SET nodes must hunt through the layers tree or remember where they placed them. Figma solves this with an Assets panel that lists all components grouped by page, with search, thumbnail previews, variant expansion for COMPONENT_SETs, and drag-to-canvas insertion. This is a fundamental usability gap — especially as documents grow and accumulate dozens of components.

## What Changes

- Add a **Layers/Assets tab switcher** to the left sidebar bottom section, keeping PagesPanel untouched above
- The **Assets tab** lists all COMPONENT and COMPONENT_SET nodes in the document, grouped by page in collapsible sections
- **COMPONENT_SET nodes expand** to show their child COMPONENT variants — each variant is individually insertable
- Each component shows: **thumbnail preview** (48×48 CanvasKit render), **name** (truncated), **type icon** (◆ component / ▦ set), **instance count** badge, **description** tooltip
- **Search** filters components by name (case-insensitive substring match)
- **Drag-and-drop** from the Assets panel onto the canvas creates an INSTANCE at the drop position
- **Double-click** inserts an instance at viewport center
- **Right-click context menu** with "Go to component", "Insert instance" actions
- Add `getComponentsGroupedByPage()` method to SceneGraph for component enumeration
- Expose a `renderComponentThumbnail()` store method for thumbnail generation
- Fix `createInstanceFromComponent()` parentId to use current page for cross-page insertion
- Add `focusNode(nodeId)` store helper for viewport centering (replaces hardcoded 800×600 in `goToMainComponent`)
- Update `ACP_DESIGN_CONTEXT` system prompt to mention `get_components` and `create_instance` tools

## Capabilities

### New Capabilities
- `asset-panel`: Left-sidebar Assets tab with component browsing, search, variant expansion, thumbnails, drag-to-canvas, click-to-insert, context menu

### Modified Capabilities
- `editor-ui`: Left sidebar bottom section gains Layers/Assets tab switcher
- `components`: SceneGraph gets `getComponentsGroupedByPage()` helper; store gets `focusNode()` + fixes to `createInstanceFromComponent()` cross-page parentId

## Impact

- `packages/core/src/scene-graph.ts` — new `getComponentsGroupedByPage()` method
- `src/stores/editor.ts` — new `leftPanelTab` state, `focusNode()`, `renderComponentThumbnail()`, fix `createInstanceFromComponent()` parentId
- `src/components/LayersPanel.vue` — add TabsRoot/TabsTrigger switching bottom section
- `src/components/AssetsPanel.vue` — new: component listing with search, page groups, empty states
- `src/components/AssetItem.vue` — new: component row with thumbnail, name, type icon, instance count, drag, context menu
- `src/composables/use-component-thumbnails.ts` — new: debounced CanvasKit thumbnail rendering with blob URL lifecycle
- `src/composables/use-canvas-drop.ts` — extend to handle `application/x-openpencil-component` MIME type
- `src/constants.ts` — update `ACP_DESIGN_CONTEXT`
- `tests/engine/scene-graph.test.ts` — new tests for `getComponentsGroupedByPage()`
