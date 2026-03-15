---
id: "005"
title: "Intégration éditeur — ouvrir/sauver .design"
phase: 2
semaine: 3
priorite: haute
dependances: ["004"]
---

## Description
Intégrer le format .design dans l'éditeur : file dialog pour ouvrir des .design, auto-détection du format (natif OpenPencil vs .design), et sauvegarde en .design.

## Tâches
- [ ] Ajouter le file dialog pour ouvrir des fichiers .design (web + Tauri)
- [ ] Implémenter l'auto-détection de format (JSON natif vs .design)
- [ ] Ajouter "Save as .design" dans le menu File
- [ ] Ajouter "Export as .design" pour les fichiers natifs
- [ ] Gérer le drag & drop de fichiers .design sur le canvas
- [ ] Ajouter les associations de fichiers .design dans Tauri
- [ ] Afficher le nom du fichier .design dans la title bar
- [ ] Gérer le dirty state (modifications non sauvegardées)
- [ ] Tester l'ouverture de fichiers .design d'exemple

## Validation
- Ouvrir un fichier .design charge correctement le canvas
- Sauvegarder en .design produit un fichier valide
- Auto-détection fonctionne pour les deux formats
- Dirty state affiché dans la title bar
