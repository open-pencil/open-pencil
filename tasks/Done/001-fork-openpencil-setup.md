---
id: "001"
title: "Fork OpenPencil + setup remotes + vérifier builds"
phase: 1
semaine: 1
priorite: haute
dependances: []
---

## Description
Forker le repo OpenPencil, configurer les remotes (origin = verso, upstream = openpencil), installer les dépendances avec bun, et vérifier que tout fonctionne : app web, app desktop Tauri, et suite de tests.

## Tâches
- [ ] Forker OpenPencil sur GitHub sous le compte/org Verso
- [ ] Cloner le fork localement
- [ ] Configurer remote upstream vers OpenPencil original
- [ ] Exécuter `bun install` et résoudre les éventuels conflits de dépendances
- [ ] Lancer l'app web en dev (`bun dev`) et vérifier le rendu
- [ ] Lancer l'app desktop Tauri et vérifier le fonctionnement
- [ ] Exécuter la suite de tests existante et s'assurer que tout passe
- [ ] Documenter les versions (Node, bun, Rust/Tauri) dans le README

## Validation
- `bun install` sans erreur
- App web démarre et affiche le canvas
- App desktop Tauri compile et s'ouvre
- Tests existants passent à 100%
