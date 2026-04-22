---
title: ScrubInputDisplay
description: Prymityw wyświetlacza tylko do odczytu dla trybu nieEdycji ScrubInputRoot.
---

# ScrubInputDisplay

`ScrubInputDisplay` renderuje wyświetlacz nieEdycji dla `ScrubInputRoot`.

Renderuje się tylko wtedy, gdy pole przeciągania nie jest w trybie edycji.

## Użycie

Użyj go wewnątrz poddrzewa `ScrubInputRoot`.

## Props i atrybuty

<SdkFieldGroup>
  <SdkField name="$attrs" type="atrybuty span">Przekazywane do renderowanego elementu span.</SdkField>
</SdkFieldGroup>

## Przykład

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## Powiązane API

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
