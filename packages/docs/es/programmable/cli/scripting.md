---
title: Scripting
description: Ejecuta JavaScript con la API de Plugins de Figma — consulta nodos, modifica diseños por lotes, crea frames.
---

# Scripting

`open-pencil eval` te da acceso a la API completa de Plugins de Figma en la terminal. Lee nodos, modifica propiedades, crea formas — y luego guarda los cambios en el archivo.

## Uso Básico

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

El flag `-c` recibe JavaScript. El global `figma` funciona como la API de Plugins de Figma.

## Consultar Nodos

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Modificar y Guardar

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` escribe los cambios de vuelta al archivo de entrada. Usa `-o output.fig` para escribir en un archivo diferente.

## Leer desde Stdin

Para scripts más largos:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Modo Aplicación en Vivo

Omite el archivo para ejecutar contra la aplicación de escritorio en ejecución:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## API Disponible

El objeto `figma` soporta:

- `figma.currentPage` — la página activa
- `figma.root` — la raíz del documento
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()`, etc.
- `.findAll()`, `.findOne()` — buscar descendientes
- `.appendChild()`, `.insertChild()` — manipulación del árbol
- Todos los setters de propiedades: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing`, etc.

Esta es la misma API que usan los plugins de Figma, por lo que el conocimiento existente y los fragmentos de código se transfieren directamente.

## Salida JSON

```sh
open-pencil eval design.fig -c "..." --json
```
