---
title: GradientEditorRoot
description: Состояние и действия для редактирования точек градиента.
---

# GradientEditorRoot

`GradientEditorRoot` управляет активной точкой, типом градиента, добавлением, удалением и изменением точек, цветом активной точки и фоном полосы градиента.

Слот по умолчанию получает весь набор данных и действий, необходимый для собственного интерфейса редактора градиента.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Текущая градиентная заливка.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Вызывается после изменения градиентной заливки.' }
  ]"
/>

## Пример

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## См. также

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
