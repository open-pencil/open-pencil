---
title: useFillControls
description: Kompozyt panelu wypełnień z domyślnym zachowaniem wypełnienia.
---

# useFillControls

`useFillControls()` to kompozyt właściwości wypełnienia używany przez UI edycji wypełnień.

Dodaje wielokrotnie używalną domyślną wartość wypełnienia.

## Użycie

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Co udostępnia

Udostępnia:

- `defaultFill`

## Przykłady praktyczne

### Dodaj nowy wiersz wypełnienia

```ts
propertyList.add(fills.defaultFill)
```

## Powiązane API

- [PropertyListRoot](../components/property-list-root)
