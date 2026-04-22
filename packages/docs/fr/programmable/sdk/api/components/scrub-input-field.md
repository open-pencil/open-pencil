---
title: ScrubInputField
description: Primitive élément input pour le mode édition de ScrubInputRoot.
---

# ScrubInputField

`ScrubInputField` affiche l'élément input modifiable pour `ScrubInputRoot`.

Il ne s'affiche que lorsque la saisie par glissement est en mode édition.

## Utilisation

Utilisez-la à l'intérieur d'un sous-arbre `ScrubInputRoot`.

## Props et attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="attributs input">Transmis à l'élément input rendu.</SdkField>
</SdkFieldGroup>

## Exemple

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## API associées

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
