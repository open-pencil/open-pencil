---
title: useLayout
description: Mit Auto-Layout, Größenanpassung, Innenabstand, Ausrichtung und Raster-Tracks arbeiten.
---

# useLayout

`useLayout()` ist das Haupt-Steuerelemente-Composable für layout-bezogene Panels.

Es gibt Zustand und Aktionen zurück für:

- Flex- vs. Rastermodus
- Breite/Höhe-Größenanpassung
- Innenabstand
- Ausrichtung
- Raster-Template-Track-Bearbeitung

## Verwendung

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Einfaches Beispiel

```ts
const {
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  setWidthSizing,
  setHeightSizing,
} = useLayout()
```

## Praktische Beispiele

### Zwischen einheitlichem und individuellem Innenabstand wechseln

```ts
layout.toggleIndividualPadding()
```

### Raster-Tracks aktualisieren

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Ausrichtung ändern

```ts
layout.setAlignment('CENTER', 'MAX')
```

## Verwandte APIs

- [usePosition](./use-position)
- [useEditor](./use-editor)
