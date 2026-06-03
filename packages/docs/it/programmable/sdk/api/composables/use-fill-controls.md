---
title: useFillControls
description: Composable del pannello riempimenti con comportamento di riempimento predefinito.
---

# useFillControls

`useFillControls()` è il composable delle proprietà di riempimento usato dalle UI di modifica dei riempimenti.

Aggiunge un valore di riempimento predefinito riutilizzabile.

## Utilizzo

```ts
import { useFillControls } from '@inkly/vue'

const fills = useFillControls()
```

## Cosa fornisce

Espone:

- `defaultFill`

## Esempi pratici

### Aggiungi una nuova riga di riempimento

```ts
propertyList.add(fills.defaultFill)
```

## API correlate

- [PropertyListRoot](../components/property-list-root)
