---
id: "024"
title: "Convex self-hosted + schema + auth (email/GitHub/Google)"
phase: 8
semaine: 19
priorite: haute
dependances: ["021"]
---

## Description
Déployer Convex self-hosted sur Coolify, définir le schema de données, et implémenter l'authentification (email + GitHub + Google OAuth).

## Tâches
- [ ] Déployer Convex self-hosted sur Coolify
- [ ] Configurer le domaine api.verso.dev pour Convex
- [ ] Définir schema.ts : users, subscriptions, designs, teams, templates
- [ ] Implémenter l'auth email (inscription + login + reset password)
- [ ] Implémenter l'auth GitHub OAuth
- [ ] Implémenter l'auth Google OAuth
- [ ] Configurer les providers OAuth (GitHub App, Google Cloud Console)
- [ ] Implémenter la vérification email
- [ ] Configurer les rate limits et la protection anti-abuse
- [ ] Tester tous les flux d'authentification

## Validation
- Convex accessible sur api.verso.dev
- Inscription/login par email fonctionnel
- Login GitHub OAuth fonctionnel
- Login Google OAuth fonctionnel
- Schema déployé et migrations ok
- Rate limiting actif
