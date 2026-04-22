---
title: ScrubInputRoot
description: Headless-корневой примитив для числового ввода с перетаскиванием.
---

# ScrubInputRoot

`ScrubInputRoot` — headless-корневой примитив для числового ввода с перетаскиванием (scrub).

Управляет:

- отображением смешанных значений
- состоянием редактирования vs перетаскивания
- числовым скрабингом с помощью указателя
- семантикой подтверждения завершённых правок

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Текущее числовое значение или символ смешанного состояния.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Минимально допустимое значение.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Максимально допустимое значение.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Множитель шага скрабинга.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Множитель чувствительности указателя.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Заполнитель для смешанных значений.', default: 'Mixed' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Записываемая числовая модель.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Генерируется при скрабинге или редактировании.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Генерируется при подтверждении взаимодействия.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Полный контракт рендеринга scrub-ввода.' }
  ]"
/>

## Пример

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## Связанные API

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
