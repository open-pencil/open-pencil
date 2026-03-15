---
id: "029"
title: "Shared design systems — sync temps réel Convex"
phase: 9
semaine: 23
priorite: haute
dependances: ["028"]
---

## Description
Implémenter les design systems partagés au sein d'une équipe avec synchronisation en temps réel via Convex subscriptions.

## Tâches
- [ ] Schema Convex design-systems : tokens, composants, styles, team_id, version
- [ ] CRUD design systems dans Convex
- [ ] Sync temps réel via Convex subscriptions (changements propagés instantanément)
- [ ] Gestion des versions de design system (historique, rollback)
- [ ] UI dans l'éditeur : panel "Team Design System" dans la sidebar
- [ ] Importer des tokens/composants depuis le design system partagé
- [ ] Mettre à jour le design system depuis l'éditeur (push changes)
- [ ] Indicateur de sync dans l'éditeur (synced, syncing, conflict)
- [ ] Notifications quand un membre modifie le design system
- [ ] Export du design system partagé (tokens, documentation)

## Validation
- Modifications du design system propagées en temps réel (< 500ms)
- Historique des versions accessible et rollback fonctionnel
- Tokens importés depuis le design system utilisables dans le canvas
- Indicateur de sync précis
- Aucune perte de données lors de modifications simultanées
