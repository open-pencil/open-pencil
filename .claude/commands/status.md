---
description: Résumé de l'état actuel du projet
argument-hint:
---

## Contexte

- Features : consulter `.claude/context/features.md`
- Roadmap : consulter `.claude/context/roadmap.md`

## Ta tâche

Générer un résumé concis et actionnable de l'état du projet Verso.

### Sections du rapport

1. **Features** :
   - Done : nombre et liste
   - En cours : nombre et liste avec progression
   - Planifiées : nombre et prochaines priorités P0

2. **Roadmap** :
   - Phase actuelle et avancement
   - Prochaines tâches P0/P1
   - Epic en cours

3. **Git** (si dans un repo git) :
   - Branche courante
   - Derniers commits (5 max)
   - Branches actives
   - PRs ouvertes (si `gh` disponible)

4. **Santé** :
   - Tâches en retard ou bloquées
   - Fichiers modifiés non commités
   - Tests qui échouent (lancer `pnpm test` si disponible)
   - Points d'attention

### Format

```
========================================
STATUS — Verso
========================================

PHASE ACTUELLE : Phase X — [Nom]

FEATURES
  Done      : X
  En cours  : X  [liste]
  Planifié  : X  [prochaine P0]

ROADMAP
  Prochaine tâche : [description]
  Epic en cours   : [nom epic]

GIT
  Branche : [branche]
  Commits récents : X
  PRs ouvertes : X

SANTÉ
  [points d'attention ou "Tout est en ordre"]
========================================
```
