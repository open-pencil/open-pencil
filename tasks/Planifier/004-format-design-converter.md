---
id: "004"
title: "Converter bidirectionnel scene graph ↔ .design"
phase: 2
semaine: 3
priorite: haute
dependances: ["001"]
---

## Description
Enrichir packages/format/ avec un converter.ts bidirectionnel capable de convertir le scene graph d'OpenPencil vers le format .design de Verso et inversement. Gérer tous les types de nodes, styles, contraintes et métadonnées.

## Tâches
- [ ] Analyser le scene graph d'OpenPencil (types de nodes, propriétés, hiérarchie)
- [ ] Analyser le format .design existant dans packages/format/
- [ ] Implémenter toGraph() : .design → scene graph OpenPencil
- [ ] Implémenter toDesign() : scene graph OpenPencil → .design
- [ ] Gérer les types de nodes : frame, rectangle, ellipse, text, path, group, component, instance
- [ ] Convertir les styles : fill, stroke, effects, blur, shadow
- [ ] Convertir les contraintes et auto-layout
- [ ] Gérer les métadonnées design-context dans le .design
- [ ] Écrire des tests unitaires pour chaque type de conversion
- [ ] Tester la conversion round-trip (A → B → A = A)

## Validation
- Conversion round-trip sans perte de données pour tous les types de nodes
- Tests unitaires > 90% couverture sur converter.ts
- Types TypeScript stricts, zéro `any`
