---
title: useExport
description: Exporteinstellungen wie Maßstab und Format für die aktuelle Auswahl verwalten.
---

# useExport

`useExport()` ist das Export-Panel-Composable für ausgewählte Knoten.

Es verwaltet:

- Export-Einstellungszeilen
- ausgewählte Knoten-IDs
- Export-Name-Beschriftung
- unterstützte Maßstäbe und Formate

## Verwendung

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Einfaches Beispiel

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

## Praktische Beispiele

### Eine weitere Export-Voreinstellung hinzufügen

```ts
exportState.addSetting()
```

### Den ersten Export auf 2x WEBP ändern

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Verwandte APIs

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
