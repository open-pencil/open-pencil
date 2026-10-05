---
title: Variables
description: Créer des variables, collections et modes, puis les lier aux propriétés de design.
---

# Variables

Les variables stockent des tokens de design réutilisables, comme des couleurs, des espacements et d’autres propriétés, qui peuvent être liés à des objets. Lorsque la valeur d’une variable change, tous les objets qui l’utilisent sont mis à jour.

## Ouvrir la boîte de dialogue des variables

Lorsqu’aucun objet n’est sélectionné, l’onglet **Design** affiche les propriétés de la page, dont une section Variables indiquant le nombre de collections et de variables. L’icône des réglages ouvre la boîte de dialogue.

La boîte de dialogue liste à gauche les variables de la collection active, modifie à droite la variable sélectionnée ou la collection, et affiche en dessous la feuille de style qu’elles produisent. Dans une fenêtre étroite ou sur téléphone, elle n’affiche qu’un mode à la fois, et une variable, les paramètres de la collection ou la feuille de style s’ouvrent par-dessus la liste avec un bouton de retour.

## Collections

Les variables sont organisées en collections, affichées sous forme d’onglets (un menu sur les écrans étroits).

- **Changer de collection :** cliquez sur un onglet
- **Créer une collection :** cliquez sur le bouton en forme de dossier dans la barre d’outils (**Créer une collection**)
- **Renommer ou supprimer :** sans variable sélectionnée, la partie droite modifie la collection : changez son nom ou supprimez-la (**Supprimer la collection**)

## Modes

Chaque collection peut avoir plusieurs modes (par exemple Clair et Sombre). Les modes apparaissent sous forme de colonnes de valeurs dans la liste, et une variable a une valeur pour chaque mode. Ils se gèrent dans les **Paramètres de la collection** :

- **Ajouter un mode :** cliquez sur **+** à côté de **Modes**
- **Renommer :** modifiez le nom du mode
- **Dupliquer, définir par défaut, supprimer :** utilisez le menu **⋯** à côté du mode (**Dupliquer le mode**, **Définir par défaut**, **Supprimer le mode**)
- **Condition :** le sélecteur CSS ou la requête `@media`, `@supports` ou `@container` qui active le mode dans la feuille de style. Si elle est vide, c’est un attribut nommé d’après la collection et le mode, comme `[data-theme="dark"]` pour le mode Sombre d’une collection Theme. Le mode par défaut va toujours dans `:root`.

## Gérer les variables

Les variables sont regroupées selon les dossiers de leurs noms (`Brand/Primary` apparaît comme *Primary* sous *Brand*), avec leur nom CSS et une valeur par mode.

- **Créer une variable :** cliquez sur **+** dans la barre d’outils et choisissez un type ; la nouvelle variable s’ouvre pour modification
- **Sélectionner :** cliquez sur une ligne, ou déplacez-vous avec les flèches et appuyez sur Entrée
- **Rechercher :** saisissez du texte dans la barre de recherche pour filtrer les variables par nom
- **Supprimer :** cliquez sur **Supprimer la variable** en bas de ses paramètres

La sélection d’une variable permet de modifier :

- **Nom** et **Nom CSS** : laissez le nom CSS vide pour le déduire du nom et des portées, par exemple `--color-brand-primary`
- **Unité** : pour les nombres, `px`, `rem`, `%`, `ms`, `s`, `deg` ou aucune ; les valeurs sont saisies dans cette unité
- **Valeurs** : une par mode ; une couleur ouvre le sélecteur de couleur, et un alias affiche la variable vers laquelle il pointe
- **Expression CSS** : pour les nombres, une valeur comme `clamp(1rem, 4vw, 1.5rem)` écrite en CSS à la place du nombre, tandis que le canevas continue de dessiner le nombre
- **Portées** : les propriétés pour lesquelles la variable est proposée
- **Description**

## Feuille de style

Le bas de la boîte de dialogue affiche la collection active sous forme de propriétés personnalisées CSS ou de thème Tailwind v4. Le bouton de copie (**Copier toutes les variables en CSS**) copie les variables de tout le document dans ce format, de sorte que les alias vers d’autres collections sont résolus.

## Lier des variables aux remplissages

Dans la section Remplissage du panneau des propriétés, utilisez le sélecteur de variables pour lier une variable de couleur au remplissage d’un objet.

- **Lier :** choisissez une variable de couleur dans le sélecteur. Le remplissage affiche une pastille violette avec le nom de la variable.
- **Détacher :** cliquez sur le bouton de détachement de la pastille pour supprimer le lien. Le remplissage revient à la valeur de couleur résolue.

Lorsque la valeur de la variable change (ou lors d’un changement de mode), tous les remplissages liés sont mis à jour automatiquement.

## Conseils

- Utilisez des collections pour regrouper des tokens liés (par exemple `Primitives` pour les couleurs brutes, `Semantic` pour les alias par rôle et `Spacing` pour les valeurs de mise en page).
- Les modes sont utiles pour changer de thème : définissez les valeurs Clair et Sombre dans la même collection.
- Les variables prennent en charge les alias : une collection `Semantic` peut référencer des valeurs d’une collection `Primitives`.
- Consultez [Dessiner des formes](./drawing-shapes) pour le fonctionnement des remplissages et du sélecteur de couleur.
