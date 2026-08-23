---
title: Variables
description: Créer des variables, collections et modes, puis les lier aux propriétés de design.
---

# Variables

Les variables stockent des valeurs réutilisables, comme des couleurs et des espacements. Une propriété liée est mise à jour lorsque la variable change.

## Ouvrir l’éditeur

Lorsqu’aucun objet n’est sélectionné, l’onglet **Design** affiche les propriétés de la page. L’icône des réglages de la section Variables ouvre l’éditeur.

## Collections et modes

Une collection regroupe des variables liées. Chaque collection peut avoir plusieurs modes, par exemple Clair et Sombre, avec une valeur différente par variable.

- Un clic change de collection.
- Un double clic sur le nom permet de la renommer.
- Les boutons d’en-tête créent collections et modes.

## Modifier les variables

Le tableau contient le nom, le type et une colonne par mode. Cliquez sur une cellule pour la modifier.

Types pris en charge : couleur, nombre, texte et booléen. Les couleurs se modifient avec un champ et un sélecteur.

## Lier remplissages et contours

Ouvrez le sélecteur de variables depuis le contrôle de couleur et choisissez une variable compatible. Le contrôle affiche le lien au lieu de copier la valeur.

Ouvrir ou sélectionner le champ ne modifie pas le lien. Seule la première modification réelle peut le supprimer ou modifier directement la variable, selon le contrôle.

## Alias

Une variable peut en référencer une autre. OpenPencil résout la chaîne selon le mode actif et détecte les cycles.

## Importation et exportation

Les variables sont conservées lors des importations et exportations `.fig`. La CLI peut aussi les lister et les modifier via l’API compatible avec les plugins Figma.
