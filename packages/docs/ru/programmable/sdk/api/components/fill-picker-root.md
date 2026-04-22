---
title: FillPickerRoot
description: Headless-примитив пикера заливки с поповером.
---

# FillPickerRoot

`FillPickerRoot` — headless-примитив пикера заливки на основе поповера для сплошных, градиентных и графических заливок.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Текущее значение заливки.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Опциональный класс для содержимого поповера.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Опциональный класс для кнопки триггера по умолчанию.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Генерируется при изменении заливки.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'swatch style', description: 'Кастомный триггер со стилем фона свотча.' },
    { name: 'default', props: 'fill state + conversion helpers', description: 'Основное содержимое редактора заливки.' }
  ]"
/>

### Пропы слота trigger

```ts
{
  style: Record<string, string>
}
```

### Пропы слота default

```ts
{
  fill: Fill
  category: 'SOLID' | 'GRADIENT' | 'IMAGE'
  toSolid: () => void
  toGradient: () => void
  toImage: () => void
  update: (fill: Fill) => void
}
```

## Пример

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Сплошная</button>
    <button @click="toGradient">Градиент</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## Связанные API

- [GradientEditorRoot](./gradient-editor-root)
