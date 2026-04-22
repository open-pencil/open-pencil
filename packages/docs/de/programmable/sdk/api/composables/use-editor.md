---
title: useEditor
description: Auf die aktuell injizierte OpenPencil-Editor-Instanz zugreifen.
---

# useEditor

`useEditor()` gibt den aktuell injizierten OpenPencil-Editor zurück.

Es ist der Haupt-Einstiegspunkt für SDK-Composables und headless Primitive, die Editor-Zugriff benötigen.

## Verwendung

`useEditor()` muss innerhalb eines Teilbaums aufgerufen werden, in dem `provideEditor(editor)` bereits aufgerufen wurde.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Einfaches Beispiel

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Aktuelle Seite: {{ pageId }}</div>
</template>
```

## Praktische Beispiele

### Ausgewählte Knoten lesen

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

### Befehle auslösen

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Fehlerverhalten

Wenn außerhalb eines Editor-Provider-Baums aufgerufen, wirft `useEditor()` eine hilfreiche Fehlermeldung.

Das ist beabsichtigt — diese API sollte laut fehlschlagen, wenn der Editor-Kontext fehlt.

## Verwandte APIs

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Typ

```ts
function useEditor(): Editor
```
