---
title: useExport
description: Gestisce le impostazioni di esportazione come scala e formato per la selezione corrente.
---

# useExport

`useExport()` è il composable del pannello di esportazione per i nodi selezionati.

Gestisce:

- le righe delle impostazioni di esportazione
- gli ID dei nodi selezionati
- l'etichettatura del nome di esportazione
- scale e formati supportati

## Utilizzo

```ts
import { useExport } from '@open-pencil/vue'

const exportState = useExport()
```

## Esempio base

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

## Esempi pratici

### Aggiungi un altro preset di esportazione

```ts
exportState.addSetting()
```

### Cambia il primo export a 2x WEBP

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'WEBP')
```

## API correlate

- [useSelectionState](./use-selection-state)
- [useEditor](./use-editor)
