---
title: useSelectionCapabilities
description: Wyprowadzaj wartości logiczne przyjazne poleceniom dla UI i akcji napędzanych selekcją.
---

# useSelectionCapabilities

`useSelectionCapabilities()` udostępnia reaktywne wartości logiczne wskazujące, czy typowe akcje edytora są aktualnie dozwolone.

Użyj go przy budowaniu:

- menu
- pasków narzędzi
- skrótów klawiaturowych
- przycisków akcji
- kontekstowych paneli

## Użycie

```ts
import { useSelectionCapabilities } from '@open-pencil/vue'

const caps = useSelectionCapabilities()
```

## Podstawowy przykład

```vue
<script setup lang="ts">
import { useSelectionCapabilities } from '@open-pencil/vue'

const { canDelete, canDuplicate, canCreateComponent } = useSelectionCapabilities()
</script>

<template>
  <div class="flex gap-2">
    <button :disabled="!canDuplicate">Duplikuj</button>
    <button :disabled="!canDelete">Usuń</button>
    <button :disabled="!canCreateComponent">Utwórz komponent</button>
  </div>
</template>
```

## Przykłady praktyczne

### Bramkuj wpisy menu

```ts
const { canMoveToPage, canGoToMainComponent } = useSelectionCapabilities()
```

### Włącz polecenia powiększenia tylko gdy przydatne

```ts
const { canZoomToSelection } = useSelectionCapabilities()
```

## Powiązane API

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
