---
title: GradientEditorBar
description: Интерактивная полоса для выбора и перетаскивания точек градиента.
---

# GradientEditorBar

`GradientEditorBar` предоставляет состояние и обработчики указателя для отображения полосы градиента. Компонент управляет выбором и перетаскиванием точек.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stops', type: 'GradientStop[]', description: 'Текущие точки градиента.', required: true },
    { name: 'activeStopIndex', type: 'number', description: 'Индекс активной точки.', required: true },
    { name: 'barBackground', type: 'string', description: 'CSS-фон полосы.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'selectStop', payload: 'index: number', description: 'Вызывается при выборе точки.' },
    { name: 'dragStop', payload: 'index: number, position: number', description: 'Вызывается во время перетаскивания точки.' }
  ]"
/>

## См. также

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorStop](./gradient-editor-stop)
