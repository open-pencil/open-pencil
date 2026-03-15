---
id: "023"
title: "Déploiement docs + npm publish + GitHub Release v0.1.0"
phase: 7
semaine: 18
priorite: haute
dependances: ["022", "021"]
---

## Description
Déployer la documentation sur Coolify, publier le package @verso/mcp sur npm, et créer la première GitHub Release v0.1.0.

## Tâches
- [ ] Créer le Dockerfile pour apps/docs/
- [ ] Déployer la documentation sur Coolify (docs.verso.dev)
- [ ] Configurer SSL et caching pour la documentation
- [ ] Préparer @verso/mcp pour publication npm (package.json, README, exports)
- [ ] Publier @verso/mcp sur npm (version 0.1.0)
- [ ] Vérifier l'installation : `npx @verso/mcp` fonctionne
- [ ] Préparer les release notes pour v0.1.0
- [ ] Créer la GitHub Release v0.1.0 avec changelog et binaires desktop
- [ ] Configurer les GitHub Actions pour les releases automatiques futures
- [ ] Tester le téléchargement et l'installation depuis la release

## Validation
- Documentation accessible sur docs.verso.dev
- `npm install @verso/mcp` fonctionne
- `npx @verso/mcp` démarre le serveur MCP
- GitHub Release v0.1.0 publiée avec assets
- CI/CD de release configuré et fonctionnel
