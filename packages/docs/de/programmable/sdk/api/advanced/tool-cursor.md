---
title: toolCursor
description: Hilfsmittel, das den Cursor-String für ein Editor-Werkzeug auflöst.
---

# toolCursor

`toolCursor(tool, override?)` ordnet ein Editor-Werkzeug dem Cursor zu, den das SDK verwenden soll, erlaubt dabei aber weiterhin eine explizite Überschreibung.

Verwenden Sie es beim Erstellen benutzerdefinierter Canvas-Shells oder Werkzeug-UIs, die konsistentes Cursor-Verhalten benötigen.

## Verwandte APIs

- [useCanvas](../composables/use-canvas)
- [useEditorCommands](../composables/use-editor-commands)
