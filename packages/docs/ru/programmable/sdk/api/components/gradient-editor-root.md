---
title: GradientEditorRoot
description: Headless-корневой примитив для редактирования точек градиента.
---

# GradientEditorRoot

`GradientEditorRoot` — headless-корневой примитив для редактирования градиента.

Управляет:

- состоянием активной точки
- переключением подтипа
- логикой добавления/удаления/обновления точек
- редактированием цвета активной точки
- производным фоном полосы

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Текущее значение заливки градиентом.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Генерируется при изменении заливки градиентом.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'editor state + handlers', description: 'Полный контракт рендеринга редактора градиента.' }
  ]"
/>

### Пропы слота default

```ts
{
  stops: GradientStop[]
  subtype: GradientSubtype
  subtypes: Array<{ value: GradientSubtype; label: string }>
  activeStopIndex: number
  activeColor: Color
  barBackground: string
  setSubtype: (type: GradientSubtype) => void
  selectStop: (index: number) => void
  addStop: () => void
  removeStop: (index: number) => void
  updateStopPosition: (index: number, position: number) => void
  updateStopColor: (index: number, hex: string) => void
  updateStopOpacity: (index: number, opacity: number) => void
  updateActiveColor: (color: Color) => void
  dragStop: (index: number, position: number) => void
}
```

## Пример

```vue
<GradientEditorRoot :fill="fill" @update="fill = $event" v-slot="ctx">
  <MyGradientUI v-bind="ctx" />
</GradientEditorRoot>
```

## Связанные API

- [GradientEditorBar](./gradient-editor-bar)
- [GradientEditorStop](./gradient-editor-stop)
