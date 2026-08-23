---
title: Exportar desde la CLI
description: Generar imágenes, SVG, HTML y otros resultados sin abrir el editor.
---

# Exportar desde la CLI

`export` renderiza una página u objeto desde un archivo compatible.

```sh
bun open-pencil export design.fig -o preview.png
```

## Seleccionar contenido

Usa las opciones del comando para elegir página, identificador u objeto encontrado. El formato se deduce de la extensión o se indica explícitamente.

## Escala y tamaño

La escala controla la resolución de salida. También se pueden fijar anchura o altura, conservando las proporciones cuando solo se proporciona una dimensión.

## SVG

SVG conserva geometría vectorial y resulta útil para iconos, revisión y edición posterior.

```sh
bun open-pencil export design.fig --node 12:34 -o icon.svg
```

## HTML

La exportación HTML genera un documento independiente con la estructura y los estilos disponibles. Está pensada para entrega, inspección y procesamiento posterior, no como sustituto exacto del renderizador CanvasKit. Solo está disponible al trabajar con archivos.

## Sobrescritura y rutas

`-o` o `--output` define la ruta. La CLI informa de errores de formato, objetos inexistentes y rutas no válidas en lugar de producir resultados parciales silenciosamente.

Consulta `bun open-pencil export --help` para ver los formatos y opciones disponibles en la versión instalada.
