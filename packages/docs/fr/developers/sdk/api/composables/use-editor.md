---
title: useEditor
description: Accéder à l’instance d’Editor fournie.
---

# useEditor

`useEditor()` renvoie l’instance enregistrée avec `provideEditor()`.

Elle donne accès à l’état, SceneGraph, la sélection, les outils, l’historique, les pages, les composants et les autres actions du noyau.

Le composable produit une erreur claire lorsqu’il est utilisé hors de l’arbre où l’éditeur a été fourni.

## Voir aussi

- [provideEditor](./provide-editor)
- [Architecture](../../architecture)
