---
title: Esportazione
description: Renderizza file .fig in PNG, JPG, WEBP, SVG o JSX con classi Tailwind.
---

# Esportazione

Esporta i design dal terminale — immagini raster, vettoriali o codice JSX.

## Esportazione Immagini

```sh
open-pencil export design.fig                          # PNG (predefinito)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG a 2×, qualità 90
open-pencil export design.fig -f webp -s 3             # WEBP a 3×
open-pencil export design.fig -f svg                   # SVG vettoriale
```

Opzioni:

- `-f` — formato: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — scala: `1`–`4`
- `-q` — qualità: `0`–`100` (solo JPG/WEBP)
- `-o` — percorso di output
- `--page` — nome della pagina
- `--node` — ID di un nodo specifico

## Esportazione JSX

Esporta come JSX con classi utility Tailwind:

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Output:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Supporta anche `--style openpencil` per il formato JSX nativo (vedi [Renderer JSX](../jsx-renderer)).

## Miniature

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Modalità App in Esecuzione

Ometti il file per esportare dall'app in esecuzione:

```sh
open-pencil export -f png    # screenshot del canvas corrente
```
