---
title: GradientEditorRoot
description: État et actions pour modifier les points d’un dégradé.
---

# GradientEditorRoot

`GradientEditorRoot` coordonne le type de dégradé, le point actif et les changements de couleur, position et opacité.

Il reçoit un remplissage par `fill` et émet `update` avec le nouvel objet `Fill`. L’application peut composer [GradientEditorBar](./gradient-editor-bar) et [GradientEditorStop](./gradient-editor-stop) dans son emplacement.

## Voir aussi

- [useGradientStops](../advanced/use-gradient-stops)
