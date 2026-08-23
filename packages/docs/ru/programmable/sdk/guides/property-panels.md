---
title: Панели свойств
description: Создание панелей свойств с помощью composables и компонентов без встроенного оформления.
---

# Панели свойств

Панели свойств в `@open-pencil/vue` строятся прежде всего с помощью composables.

Если панели нужны вычисленные из выделения значения и действия для их изменения, используйте composable. Если важна переиспользуемая структура массива или списка, используйте компонент без встроенного оформления, например `PropertyListRoot`.

## Основные composables

Для обычных разделов панели свойств предназначены:

- `usePosition()`
- `useLayout()`
- `useAppearance()`
- `useTypography()`
- `useExport()`

Для свойств, представленных списками:

- `useFillControls()`
- `useStrokeControls()`
- `useEffectsControls()`

## Поля с привязкой к переменным

Если значение поля можно связать с переменной или внешним токеном дизайна, оберните поле в `BindableValueRoot`. Компонент не задаёт внешний вид поля, однако интерфейс не должен разрушать существующую привязку при простом получении фокуса:

- Пока поле не редактируют, показывайте имя переменной. Вычисленное значение можно вывести во вспомогательном элементе, например во всплывающей подсказке.
- Получение фокуса и открытие выбора переменной не должны удалять привязку.
- Применяйте `detach-on-edit`, `readonly-when-bound` или `edit-variable` только после фактического изменения значения пользователем.
- Отдельное действие для удаления привязки лучше разместить в окне выбора, а не превращать значок рядом с полем в опасную кнопку без подтверждения.
- Замену привязки, её удаление при редактировании и изменение нескольких объектов выполняйте одной пакетной операцией поставщика.

В интерфейсе приложения OpenPencil связанное поле в обычном состоянии показывает имя переменной на фиолетовом фоне. После начала редактирования `NumberField` показывает вычисленное числовое значение. В собственном интерфейсе редактора то же состояние можно представить иначе.

## Пример: положение и размер

```vue
<script setup lang="ts">
import { usePosition } from '@open-pencil/vue'

const { x, y, width, height, updateProp, commitProp } = usePosition()
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <input :value="x" @input="updateProp('x', Number(($event.target as HTMLInputElement).value))" />
    <input :value="y" @input="updateProp('y', Number(($event.target as HTMLInputElement).value))" />
    <input :value="width" @input="updateProp('width', Number(($event.target as HTMLInputElement).value))" />
    <input :value="height" @input="updateProp('height', Number(($event.target as HTMLInputElement).value))" />
  </div>
</template>
```

## Пример: список заливок

```vue
<script setup lang="ts">
import {
  PropertyListRoot,
  useEditorPropertyList,
  useFillControls
} from '@open-pencil/vue'

const fillControls = useFillControls()
const fills = useEditorPropertyList('fills')
</script>

<template>
  <PropertyListRoot
    prop-key="fills"
    :items="fills.items.value"
    :mixed="fills.isMixed.value"
    @add="fills.actions.add"
    @remove="fills.actions.remove"
    v-slot="{ items, actions }"
  >
    <div v-for="(fill, index) in items" :key="index">
      {{ fill.type }}
      <button @click="actions.remove(index)">Удалить</button>
    </div>

    <button @click="actions.add(fillControls.defaultFill)">Добавить заливку</button>
  </PropertyListRoot>
</template>
```

## Как выбрать API

- Используйте composables для состояния и действий.
- Используйте структурные компоненты без встроенного оформления, когда основная сложность заключается в координации повторяющихся списков, деревьев или слотов.

## См. также

- [usePosition](../api/composables/use-position)
- [useLayout](../api/composables/use-layout)
- [useAppearance](../api/composables/use-appearance)
- [useTypography](../api/composables/use-typography)
- [useFillControls](../api/composables/use-fill-controls)
- [useStrokeControls](../api/composables/use-stroke-controls)
- [useEffectsControls](../api/composables/use-effects-controls)
- [PropertyListRoot](../api/components/property-list-root)
