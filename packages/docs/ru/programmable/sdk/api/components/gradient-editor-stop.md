---
title: GradientEditorStop
description: Доступный компонент для выбранной или перетаскиваемой точки градиента.
---

<script setup lang="ts">
import { data } from '#docs-api/components/gradient-editor-stop.data'
</script>

# GradientEditorStop

`GradientEditorStop` создаёт полиморфную точку градиента и сообщает состояние выбора и перетаскивания. В интерактивном режиме используется роль ARIA `slider`, а положение передаётся в процентах через атрибуты ARIA.

Размещайте интерактивные точки на полосе градиента. Стрелки изменяют положение на `positionStep`, а с <kbd>Shift</kbd> — с шагом в десять раз больше. <kbd>Home</kbd> и <kbd>End</kbd> перемещают точку к границам. <kbd>Delete</kbd> и <kbd>Backspace</kbd> вызывают `remove`, если точку разрешено удалить.

Обработанные клавиши не передаются выше, поэтому сочетания редактора для удаления и перемещения не запускаются. <kbd>Tab</kbd> последовательно переводит фокус между точками.

Установите `interactive="false"`, если компонент служит обёрткой для сложной строки точки. Действия слота и атрибуты `data-selected` и `data-dragging` сохраняются, но строка не попадает в порядок обхода ползунков клавишей Tab.

```vue twoslash
<script setup lang="ts">
import type { GradientStop } from '@open-pencil/scene-graph'
import { GradientEditorStop } from '@open-pencil/vue'

const stop: GradientStop = {
  color: { r: 0.4, g: 0.2, b: 0.9, a: 1 },
  position: 0.5
}
</script>

<template>
  <GradientEditorStop
    :stop="stop"
    :index="0"
    active
    label="Средняя точка градиента"
    @update-position="(_index, position) => console.log(position)"
  />
</template>
```

## Сгенерированный справочник API

<SdkComponentAPI :components="data.components" />

## См. также

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
- [useColorModel](/programmable/sdk/api/composables/use-color-model)
