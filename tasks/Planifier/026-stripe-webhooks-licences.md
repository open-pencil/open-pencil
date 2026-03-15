---
id: "026"
title: "Stripe webhooks → Convex + licences + dashboard"
phase: 8
semaine: 20
priorite: haute
dependances: ["025"]
---

## Description
Connecter les webhooks Stripe à Convex pour gérer les licences automatiquement, et créer le dashboard utilisateur avec gestion d'abonnement.

## Tâches
- [ ] Webhook handler Convex pour les événements Stripe
- [ ] Gérer checkout.session.completed → créer/activer licence
- [ ] Gérer customer.subscription.updated → mettre à jour le plan
- [ ] Gérer customer.subscription.deleted → révoquer licence
- [ ] Gérer invoice.payment_failed → notifier et grace period
- [ ] Modèle de licence dans Convex (plan, status, features, expiry)
- [ ] Dashboard utilisateur : profil, plan actuel, historique factures
- [ ] Bouton "Upgrade" / "Downgrade" avec Stripe Customer Portal
- [ ] Bouton "Cancel subscription" avec confirmation
- [ ] Affichage des features débloquées selon le plan

## Validation
- Webhooks Stripe → Convex fonctionnels (tous les événements)
- Licence créée automatiquement après paiement
- Licence révoquée après annulation
- Dashboard affiche les infos correctes
- Customer Portal Stripe accessible depuis le dashboard
