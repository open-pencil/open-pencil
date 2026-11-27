---
pageClass: guide
title: Primeros pasos
description: Abre OpenPencil en el navegador o en tu ordenador, aprende a moverte por el editor y crea tu primer diseño.
---

# Primeros pasos

OpenPencil es un editor de diseño para pantallas, desde un solo botón hasta una app completa. Abre y guarda archivos de Figma, y funciona en el navegador o como app de escritorio.

## Abrir OpenPencil

- **En el navegador:** ve a [cloud.openpencil.dev](https://cloud.openpencil.dev). No hay nada que instalar.
- **En tu ordenador:** descarga la app para macOS, Windows o Linux desde la [página de descarga](/es/download). En un Mac también puedes instalarla con Homebrew: `brew install --cask openpencil`.

::: tip Nos hemos mudado desde app.openpencil.dev
La app web se ha trasladado a cloud.openpencil.dev. Los archivos que guardaste en el navegador en [app.openpencil.dev](https://app.openpencil.dev) seguirán ahí hasta que esa dirección empiece a redirigir: ábrela para guardarlos en Cloud o descargarlos.
:::

## Requisitos del sistema

En el navegador, OpenPencil necesita Chrome o Edge 111, Firefox 128 o Safari 16.4, o versiones posteriores. Los navegadores basados en Chrome, como Brave y Opera, funcionan a partir de las mismas versiones.

La app de escritorio necesita:

- **macOS** 13 Ventura o posterior, con las actualizaciones de Safari instaladas.
- **Windows** 10 o posterior, con el entorno de ejecución Microsoft Edge WebView2, que Windows mantiene actualizado.
- **Linux** con WebKitGTK 2.40 o posterior (`webkit2gtk-4.1`).

Si tu navegador o tu sistema es demasiado antiguo, OpenPencil te indica qué tienes que actualizar. Si ves ese aviso en un sistema que cumple estos requisitos, haz clic en **Informar de un problema** en el mensaje.

## Orientarte en el editor

<GuideImage name="getting-started/editor" alt="El editor con ocho áreas numeradas" />

1. **Menús.** Archivo, Editar, Ver y los demás, bajo el nombre del archivo.
2. **Páginas.** Cada página es un lienzo independiente dentro del mismo archivo.
3. **Capas.** Todo lo que hay en la página, en el orden en que se dibuja.
4. **Lienzo.** Donde diseñas.
5. **Barra de herramientas.** Herramientas para marcos, formas, la pluma y el texto.
6. **Panel Diseño.** Los ajustes de lo que has seleccionado. Las pestañas junto a **Diseño** lo muestran como código, abren el chat de IA y revisan tu diseño en busca de problemas.
7. **Zoom.** Haz clic en el porcentaje para ver las opciones de zoom.
8. **Compartir y Vista previa.** Invita a otras personas al archivo o prueba tu diseño como prototipo.

## Crear tu primer diseño

1. Pulsa <Keys mac="F" other="F" /> y arrastra en el lienzo para dibujar un marco. Los marcos contienen el resto de tu diseño, como una pantalla o una tarjeta.
2. Pulsa <Keys mac="R" other="R" /> y arrastra dentro del marco para dibujar un rectángulo.
3. Pulsa <Keys mac="T" other="T" />, haz clic dentro del marco y escribe.
4. Pulsa <Keys mac="Esc" other="Esc" /> para terminar de escribir. El panel Diseño muestra ahora la fuente y el tamaño del texto.
5. Pulsa <Keys mac="⌘ S" other="Ctrl S" /> para guardar.

[Abrir y guardar](./user-guide/files) explica dónde se guarda tu archivo.

## Buscar un comando

Pulsa <Keys mac="⌘ K" other="Ctrl K" /> y escribe lo que quieres hacer, como «alinear a la izquierda» o «exportar». Elige un resultado para ejecutarlo. También puedes escribir el nombre de una página para ir a ella.

## Usar un teléfono o una tableta

En una pantalla pequeña, los paneles pasan a un cajón en la parte inferior. Sus botones abren las capas, el panel Diseño, el código y el chat de IA.

## Siguientes pasos

- [Navegación del lienzo](./user-guide/canvas-navigation): muévete por el lienzo y haz zoom.
- [Selección y manipulación](./user-guide/selection-and-manipulation): selecciona, mueve y redimensiona capas.
- [Capas y páginas](./user-guide/layers-and-pages): organiza el contenido de tu archivo.
- [Auto-layout](./user-guide/auto-layout): crea marcos que cambian de tamaño con su contenido.

¿Quieres compilar OpenPencil tú mismo? Consulta [Contribuir](/development/contributing#build-from-source).
