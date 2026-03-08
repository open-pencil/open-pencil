---
title: Dateien inspizieren
description: Knotenbäume durchsuchen, nach Name oder Typ suchen und Eigenschaften im Terminal untersuchen.
---

# Dateien inspizieren

Das CLI ermöglicht es, `.fig`-Dateien zu erkunden, ohne den Editor zu öffnen. Jeder Befehl funktioniert auch mit der laufenden App — lass einfach das Dateiargument weg.

::: tip Installation
```sh
bun add -g @open-pencil/cli
# oder
brew install open-pencil/tap/open-pencil
```
:::

## Dokumentinformationen

Erhalte einen schnellen Überblick — Seitenanzahl, Gesamtknoten, verwendete Schriften, Dateigröße:

```sh
open-pencil info design.fig
```

## Knotenbaum

Gibt die vollständige Knotenhierarchie aus:

```sh
open-pencil tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Knoten finden

Nach Typ suchen:

```sh
open-pencil find design.fig --type TEXT
```

Nach Name suchen:

```sh
open-pencil find design.fig --name "Button"
```

Beide Flags können kombiniert werden, um Ergebnisse weiter einzugrenzen.

## Knotendetails

Alle Eigenschaften eines bestimmten Knotens anhand seiner ID inspizieren:

```sh
open-pencil node design.fig --id 1:23
```

## Seiten

Alle Seiten im Dokument auflisten:

```sh
open-pencil pages design.fig
```

## Variablen

Designvariablen und ihre Sammlungen auflisten:

```sh
open-pencil variables design.fig
```

## Live-App-Modus

Wenn die Desktop-App läuft, lass das Dateiargument weg — das CLI verbindet sich über RPC und arbeitet auf der Live-Zeichenfläche:

```sh
open-pencil tree              # das Live-Dokument inspizieren
open-pencil eval -c "..."     # den Editor abfragen
```

## JSON-Ausgabe

Alle Befehle unterstützen `--json` für maschinenlesbare Ausgabe — weiterleiten an `jq`, in CI-Skripte einspeisen oder mit anderen Werkzeugen verarbeiten:

```sh
open-pencil tree design.fig --json | jq '.[] | .name'
```
