---
id: "032"
title: "Adapter pour Cursor + publier Marketplace + Open VSX"
phase: 10
semaine: 26
priorite: haute
dependances: ["031"]
---

## Description
Adapter l'extension VS Code pour Cursor (compatibilité, features spécifiques), et publier sur le VS Code Marketplace et Open VSX Registry.

## Tâches
- [ ] Tester l'extension dans Cursor et identifier les incompatibilités
- [ ] Adapter pour les API spécifiques Cursor (si nécessaire)
- [ ] Ajouter des features spécifiques Cursor (intégration Composer, inline chat)
- [ ] Préparer le packaging pour le Marketplace (README, changelog, screenshots)
- [ ] Créer les assets visuels (icône 256x256, banner, screenshots annotées)
- [ ] Publier sur le VS Code Marketplace (vsce publish)
- [ ] Publier sur Open VSX Registry (pour les éditeurs alternatifs)
- [ ] Configurer le CI pour les publications automatiques sur tag
- [ ] Ajouter un lien "Install VS Code Extension" sur verso.dev
- [ ] Tester l'installation depuis le Marketplace dans VS Code et Cursor

## Validation
- Extension publiée sur VS Code Marketplace
- Extension publiée sur Open VSX Registry
- Installation fonctionnelle depuis le Marketplace dans VS Code
- Installation fonctionnelle dans Cursor
- CI de publication automatique configuré
- Page Marketplace avec description, screenshots et README complets
