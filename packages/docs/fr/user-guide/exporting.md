---
title: Exporter
description: Exporter la sélection en PNG, JPG, WEBP ou SVG et enregistrer des fichiers `.fig`.
---

# Exporter

## Exportation d’images

Sélectionnez un objet et ouvrez **Exporter** dans le panneau des propriétés. Chaque réglage définit :

- le format : PNG, JPG, WEBP ou SVG ;
- l’échelle ou une largeur explicite ;
- le suffixe du nom ;
- la qualité pour JPG et WEBP.

Un objet peut avoir plusieurs réglages. L’aperçu apparaît sur un damier afin de vérifier la transparence.

Vous pouvez aussi ouvrir **Exporter…** depuis le menu contextuel.

## Copier comme

Le menu contextuel copie la sélection comme texte, SVG, PNG ou JSX.

## Enregistrer les documents

**Enregistrer** met à jour le fichier actuel. **Enregistrer sous…** choisit un nouvel emplacement. Tauri utilise des dialogues natifs ; Chrome et Edge peuvent utiliser File System Access API ; les autres navigateurs téléchargent le fichier.

Les fichiers `.fig` exportés contiennent les données Kiwi, la compression Zstandard et une miniature. Les composants et ensembles sont conservés pour pouvoir rouvrir le fichier dans Figma.

## Choisir un format

- PNG conserve la transparence et convient aux interfaces.
- JPG réduit la taille des photographies.
- WEBP offre une bonne compression pour le Web.
- SVG conserve les vecteurs modifiables et convient aux icônes et au code.
