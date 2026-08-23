---
title: useCanvas
description: Crear y mantener la superficie CanvasKit del editor.
---

# useCanvas

`useCanvas(options)` conecta un elemento `<canvas>` con el renderizador. Se encarga de:

- cargar CanvasKit;
- crear y recrear la superficie;
- observar el tamaño;
- ajustar la escala de píxeles;
- solicitar repintados;
- limpiar recursos al desmontar.

Puede configurar reglas, color de fondo y comportamiento de una vista previa integrada.

Use `CanvasRoot` y `CanvasSurface` para la composición habitual, o este composable cuando necesite controlar directamente el elemento.

## Véase también

- [CanvasRoot](../components/canvas-root)
- [CanvasSurface](../components/canvas-surface)
- [useCanvasInput](./use-canvas-input)
