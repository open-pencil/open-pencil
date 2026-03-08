---
title: Designs analysieren
description: Farben, Typografie, Abstände und wiederkehrende Muster in .fig-Dateien auditieren.
---

# Designs analysieren

Die `analyze`-Befehle prüfen ein gesamtes Designsystem vom Terminal aus — Inkonsistenzen finden, die tatsächliche Palette extrahieren, Komponenten erkennen, die noch extrahiert werden sollten.

## Farben

```sh
open-pencil analyze colors design.fig
```

Findet jede Farbe in der Datei, zählt die Verwendung und zeigt ein visuelles Histogramm:

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Typografie

```sh
open-pencil analyze typography design.fig
```

Listet jede Kombination aus Schriftfamilie, -größe und -gewicht mit Nutzungszahlen auf. Nützlich, um einmalige Textstile zu erkennen, die konsolidiert werden sollten.

## Abstände

```sh
open-pencil analyze spacing design.fig
```

Prüft Gap- und Padding-Werte über alle Auto-Layout-Frames hinweg. Hilft, Inkonsistenzen in der Abstandsskala zu identifizieren — z.B. ein einzelner `13px`-Gap zwischen ansonsten `8/16/24`-Werten.

## Cluster

```sh
open-pencil analyze clusters design.fig
```

Findet wiederkehrende Knotenmuster, die in Komponenten extrahiert werden könnten:

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## JSON-Ausgabe

Alle Analyse-Befehle unterstützen `--json` für maschinenlesbare Ausgabe:

```sh
open-pencil analyze colors design.fig --json
```

Weiterleiten an `jq`, in CI-Prüfungen einspeisen oder in Skripten verwenden, die Design-Token-Budgets durchsetzen.
