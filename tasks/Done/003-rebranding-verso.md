---
id: "003"
title: "Rebranding OpenPencil → Verso"
phase: 1
semaine: 2
priorite: haute
dependances: ["002"]
---

## Description
Renommer tous les packages, fichiers de configuration, assets visuels et documentation pour passer d'OpenPencil à Verso. Appliquer la nouvelle palette de couleurs, le logo, le splash screen.

## Tâches
- [ ] Renommer tous les packages (package.json, imports) : openpencil → verso
- [ ] Mettre à jour tauri.conf.json (nom, identifiant, description, icône)
- [ ] Créer/remplacer le logo Verso (SVG + PNG toutes tailles)
- [ ] Appliquer la palette de couleurs Verso (CSS variables)
- [ ] Mettre à jour le splash screen desktop
- [ ] Réécrire README.md principal avec la description Verso
- [ ] Mettre à jour LICENSE et ajouter NOTICE (attribution OpenPencil)
- [ ] Mettre à jour les métadonnées npm (scope @verso/)
- [ ] Vérifier que tous les builds passent après renommage
- [ ] Grep exhaustif pour s'assurer qu'aucune référence OpenPencil ne subsiste

## Validation
- Aucune mention de "OpenPencil" dans le code (sauf NOTICE/attribution)
- Logo Verso visible dans l'app web et desktop
- Palette de couleurs Verso appliquée
- Builds web + desktop fonctionnels
- LICENSE AGPL-3.0 + NOTICE conformes
