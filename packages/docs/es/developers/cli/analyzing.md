---
title: Analizar documentos con la CLI
description: Detectar colores, tipografías, espaciados y estructuras repetidas.
---

# Analizar documentos con la CLI

Los subcomandos `analyze` examinan el documento completo y ayudan a descubrir inconsistencias o candidatos a componentes.

## Colores

```sh
bun open-pencil analyze colors design.fig
```

Agrupa los colores de rellenos y contornos, cuenta su uso y ayuda a detectar tonos casi idénticos.

## Tipografía

```sh
bun open-pencil analyze typography design.fig
```

Enumera las combinaciones de familia, tamaño y estilo con su frecuencia. Así se identifican estilos aislados.

## Espaciado

```sh
bun open-pencil analyze spacing design.fig
```

Examina separación y relleno en marcos con disposición automática. Permite detectar, por ejemplo, un valor de `13px` entre los habituales `8/16/24`.

## Estructuras repetidas

```sh
bun open-pencil analyze clusters design.fig
```

Busca jerarquías similares que podrían convertirse en componentes y muestra coincidencia, tamaño y estructura.

## Salida JSON

Añade `--json` para procesar los resultados en CI, generar informes o aplicar reglas propias.

```sh
bun open-pencil analyze colors design.fig --json
```

Estos análisis no modifican el archivo. Para transformaciones usa [`eval`](./scripting).
