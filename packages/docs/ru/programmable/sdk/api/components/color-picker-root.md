---
title: ColorPickerRoot
description: Компонент выбора цвета на основе всплывающей панели с событиями жизненного цикла взаимодействия.
---

<script setup lang="ts">
import { data } from '#docs-api/components/color-picker-root.data'
</script>

# ColorPickerRoot

`ColorPickerRoot` объединяет кнопку с образцом цвета и всплывающую панель, а интерфейс редактирования оставляет слотам. Слот `trigger` получает текущий стиль образца, слот по умолчанию — текущее значение `Color` из SceneGraph.

Событие `openChange` сообщает начало и завершение взаимодействия с выбором цвета. `cancel` вызывается перед закрытием по <kbd>Escape</kbd>, поэтому компонент, использующий `BindableValue`, может одной операцией отменить удаление привязки и изменение краски. Простое открытие панели или получение фокуса не меняет цвет.

```vue twoslash
<script setup lang="ts">
import { ref } from 'vue'
import type { Color } from '@open-pencil/scene-graph'
import { ColorPickerRoot } from '@open-pencil/vue'

const color = ref<Color>({ r: 0.2, g: 0.5, b: 0.9, a: 1 })
</script>

<template>
  <ColorPickerRoot
    :color="color"
    @update="color = $event"
    @open-change="open => console.log(open)"
    @cancel="console.log('cancel')"
  >
    <template #trigger="{ style }">
      <button :style="style" aria-label="Изменить цвет" />
    </template>
    <template #default="{ color: currentColor }">
      <output>{{ currentColor.r }}, {{ currentColor.g }}, {{ currentColor.b }}</output>
    </template>
  </ColorPickerRoot>
</template>
```

## Сгенерированный справочник API

<SdkComponentAPI :components="data.components" />

## См. также

- [ColorInputRoot](./color-input-root)
- [useColorModel](/programmable/sdk/api/composables/use-color-model)
- [BindableValue](/programmable/sdk/api/components/bindable-value)
