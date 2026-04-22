---
title: useCanvasInput
description: Conecta la entrada de puntero del canvas con el arrastre, la selección, el redimensionado, la rotación y el comportamiento de herramientas.
---

# useCanvasInput

`useCanvasInput()` conecta las interacciones de puntero y ratón al canvas del editor.

Gestiona las siguientes interacciones:

- selección
- arrastre
- redimensionado
- rotación
- panorámica
- flujos de pluma/dibujo
- interacción de edición de texto
- hit testing consciente del ámbito

## Uso

Este composable suele combinarse con `useCanvas()` y los helpers de hit test del renderer.

```ts
useCanvasInput(
  canvasRef,
  editor,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
)
```

## Ejemplo básico

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

## Ejemplos prácticos

### Seguir el movimiento del cursor en el espacio del canvas

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

## Notas

Este composable es de más bajo nivel que la mayoría de la lógica de paneles. Es más adecuado para shells de editor y contenedores de canvas.

## APIs relacionadas

- [useCanvas](./use-canvas)
- [useEditor](./use-editor)
