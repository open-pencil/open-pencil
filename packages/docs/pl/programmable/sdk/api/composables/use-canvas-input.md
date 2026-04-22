---
title: useCanvasInput
description: Podłącz wejście wskaźnika kanvasu, przeciąganie, selekcję, zmianę rozmiaru, obrót i zachowanie narzędzi.
---

# useCanvasInput

`useCanvasInput()` łączy interakcję wskaźnika i myszy z kanwasem edytora.

Obsługuje zagadnienia interakcji takie jak:

- selekcja
- przeciąganie
- zmiana rozmiaru
- obrót
- przesuwanie
- przepływy pióra/rysowania
- interakcja edycji tekstu
- testy trafień uwzględniające zakres

## Użycie

Ten kompozyt jest zazwyczaj parowany z `useCanvas()` i pomocnikami testów trafień z renderera.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Podstawowy przykład

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

## Przykłady praktyczne

### Śledź ruch kursora w przestrzeni kanvasu

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

## Uwagi

Ten kompozyt jest niższego poziomu niż większość logiki paneli. Najlepiej nadaje się do powłok edytora i kontenerów kanvasu.

## Powiązane API

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
