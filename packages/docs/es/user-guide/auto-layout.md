---
title: Disposición automática
description: Flexbox y CSS Grid con dirección, separación, relleno, alineación y modos de tamaño.
---

# Disposición automática

La disposición automática distribuye los objetos secundarios dentro de un marco. Admite Flexbox horizontal o vertical y Grid con filas, columnas y pistas configurables.

## Activar

- Selecciona un marco y pulsa <kbd>⇧</kbd><kbd>A</kbd>.
- Selecciona varios objetos sueltos y usa el mismo atajo para envolverlos en un marco nuevo.

## Dirección y separación

Los objetos pueden fluir en horizontal, vertical o con salto de línea. La separación controla la distancia entre objetos y el relleno la distancia al borde del marco.

## Alineación

En el eje principal están disponibles inicio, centro, final y espacio entre elementos. En el eje transversal se ofrecen inicio, centro, final y estirar.

## Tamaño

- **Fijo:** usa anchura o altura explícitas.
- **Rellenar:** ocupa el espacio disponible.
- **Ajustar:** adapta el tamaño al contenido.

El primer cambio real de anchura o altura convierte solo ese eje a fijo. El foco del campo no cambia el modo.

## CSS Grid

Grid distribuye los objetos en filas y columnas con tamaños `fr`, `px` o `auto`. Los espacios de fila y columna se configuran por separado. Cada objeto puede definir fila, columna y número de celdas ocupadas.

El resultado se exporta como JSX con clases Tailwind.
