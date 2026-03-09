---
title: Exportation
description: Exporter des images (PNG, JPG, WEBP, SVG) et gérer les fichiers .fig dans OpenPencil.
---
# Exportation

## Exportation d'images

Sélectionnez un nœud et utilisez la section Export dans le panneau de propriétés.

### Paramètres d'exportation

- **Échelle** — 0,5×, 0,75×, 1×, 1,5×, 2×, 3× ou 4× (masquée pour SVG — les vecteurs sont indépendants de la résolution)
- **Format** — PNG (fond transparent), JPG (fond blanc), WEBP (fond transparent), SVG (vecteur)

### Méthodes d'exportation

| Méthode | Mac | Windows / Linux |
|--------|-----|-----------------|
| Raccourci clavier | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Menu contextuel | Clic droit <kbd>→</kbd> Exporter… | Clic droit <kbd>→</kbd> Exporter… |
| Panneau propriétés | Bouton "Exporter" | Bouton "Exporter" |

## Copier en tant que

Le menu contextuel **Copier en tant que** offre des formats supplémentaires :

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Copier en tant que texte | — | — |
| Copier en tant que SVG | — | — |
| Copier en tant que PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Copier en tant que JSX | — | — |

## Opérations de fichier .fig

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Ouvrir | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Enregistrer | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Enregistrer sous | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

Les fichiers sauvegardés sont compressés et incluent une miniature pour l'aperçu. Compatibilité aller-retour avec Figma.

## Conseils

- Utilisez l'échelle 2× ou 3× pour les écrans haute résolution.
- JPG utilise toujours un fond blanc — utilisez PNG ou WEBP pour la transparence.
- Utilisez l'export SVG pour l'édition vectorielle dans des éditeurs de code ou Illustrator.
