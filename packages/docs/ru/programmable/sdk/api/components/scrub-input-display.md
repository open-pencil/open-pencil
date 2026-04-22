---
title: ScrubInputDisplay
description: Примитив отображения только для чтения в режиме без редактирования ScrubInputRoot.
---

# ScrubInputDisplay

`ScrubInputDisplay` рендерит отображение без редактирования для `ScrubInputRoot`.

Рендерится только когда scrub-ввод не находится в режиме редактирования.

## Использование

Используйте внутри поддерева `ScrubInputRoot`.

## Props и attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="span attributes">Передаются в рендеримый элемент span.</SdkField>
</SdkFieldGroup>

## Пример

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## Связанные API

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
