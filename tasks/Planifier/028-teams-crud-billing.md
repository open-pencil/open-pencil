---
id: "028"
title: "Teams CRUD + invitations + billing par siège"
phase: 9
semaine: 22
priorite: haute
dependances: ["027"]
---

## Description
Implémenter la gestion des équipes : CRUD, système d'invitations par email, et billing Stripe par siège ($49/seat/mo).

## Tâches
- [ ] Schema Convex teams : name, owner, members, plan, seats
- [ ] CRUD teams dans Convex (create, read, update, delete)
- [ ] Système de rôles : owner, admin, member, viewer
- [ ] Invitations par email avec lien unique et expiration
- [ ] Page d'acceptation d'invitation
- [ ] Billing par siège Stripe : ajout/suppression de sièges = proration automatique
- [ ] Dashboard team : liste membres, rôles, gestion sièges
- [ ] Transfert d'ownership
- [ ] Quitter une équipe
- [ ] Notifications email pour les invitations et changements de rôle

## Validation
- Création d'équipe et ajout de membres fonctionnel
- Invitations par email reçues et acceptables
- Billing par siège correct (proration Stripe)
- Rôles respectés (permissions différenciées)
- Dashboard team complet et fonctionnel
