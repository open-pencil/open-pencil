---
title: Analizar Diseños
description: Audita colores, tipografía, espaciado y patrones repetidos en archivos .fig.
---

# Analizar Diseños

Los comandos `analyze` auditan un sistema de diseño completo desde la terminal — encuentra inconsistencias, extrae la paleta real, detecta componentes que esperan ser extraídos.

## Colores

```sh
open-pencil analyze colors design.fig
```

Encuentra cada color en el archivo, cuenta el uso y muestra un histograma visual:

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Tipografía

```sh
open-pencil analyze typography design.fig
```

Lista cada combinación de familia tipográfica, tamaño y peso con conteos de uso. Útil para detectar estilos de texto aislados que deberían consolidarse.

## Espaciado

```sh
open-pencil analyze spacing design.fig
```

Audita los valores de gap y padding en los frames con auto-layout. Ayuda a identificar inconsistencias en la escala de espaciado — por ejemplo, un gap de `13px` suelto entre valores de `8/16/24`.

## Clusters

```sh
open-pencil analyze clusters design.fig
```

Encuentra patrones de nodos repetidos que podrían extraerse como componentes:

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## Salida JSON

Todos los comandos de análisis soportan `--json` para salida legible por máquinas:

```sh
open-pencil analyze colors design.fig --json
```

Envía a `jq`, alimenta verificaciones de CI, o úsalo en scripts que controlen presupuestos de tokens de diseño.
