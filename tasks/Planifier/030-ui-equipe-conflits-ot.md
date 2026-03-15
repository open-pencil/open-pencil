---
id: "030"
title: "UI équipe éditeur + résolution conflits OT + tests"
phase: 9
semaine: 24
priorite: haute
dependances: ["029"]
---

## Description
Intégrer l'UI d'équipe dans l'éditeur (curseurs collaboratifs, présence), implémenter la résolution de conflits par Operational Transform, et écrire les tests.

## Tâches
- [ ] Curseurs collaboratifs en temps réel (nom + couleur par membre)
- [ ] Indicateur de présence : qui est en ligne, qui édite quoi
- [ ] Sélection collaborative : voir les sélections des autres membres
- [ ] Résolution de conflits OT pour les modifications simultanées du scene graph
- [ ] Gestion des conflits de propriétés (deux membres modifient le même node)
- [ ] Merge automatique pour les modifications non-conflictuelles
- [ ] UI de résolution manuelle pour les conflits irréconciliables
- [ ] Tests unitaires OT : convergence, commutativité, transformation
- [ ] Tests d'intégration : 2-3 clients simultanés modifiant le même document
- [ ] Tests de stress : 10+ clients, modifications rapides, reconnexion

## Validation
- Curseurs et sélections visibles en temps réel (< 100ms de latence)
- Modifications simultanées sans perte de données
- OT converge dans tous les cas de test
- Tests de stress passent sans corruption de données
- Reconnexion automatique et re-sync après déconnexion
