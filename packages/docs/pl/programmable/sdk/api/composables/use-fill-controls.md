---
title: useFillControls
description: Domyślna wartość nowego fill w panelu właściwości.
---

# useFillControls

`useFillControls()` udostępnia panelowi fills wartość nowego fill używaną domyślnie.

## Użycie

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Zwracana wartość

- `defaultFill`

### Dodanie fill

```ts
propertyList.add(fills.defaultFill)
```

## Zobacz też

- [PropertyListRoot](../components/property-list-root)
