---
title: Exportar desde la CLI
description: Generar imágenes, SVG, HTML, historias de Storybook y otros resultados sin abrir el editor.
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

## JSX con Tailwind

Exporta JSX con clases de utilidad Tailwind:

```sh
bun open-pencil export design.fig -f tailwind-jsx    # o: -f jsx --style tailwind
```

## Storybook

Genera un archivo CSF3 `.stories.ts` por cada conjunto de componentes o componente:

```sh
bun open-pencil export design.fig -f storybook                      # historias de React en ./design-stories/
bun open-pencil export design.fig -f storybook --framework vue -o src/stories
bun open-pencil export design.fig -f storybook --framework html --page "Components"
bun open-pencil export design.pen -f storybook -o src/stories --watch  # reexporta en cada guardado
bun open-pencil export 'src/**/*.pen' -f storybook --beside --watch    # historias junto a cada diseño
```

### Diseños junto a sus historias

Guarda el archivo de diseño de cada componente en la carpeta del componente y exporta con `--beside`: las historias, las imágenes de diseño y el manifiesto `.openpencil-stories.json` de cada documento van a la carpeta de ese documento, junto al código del componente. Un glob de `stories` de Storybook como `../src/**/*.stories.ts` en `.storybook/main.ts` las recoge sin más configuración.

Pasa varios documentos, o un glob entre comillas como `'src/**/*.pen'` que OpenPencil expande por sí mismo (Node.js 22 o posterior). Varios documentos requieren `--beside` o `--output`; `--page` solo funciona con un documento. Los documentos se exportan uno tras otro y, si uno falla, el resto se exporta igualmente antes de que el comando termine con un error. `--watch` vigila todos los documentos coincidentes; un documento creado después de iniciar la vigilancia requiere ejecutar el comando de nuevo.

Cada variante de un conjunto de componentes se convierte en una historia y sus propiedades de variante pasan a ser controles `select`, de modo que al cambiar un control se muestra la variante correspondiente. Un conjunto con comportamiento recibe en su lugar las props del control: un Switch o un Checkbox un booleano `checked`, un Toggle `pressed`, un Collapsible `open` y `disabled` cuando el conjunto dibuja un estado deshabilitado; hover, pressed y foco siguen siendo historias propias. Los componentes independientes con nombres separados por barras, como `Button/Primary` y `Button/Secondary`, se agrupan en un único archivo `Button` con un control `Variant`. Una combinación para la que el diseño no tiene variante lanza en Storybook un error con nombre en lugar de mostrar otra variante.

Las historias muestran el componente como HTML con estilos en línea, igual que `-f html`, así que no necesitan el runtime de OpenPencil; `--framework` (`react`, `vue` o `html`) solo cambia el contenedor y la importación de `Meta`/`StoryObj` desde `@storybook/react-vite`, `@storybook/vue3-vite` o `@storybook/html-vite`. El texto usa las familias tipográficas del documento, que Storybook debe cargar por su cuenta. Las propiedades de texto, booleanas y de intercambio de instancia aún no se exportan.

Las historias incluyen entradas `parameters.design` para [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil:** cuando la ruta del documento está dentro del directorio actual, un [enlace `openpencil://`](../index#url-scheme) que abre el documento en la aplicación de escritorio y selecciona la variante, o su conjunto de componentes cuando otra capa comparte el nombre de la variante. El esquema direcciona las capas por nombre, así que una historia cuyos nombres de variante y de componente comparten otras capas no recibe enlace.
- **Design:** un PNG a 2× de la variante, escrito en `<Name>.design/` junto a la historia y referenciado con `new URL(…, import.meta.url)`, de modo que Vite lo empaqueta. Copia el parámetro a la historia de tu propio componente para comparar la implementación con el diseño. `--no-design-images` omite el renderizado; la sustitución de fuentes sigue `--font-policy`, como en la exportación raster.

`-o` indica el directorio de salida. Allí, un manifiesto `.openpencil-stories.json` registra qué documento, como ruta relativa al directorio de salida, y qué página generó cada historia e imagen de diseño; súbelo al repositorio junto con las historias. Una exportación reemplaza los archivos que generó antes una exportación del mismo documento, incluidos los de componentes eliminados o renombrados desde entonces; con `--page`, solo los de esa página. Antes de cambiar nada, se niega a sobrescribir cualquier otro archivo: una historia escrita a mano, la de otro documento o una imagen suelta. Una exportación de una sola página cuyos nombres de archivo han pasado a historias de otra página pide una exportación completa. Sin el manifiesto, las historias existentes se consideran ajenas, así que elimínalas antes de volver a exportar. `--watch` mantiene el comando en ejecución y reexporta cada vez que se guarda el documento, de modo que la recarga en caliente de Storybook sigue al diseño; un guardado que no se puede leer se notifica y la vigilancia continúa. Un `--page` inexistente o una sustitución con `--font-policy strict` sí terminan el comando.

## Modo con la aplicación en ejecución

Omite el archivo para exportar desde la aplicación en ejecución:

```sh
bun open-pencil export -f png                       # exporta la selección del documento activo
bun open-pencil export --page "Components" -f png   # exporta todas las capas de una página
bun open-pencil export --node 1:23 -f png           # exporta una capa, en cualquier página
```

`--page` toma el nombre de una página y `--page-id` el ID de una página de `openpencil documents list`; ambas exportan esa página sin cambiar la aplicación a ella. Añade `--document-id` para exportar desde un documento distinto del activo.

Este modo admite PNG, JPG, WEBP, SVG y PDF. PowerPoint, JSX, HTML, Storybook y `.fig` requieren un archivo como argumento. La exportación de miniaturas en modo archivo aún no es compatible.

## Sobrescritura y rutas

`-o` o `--output` define la ruta. La CLI informa de errores de formato, objetos inexistentes y rutas no válidas en lugar de producir resultados parciales silenciosamente.

Consulta `bun open-pencil export --help` para ver los formatos y opciones disponibles en la versión instalada.
