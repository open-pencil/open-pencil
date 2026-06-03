---
title: Auto-layout
description: Layout flex y grid en Inkly — dirección, espaciado, padding, alineación, dimensionamiento y tracks CSS Grid.
---
# Auto-layout

El auto-layout posiciona los hijos automáticamente dentro de un marco. Soporta dos modos: **flex** (flujo horizontal/vertical) y **grid** (filas y columnas con dimensionamiento de tracks).

## Activar auto-layout

- Selecciona un marco y pulsa <kbd>⇧</kbd><kbd>A</kbd> (<kbd>Shift</kbd> + <kbd>A</kbd>) para activar o desactivar el auto-layout
- Selecciona nodos sueltos (sin marco padre) y pulsa <kbd>⇧</kbd><kbd>A</kbd> para envolverlos en un nuevo marco con auto-layout

## Dirección
- **Horizontal** — de izquierda a derecha
- **Vertical** — de arriba abajo
- **Ajuste** — ajusta cuando se acaba el espacio

## Espaciado
**Gap** entre hijos adyacentes. **Padding** entre borde del marco e hijos.

## Alineación
- **Eje principal (Justify):** inicio, centro, fin, espacio entre
- **Eje transversal (Align):** inicio, centro, fin, estirar

## Dimensionamiento de hijos
- **Fijo** — ancho/alto explícito
- **Rellenar** — se expande en el espacio disponible
- **Ajustar** — se reduce al contenido

## CSS Grid

El layout grid organiza los hijos en filas y columnas con dimensionamiento explícito de tracks.

### Activar Grid

Selecciona un marco con auto-layout activado y haz clic en el icono de cuadrícula en la barra de herramientas de layout para cambiar de flex a grid.

### Dimensionamiento de tracks

Define tracks de columnas y filas con tres modos:

- **fr** — unidad fraccional, divide el espacio disponible proporcionalmente
- **px** — tamaño fijo en píxeles
- **auto** — se ajusta al contenido

### Espaciado del grid

Establece gaps horizontales (columnas) y verticales (filas) separados entre celdas.

### Posicionamiento de hijos

Los hijos se colocan en las celdas del grid automáticamente en orden de fila. Puedes sobrescribir la ubicación con valores de inicio de columna/fila y span en las propiedades de layout del hijo.

### Exportación JSX y Tailwind

Los layouts grid se exportan como JSX con clases Tailwind: `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.
