---
id: "021"
title: "Stripe integration + Docker + déploiement Coolify"
phase: 7
semaine: 17
priorite: haute
dependances: ["020"]
---

## Description
Intégrer Stripe pour les paiements (checkout, webhooks), créer le Docker build du site, et déployer sur Coolify à verso.dev.

## Tâches
- [ ] Créer les produits Stripe : Free, Pro ($19/mo), Team ($49/seat/mo)
- [ ] Intégrer Stripe Checkout pour les pages de pricing
- [ ] Implémenter la page de succès et de cancel post-paiement
- [ ] Configurer les webhooks Stripe (checkout.session.completed, subscription events)
- [ ] Créer le Dockerfile pour apps/site/ (multi-stage build)
- [ ] Configurer les variables d'environnement (Stripe keys, etc.)
- [ ] Déployer sur Coolify avec le domaine verso.dev
- [ ] Configurer SSL (Let's Encrypt via Coolify)
- [ ] Configurer le CDN et le caching
- [ ] Tester le flux de paiement complet en mode test Stripe

## Validation
- Flux de paiement Stripe fonctionnel (test mode)
- Webhooks reçus et traités correctement
- Site déployé et accessible sur verso.dev
- SSL configuré et fonctionnel
- Docker build < 2min, image < 500MB
