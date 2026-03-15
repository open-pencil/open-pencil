---
id: "014"
title: "Panel Validation — issues, auto-fix, click→select"
phase: 5
semaine: 12
priorite: haute
dependances: ["010"]
---

## Description
Créer un panel de validation dans la sidebar avec bouton validate, issues groupées par severity, click pour sélectionner le node problématique, et suggestions d'auto-fix.

## Tâches
- [ ] Créer le composant ValidationPanel.vue
- [ ] Bouton "Validate" avec indicateur de progression
- [ ] Affichage des issues groupées par severity (error, warning, info)
- [ ] Chaque issue : icône, message, node concerné, suggestion de fix
- [ ] Click sur une issue → sélectionne et zoome sur le node concerné
- [ ] Bouton "Auto-fix" par issue (applique la suggestion automatiquement)
- [ ] Bouton "Auto-fix all" pour corriger toutes les issues fixables
- [ ] Filtres par type d'issue (contraste, spacing, touch target, etc.)
- [ ] Badge avec le nombre d'issues dans l'onglet du panel
- [ ] Historique des validations avec diff

## Validation
- Bouton validate lance la validation et affiche les résultats
- Click sur issue sélectionne le bon node sur le canvas
- Auto-fix corrige les issues sans casser le design
- Filtres fonctionnels
- Performance < 200ms pour afficher les résultats
