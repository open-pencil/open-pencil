---
id: "018"
title: "Export tokens + MCP tools export_to_code/export_tokens"
phase: 6
semaine: 14
priorite: haute
dependances: ["017"]
---

## Description
Implémenter l'export de design tokens (CSS custom properties, Tailwind config, JSON) et ajouter les outils MCP export_to_code et export_tokens.

## Tâches
- [ ] Implémenter l'export tokens → CSS custom properties (--color-primary, --spacing-md, etc.)
- [ ] Implémenter l'export tokens → Tailwind config (theme.extend)
- [ ] Implémenter l'export tokens → JSON (format W3C Design Tokens)
- [ ] Extraire les tokens automatiquement depuis le design (couleurs, spacing, typo, shadows)
- [ ] Implémenter l'outil MCP export_to_code (paramètres : format, scope, options)
- [ ] Implémenter l'outil MCP export_tokens (paramètres : format, tokens à exporter)
- [ ] Enregistrer les 2 nouveaux outils dans le serveur MCP
- [ ] Tester les exports avec des designs variés
- [ ] Documenter les formats de tokens supportés

## Validation
- CSS variables valides et utilisables directement
- Tailwind config valide et utilisable avec tailwind.config.js
- JSON conforme au format W3C Design Tokens
- Outils MCP fonctionnels via stdio et WebSocket
- Tokens extraits automatiquement sont corrects et complets
