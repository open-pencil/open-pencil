---
title: useCanvasInput
description: Cabla l'input del puntatore canvas, il trascinamento, la selezione, il ridimensionamento, la rotazione e il comportamento degli strumenti.
---

# useCanvasInput

`useCanvasInput()` connette le interazioni del puntatore e del mouse al canvas dell'editor.

Gestisce aspetti delle interazioni come:

- selezione
- trascinamento
- ridimensionamento
- rotazione
- panoramica
- flussi penna/disegno
- interazione per la modifica del testo
- hit testing consapevole dello scope

## Utilizzo

Questo composable viene tipicamente abbinato a `useCanvas()` e agli helper di hit-test del renderer.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Esempio base

```ts
const canvas = useCanvas(canvasRef, editor)

useCanvasInput(
  canvasRef,
  editor,
  canvas.hitTestSectionTitle,
  canvas.hitTestComponentLabel,
  canvas.hitTestFrameTitle,
)
```

## Esempi pratici

### Traccia il movimento del cursore nello spazio canvas

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  (cx, cy) => {
    console.log(cx, cy)
  },
)
```

## Note

Questo composable è di livello inferiore rispetto alla maggior parte della logica dei pannelli. È più adatto per le shell dell'editor e i contenitori canvas.

## API correlate

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
