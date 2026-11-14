---
title: provideEditor
description: Fournir une instance d’Editor aux composants descendants.
---

# provideEditor

`provideEditor(editor)` rend l’éditeur accessible aux composables et composants sans styles placés plus bas dans l’arbre Vue.

Appelez-le une fois à la racine de l’interface, puis utilisez `useEditor()` dans les descendants.

Le SDK public actuel utilise directement `provideEditor()` et `useEditor()`. `OpenPencilProvider`, mentionné dans d’anciens exemples, ne fait pas partie de l’API actuelle.

## Voir aussi

- [useEditor](./use-editor)
- [Premiers pas](../../getting-started)
