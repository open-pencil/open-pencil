---
title: File Format
description: Technical reference for OpenPencil .fig and .pen document formats, Kiwi binary structure, import pipeline, and export behavior.
---

# File Format

::: warning Figma round-trip limitations
Complex Figma documents can lose visual fidelity when saved by OpenPencil and reopened in Figma, even without edits. Component content, colors, and text may differ or appear missing. This is an existing compatibility limitation; preserving the layer count does not guarantee the same appearance.

Keep the original `.fig`, use **Save As** for an OpenPencil copy, and inspect the exported copy in Figma before replacing your original.
:::

## .fig File Structure

A `.fig` file is a ZIP archive containing a Kiwi-encoded binary message:

| Offset | Content |
|--------|---------|
| 0 | Magic header `fig-kiwi` (8 bytes) |
| 8 | Version (4 bytes, uint32 LE) |
| 12 | Schema length (4 bytes, uint32 LE) |
| 16 | Compressed Kiwi schema |
| … | Message length (4 bytes, uint32 LE) |
| … | Compressed Kiwi message — `NodeChange[]` (entire document) |
| … | Blob data — images, vector networks, fonts |

## Import Pipeline

```
.fig file → parse header → decompress Zstd → decode Kiwi schema
  → decode message → NodeChange[] → build SceneGraph
  → resolve blob refs → render on canvas
```

## Export Pipeline

```
SceneGraph → NodeChange[] → Kiwi encode → compress (Zstd)
  → build ZIP (header + schema + message + thumbnail.png)
  → write .fig file
```

Export uses <kbd>⌘</kbd><kbd>S</kbd> (Save) and <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> (Save As) with native OS dialogs on the desktop app. The exported file includes a `thumbnail.png` required by Figma for file preview. OpenPencil draws it from the first page named exactly `Cover` (case-insensitive), then the first page whose name contains `Cover`, then the first page, and writes a 1×1 placeholder when that page has nothing to draw. The CLI draws it too whenever it saves a `.fig`: `export --format fig`, `convert`, `import`, `lint --fix`, and `eval`, `tool call`, or `diff apply` with `--write` or `--output`. The desktop app also caches this Cover after opening a file so Recent Files can prefer the generated preview without modifying the source `.fig`.

Compression uses Zstd at the level the document asks for (see [Compression](#compression)): through a Tauri Rust command on desktop, Bun's own Zstd in the CLI, and a WebAssembly build in the browser.

## Kiwi Binary Codec

The codec handles Figma's 194-definition Kiwi schema with `NodeChange` as the central type (~390 fields). Key components:

| Module | Purpose |
|--------|---------|
| `kiwi-schema` | Kiwi parser (from [evanw/kiwi](https://github.com/nicolo-ribaudo/kiwi)), patched for ESM and sparse field IDs |
| `codec.ts` | Encode/decode messages using the Kiwi schema |
| `protocol.ts` | Wire format parsing and message type detection |
| `schema.ts` | 194 message/enum/struct definitions |

### Sparse Field IDs

Figma's schema uses non-contiguous field IDs (e.g. 1, 2, 5, 10 with gaps). The kiwi-schema parser handles this correctly.

### Compression

The schema chunk is deflated and the message chunk is Zstd-compressed; Figma also reads a deflated message chunk, as older files have. Decompression uses the same Zstd as export: Bun's own under Bun, the WebAssembly build elsewhere.

Export writes the message chunk with Zstd at a level set per document, stored as `figCompression` in the document node's `open-pencil` plugin data: `fast` (level 3, as Figma saves), `smaller` (9), or `smallest` (19). Figma opens every Zstd level, but only frames that declare their decompressed size, which all three encoders write. Reading costs the same at every level; on a 45 MB message, level 9 takes about five times and level 19 about 150 times as long to write as level 3.

## Supported Formats

| Format | Open / Read | Save / Write | Export |
|--------|-------------|--------------|--------|
| `.fig` (Figma) | ✅ | ✅ | ✅ |
| `.pen` (Pencil) | ✅ | — | — |
| `.png` | — | — | ✅ |
| `.jpg` | — | — | ✅ |
| `.webp` | — | — | ✅ |
| `.svg` | — | — | ✅ |
| `.jsx` | — | — | ✅ |

## Clipboard Format

Copy/paste uses the same Kiwi binary encoding:

1. **Copy** — encode selected `NodeChange[]` to Kiwi binary, compress, write to clipboard as `application/x-figma-design` MIME type
2. **Paste** — read clipboard, decompress, decode Kiwi binary, create nodes in scene graph

Encoding happens synchronously in the copy event handler (not async Clipboard API) for browser compatibility. This enables bidirectional clipboard between OpenPencil and Figma.
