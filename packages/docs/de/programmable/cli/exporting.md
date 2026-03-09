---
title: Exportieren
description: .fig-Dateien als PNG, JPG, WEBP, SVG oder JSX mit Tailwind-Klassen rendern.
---

# Exportieren

Designs vom Terminal aus exportieren — Rasterbilder, Vektoren oder JSX-Code.

## Bildexport

```sh
open-pencil export design.fig                          # PNG (Standard)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG in 2×, Qualität 90
open-pencil export design.fig -f webp -s 3             # WEBP in 3×
open-pencil export design.fig -f svg                   # SVG-Vektor
```

Optionen:

- `-f` — Format: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — Skalierung: `1`–`4`
- `-q` — Qualität: `0`–`100` (nur JPG/WEBP)
- `-o` — Ausgabepfad
- `--page` — Seitenname
- `--node` — bestimmte Knoten-ID

## JSX-Export

Als JSX mit Tailwind-Utility-Klassen exportieren:

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Ausgabe:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Unterstützt auch `--style openpencil` für das native JSX-Format (siehe [JSX-Renderer](../jsx-renderer)).

## Vorschaubilder

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Live-App-Modus

Lass die Datei weg, um aus der laufenden App zu exportieren:

```sh
open-pencil export -f png    # Screenshot der aktuellen Zeichenfläche
```
