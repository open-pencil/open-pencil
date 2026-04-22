---
title: useSelectionState
description: Reaktywny stan edytora pochodny od selekcji dla bieżącego węzła, liczby i typu selekcji.
---

# useSelectionState

`useSelectionState()` udostępnia reaktywny stan pochodny od selekcji z bieżącego edytora.

Użyj go, gdy chcesz renderować UI na podstawie:

- czy coś jest zaznaczone
- ile węzłów jest zaznaczonych
- głównego zaznaczonego węzła
- czy bieżąca selekcja jest instancją, komponentem lub grupą

## Użycie

```ts
import { useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
```

## Podstawowy przykład

```vue
<script setup lang="ts">
import { useSelectionState } from '@open-pencil/vue'

const { hasSelection, selectedCount, isInstance } = useSelectionState()
</script>

<template>
  <div class="text-xs text-muted">
    <span v-if="!hasSelection">Brak selekcji</span>
    <span v-else>
      {{ selectedCount }} zaznaczono
      <span v-if="isInstance">· instancja</span>
    </span>
  </div>
</template>
```

## Co zwraca

Przydatne wartości obejmują:

- `selectedIds`
- `hasSelection`
- `selectedNode`
- `selectedCount`
- `selectedNodeType`
- `isInstance`
- `isComponent`
- `isGroup`
- `canCreateComponentSet`

## Przykłady praktyczne

### Wyświetl akcje tylko dla instancji

```ts
const { isInstance } = useSelectionState()
```

### Włącz UI tworzenia zestawu komponentów

```ts
const { canCreateComponentSet } = useSelectionState()
```

## Powiązane API

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
