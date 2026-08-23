---
title: useExport
description: Scale und Format für den Export der aktuellen Selection verwalten.
---

# useExport

`useExport()` stellt State und Actions für ein Export-Panel bereit:

- Export settings;
- IDs der ausgewählten Objekte;
- Name der Output file;
- verfügbare Scales und Formats.

## Verwendung

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Beispiel

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

### Weiteres Export setting

```ts
exportState.addSetting()
```

### WEBP mit Scale 2×

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## Siehe auch

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
