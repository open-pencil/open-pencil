---
id: "025"
title: "Pages auth verso.dev + session management"
phase: 8
semaine: 20
priorite: haute
dependances: ["024"]
---

## Description
Créer les pages d'authentification sur verso.dev (login, register, forgot password, reset password) et implémenter la gestion des sessions.

## Tâches
- [ ] Page Login : email/password + boutons OAuth (GitHub, Google)
- [ ] Page Register : formulaire d'inscription + validation
- [ ] Page Forgot Password : envoi du lien de reset
- [ ] Page Reset Password : formulaire de nouveau mot de passe
- [ ] Page Email Verification : confirmation après inscription
- [ ] Session management : JWT, refresh tokens, expiration
- [ ] Middleware d'authentification pour les pages protégées
- [ ] Redirection post-login vers le dashboard
- [ ] Gestion des erreurs (compte existant, mauvais password, token expiré)
- [ ] Design cohérent avec la charte Verso

## Validation
- Flux complet : register → verify email → login → dashboard
- Flux OAuth : click → authorize → callback → dashboard
- Forgot password → email → reset → login
- Sessions persistantes et sécurisées
- Pages responsive et accessibles
