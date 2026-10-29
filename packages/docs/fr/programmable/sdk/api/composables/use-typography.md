---
title: useTypography
description: Lire et modifier police, taille, espacement et alignement du texte.
---

# useTypography

`useTypography()` fournit l’état et les actions des contrôles typographiques :

- famille et style ;
- taille et interligne ;
- approche ;
- alignement horizontal et vertical ;
- gras, italique, souligné et barré ;
- valeurs mixtes pour une sélection multiple.

Pendant l’édition de texte, les changements peuvent ne s’appliquer qu’à la plage sélectionnée.

### Régler les axes d’une police variable

`axes` liste les axes de la police variable du texte sélectionné, chacun avec son `tag`, son `name`, sa plage et la `value` à laquelle il est dessiné (`MIXED` si les calques diffèrent) ; la liste est vide pour une police statique ou des calques de familles différentes. `previewAxis` affiche une valeur pendant un glissement, `setAxis` la fixe en une étape d’annulation et `setOpticalSizeAuto` fait suivre la taille optique à la taille de police ou la fige. Changer de graisse, d’inclinaison ou de famille ramène les axes à ceux du style.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Voir aussi

- [TypographyControlsRoot](../components/typography-controls-root)
- [useFontPicker](../advanced/use-font-picker)
- [Modifier du texte](/user-guide/text-editing)
