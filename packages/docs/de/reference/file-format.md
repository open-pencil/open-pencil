# Dateiformat

## .fig-Dateistruktur

```
┌─────────────────────────────────┐
│ Magic header: "fig-kiwi" (8B)   │
│ Version (4B uint32 LE)          │
│ Schema length (4B uint32 LE)    │
│ Compressed Kiwi schema          │
│ Message length (4B uint32 LE)   │
│ Compressed Kiwi message         │  ← NodeChange[] (entire document)
│ Blob data                       │  ← Images, vector networks, fonts
└─────────────────────────────────┘
```

## Import-Pipeline

```
.fig file → Parse header → Decompress Zstd → Decode Kiwi schema
  → Decode Message → NodeChange[] → Build SceneGraph
  → Resolve blob refs → Render on canvas
```

## Export-Pipeline

```
SceneGraph → NodeChange[] → Kiwi encode → Compress (Zstd/deflate)
  → Build ZIP (header + schema + message + thumbnail.png)
  → Write .fig file
```

Export uses <kbd>⌘</kbd><kbd>S</kbd> (Save) and <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> (Save As) with native OS dialogs on the desktop app. The exported file includes a `thumbnail.png` required by Figma for file preview. Compression uses Zstd via Tauri Rust command on desktop, with deflate fallback in the browser. The ZIP archive is assembled in Rust on desktop for correct Zstd frame headers (content size included).

## Kiwi Binary Codec

The codec handles Figma's 194-definition Kiwi schema with NodeChange as the central type (~390 fields). Key components:

- **kiwi-schema** — vendored from evanw/kiwi, patched for ESM and sparse field IDs
- **codec.ts** — encode/decode Messages using the Kiwi schema
- **protocol.ts** — wire format parsing and message type detection
- **schema.ts** — 194 message/enum/struct definitions

### Sparse Field IDs

Figma's schema uses non-contiguous field IDs (e.g., 1, 2, 5, 10 with gaps). The vendored kiwi-schema parser is patched to handle this correctly.

### Compression

.fig files use Zstd compression for both the schema and message payloads. Decompression uses the `fzstd` library. For export, Zstd compression is offloaded to a Tauri Rust command on the desktop app (better performance, correct frame headers). In the browser, deflate via `fflate` is used as a fallback. Clipboard encoding also uses `fflate`.

## Supported Formats

| Format | Import | Export |
|--------|--------|--------|
| .fig (Figma) | ✅ | ✅ |
| .svg | Planned | Planned |
| .png | Planned | Planned |
| .pdf | — | Planned |

See [Roadmap](/development/roadmap) for planned format support timeline.

## Clipboard Format

Copy/paste uses the same Kiwi binary encoding:

1. **Copy** — encode selected NodeChange[] to Kiwi binary, compress, write to clipboard as `application/x-figma-design` MIME type
2. **Paste** — read clipboard, decompress, decode Kiwi binary, create nodes in scene graph
3. **Synchronous** — encoding happens in the copy event handler (not async Clipboard API) to ensure browser compatibility

This enables bidirectional clipboard between OpenPencil and Figma.
