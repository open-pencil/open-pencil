---
id: "015"
title: "Indicateur qualité topbar + Theme preview light/dark"
phase: 5
semaine: 12
priorite: moyenne
dependances: ["014"]
---

## Description
Ajouter un indicateur de qualité du design dans la topbar (score global, couleur selon la qualité) et un switch de prévisualisation light/dark pour le theme du design.

## Tâches
- [ ] Indicateur qualité dans la topbar : score 0-100, couleur (rouge/orange/vert)
- [ ] Tooltip détaillé au hover : breakdown par catégorie (contraste, spacing, etc.)
- [ ] Click sur l'indicateur ouvre le panel Validation
- [ ] Mise à jour en temps réel quand le design change
- [ ] Switch light/dark dans la topbar pour prévisualiser le design dans les deux thèmes
- [ ] Le switch change le rendu du canvas (pas le thème de l'éditeur)
- [ ] Supporter les tokens de couleur qui dépendent du thème
- [ ] Animation de transition entre light et dark
- [ ] Raccourci clavier pour toggle le thème de preview

## Validation
- Indicateur visible et à jour dans la topbar
- Score reflète correctement la qualité du design
- Switch light/dark change le rendu du canvas
- Tokens de couleur s'adaptent au thème
- Transition fluide entre les thèmes
