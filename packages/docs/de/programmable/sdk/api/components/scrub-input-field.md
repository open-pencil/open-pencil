---
title: ScrubInputField
description: Eingabe-Element-Primitiv für den ScrubInputRoot-Bearbeitungsmodus.
---

# ScrubInputField

`ScrubInputField` rendert das bearbeitbare Eingabe-Element für `ScrubInputRoot`.

Es rendert nur, wenn sich die Scrub-Eingabe im Bearbeitungsmodus befindet.

## Verwendung

Verwenden Sie es innerhalb eines `ScrubInputRoot`-Teilbaums.

## Props und Attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="input-Attribute">Werden an das gerenderte input-Element weitergereicht.</SdkField>
</SdkFieldGroup>

## Beispiel

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## Verwandte APIs

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
