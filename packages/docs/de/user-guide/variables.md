---
title: Variablen
description: Design-Variablen, Sammlungen, Modi und Füllbindungen in OpenPencil.
---

# Variablen

Variablen speichern wiederverwendbare Design-Token — Farben, Abstandswerte und andere Eigenschaften — die an Knoten gebunden werden können. Ändern Sie den Wert einer Variable und jeder Knoten, der sie verwendet, aktualisiert sich.

## Variablen-Dialog öffnen

Ohne ausgewählte Knoten zeigt der Design-Tab Seiteneigenschaften einschließlich eines Variablen-Bereichs. Klicken Sie auf das Einstellungen-Symbol, um den Variablen-Dialog zu öffnen.

## Sammlungen

Variablen sind in Sammlungen organisiert. Jede Sammlung erscheint als Tab im Dialog.

- **Sammlung wechseln** — auf einen Tab klicken
- **Sammlung umbenennen** — Doppelklick auf den Tab-Namen

## Modi

Jede Sammlung kann mehrere Modi haben (z.B. Hell und Dunkel). Modi erscheinen als Spalten in der Variablentabelle.

## Variablen verwalten

- **Variable erstellen** — klicken Sie auf „+ Variable erstellen"
- **Name bearbeiten** — klicken Sie auf die Namens-Zelle
- **Wert bearbeiten** — klicken Sie auf eine Wert-Zelle
- **Suchen** — tippen Sie in die Suchleiste zum Filtern

### Farbvariablen

Farbvariablen zeigen eine Inline-Farbeingabe mit Picker.

## Variablen an Füllungen binden

Im Füllungsbereich verwenden Sie den Variablen-Picker, um eine Farbvariable an eine Knotenfüllung zu binden.

- **Binden** — Farbvariable auswählen. Die Füllung zeigt ein lila Badge mit dem Variablennamen.
- **Lösen** — auf den Lösen-Button im Badge klicken.

## Tipps

- Verwenden Sie Sammlungen, um verwandte Token zu gruppieren (z.B. „Primitives" für Rohfarben, „Semantic" für rollenbasierte Aliase).
- Modi sind nützlich für Themenwechsel — definieren Sie Hell- und Dunkel-Werte in derselben Sammlung.
- Variablen unterstützen Aliase — eine „Semantic"-Sammlung kann Werte aus einer „Primitives"-Sammlung referenzieren.
