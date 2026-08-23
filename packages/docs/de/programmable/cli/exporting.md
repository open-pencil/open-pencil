---
title: Export mit der CLI
description: PNG, JPG, WEBP, SVG, `.fig`, JSX und HTML exportieren oder Dokumentformate umwandeln.
---

# Export mit der CLI

Die CLI exportiert Rasterbilder, SVG, Teile eines Dokuments als `.fig`, JSX und HTML.

## Formate

```sh
openpencil export design.fig                           # PNG
openpencil export design.fig -f jpg -s 2 -q 90        # JPG mit 2×
openpencil export design.fig -f svg                   # SVG
openpencil export design.fig -f fig --page "Page 1"   # Seite als .fig
openpencil export design.fig -f html --css tailwind    # HTML mit Tailwind-Klassen
```

`-f` wählt das Format, `-s` den Maßstab, `-q` die Qualität und `-o` den Ausgabepfad. `--page` und `--node` begrenzen den Export.

## JSX

```sh
openpencil export design.fig -f jsx --style tailwind
```

`--style openpencil` erzeugt das native JSX-Format des [JSX-Renderers](../jsx-renderer).

## HTML

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
openpencil export design.fig -f html --html standalone --assets external
```

Der eigenständige HTML-Export wird sofort mit Tailwind kompiliert und benötigt keine Browser-Laufzeit. `--assets external` schreibt CSS und Bilder neben die HTML-Datei. `--fonts assets` speichert aufgelöste Webschriften als lokale `@font-face`-Dateien.

Der HTML-Export dient Übergabe und Weiterverarbeitung, nicht als pixelgenauer Ersatz für die Darstellung auf der Arbeitsfläche.
