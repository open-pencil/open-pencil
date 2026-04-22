---
title: useCanvasInput
description: Canvas-Zeigereingabe, Ziehen, Auswahl, Größenänderung, Rotation und Werkzeugverhalten verdrahten.
---

# useCanvasInput

`useCanvasInput()` verbindet Zeiger- und Mausinteraktion mit dem Editor-Canvas.

Es behandelt Interaktionsbelange wie:

- Auswahl
- Ziehen
- Größenänderung
- Rotation
- Schwenken
- Stift-/Zeichenflows
- Textbearbeitungsinteraktion
- scope-bewusstes Hit-Testing

## Verwendung

Dieses Composable wird typischerweise mit `useCanvas()` und Hit-Test-Hilfsmitteln des Renderers kombiniert.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Einfaches Beispiel

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

## Praktische Beispiele

### Cursorbewegung im Canvas-Koordinatenraum verfolgen

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

## Hinweise

Dieses Composable ist auf niedrigerem Level als die meiste Panel-Logik. Es eignet sich am besten für Editor-Shells und Canvas-Container.

## Verwandte APIs

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
