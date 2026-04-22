---
title: useTextEdit
description: Gestiona la edición de texto en el DOM, la composición IME, el formateo y la sincronización para nodos de texto en el canvas.
---

# useTextEdit

`useTextEdit()` conecta la entrada de texto del DOM con el modelo de edición de texto del canvas del editor.

Coordina:

- entrada de texto respaldada por textarea
- composición IME
- parpadeo del cursor
- comportamiento de borrado/retroceso
- comandos de formato como negrita/cursiva/subrayado
- sincronización de los cambios de texto de vuelta al grafo

## Uso

```ts
useTextEdit(canvasRef, editor)
```

## Ejemplo básico

Usa este composable en el componente propietario del canvas junto con `useCanvas()` y `useCanvasInput()`.

## Ejemplos prácticos

### Soportar atajos de formato

`useTextEdit()` ya gestiona las acciones de formato de teclado como negrita, cursiva y subrayado mientras la edición de texto está activa.

### Mantener el canvas y el editor de texto sincronizados

Actualiza el texto del grafo y los rangos de estilo a medida que el usuario escribe o edita rangos con formato.

## Notas

Este es un composable de integración canvas/editor, no un composable genérico de campo de texto.

## APIs relacionadas

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
