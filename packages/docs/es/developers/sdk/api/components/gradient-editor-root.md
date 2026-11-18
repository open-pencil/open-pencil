---
title: GradientEditorRoot
description: Estado y acciones para editar los puntos de un degradado.
---

# GradientEditorRoot

`GradientEditorRoot` coordina el tipo de degradado, el punto activo y los cambios de color, posición y opacidad.

Recibe un relleno de degradado mediante `fill` y emite `update` con el nuevo objeto `Fill`. La aplicación puede componer [GradientEditorBar](./gradient-editor-bar) y [GradientEditorStop](./gradient-editor-stop) en su ranura.

## Véase también

- [useGradientStops](../advanced/use-gradient-stops)
