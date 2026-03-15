---
id: "009"
title: "Tests complets design-context > 90% couverture"
phase: 3
semaine: 7
priorite: haute
dependances: ["008"]
---

## Description
Écrire une suite de tests complète pour packages/design-context/ couvrant assembler, classifier et validator. Objectif : > 90% de couverture de code.

## Tâches
- [ ] Tests unitaires assembler — assemblage des 4 couches, résolution de conflits
- [ ] Tests unitaires classifier — catégorisation de designs variés
- [ ] Tests unitaires validator — chaque règle de validation individuellement
- [ ] Tests d'intégration — pipeline complet (classify → assemble → validate)
- [ ] Tests de performance — benchmarks sur des documents de taille croissante
- [ ] Tests edge cases — documents vides, nodes invalides, valeurs limites
- [ ] Tests de régression — cas réels de bugs corrigés
- [ ] Configurer la couverture de code dans vitest.config
- [ ] Ajouter les tests dans le CI (GitHub Actions)
- [ ] Documenter les fixtures de test et comment en ajouter

## Validation
- Couverture > 90% sur packages/design-context/
- Tous les tests passent en CI
- Tests de performance avec seuils définis
- Fixtures documentées et réutilisables
