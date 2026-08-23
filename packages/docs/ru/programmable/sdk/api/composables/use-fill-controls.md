---
title: useFillControls
description: Значение по умолчанию для новых заливок в панели свойств.
---

# useFillControls

`useFillControls()` предоставляет панели заливок значение новой заливки по умолчанию.

## Использование

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## Что предоставляет

- `defaultFill`

## Практические примеры

### Добавить новую строку заливки

```ts
propertyList.add(fills.defaultFill)
```

## Связанные API

- [PropertyListRoot](../components/property-list-root)
