---
title: ScrubInputDisplay
description: Nur-Lesen-Anzeige-Primitiv für den ScrubInputRoot-Nicht-Bearbeitungsmodus.
---

# ScrubInputDisplay

`ScrubInputDisplay` rendert die Nicht-Bearbeitungs-Anzeige für `ScrubInputRoot`.

Es rendert nur, wenn sich die Scrub-Eingabe nicht im Bearbeitungsmodus befindet.

## Verwendung

Verwenden Sie es innerhalb eines `ScrubInputRoot`-Teilbaums.

## Props und Attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="span-Attribute">Werden an das gerenderte span-Element weitergereicht.</SdkField>
</SdkFieldGroup>

## Beispiel

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## Verwandte APIs

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
