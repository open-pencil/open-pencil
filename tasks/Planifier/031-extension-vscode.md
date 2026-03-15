---
id: "031"
title: "Extension VS Code — webview, file association, MCP"
phase: 10
semaine: 25
priorite: haute
dependances: ["012"]
---

## Description
Créer l'extension VS Code pour Verso : webview panel pour visualiser les .design, association de fichiers, auto-start du serveur MCP, commandes.

## Tâches
- [ ] Initialiser le projet d'extension VS Code (TypeScript, esbuild)
- [ ] Webview panel : preview du fichier .design (rendu simplifié ou iframe éditeur)
- [ ] File association : .design → icône custom, double-click ouvre la webview
- [ ] Auto-start du serveur MCP Verso quand un .design est détecté dans le workspace
- [ ] Commande "Verso: Open Editor" → ouvre l'éditeur complet dans un panel
- [ ] Commande "Verso: Validate Design" → exécute la validation et affiche les issues
- [ ] Commande "Verso: Export to Code" → export dans le dossier courant
- [ ] Commande "Verso: Show Design Context" → affiche le contexte dans un panel
- [ ] Intégration avec le terminal : commandes verso CLI
- [ ] Configuration de l'extension (path vers le serveur MCP, options d'export)
- [ ] Tests unitaires de l'extension

## Validation
- Extension s'installe sans erreur dans VS Code
- Fichiers .design s'ouvrent dans la webview avec preview
- Serveur MCP démarre automatiquement
- Toutes les commandes fonctionnent correctement
- Configuration persistée et respectée
