---
title: ScrubInputDisplay
description: Primitiva di visualizzazione in sola lettura per la modalità non in modifica di ScrubInputRoot.
---

# ScrubInputDisplay

`ScrubInputDisplay` renderizza la visualizzazione non in modifica per `ScrubInputRoot`.

Viene renderizzato solo quando lo scrub input non è in modalità di modifica.

## Utilizzo

Usalo all'interno di un sottoalbero `ScrubInputRoot`.

## Props e attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="attributi span">Passati all'elemento span renderizzato.</SdkField>
</SdkFieldGroup>

## Esempio

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## API correlate

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
