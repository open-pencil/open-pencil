---
title: useEditor
description: Uzyskaj dostęp do bieżącej wstrzykniętej instancji edytora OpenPencil.
---

# useEditor

`useEditor()` zwraca bieżący wstrzyknięty edytor OpenPencil.

Jest to główny punkt wejścia dla kompozytów SDK i bezstanowych prymitywów, które potrzebują dostępu do edytora.

## Użycie

`useEditor()` musi być wywołane wewnątrz poddrzewa, gdzie wcześniej wywołano `provideEditor(editor)`.

```ts
import { useEditor } from '@open-pencil/vue'

const editor = useEditor()
```

## Podstawowy przykład

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

## Przykłady praktyczne

### Odczytaj zaznaczone węzły

```ts
const editor = useEditor()
const selected = editor.getSelectedNodes()
```

### Wyzwól polecenia

```ts
const editor = useEditor()
editor.zoomToFit()
editor.undoAction()
```

## Zachowanie przy błędzie

Jeśli wywołane poza drzewem dostawcy edytora, `useEditor()` rzuca z pomocnym komunikatem.

Jest to celowe — to API powinno głośno zawodzić, gdy brakuje kontekstu edytora.

## Powiązane API

- [provideEditor](./provide-editor)
- [useCanvas](./use-canvas)
- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)

## Typ

```ts
function useEditor(): Editor
```
