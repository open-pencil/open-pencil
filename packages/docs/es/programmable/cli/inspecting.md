---
title: Inspeccionar Archivos
description: Navega árboles de nodos, busca por nombre o tipo, y examina propiedades desde la terminal.
---

# Inspeccionar Archivos

El CLI te permite explorar archivos `.fig` sin abrir el editor. Cada comando también funciona con la aplicación en vivo — simplemente omite el argumento de archivo.

::: tip Instalar
```sh
bun add -g @open-pencil/cli
# o
brew install open-pencil/tap/open-pencil
```
:::

## Información del Documento

Obtén un resumen rápido — cantidad de páginas, nodos totales, fuentes utilizadas, tamaño del archivo:

```sh
open-pencil info design.fig
```

## Árbol de Nodos

Imprime la jerarquía completa de nodos:

```sh
open-pencil tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Buscar Nodos

Buscar por tipo:

```sh
open-pencil find design.fig --type TEXT
```

Buscar por nombre:

```sh
open-pencil find design.fig --name "Button"
```

Ambos flags se pueden combinar para refinar aún más los resultados.

## Detalles del Nodo

Inspecciona todas las propiedades de un nodo específico por su ID:

```sh
open-pencil node design.fig --id 1:23
```

## Páginas

Lista todas las páginas del documento:

```sh
open-pencil pages design.fig
```

## Variables

Lista las variables de diseño y sus colecciones:

```sh
open-pencil variables design.fig
```

## Modo Aplicación en Vivo

Cuando la aplicación de escritorio está en ejecución, omite el argumento de archivo — el CLI se conecta vía RPC y opera sobre el lienzo en vivo:

```sh
open-pencil tree              # inspeccionar el documento en vivo
open-pencil eval -c "..."     # consultar el editor
```

## Salida JSON

Todos los comandos soportan `--json` para salida legible por máquinas — envía a `jq`, alimenta scripts de CI, o procesa con otras herramientas:

```sh
open-pencil tree design.fig --json | jq '.[] | .name'
```
