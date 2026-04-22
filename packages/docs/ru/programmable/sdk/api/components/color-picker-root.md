---
title: ColorPickerRoot
description: Headless-примитив пикера цвета с поповером.
---

# ColorPickerRoot

`ColorPickerRoot` — headless-примитив пикера цвета на основе поповера.

Предоставляет:

- слот триггера со стилизацией фона свотча
- дефолтный фоллбэк триггера
- слот содержимого с `color` и `update()`

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Текущее значение цвета.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Опциональный класс для содержимого поповера.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Опциональный класс для кнопки триггера по умолчанию.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Генерируется при изменении цвета.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ style: Record<string, string> }', description: 'Кастомный триггер со стилем фона свотча.' },
    { name: 'default', props: '{ color: Color, update: (color: Color) => void }', description: 'Основное содержимое редактора цвета.' }
  ]"
/>

## Пример

```vue
<ColorPickerRoot :color="color" @update="color = $event">
  <template #trigger="{ style }">
    <button class="size-6 rounded border" :style="style" />
  </template>

  <template #default="{ color, update }">
    <MyColorEditor :color="color" @change="update" />
  </template>
</ColorPickerRoot>
```

## Связанные API

- [ColorInputRoot](./color-input-root)
