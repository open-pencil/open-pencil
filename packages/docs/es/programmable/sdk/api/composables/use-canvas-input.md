---
title: useCanvasInput
description: Conectar puntero, arrastre, selección, tamaño, giro y herramientas con el lienzo.
---

# useCanvasInput

`useCanvasInput(options)` enlaza los eventos del elemento con el sistema de entrada del editor:

- movimiento, pulsación y liberación del puntero;
- selección y marco de selección;
- desplazamiento y zoom;
- arrastre de objetos;
- redimensionado y giro;
- herramientas de forma, Pluma, Texto y Mano;
- edición vectorial y de texto.

El composable convierte coordenadas de pantalla a coordenadas del lienzo y conserva la captura del puntero durante una interacción.

Esta API de bajo nivel está pensada principalmente para componentes que contienen el lienzo de una interfaz propia.

## Véase también

- [useCanvas](./use-canvas)
- [useTextEdit](./use-text-edit)
