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
import { MIXED } from '@open-pencil/vue/controls/node-props'
import { usePosition } from '@open-pencil/vue/controls/position'

const { panelProp, updateProp, commitProp } = usePosition()
const x = panelProp('x')
const y = panelProp('y')
const width = panelProp('width')
const height = panelProp('height')
// A multi-selection whose layers show different values shows an empty field.
const shown = (value: number | typeof MIXED) => (value === MIXED ? '' : value)
// Applied on change, so the rounded value replaces the text only once typing is done.
function set(key: 'x' | 'y' | 'width' | 'height', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  updateProp(key, value)
  commitProp(key, value, value)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <input :value="shown(x)" @change="set('x', $event)" />
    <input :value="shown(y)" @change="set('y', $event)" />
    <input :value="shown(width)" @change="set('width', $event)" />
    <input :value="shown(height)" @change="set('height', $event)" />
  </div>
</template>
```

## Пример: список заливок

```vue
<script setup lang="ts">
import { PropertyListRoot } from '@open-pencil/vue/primitives/PropertyList'
import { useEditorPropertyList } from '@open-pencil/vue/controls/property-list'
import { useFillControls } from '@open-pencil/vue/controls/fill'

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
