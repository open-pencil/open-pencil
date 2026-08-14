---
title: Composants
description: Composants réutilisables, instances, surcharges et synchronisation live dans OpenPencil.
---
# Composants

Les composants sont des éléments réutilisables. Modifier le composant principal met automatiquement à jour ses instances.

## Parcourir les composants

Ouvrez l'onglet **Assets** du panneau gauche pour parcourir les composants locaux et les bibliothèques activées. Recherchez par nom, choisissez la grille ou la liste, puis insérez par clic, <kbd>Entrée</kbd> ou glisser-déposer. Les révisions téléchargées restent disponibles hors ligne.

## Créer un composant
<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>) — convertit un cadre ou un groupe en composant réutilisable. Une étiquette violette avec un losange apparaît au-dessus.

## Jeux de composants et variantes
<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> — combine deux composants ou plus dans un conteneur avec une bordure violette en pointillés.

Les variantes acceptent plusieurs dimensions, par exemple `Taille=Petite`, `État=Survol` et `Thème=Sombre`, sans exiger toutes les combinaisons. La variante en haut à gauche est la valeur par défaut et sert de repli lorsqu'une mise à jour ne contient plus de correspondance exacte. Le panneau des propriétés permet d'ajouter, renommer, réordonner et supprimer les dimensions et valeurs ; les doublons sont refusés.

## Propriétés de composant

Les composants prennent en charge les propriétés de texte, de visibilité booléenne et d'échange d'instance. Reliez une propriété à un champ descendant, puis modifiez sa valeur sur une instance sans la détacher. Les définitions et affectations sont conservées dans les fichiers `.fig`.

## Bibliothèques de composants

Une bibliothèque publie des composants sous forme de révision immuable. Ouvrez **Assets → Gérer les bibliothèques → Publier la bibliothèque**, définissez un ID stable et un nom lors de la première publication, sélectionnez les changements, puis publiez. Les changements non sélectionnés restent en attente.

Activez une bibliothèque dans **Gérer les bibliothèques**. Ses ressources apparaissent avec les composants locaux. Les définitions publiées sont en lecture seule dans le document consommateur, tandis que les instances liées et leurs surcharges restent modifiables.

Dans **Mises à jour**, comparez côte à côte l'instance actuelle et la nouvelle. Appliquez la mise à jour à une instance, toutes les instances d'une ressource, la page actuelle ou toutes les pages. Les propriétés compatibles sont conservées et un repli est signalé avant validation si une variante exacte a disparu. Les mises à jour sont annulables.

Les bibliothèques utilisent le catalogue local ou un fournisseur de stockage configuré. Les révisions téléchargées sont mises en cache. Les liaisons activées et définitions matérialisées sont enregistrées dans `.fig`, ce qui permet de rouvrir le document sans accès à la bibliothèque distante.

## Créer des instances
Clic droit → **Créer une instance**. L'instance apparaît à droite du composant source.

## Détacher une instance
<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> — devient un cadre sans lien.

## Synchronisation live
Modifier un composant met à jour automatiquement toutes ses instances. Les propriétés synchronisées incluent les dimensions, les couleurs, les contours, les effets, l'opacité, les coins arrondis et la mise en page.

## Surcharges
Les instances peuvent surcharger des propriétés sans rompre le lien.

## Hit testing
Clic sélectionne le composant. **Double-clic** pour entrer et sélectionner les enfants.

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Créer composant | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Créer jeu | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Détacher instance | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |
