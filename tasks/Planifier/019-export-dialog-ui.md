---
id: "019"
title: "Export dialog UI — formats, preview, clipboard"
phase: 6
semaine: 15
priorite: moyenne
dependances: ["018"]
---

## Description
Créer un dialog d'export complet en Vue 3 : sélection du format, preview du code généré, copie dans le presse-papiers, téléchargement de fichiers.

## Tâches
- [ ] Créer le composant ExportDialog.vue (modal overlay)
- [ ] Sélecteur de format : React+Tailwind, HTML+CSS, Tokens CSS, Tokens Tailwind, Tokens JSON
- [ ] Sélecteur de scope : page entière, sélection, composant
- [ ] Options par format (indentation, naming convention, framework version)
- [ ] Preview du code avec syntax highlighting (Shiki ou Prism)
- [ ] Bouton "Copy to clipboard" avec feedback visuel
- [ ] Bouton "Download" pour télécharger le/les fichier(s)
- [ ] Bouton "Export to project" pour écrire directement dans un dossier
- [ ] Historique des derniers exports
- [ ] Raccourci clavier Cmd+E pour ouvrir le dialog

## Validation
- Dialog s'ouvre avec Cmd+E
- Tous les formats disponibles et fonctionnels
- Preview affiche le code correctement avec coloration syntaxique
- Copy to clipboard fonctionne
- Download produit des fichiers valides
