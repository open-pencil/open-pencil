---
title: Examinar archivos con la CLI
description: Consultar páginas, objetos, jerarquías, variables y formatos de documentos `.fig`.
---

# Examinar archivos con la CLI

La CLI permite conocer la estructura de un archivo sin abrir el editor.

```sh
bun lawha info design.fig
bun lawha pages design.fig
bun lawha tree design.fig
```

## Resumen

`info` muestra formato, versión, número de páginas y objetos, tamaño del lienzo, fuentes, variables y metadatos principales.

## Páginas y árbol

`pages` enumera las páginas. `tree` imprime la jerarquía y puede limitar profundidad, página o número de resultados.

```sh
bun lawha tree design.fig --depth 3
```

## Buscar objetos

`find` busca por nombre, tipo u otras condiciones.

```sh
bun lawha find design.fig --name Button
bun lawha find design.fig --type TEXT
```

## Ver un objeto

`node` muestra las propiedades del identificador indicado, incluidas geometría, estilo, relaciones y datos específicos de su tipo.

```sh
bun lawha node design.fig 12:34
```

## Variables

`variables` enumera colecciones, modos, tipos y valores.

```sh
bun lawha variables design.fig
```

## Formatos

`formats` lista los formatos de documento registrados y sus capacidades de lectura y escritura.

## Aplicación en ejecución

Cuando la aplicación de escritorio está abierta, omite el archivo: la CLI se conecta por RPC y opera sobre el lienzo en vivo:

```sh
bun lawha documents list    # lista los ID de documentos y páginas abiertos
bun lawha tree              # inspecciona el documento activo
bun lawha tree --document-id tab-123 --page-id 0:1
bun lawha eval --document-id tab-123 --page-id 0:1 -c "..."
```

En flujos con agentes, usa `bun lawha documents list --json` y pasa `--document-id` y `--page-id` de forma explícita en lugar de depender de la pestaña o página visible. Para abrir, guardar, cambiar y cerrar documentos, deshacer, modificar ajustes o llamar a cualquier herramienta del editor, consulta [Controlar la aplicación](/programmable/cli/app-control).

## Lint

`lint` revisa un diseño con reglas de accesibilidad y consistencia.

```sh
bun lawha lint design.fig
bun lawha lint design.pen --preset strict
bun lawha lint design.fig --rule color-contrast
bun lawha lint design.fig --list-rules
bun lawha lint design.fig --fix -o fixed.fig
```

Usa `--json` para una salida legible por máquinas; cada mensaje incluye su `fix` y sus `suggestions` como datos. `--fix` aplica las correcciones seguras —enlazar los colores a la variable de color que coincide y redondear la geometría a píxeles enteros— y escribe el resultado en el archivo `.fig` indicado con `-o`.

## Salida JSON

Los comandos de consulta admiten `--json`, apropiado para `jq`, CI y programas que necesiten una salida estable y legible por máquinas.

```sh
bun lawha pages design.fig --json | jq '.[].name'
```

Usa `bun lawha --help` o añade `--help` a un subcomando para ver todas las opciones.
