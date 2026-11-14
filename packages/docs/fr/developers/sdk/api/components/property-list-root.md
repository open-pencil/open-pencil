---
title: PropertyListRoot
description: Liste contrôlée pour remplissages, contours, effets et autres propriétés sous forme de tableau.
---

# PropertyListRoot

`PropertyListRoot` coordonne les propriétés stockées sous forme de tableaux, comme les remplissages, contours et effets.

Il reçoit les éléments et l’état mixte par ses propriétés, émet les changements et fournit dans son emplacement :

- les éléments actuels ;
- des actions pour ajouter, supprimer, remplacer et modifier partiellement ;
- une action pour changer la visibilité d’un élément.

La connexion à la sélection et à l’historique passe par `useEditorPropertyList()` ou un adaptateur de l’application.

## Voir aussi

- [PropertyListItem](./property-list-item)
- [usePropertyList](../advanced/use-property-list)
