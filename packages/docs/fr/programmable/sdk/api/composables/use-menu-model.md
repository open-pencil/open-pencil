---
title: useMenuModel
description: Construisez des modèles de menu applicatif et canvas depuis l'état courant de l'éditeur.
---

# useMenuModel

`useMenuModel()` construit des structures de menu de plus haut niveau au-dessus des commandes éditeur et de l'état de sélection.

Il est utile quand vous voulez des groupes de menu prêts à l'affichage plutôt que de composer les commandes manuellement.

## Utilisation

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Exemple de base

```ts
const { canvasMenu } = useMenuModel()
```

Affichez `canvasMenu.value` dans votre composant de menu contextuel.

## Exemples pratiques

### Menu principal en style applicatif

`appMenu` regroupe les entrées en :

- Édition
- Vue
- Objet
- Disposition

### Menu contextuel avec déplacements entre pages

`canvasMenu` inclut des éléments dynamiques comme « Déplacer vers la page » selon la sélection courante et les pages disponibles.

### Libellés de sélection

`selectionLabelMenu` expose des libellés sensibles au contexte comme :

- `Masquer` / `Afficher`
- `Verrouiller` / `Déverrouiller`

## API associées

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
