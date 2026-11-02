---
title: Skripte
description: JavaScript mit einer Figma-kompatiblen Plugin API ausführen, um Designs zu lesen, zu verändern und zu erzeugen.
---

# Skripte

`lawha eval` führt JavaScript für ein Lawha-Dokument aus und stellt das globale Objekt `figma` bereit. Der Befehl eignet sich für Massenänderungen, Prüfungen, Testdaten und Automatisierung ohne Editoroberfläche.

## Grundlagen

```sh
lawha eval design.fig -c "return figma.currentPage.children.length"
```

Beginnt der Code nicht mit `return`, führt Lawha ihn in einer asynchronen Funktion aus.

## Ändern und speichern

`--write` schreibt in die Eingabedatei, `--output` in eine neue Datei. Längere Skripte können über die Standardeingabe gelesen werden.

## Geöffnetes Dokument

Ohne Dateipfad wird das aktuelle Dokument der Desktop-App verwendet.

## Ausgabe

Nicht interaktive Ausgabe verwendet standardmäßig JSON. `--quiet` unterdrückt die Ausgabe.

## Unterstützte API

Die API orientiert sich an Figma Plugin API und arbeitet mit SceneGraph und dem Lawha-Dateiformat.

Sie umfasst Dokumente und Seiten, Objekterstellung, Baumoperationen, Komponenten, Variablen sowie häufige Eigenschaften für Geometrie, Darstellung, Text, automatische Anordnung und Konturen.

Exakte Namen wie `figma.createFrame()`, `node.appendChild()`, `fontSize` und `layoutMode` bleiben mit Figma kompatibel.

## Noch nicht kompatibel

Noch nicht angeboten werden unter anderem `node.exportAsync()`, `node.setBoundVariable()`, `figma.combineAsVariants()` und die Stil-APIs von Figma.

Dafür stehen je nach Aufgabe CLI-Export, Werkzeuge des Kernpakets oder direkte SceneGraph-Hilfsfunktionen zur Verfügung.
