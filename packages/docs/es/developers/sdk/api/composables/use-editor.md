---
title: useEditor
description: Acceder a la instancia de Editor proporcionada.
---

# useEditor

`useEditor()` devuelve la instancia registrada con `provideEditor()`.

Desde ella puede accederse al estado, SceneGraph, selección, herramientas, historial, páginas, componentes y demás acciones del núcleo.

El composable produce un error claro si se usa fuera del árbol donde se proporcionó el editor.

## Véase también

- [provideEditor](./provide-editor)
- [Arquitectura](../../architecture)
