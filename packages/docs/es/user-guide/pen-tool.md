---
title: Herramienta pluma
description: Trazados vectoriales con curvas de Bézier en OpenPencil.
---
# Herramienta pluma

La herramienta pluma crea trazados vectoriales usando un modelo de redes vectoriales, compatible con el formato .fig de Figma.

## Activación

Pulsa <kbd>P</kbd> para activar la herramienta pluma.

## Colocar puntos

- **Clic** — punto de esquina (segmento recto)
- **Clic + arrastrar** — punto de curva con manejadores de tangente Bézier — la dirección y longitud del arrastre controlan la forma de la curva

## Cerrar un trazado

Haz clic en el **primer punto** del trazado para cerrarlo en un bucle. Los trazados cerrados se pueden rellenar.

## Trazados abiertos

Pulsa <kbd>Escape</kbd> para confirmar el trazado actual como trazado abierto. Los trazados abiertos se renderizan solo como trazos — no se rellenan.

## Redes vectoriales

Los trazados en OpenPencil usan redes vectoriales — un modelo más flexible que las listas simples de puntos que soporta trazados ramificados y topología compleja. Es el mismo modelo que usa Figma, así que los trazados se mantienen perfectamente al abrir y guardar archivos .fig.

## Atajos de teclado

| Acción | Mac | Windows / Linux |
|--------|-----|-----------------|
| Herramienta pluma | <kbd>P</kbd> | <kbd>P</kbd> |
| Confirmar trazado abierto | <kbd>Escape</kbd> | Escape |
