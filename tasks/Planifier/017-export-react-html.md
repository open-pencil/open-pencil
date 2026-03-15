---
id: "017"
title: "Export React+Tailwind et HTML+CSS depuis scene graph"
phase: 6
semaine: 14
priorite: haute
dependances: ["004"]
---

## Description
Adapter les exporteurs existants dans packages/format/ pour générer du React+Tailwind et du HTML+CSS à partir du scene graph d'OpenPencil, en utilisant le converter .design comme pont.

## Tâches
- [ ] Analyser les exporteurs existants dans packages/format/ (react.ts, html.ts)
- [ ] Adapter l'export React pour le scene graph OpenPencil (composants, props, JSX)
- [ ] Générer du Tailwind CSS idiomatique (classes utilitaires, responsive)
- [ ] Adapter l'export HTML+CSS pour le scene graph OpenPencil
- [ ] Gérer les composants/instances → composants React réutilisables
- [ ] Gérer les auto-layouts → Flexbox/Grid CSS
- [ ] Gérer les variantes → props conditionnels React
- [ ] Gérer les assets (images, icônes) → imports ou URLs
- [ ] Écrire des tests de snapshot pour les exports
- [ ] Comparer la qualité du code généré avec des benchmarks

## Validation
- Export React : composants compilables sans erreur, Tailwind classes valides
- Export HTML : pages rendues correctement dans un navigateur
- Auto-layout converti en Flexbox/Grid correct
- Tests de snapshot passent
- Code généré lisible et idiomatique
