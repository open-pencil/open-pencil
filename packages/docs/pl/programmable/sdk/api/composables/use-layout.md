---
title: useLayout
description: Pracuj z auto-layoutem, rozmiarem, paddingiem, wyrównaniem i torami siatki.
---

# useLayout

`useLayout()` to główny kompozyt kontrolek dla paneli związanych z layoutem.

Udostępnia stan i akcje dla:

- trybu flex vs grid
- rozmiaru szerokości/wysokości
- paddingu
- wyrównania
- edycji torów szablonu siatki

## Użycie

```ts
import { useLayout } from '@open-pencil/vue'

const layout = useLayout()
```

## Podstawowy przykład

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

## Przykłady praktyczne

### Przełącz między jednolitym i indywidualnym paddingiem

```ts
layout.toggleIndividualPadding()
```

### Aktualizuj tory siatki

```ts
layout.updateGridTrack('gridTemplateColumns', 0, { sizing: 'FIXED', value: 240 })
layout.addTrack('gridTemplateRows')
```

### Zmień wyrównanie

```ts
layout.setAlignment('CENTER', 'MAX')
```

## Powiązane API

- [usePosition](./use-position)
- [useEditor](./use-editor)
