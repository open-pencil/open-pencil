---
title: useEditor
description: Dostęp do instancji edytora OpenPencil przekazanej przez provideEditor.
---

# useEditor

`useEditor()` zwraca instancję edytora OpenPencil przekazaną przez najbliższe wywołanie `provideEditor()`.

To główny punkt wejścia dla composables i komponentów bez narzuconego wyglądu wymagających dostępu do edytora.

## Użycie

Wywołaj `useEditor()` wewnątrz drzewa komponentów, w którym wcześniej wykonano `provideEditor(editor)`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Przykład

```vue
<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
const pageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <div>Bieżąca strona: {{ pageId }}</div>
</template>
```

## Zaznaczone obiekty

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

## Polecenia

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Brak kontekstu

Jeśli `useEditor()` zostanie wywołane poza drzewem, w którym wykonano `provideEditor()`, function zgłosi czytelny błąd. Pozwala to natychmiast wykryć brak context edytora.

## Zobacz też

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Typ

```ts
function useEditor(): Editor
```
