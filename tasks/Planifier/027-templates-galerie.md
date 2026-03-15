---
id: "027"
title: "Templates Convex + galerie verso.dev/templates"
phase: 8
semaine: 21
priorite: moyenne
dependances: ["026"]
---

## Description
Implémenter le système de templates dans Convex et créer la galerie de templates accessible sur verso.dev/templates.

## Tâches
- [ ] Schema convex/templates.ts : metadata, preview, .design file, catégorie, tags
- [ ] CRUD templates dans Convex (create, read, list, update, delete)
- [ ] Upload et storage des fichiers .design et previews
- [ ] API de recherche et filtrage (catégorie, tags, popularité)
- [ ] Page galerie verso.dev/templates avec grille de previews
- [ ] Filtres : catégorie (landing, dashboard, mobile, etc.), tags, tri
- [ ] Page détail template : preview agrandie, description, bouton "Use template"
- [ ] "Use template" → ouvre l'éditeur avec le template chargé
- [ ] Templates de base : 5-10 templates de qualité pour le lancement
- [ ] Système de likes/favoris pour les utilisateurs connectés

## Validation
- Galerie accessible sur verso.dev/templates
- Filtres et recherche fonctionnels
- "Use template" charge le design dans l'éditeur
- 5-10 templates de qualité disponibles au lancement
- Performance : chargement galerie < 2s
