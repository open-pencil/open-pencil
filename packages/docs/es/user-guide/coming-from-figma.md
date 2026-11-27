---
pageClass: guide
title: Si vienes de Figma
description: Trae tus archivos y capas de Figma a OpenPencil, y descubre qué funciona igual y qué funciona de otra manera.
---

# Si vienes de Figma

OpenPencil lee y escribe los propios archivos `.fig` de Figma y usa los nombres y los atajos de Figma, así que casi todo lo que sabes te sirve aquí. Tus archivos siguen siendo tuyos: vuelven a abrirse en Figma siempre que lo necesites.

## Traer tus archivos

1. En Figma, abre el archivo y elige **File → Save local copy…**.
2. En OpenPencil, abre el archivo `.fig` o arrástralo a la ventana. Consulta [Abrir y guardar](./files).

Al guardar en OpenPencil se escribe un archivo `.fig` que también se abre en Figma.

## Copiar capas entre los dos

Selecciona capas en Figma, pulsa <Keys mac="⌘ C" other="Ctrl C" /> y pégalas en OpenPencil con <Keys mac="⌘ V" other="Ctrl V" />. También funciona en sentido contrario. Los rellenos, trazos, efectos, textos, el auto-layout, los radios de esquina y los trazados vectoriales se conservan.

Las imágenes de las capas pegadas se descargan de Figma, así que el archivo de Figma del que proceden tiene que ser uno que puedas abrir. <Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> y <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> copian y pegan solo el aspecto de una capa, también hacia y desde Figma.

## Qué funciona igual

- **Marcos, grupos, secciones y auto-layout**, con los mismos ajustes, incluido el diseño en cuadrícula.
- **Componentes, variantes e instancias**, con propiedades y slots. Consulta [Componentes](./components).
- **Variables y modos**. Consulta [Variables](./variables).
- Los **estilos** de tus archivos y bibliotecas se aplican como en Figma.
- Los **atajos** son los de Figma, como <Keys mac="R" other="R" /> para un rectángulo y <Keys mac="⇧ A" other="Shift A" /> para el auto-layout. Consulta [Atajos de teclado](/reference/keyboard-shortcuts).

## Qué funciona de otra manera

- **Bibliotecas.** Las bibliotecas de equipo de Figma no se conectan a OpenPencil. Para compartir componentes entre archivos aquí, [publica una biblioteca de OpenPencil](./component-libraries).
- **Estilos.** Puedes aplicar y separar estilos, pero todavía no crearlos ni editarlos. Usa [variables](./variables) para los colores y tamaños nuevos.
- Los **modos de variables** se definen en un marco o una página, en **Apariencia**, donde cada colección tiene siempre una fila.
- **Fuentes.** La app de escritorio usa las fuentes de tu ordenador. En el navegador, Chrome y Edge también pueden usarlas una vez que das permiso. Consulta [Elegir una fuente](./text-editing#elegir-una-fuente).
- El **prototipado** todavía no está disponible. Los componentes pueden [funcionar como controles](./components#hacer-que-un-componente-funcione-como-un-control) en la vista previa, como un interruptor que cambia de estado.
- El **historial de versiones** es para los archivos de [OpenPencil Cloud](/cloud/).

La [Matriz de funcionalidades Figma](/es/reference/figma-compatibility) recoge todas las funciones de Figma y hasta qué punto las admite OpenPencil.

## En lugar de plugins y Dev Mode

- **Pregunta a la IA.** Mucho de lo que hacen los plugins, como renombrar capas, crear variantes o comprobar el contraste, lo hace el [chat de IA](./ai-chat) a partir de una frase. También puede usar un [agente de programación](./coding-agents) que tengas.
- **Escribe un script.** Los scripts usan la misma API que los plugins de Figma, `figma.currentPage` y lo demás. Consulta [Scripts](/es/developers/cli/scripting).
- **Obtén el código.** La pestaña Código, junto a Diseño, muestra la selección como HTML, Vue o React, con CSS o Tailwind.
- **Revisa los diseños.** [Revisar diseños](./checking-designs) encuentra contraste bajo, áreas táctiles pequeñas y colores que deberían usar una variable.
