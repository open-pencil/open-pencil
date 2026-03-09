---
title: Skripting
description: JavaScript mit der Figma Plugin API ausführen — Knoten abfragen, Designs im Stapel bearbeiten, Frames erstellen.
---

# Skripting

`open-pencil eval` bietet dir die vollständige Figma Plugin API im Terminal. Knoten lesen, Eigenschaften ändern, Formen erstellen — und Änderungen zurück in die Datei schreiben.

## Grundlegende Verwendung

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

Das `-c`-Flag nimmt JavaScript entgegen. Das `figma`-Global funktioniert wie die Figma Plugin API.

## Knoten abfragen

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Bearbeiten und speichern

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` schreibt die Änderungen zurück in die Eingabedatei. Verwende `-o output.fig`, um stattdessen in eine andere Datei zu schreiben.

## Von Stdin lesen

Für längere Skripte:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Live-App-Modus

Lass die Datei weg, um gegen die laufende Desktop-App auszuführen:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## Verfügbare API

Das `figma`-Objekt unterstützt:

- `figma.currentPage` — die aktive Seite
- `figma.root` — das Dokumentwurzel-Element
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`, etc.
- `.findAll()`, `.findOne()` — Nachkommen durchsuchen
- `.appendChild()`, `.insertChild()` — Baummanipulation
- Alle Eigenschafts-Setter: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing`, etc.

Dies ist dieselbe API, die Figma-Plugins verwenden, sodass bestehendes Wissen und Code-Snippets direkt übertragbar sind.

## JSON-Ausgabe

```sh
open-pencil eval design.fig -c "..." --json
```
