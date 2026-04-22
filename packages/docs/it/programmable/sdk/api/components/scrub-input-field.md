---
title: ScrubInputField
description: Primitiva elemento input per la modalità di modifica di ScrubInputRoot.
---

# ScrubInputField

`ScrubInputField` renderizza l'elemento input modificabile per `ScrubInputRoot`.

Viene renderizzato solo quando lo scrub input è in modalità di modifica.

## Utilizzo

Usalo all'interno di un sottoalbero `ScrubInputRoot`.

## Props e attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="attributi input">Passati all'elemento input renderizzato.</SdkField>
</SdkFieldGroup>

## Esempio

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## API correlate

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
