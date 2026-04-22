---
title: useEffectsControls
description: Хелперы панели эффектов для теней, размытий, состояния развёртывания и потоков скрабинга.
---

# useEffectsControls

`useEffectsControls()` — компосабл свойства эффектов, используемый панелями эффектов.

Предоставляет хелперы для:

- эффектов по умолчанию
- логики теней и размытий
- состояния развёртывания элементов
- редактирования с предпросмотром через скрабинг
- обновлений с подтверждением по завершении
- изменения типа эффекта и цвета

## Использование

```ts
import { useEffectsControls } from '@open-pencil/vue'

const effects = useEffectsControls()
```

## Базовый пример

```ts
const { effectOptions, createDefaultEffect, toggleExpand, scrubEffect, commitEffect } = useEffectsControls()
```

## Практические примеры

### Добавить эффект по умолчанию

```ts
const effect = effects.createDefaultEffect()
```

### Предпросмотр через скрабинг, затем подтверждение

```ts
effects.scrubEffect(node, index, { radius: 12 })
effects.commitEffect(node, index, { radius: 12 })
```

## Связанные API

- [PropertyListRoot](../components/property-list-root)
