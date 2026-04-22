---
title: ScrubInputDisplay
description: Primitivo de visualización de solo lectura para el modo no edición de ScrubInputRoot.
---

# ScrubInputDisplay

`ScrubInputDisplay` renderiza la visualización en modo no edición para `ScrubInputRoot`.

Solo se renderiza mientras el scrub input no está en modo de edición.

## Uso

Úsalo dentro de un subárbol de `ScrubInputRoot`.

## Props y attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="span attributes">Se pasan al elemento span renderizado.</SdkField>
</SdkFieldGroup>

## Ejemplo

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## APIs relacionadas

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
