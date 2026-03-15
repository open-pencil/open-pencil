---
id: "006"
title: "Panel designContext dans l'UI (Vue 3)"
phase: 2
semaine: 4
priorite: moyenne
dependances: ["005"]
---

## Description
Créer un panel dans la sidebar de l'éditeur (Vue 3) permettant d'éditer les métadonnées du Design Context : brand, style, audience, references, rules. Ces données sont stockées dans le fichier .design.

## Tâches
- [ ] Créer le composant DesignContextPanel.vue dans la sidebar
- [ ] Section Brand : nom, couleurs primaires/secondaires, typographie, ton
- [ ] Section Style : direction artistique, mood board references
- [ ] Section Audience : personas, devices, contextes d'utilisation
- [ ] Section References : URLs, captures, annotations
- [ ] Section Rules : règles de design custom, contraintes métier
- [ ] Binding bidirectionnel avec le store (design-context dans le .design)
- [ ] Auto-save des modifications dans le fichier .design
- [ ] UI responsive avec accordéons pour chaque section
- [ ] Validation inline des champs

## Validation
- Panel accessible depuis la sidebar
- Modifications persistées dans le fichier .design
- Toutes les 5 sections éditables
- Validation inline fonctionnelle
