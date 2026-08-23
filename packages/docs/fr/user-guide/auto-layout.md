---
title: Disposition automatique
description: Flexbox et CSS Grid avec direction, espacement, marges intérieures, alignement et modes de taille.
---

# Disposition automatique

La disposition automatique répartit les objets enfants dans un cadre. Elle prend en charge Flexbox horizontal ou vertical et Grid avec lignes, colonnes et pistes configurables.

## Activer

- Sélectionnez un cadre et appuyez sur <kbd>⇧</kbd><kbd>A</kbd>.
- Sélectionnez plusieurs objets libres et utilisez le même raccourci pour les placer dans un nouveau cadre.

## Direction et espacement

Les objets peuvent s’enchaîner horizontalement, verticalement ou revenir à la ligne. L’espacement règle la distance entre eux ; les marges intérieures règlent la distance aux bords du cadre.

## Alignement

L’axe principal propose début, centre, fin et espace entre les éléments. L’axe transversal propose début, centre, fin et étirement.

## Taille

- **Fixe :** largeur ou hauteur explicite.
- **Remplir :** occupe l’espace disponible.
- **Ajuster :** adapte la taille au contenu.

La première modification réelle d’une dimension ne rend fixe que cet axe. Donner le focus au champ ne change pas le mode.

## CSS Grid

Grid répartit les objets en lignes et colonnes avec des tailles `fr`, `px` ou `auto`. Les espacements horizontal et vertical se règlent séparément. Chaque objet peut définir sa ligne, sa colonne et le nombre de cellules occupées.

Le résultat peut être exporté en JSX avec des classes Tailwind.
