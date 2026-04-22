---
title: useTextEdit
description: DOM-Textbearbeitung, Komposition, Formatierung und Synchronisierung für Canvas-Textknoten verwalten.
---

# useTextEdit

`useTextEdit()` verbindet DOM-Texteingabe mit dem Textbearbeitungsmodell des Editor-Canvas.

Es koordiniert:

- textarea-gestützte Texteingabe
- IME-Komposition
- Caret-Blinken
- Löschen/Rücktaste-Verhalten
- Formatierungsbefehle wie Fett/Kursiv/Unterstrichen
- Synchronisierung von Textänderungen zurück in den Graphen

## Verwendung

```ts
useTextEdit(canvasRef, editor)
```

## Einfaches Beispiel

Verwenden Sie dies in der Canvas-Owner-Komponente zusammen mit `useCanvas()` und `useCanvasInput()`.

## Praktische Beispiele

### Formatierungsverknüpfungen unterstützen

`useTextEdit()` behandelt bereits Tastaturformatierungsaktionen wie Fett, Kursiv und Unterstrichen, während die Textbearbeitung aktiv ist.

### Canvas und Text-Editor synchron halten

Es aktualisiert Graphtext und Style-Runs, während der Benutzer formatierte Bereiche tippt oder bearbeitet.

## Hinweise

Dies ist ein Canvas/Editor-Integrations-Composable, kein generisches Textfeld-Composable.

## Verwandte APIs

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
