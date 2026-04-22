---
title: useEditor
description: Accede all'istanza corrente dell'editor OpenPencil iniettata.
---

# useEditor

`useEditor()` restituisce l'editor OpenPencil iniettato corrente.

È il punto di ingresso principale per i composable SDK e le primitive headless che necessitano di accesso all'editor.

## Utilizzo

`useEditor()` deve essere chiamato all'interno di un sottoalbero dove `provideEditor(editor)` è già stato chiamato.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Esempio base

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Current page: {{ pageId }}</div>
</template>
```

## Esempi pratici

### Leggi i nodi selezionati

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

### Esegui comandi

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Comportamento in caso di errore

Se chiamato al di fuori di un albero con il provider dell'editor, `useEditor()` lancia un'eccezione con un messaggio utile.

Questo è intenzionale — questa API deve fallire in modo evidente quando manca il contesto dell'editor.

## API correlate

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Tipo

```ts
function useEditor(): Editor
```
