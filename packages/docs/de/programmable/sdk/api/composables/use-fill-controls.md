---
title: useFillControls
description: Default value für einen neuen Fill im Properties-Panel.
---

# useFillControls

`useFillControls()` stellt den Default fill bereit, den ein Fill-Panel beim Hinzufügen eines neuen Eintrags verwenden kann.

## Verwendung

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Rückgabewert

- `defaultFill`

### Fill hinzufügen

```ts
propertyList.add(fills.defaultFill)
```

## Siehe auch

- [PropertyListRoot](../components/property-list-root)
