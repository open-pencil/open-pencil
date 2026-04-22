---
title: ScrubInputField
description: Prymityw edytowalnego pola wejściowego dla trybu edycji ScrubInputRoot.
---

# ScrubInputField

`ScrubInputField` renderuje edytowalne pole wejściowe dla `ScrubInputRoot`.

Renderuje się tylko wtedy, gdy pole przeciągania jest w trybie edycji.

## Użycie

Użyj go wewnątrz poddrzewa `ScrubInputRoot`.

## Props i atrybuty

<SdkFieldGroup>
  <SdkField name="$attrs" type="atrybuty input">Przekazywane do renderowanego elementu input.</SdkField>
</SdkFieldGroup>

## Przykład

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## Powiązane API

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
