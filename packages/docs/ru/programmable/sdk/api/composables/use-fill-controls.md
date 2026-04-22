---
title: useFillControls
description: Компосабл панели заливок с поведением заливки по умолчанию.
---

# useFillControls

`useFillControls()` — компосабл свойства заливки, используемый UI редактирования заливок.

Добавляет переиспользуемое значение заливки по умолчанию.

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
