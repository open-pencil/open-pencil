## Context

`graph.images` is a `Map<string, Uint8Array>` — keys are SHA-256 hashes, values are raw image bytes (PNG/JPEG/WEBP). When a user places an image, `storeImage()` computes the hash and stores bytes. Nodes reference images via `fill.imageHash` in their fills array. Multiple nodes can share the same imageHash (same image placed multiple times).

The existing AssetsPanel has: search input → empty states → scrollable list of component page groups. We need to add an Images collapsible section after the components.

## Goals / Non-Goals

**Goals:**
- Images section in AssetsPanel showing all unique images from `graph.images`
- Each image: thumbnail (blob URL from raw bytes), truncated hash as name, usage count (nodes referencing it), node names that use it
- Click → select nodes using that image on current page
- Drag → drop on canvas → new RECTANGLE with IMAGE fill
- Search filters images by the names of nodes using them
- Collapsible section header "Images (N)"

**Non-Goals:**
- Image rename/description (no metadata stored beyond hash)
- Image delete from library (would break nodes referencing it)
- Image replace (that's in FillPicker already)

## Decisions

### 1. Image enumeration — SceneGraph.getImageUsages()

Returns `Map<string, { hash: string; nodeIds: string[]; names: string[] }>` — for each imageHash in `graph.images`, finds all nodes that reference it via fills, collects their IDs and names.

Algorithm: iterate all nodes, check fills for `type === 'IMAGE'` with `imageHash`, accumulate by hash.

### 2. Image thumbnails — direct blob URL from raw bytes

Unlike component thumbnails (which need CanvasKit rendering), image assets ARE raw image bytes. Just create `URL.createObjectURL(new Blob([bytes], { type: guessType(bytes) }))`. Much cheaper than component thumbnails. Type detection: check magic bytes (PNG: 0x89504E47, JPEG: 0xFFD8, WEBP: 0x52494646...57454250).

### 3. Drag image asset to canvas

New MIME type: `application/x-openpencil-image-asset`. DragStart sets the imageHash. Drop handler reads hash, looks up bytes from `graph.images`, creates RECTANGLE with IMAGE fill using the existing `placeImageNode` logic. Need a new store action `placeImageFromHash(hash, x, y)`.

### 4. Search integration

The search input already filters components. Extend `filteredGroups` to also filter images: match against node names that reference each image. A separate `filteredImages` computed.

### 5. Layout in AssetsPanel

Two top-level collapsible sections:
```
▼ Components (N)
  ▼ Page 1
    AssetItem...
  ▼ Page 2
    AssetItem...
▼ Images (N)
  ImageAssetItem...
  ImageAssetItem...
```

When search is active, both sections filter independently. Empty sections are hidden.
