---
title: Vector Conversion
description: Development notes for Inkly boolean operations, flattening, text outlines, stroke outlines, and vector geometry conversion.
---

# Vector conversion

Inkly has a shared path-conversion pipeline for commands that turn scene nodes into vector geometry.

## Commands

- **Boolean operations** keep a live `BOOLEAN_OPERATION` container and render it with CanvasKit path operations.
- **Flatten** replaces selected supported nodes with one persistent `VECTOR` node.
- **Outline text** replaces selected supported text nodes with vector outlines.
- **Outline stroke** replaces selected supported stroked nodes with vector stroke outlines.

The editor, renderer-backed Figma API, and menu command enablement all use the same source-path checks so unsupported nodes fail safely instead of being silently dropped.

## Supported sources

Supported sources include basic shapes, vectors, lines, nested boolean operations, and visual descendants inside groups, frames, components, and instances. Containers contribute their visible descendants, and their own fill/stroke if present.

Text can be converted when all required font data is loaded. The outline engine supports multiline text, horizontal and vertical alignment, letter spacing, style runs, and loaded fallback glyphs for mixed-font text such as Latin plus CJK.

## Unsupported sources

The conversion pipeline rejects these cases:

- visible image fills
- sections and component sets
- text with missing font data or missing fallback glyphs
- complex scripts that require shaping, such as Arabic, Hebrew, and Indic scripts

Complex-script text stays unsupported until we can extract exact shaped glyph runs and positions from the rendering stack.

## Figma API flatten

`FigmaAPI.flatten()` produces real vector geometry when a `SkiaRenderer` is attached with `api.setRenderer(renderer)`. In headless compatibility mode without a renderer, it keeps the historical placeholder behavior: the source nodes are replaced by a vector-sized placeholder without `vectorNetwork` geometry.
