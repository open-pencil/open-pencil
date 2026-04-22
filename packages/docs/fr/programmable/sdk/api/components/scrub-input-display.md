---
title: ScrubInputDisplay
description: Primitive d'affichage en lecture seule pour le mode non-édition de ScrubInputRoot.
---

# ScrubInputDisplay

`ScrubInputDisplay` affiche la présentation non-édition pour `ScrubInputRoot`.

Il ne s'affiche que lorsque la saisie par glissement n'est pas en mode édition.

## Utilisation

Utilisez-la à l'intérieur d'un sous-arbre `ScrubInputRoot`.

## Props et attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="attributs span">Transmis à l'élément span rendu.</SdkField>
</SdkFieldGroup>

## Exemple

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## API associées

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
