---
title: useSelectionCapabilities
description: Befehlsfreundliche Booleans für auswahlgesteuerte UI und Aktionen ableiten.
---

# useSelectionCapabilities

`useSelectionCapabilities()` gibt reaktive Booleans zurück, ob gängige Editor-Aktionen aktuell erlaubt sind.

Verwenden Sie es beim Erstellen von:

- Menüs
- Toolbars
- Tastaturkürzeln
- Aktionsschaltflächen
- kontextuellen Panels

## Verwendung

```ts
import { useSelectionCapabilities } from '@open-pencil/vue'

const caps = useSelectionCapabilities()
```

## Einfaches Beispiel

```vue
<script setup lang="ts">
import { useSelectionCapabilities } from '@open-pencil/vue'

const { canDelete, canDuplicate, canCreateComponent } = useSelectionCapabilities()
</script>

<template>
  <div class="flex gap-2">
    <button :disabled="!canDuplicate">Duplizieren</button>
    <button :disabled="!canDelete">Löschen</button>
    <button :disabled="!canCreateComponent">Als Komponente</button>
  </div>
</template>
```

## Praktische Beispiele

### Menüeinträge sperren

```ts
const { canMoveToPage, canGoToMainComponent } = useSelectionCapabilities()
```

### Zoom-Befehle nur aktivieren, wenn sinnvoll

```ts
const { canZoomToSelection } = useSelectionCapabilities()
```

## Verwandte APIs

- [useSelectionState](./use-selection-state)
- [useEditorCommands](./use-editor-commands)
