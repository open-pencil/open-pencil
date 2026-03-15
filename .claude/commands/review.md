---
description: Audit du code selon les conventions et contraintes du projet
argument-hint: [fichier-ou-dossier]
---

## Contexte

- Conventions : consulter `.claude/context/conventions.md`
- Contraintes : consulter `.claude/context/constraints.md`
- Architecture : consulter `.claude/context/architecture.md`

## Ta tâche

Effectuer une revue de code complète.

**Cible** : si $ARGUMENTS est fourni, analyser ce fichier/dossier. Sinon, analyser les derniers changements (`git diff`).

### Critères de revue

1. **TypeScript** : strict mode respecté, zéro `any`, types explicites
2. **Conventions Verso** :
   - Fichiers en kebab-case, composants en PascalCase, variables en camelCase
   - Imports absolus via `@/canvas`, `@/document`, `@/panels`
   - JSDoc sur les exports, commentaires en français
   - CSS Modules pour les panels, PixiJS impératif pour le canvas
3. **State management** : Zustand + Immer pour l'état global, jamais de useState cross-composant
4. **Contraintes** :
   - Pas de `any`, pas de `// TODO` sans ticket
   - Pas de JSX dans le canvas (PixiJS impératif)
   - Pas de valeurs hardcodées (utiliser CSS variables)
   - Pas de packages interdits (moment.js, styled-components, redux...)
5. **Qualité** : lisibilité, DRY, complexité cyclomatique raisonnable
6. **Sécurité** : pas de secrets en dur, pas d'injection, validation des inputs
7. **Performance** : pas de renders inutiles, pas de fuites mémoire, 60fps canvas

### Format du rapport

```
## Revue de code — [cible]

### Problèmes critiques (à corriger)
- [fichier:ligne] Description du problème
  → Suggestion de correction

### Problèmes importants
- [fichier:ligne] Description
  → Suggestion

### Points mineurs
- [fichier:ligne] Description

### Suggestions d'amélioration
- [description]

### Résumé
- X problèmes critiques
- X problèmes importants
- X points mineurs
- X suggestions
- Score global : [A/B/C/D]
```
