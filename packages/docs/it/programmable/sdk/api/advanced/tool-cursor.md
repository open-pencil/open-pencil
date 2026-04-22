---
title: toolCursor
description: Helper che risolve la stringa del cursore per uno strumento dell'editor.
---

# toolCursor

`toolCursor(tool, override?)` mappa uno strumento dell'editor al cursore che l'SDK dovrebbe usare, consentendo comunque un override esplicito.

Usalo quando costruisci shell canvas personalizzate o UI degli strumenti che necessitano di un comportamento del cursore coerente.

## API correlate

- [useCanvas](../composables/use-canvas)
- [useEditorCommands](../composables/use-editor-commands)
