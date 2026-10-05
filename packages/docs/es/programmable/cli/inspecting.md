---
title: Examinar archivos con la CLI
description: Consultar páginas, objetos, jerarquías, variables y formatos de documentos `.fig`.
---

# Examinar archivos con la CLI

La CLI permite conocer la estructura de un archivo sin abrir el editor.

```sh
bun open-pencil info design.fig
bun open-pencil pages design.fig
bun open-pencil tree design.fig
```

## Resumen

`info` muestra formato, versión, número de páginas y objetos, tamaño del lienzo, fuentes, variables y metadatos principales.

## Páginas y árbol

`pages` enumera las páginas. `tree` imprime la jerarquía y puede limitar profundidad, página o número de resultados.

```sh
bun open-pencil tree design.fig --depth 3
```

## Buscar objetos

`find` busca por nombre, tipo u otras condiciones.

```sh
bun open-pencil find design.fig --name Button
bun open-pencil find design.fig --type TEXT
```

## Ver un objeto

`node` muestra las propiedades del identificador indicado, incluidas geometría, estilo, relaciones y datos específicos de su tipo.

```sh
bun open-pencil node design.fig 12:34
```

## Variables

`variables` enumera colecciones, modos, tipos y valores.

```sh
bun open-pencil variables design.fig
```

## Formatos

`formats` lista los formatos de documento registrados y sus capacidades de lectura y escritura.

## Aplicación en ejecución

Cuando la aplicación de escritorio está abierta, omite el archivo: la CLI se conecta por RPC y opera sobre el lienzo en vivo:

```sh
bun open-pencil documents list    # lista los ID de documentos y páginas abiertos
bun open-pencil tree              # inspecciona el documento activo
bun open-pencil tree --document-id tab-123 --page-id 0:1
bun open-pencil eval --document-id tab-123 --page-id 0:1 -c "..."
```

En flujos con agentes, usa `bun open-pencil documents list --json` y pasa `--document-id` y `--page-id` de forma explícita en lugar de depender de la pestaña o página visible. Para abrir, guardar, cambiar y cerrar documentos, deshacer, modificar ajustes o llamar a cualquier herramienta del editor, consulta [Controlar la aplicación](/programmable/cli/app-control).

## Lint

`lint` revisa un diseño con reglas de accesibilidad y consistencia.

```sh
bun open-pencil lint design.fig
bun open-pencil lint design.pen --preset strict
bun open-pencil lint design.fig --rule color-contrast
bun open-pencil lint design.fig --list-rules
bun open-pencil lint design.fig --fix -o fixed.fig
```

Usa `--json` para una salida legible por máquinas; cada mensaje incluye su `fix` y sus `suggestions` como datos. `--fix` aplica las correcciones seguras —enlazar los colores a la variable de color que coincide y redondear la geometría a píxeles enteros— y escribe el resultado en el archivo `.fig` indicado con `-o`.

## Salida JSON

Los comandos de consulta admiten `--json`, apropiado para `jq`, CI y programas que necesiten una salida estable y legible por máquinas.

```sh
bun open-pencil pages design.fig --json | jq '.[].name'
```

Usa `bun open-pencil --help` o añade `--help` a un subcomando para ver todas las opciones.
