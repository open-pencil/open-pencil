---
title: provideEditor
description: Proporcionar una instancia de Editor a los componentes descendientes.
---

# provideEditor

`provideEditor(editor)` pone el editor a disposición de los composables y componentes sin estilos situados más abajo en el árbol de Vue.

Llámelo una vez en el componente raíz de la interfaz y use `useEditor()` en sus descendientes.

El SDK público actual usa directamente `provideEditor()` y `useEditor()`. `OpenPencilProvider`, mencionado en ejemplos antiguos, no forma parte de la API actual.

## Véase también

- [useEditor](./use-editor)
- [Primeros pasos](../../getting-started)
