---
title: useFillControls
description: Füllungs-Panel-Composable mit Standard-Füllungsverhalten.
---

# useFillControls

`useFillControls()` ist das Füllungs-Eigenschafts-Composable, das von Füllungs-Bearbeitungs-UIs verwendet wird.

Es fügt einen wiederverwendbaren Standard-Füllungswert hinzu.

## Verwendung

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Was es bietet

Es gibt zurück:

- `defaultFill`

## Praktische Beispiele

### Eine neue Füllungszeile hinzufügen

```ts
propertyList.add(fills.defaultFill)
```

## Verwandte APIs

- [PropertyListRoot](../components/property-list-root)
