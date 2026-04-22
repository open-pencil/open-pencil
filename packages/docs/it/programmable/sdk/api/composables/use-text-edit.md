---
title: useTextEdit
description: Gestisce la modifica del testo DOM, la composizione, la formattazione e la sincronizzazione per i nodi testo del canvas.
---

# useTextEdit

`useTextEdit()` fa da ponte tra l'input di testo DOM e il modello di modifica del testo canvas dell'editor.

Coordina:

- l'input di testo basato su textarea
- la composizione IME
- il lampeggio del cursore
- il comportamento di cancellazione/backspace
- i comandi di formattazione come grassetto/corsivo/sottolineato
- la sincronizzazione delle modifiche al testo nel grafo

## Utilizzo

```ts
useTextEdit(canvasRef, editor)
```

## Esempio base

Usalo nel componente proprietario del canvas insieme a `useCanvas()` e `useCanvasInput()`.

## Esempi pratici

### Supporta le scorciatoie di formattazione

`useTextEdit()` gestisce già le azioni di formattazione da tastiera come grassetto, corsivo e sottolineato mentre la modifica del testo è attiva.

### Mantieni canvas ed editor di testo sincronizzati

Aggiorna il testo e le esecuzioni di stile nel grafo mentre l'utente digita o modifica intervalli formattati.

## Note

Questo è un composable di integrazione canvas/editor, non un composable generico per campi di testo.

## API correlate

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
