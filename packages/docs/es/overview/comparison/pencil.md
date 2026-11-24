---
title: OpenPencil vs Pencil
description: En qué se diferencian OpenPencil, un editor de diseño de código abierto, y Pencil (pen.dev), una herramienta de diseño con IA propietaria, en licencia, formatos de archivo, IA, colaboración y precio.
---

# OpenPencil vs Pencil

[Pencil](https://pen.dev) es una herramienta comercial de diseño con IA que guarda los diseños en archivos `.pen` y trabaja junto a agentes de código. OpenPencil es un editor de diseño de código abierto que abre esos archivos `.pen` además de los archivos `.fig` de Figma. Son proyectos separados de equipos distintos. Esta página los compara según Pencil desktop 1.2 y OpenPencil 0.17.

## De un vistazo

|                        | OpenPencil                                                                                                   | Pencil                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Licencia               | Código abierto: MIT (editor), Apache 2.0 (servidor Cloud)                                                    | Propietaria                                                                           |
| Precio                 | Gratis; los planes de Cloud añaden almacenamiento, editores y créditos de IA                                 | Plan gratuito con IA limitada; planes Pro y Ultra por usuario                         |
| Dónde se ejecuta       | Aplicación de escritorio para macOS, Windows y Linux, y el navegador                                         | Aplicación de escritorio, extensión para editores de código y el navegador           |
| Formato nativo         | Figma `.fig`                                                                                                 | `.pen`                                                                                |
| Abre archivos `.pen`   | Sí                                                                                                           | Sí                                                                                    |
| Abre archivos `.fig`   | Los abre y los guarda                                                                                        | Los importa                                                                           |
| IA integrada           | Asistente de chat con más de 100 herramientas de diseño; tus propias claves de proveedor o créditos de Cloud | Agentes en el lienzo; tus propias claves, una suscripción a ChatGPT o Claude, o planes |
| Agentes de código      | Servidor MCP, además de Claude Code, Codex, Cursor y otros ejecutándose dentro del editor                    | Servidor MCP para Claude Code, Codex, Cursor y otros                                  |
| Scripts                | CLI sin interfaz y scripts compatibles con la Figma Plugin API                                               | CLI                                                                                   |
| Exportación de código  | Design JSX, HTML, Vue y React con CSS o Tailwind                                                             | HTML con CSS o Tailwind                                                               |
| Colaboración           | Edición en tiempo real en salas peer-to-peer, o en OpenPencil Cloud con comentarios e historial              | Enlaces para compartir, sesiones en vivo, comentarios y versiones                     |
| Autoalojamiento        | Servidor de OpenPencil Cloud                                                                                 | —                                                                                     |

## Licencia y archivos

Pencil se licencia, no se vende: sus términos prohíben modificar o redistribuir la aplicación. El editor de OpenPencil tiene licencia MIT y su servidor Cloud, Apache 2.0, así que puedes leerlo, cambiarlo y alojarlo todo.

OpenPencil guarda en el formato `.fig` de Figma, que también abren Figma y otras herramientas. Abre documentos `.pen`, así que un proyecto de Pencil se puede traer y guardar como `.fig`; consulta [Exportación](/user-guide/exporting) para abrir archivos.

## IA

Ambos editores están hechos para trabajar con IA. Pencil ejecuta varios agentes a la vez en el lienzo, genera imágenes y SVG, y descuenta el uso de IA de los límites del plan salvo que traigas tu propia clave o suscripción.

El [asistente de IA](/es/user-guide/ai-chat) de OpenPencil funciona con tu propia clave de Anthropic, OpenAI, Google AI, OpenRouter y otros proveedores, sin límite de uso por nuestra parte, o con los créditos que incluye un plan de Cloud. Más de 100 herramientas están abiertas a los agentes de código a través del [servidor MCP](/developers/mcp-server), y la aplicación de escritorio ejecuta [agentes de código](/user-guide/coding-agents) como Claude Code y Codex dentro del editor, cada uno con su propio cursor en el lienzo.

## Colaboración

OpenPencil permite editar juntos en tiempo real: abre una [sala peer-to-peer](/es/user-guide/collaboration) sin cuenta y sin nada que alojar, o guarda los documentos en [OpenPencil Cloud](/cloud/), alojado o en tu propio servidor, con uso compartido, comentarios e historial de versiones. Pencil comparte diseños por enlace y sesión en vivo, con comentarios y versiones, en su propio servicio.

## Dónde va por delante Pencil

- **Agentes en paralelo.** Pencil ejecuta hasta seis agentes en un mismo lienzo en su plan superior.
- **Imágenes generadas.** Pencil genera imágenes y SVG y elimina fondos; OpenPencil vectoriza imágenes mediante Recraft o fal.ai, pero no las genera.
- **Extensión para editores de código.** Pencil se ejecuta dentro de VS Code y Cursor; OpenPencil se ejecuta a su lado.

## Cuál elegir

Elige OpenPencil si quieres un editor de código abierto que puedas alojar tú mismo, archivos en un formato que Figma también abre e IA con tus propias claves sin límites de plan. Elige Pencil si quieres varios agentes diseñando a la vez dentro de tu editor de código.
