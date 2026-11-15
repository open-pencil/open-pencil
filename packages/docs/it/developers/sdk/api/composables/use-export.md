---
title: useExport
description: Gestire scala e formato di esportazione della selezione corrente.
---

# useExport

`useExport()` fornisce stato e azioni per impostazioni, oggetti selezionati, nome del file, scale, formati e anteprima, oltre all’esecuzione dell’esportazione.

Gestisce anche scale e formati supportati: gli ID in `formats` e le voci con etichetta in `formatOptions`.

## Esempi

```ts
const {
  settings,
  nodeName,
  scales,
  formats,
  formatOptions,
  addSetting,
  updateScale,
  updateFormat,
} = useExport()
```

Per portare la prima esportazione a 2× in WEBP:

```ts
exportState.updateScale(0, 2)
exportState.updateFormat(0, 'webp')
```

## Vedi anche

- [Guida all’esportazione](/user-guide/exporting)
