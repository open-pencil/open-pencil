---
title: PropertyList
description: Строго типизированная структура без встроенного оформления для списков заливок, обводок и эффектов.
---

<script setup lang="ts">
import { data } from '#docs-api/components/property-list.data'
</script>

# PropertyList

PropertyList — управляемый компонент без встроенного оформления для списков заливок, обводок и эффектов. Параметр `propKey` задаёт точный тип `Fill`, `Stroke` или `Effect` для слотов и действий. Изменение состояния редактора и история отмены остаются в `useEditorPropertyList()` или адаптере приложения.

## Состав

- `PropertyListRoot` — управляемые элементы, их идентификация, смешанное состояние и смысловые события;
- `PropertyListItem` — точный тип элемента, а также `data-hidden` и `data-dragging`;
- `PropertyListAdd` — добавление типизированного элемента;
- `PropertyListRemove` — удаление элемента по индексу;
- `PropertyListVisibility` — изменение видимости по индексу и значение `aria-pressed`.

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import type { Fill } from '@open-pencil/scene-graph'
import {
  PropertyListItem,
  PropertyListRemove,
  PropertyListRoot
} from '@open-pencil/vue'

const fills = ref<Fill[]>([])
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills"
    @remove="fills.splice($event, 1)"
    v-slot="{ items }"
  >
    <PropertyListItem
      v-for="(_, index) in items"
      :key="index"
      prop-key="fills"
      :index="index"
      v-slot="{ item }"
    >
      <span>{{ item?.type }}</span>
      <PropertyListRemove prop-key="fills" :index="index">Удалить</PropertyListRemove>
    </PropertyListItem>
  </PropertyListRoot>
</template>
```

Общая матрица интерактивных состояний показана в [демонстрации PropertySection](/programmable/sdk/api/components/property-section).

## Адаптер редактора

Панели OpenPencil используют `useEditorPropertyList(propKey)`, чтобы связать управляемые события с выделением, изменением нескольких объектов, группировкой истории отмены и изменением порядка. Пользователи SDK могут предоставить собственный адаптер состояния без контекста редактора OpenPencil.

## Сгенерированный справочник API

<SdkComponentAPI :components="data.components" />
