---
title: useExport
description: Gérer l’échelle et le format d’exportation de la sélection actuelle.
---

# useExport

`useExport()` fournit l’état et les actions d’un panneau d’exportation : sélection et réglages, format, échelle, suffixe, aperçu, création et modification des réglages, puis exécution.

Il expose aussi les échelles et formats pris en charge : `formats` (identifiants) et `formatOptions` (options avec libellé). Par exemple, `exportState.updateFormat(0, 'webp')`.

Utilisez-le pour construire une interface propre au-dessus du système d’exportation de l’éditeur.

## Voir aussi

- [Guide d’exportation](/user-guide/exporting)
