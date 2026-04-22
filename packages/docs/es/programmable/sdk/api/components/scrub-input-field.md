---
title: ScrubInputField
description: Primitivo de elemento input para el modo de edición de ScrubInputRoot.
---

# ScrubInputField

`ScrubInputField` renderiza el elemento input editable para `ScrubInputRoot`.

Solo se renderiza mientras el scrub input está en modo de edición.

## Uso

Úsalo dentro de un subárbol de `ScrubInputRoot`.

## Props y attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="input attributes">Se pasan al elemento input renderizado.</SdkField>
</SdkFieldGroup>

## Ejemplo

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## APIs relacionadas

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
