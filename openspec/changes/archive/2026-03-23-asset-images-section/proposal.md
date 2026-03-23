## Why

The Assets panel currently shows only Components. But "assets" in a design tool means both reusable components AND embedded images. Users who insert photos/icons as image fills have no way to browse them — they must visually scan the canvas. Figma's Assets panel has a dedicated Images section. We need the same split: Components section + Images section inside the Assets tab.

## What Changes

- Add an **Images section** to the existing AssetsPanel, below the Components section
- Images section shows all unique images from `graph.images` (the `Map<string, Uint8Array>` of imageHash → bytes)
- Each image shows a thumbnail preview (blob URL from the raw bytes), the hash (truncated), and a count of how many nodes reference it
- Click on an image → selects all nodes using that imageHash on the current page
- Drag an image from the panel → drop on canvas → creates a RECTANGLE with IMAGE fill at drop position
- Search filters both components AND images (by node name that uses the image)
- Add `getImageUsages()` method to SceneGraph for efficient image enumeration
- Collapsible "Images" header, same pattern as page group headers

## Capabilities

### New Capabilities
- `asset-images`: Images section in Assets panel with thumbnails, usage count, drag-to-canvas, click-to-select

### Modified Capabilities
- `asset-panel`: Search now covers both components and images; panel has two collapsible top-level sections

## Impact

- `packages/core/src/scene-graph.ts` — new `getImageUsages()` method
- `src/components/AssetsPanel.vue` — add Images section below Components
- `src/components/ImageAssetItem.vue` — new component for image row
- `src/composables/use-canvas-drop.ts` — extend to handle image asset drag (reuse existing image bytes)
- `src/stores/editor.ts` — add `placeImageFromHash()` store action
