---
title: useTypography
description: Leer y modificar fuente, tamaño, espaciado y alineación del texto.
---

# useTypography

`useTypography()` proporciona estado y acciones para controles tipográficos:

- familia y estilo;
- tamaño e interlineado;
- espaciado entre letras;
- alineación horizontal y vertical;
- negrita, cursiva, subrayado y tachado;
- valores mixtos en selecciones múltiples.

Durante la edición de texto, los cambios pueden aplicarse solo al intervalo seleccionado.

### Ajustar ejes de fuentes variables

`axes` lista los ejes de la fuente variable del texto seleccionado, cada uno con su `tag`, `name`, rango y el `value` con que se dibuja (`MIXED` si las capas difieren); queda vacío con una fuente estática o con capas de familias distintas. `previewAxis` muestra un valor mientras se arrastra, `setAxis` lo fija en un paso de deshacer y `setOpticalSizeAuto` hace que el tamaño óptico siga al tamaño de fuente o lo mantiene. Cambiar grosor, inclinación o familia devuelve los ejes a los del estilo.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Véase también

- [TypographyControlsRoot](../components/typography-controls-root)
- [useFontPicker](../advanced/use-font-picker)
- [Edición de texto](/user-guide/text-editing)
