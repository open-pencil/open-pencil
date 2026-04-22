---
title: ScrubInputField
description: Примитив элемента ввода для режима редактирования ScrubInputRoot.
---

# ScrubInputField

`ScrubInputField` рендерит редактируемый элемент ввода для `ScrubInputRoot`.

Рендерится только в режиме редактирования scrub-ввода.

## Использование

Используйте внутри поддерева `ScrubInputRoot`.

## Props и attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="input attributes">Передаются в рендеримый элемент input.</SdkField>
</SdkFieldGroup>

## Пример

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## Связанные API

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
