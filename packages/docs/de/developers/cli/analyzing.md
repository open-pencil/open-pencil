---
title: Designs analysieren
description: Farben, Typografie, Abstände und wiederkehrende Strukturen in `.fig`-Dateien untersuchen.
---

# Designs analysieren

Die `analyze`-Befehle prüfen ein vollständiges Dokument im Terminal. Sie zeigen Farben und Textstile, Abweichungen bei Abständen und wiederkehrende Strukturen, die sich als Komponenten eignen könnten.

## Farben

```sh
openpencil analyze colors design.fig
```

Zählt jede Farbe und zeigt ein Histogramm.

## Typografie

```sh
openpencil analyze typography design.fig
```

Listet Kombinationen aus Schriftfamilie, Größe und Schnitt mit ihrer Häufigkeit auf.

## Abstände

```sh
openpencil analyze spacing design.fig
```

Prüft Abstände und Innenabstände in Rahmen mit automatischer Anordnung. So wird beispielsweise ein einzelner Wert von `13px` zwischen üblichen `8/16/24` sichtbar.

## Wiederkehrende Strukturen

```sh
openpencil analyze clusters design.fig
```

Sucht wiederkehrende Objektstrukturen, die als Komponenten zusammengefasst werden könnten.

## JSON-Ausgabe

Alle Analysebefehle unterstützen `--json`. Die Ausgabe kann mit `jq`, in CI oder in Skripten für Designtoken verarbeitet werden.
