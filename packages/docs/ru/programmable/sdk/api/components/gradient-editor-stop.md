---
title: GradientEditorStop
description: Headless-примитив слота для одной строки точки градиента.
---

# GradientEditorStop

`GradientEditorStop` — headless-примитив для рендеринга и редактирования одной точки градиента.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Текущее значение точки.', required: true },
    { name: 'index', type: 'number', description: 'Индекс текущей точки.', required: true },
    { name: 'active', type: 'boolean', description: 'Является ли эта точка активной.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Генерируется при выборе точки.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Генерируется при изменении позиции точки.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Генерируется при изменении цвета точки.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Генерируется при изменении прозрачности точки.' },
    { name: 'remove', payload: 'index: number', description: 'Генерируется при удалении точки.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stop state + update handlers', description: 'Полный контракт рендеринга точки градиента.' }
  ]"
/>

### Пропы слота default

```ts
{
  stop: GradientStop
  index: number
  active: boolean
  positionPercent: number
  opacityPercent: number
  hex: string
  css: string
  select: () => void
  updatePosition: (position: number) => void
  updateColor: (hex: string) => void
  updateOpacity: (opacity: number) => void
  remove: () => void
}
```

## Пример

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## Связанные API

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
