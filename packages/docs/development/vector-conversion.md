---
title: Vector Conversion
description: Development notes for OpenPencil boolean operations, flattening, text outlines, stroke outlines, and vector geometry conversion.
---

# Vector conversion

OpenPencil has a shared path-conversion pipeline for commands that turn scene nodes into vector geometry.

## Commands

- **Boolean operations** keep a live `BOOLEAN_OPERATION` container and render it with CanvasKit path operations.
- **Flatten** replaces selected supported nodes with one persistent `VECTOR` node, as Figma's does: each shape keeps its own geometry (a line its segment, text its glyphs with their underlines and strikethroughs) and fills its own regions with its fills, a text glyph with its character's, stacked in layer order. The vector takes the topmost shape's stroke, opacity, blend mode, and effects, and its name when it is the only shape, "Vector" otherwise. Strokes stay strokes rather than becoming shape.
- **Outline stroke** replaces each selected layer that has a stroke or a fill, and each such layer inside a selected group, frame, or component, with its fill as a vector under its stroke as one, as Figma does; a shape with only a fill becomes a vector of its fill. Text becomes a group of glyph vectors. Figma has no separate Outline text command.

The editor, renderer-backed Figma API, and menu command enablement all use the same source-path checks so unsupported nodes fail safely instead of being silently dropped.

## Supported sources

Supported sources include basic shapes, vectors, lines, nested boolean operations, and visual descendants inside groups, frames, components, and instances. Containers contribute their visible descendants, never their own fill or stroke, as in Figma.

Text can be converted when all required font data is loaded. The outline engine supports multiline text, horizontal and vertical alignment, letter spacing, style runs, and loaded fallback glyphs for mixed-font text such as Latin plus CJK.

## Unsupported sources

The conversion pipeline rejects these cases:

- visible image fills
- sections and component sets
- text with missing font data or missing fallback glyphs
- complex scripts that require shaping, such as Arabic, Hebrew, and Indic scripts

Complex-script text stays unsupported until we can extract exact shaped glyph runs and positions from the rendering stack.

## Figma API flatten

`FigmaAPI.flatten()` produces real vector geometry when a `SkiaRenderer` is attached: `api.setRenderer(renderer)` in a headless host, or the `renderer` option in a host that already invalidates its renderers on edits, as the editor does. In headless compatibility mode without a renderer, it keeps the historical placeholder behavior: the source nodes are replaced by a vector-sized placeholder without `vectorNetwork` geometry.
