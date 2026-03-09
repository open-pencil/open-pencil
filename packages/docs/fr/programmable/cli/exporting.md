---
title: Exporter
description: Rendez des fichiers .fig en PNG, JPG, WEBP, SVG ou JSX avec classes Tailwind.
---

# Exporter

Exportez des designs depuis le terminal — images raster, vecteurs ou code JSX.

## Export d'images

```sh
open-pencil export design.fig                          # PNG (par défaut)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG en 2×, qualité 90
open-pencil export design.fig -f webp -s 3             # WEBP en 3×
open-pencil export design.fig -f svg                   # SVG vectoriel
```

Options :

- `-f` — format : `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — échelle : `1`–`4`
- `-q` — qualité : `0`–`100` (JPG/WEBP uniquement)
- `-o` — chemin de sortie
- `--page` — nom de la page
- `--node` — identifiant de nœud spécifique

## Export JSX

Exportez en JSX avec des classes utilitaires Tailwind :

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Résultat :

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Supporte aussi `--style openpencil` pour le format JSX natif (voir [Moteur de rendu JSX](../jsx-renderer)).

## Miniatures

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Mode application en direct

Omettez le fichier pour exporter depuis l'application en cours d'exécution :

```sh
open-pencil export -f png    # capture du canevas actuel
```
