---
pageClass: guide
title: Si vienes de pen.dev
description: Abre en OpenPencil archivos de pen.dev (antes Pencil), mira qué se conserva y sigue diseñando con un agente de IA.
---

# Si vienes de pen.dev

OpenPencil abre los archivos `.pen` de pen.dev, antes llamado Pencil. Tu diseño llega como capas que puedes editar, y sigues trabajando con el agente de IA que ya usas.

## Abrir un archivo `.pen`

Pulsa <Keys mac="⌘ O" other="Ctrl O" /> y elige el archivo, o arrástralo a la ventana. En tu ordenador, también puedes abrirlo desde el Finder o el Explorador de archivos con la app de escritorio.

OpenPencil lee archivos `.pen`, pero no los escribe. La primera vez que guardas, te pregunta dónde poner un archivo `.fig` nuevo, con el mismo nombre que el original; un navegador sin diálogo de guardado lo descarga en su lugar. El archivo `.pen` se queda como estaba, y el archivo `.fig` también se abre en Figma.

## Qué se conserva

- Marcos, formas y trazados, con sus rellenos, trazos y efectos.
- El texto y el diseño: filas, columnas, espaciados y rellenos interiores.
- Los componentes y sus instancias, con los cambios hechos en cada instancia.
- Los temas, como colecciones de [variables](./variables). Las opciones de tema que tus variables combinan, como el modo de color y la densidad, comparten una colección cuyos modos son sus combinaciones; una opción por sí sola recibe su propia colección.
- Los iconos y las imágenes.

Algunas cosas todavía no se conservan:

- Las capas de otros archivos que importa el documento.
- Las capas de script, navegador, shader, nota y contexto.
- En el navegador, las imágenes guardadas junto al archivo. Abre el archivo en la app de escritorio para conservarlas.

## Seguir trabajando con un agente de IA

El agente con el que diseñas en pen.dev también puede trabajar en OpenPencil:

- En la app de escritorio, usa como chat de IA [Claude Code, Codex, Cursor u otro agente de programación](./coding-agents) que ya tengas.
- O conecta tu agente al [servidor MCP](/developers/mcp-server) de OpenPencil desde su propio terminal o editor, y editará el documento abierto.

Los agentes editan el documento mientras está abierto, así que no necesitan un archivo `.pen` en el disco.
