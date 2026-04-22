---
title: useSelectionState
description: Reaktiver auswahlabgeleiteter Editor-Zustand für aktuellen Knoten, Anzahl und Auswahltyp.
---

# useSelectionState

`useSelectionState()` gibt reaktiven auswahlabgeleiteten Zustand aus dem aktuellen Editor zurück.

Verwenden Sie es, wenn Sie UI basierend auf folgendem rendern müssen:

- ob etwas ausgewählt ist
- wie viele Knoten ausgewählt sind
- dem primär ausgewählten Knoten
- ob die aktuelle Auswahl eine Instanz, Komponente oder Gruppe ist

## Verwendung

```ts
import { useSelectionState } from '@open-pencil/vue'

const selection = useSelectionState()
```

## Einfaches Beispiel

```vue
<script setup lang="ts">
import { useSelectionState } from '@open-pencil/vue'

const { hasSelection, selectedCount, isInstance } = useSelectionState()
</script>

<template>
  <div class="text-xs text-muted">
    <span v-if="!hasSelection">Keine Auswahl</span>
    <span v-else>
      {{ selectedCount }} ausgewählt
      <span v-if="isInstance">· Instanz</span>
    </span>
  </div>
</template>
```

## Rückgabewerte

Nützliche Werte umfassen:

- `selectedIds`
- `hasSelection`
- `selectedNode`
- `selectedCount`
- `selectedNodeType`
- `isInstance`
- `isComponent`
- `isGroup`
- `canCreateComponentSet`

## Praktische Beispiele

### Nur für Instanzen verfügbare Aktionen anzeigen

```ts
const { isInstance } = useSelectionState()
```

### UI zur Komponentenset-Erstellung aktivieren

```ts
const { canCreateComponentSet } = useSelectionState()
```

## Verwandte APIs

- [useSelectionCapabilities](./use-selection-capabilities)
- [useEditorCommands](./use-editor-commands)
- [useEditor](./use-editor)
