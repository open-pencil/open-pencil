---
title: OpenPencil vs Paper
description: En qué se diferencian OpenPencil, un editor de diseño de código abierto, y Paper, un lienzo de diseño comercial construido sobre HTML y CSS, en archivos de Figma, uso local, agentes de IA y precio.
---

# OpenPencil vs Paper

[Paper](https://paper.design) es una herramienta de diseño comercial cuyo lienzo está construido sobre HTML y CSS, hecha para trabajar con agentes de código de IA a través de MCP. OpenPencil es un editor de diseño de código abierto que abre los archivos `.fig` de Figma, tiene su propio asistente de IA y también ofrece a los agentes un conjunto completo de herramientas. Esta página los compara según Paper Desktop 0.5 y OpenPencil 0.17.

## De un vistazo

|                          | OpenPencil                                                                                                   | Paper                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Licencia                 | Código abierto: MIT (editor), Apache 2.0 (servidor Cloud)                                                    | Propietaria                                                                    |
| Precio                   | Gratis; los planes de Cloud añaden almacenamiento, editores y créditos de IA                                 | Plan gratuito con 100 llamadas MCP a la semana; Pro por editor                 |
| Plataformas              | Aplicación de escritorio para macOS, Windows y Linux, y el navegador                                         | Aplicación de escritorio para macOS, Windows y Linux, y el navegador           |
| Dónde viven los archivos | En tu dispositivo, en tu propio bucket de almacenamiento o en OpenPencil Cloud                               | El servicio de Paper                                                           |
| Autoalojamiento          | Servidor de OpenPencil Cloud                                                                                 | —                                                                              |
| Figma                    | Abre y guarda archivos `.fig`; copiar y pegar en ambos sentidos                                              | Pegar desde Figma                                                              |
| IA integrada             | Asistente de chat con más de 100 herramientas de diseño; tus propias claves de proveedor o créditos de Cloud | Generación de imágenes y SVG; trabajo de diseño mediante agentes externos      |
| Agentes de código        | Servidor MCP, además de Claude Code, Codex, Cursor y otros ejecutándose dentro del editor                    | Servidores MCP locales y remotos                                               |
| Scripts                  | CLI sin interfaz y scripts compatibles con la Figma Plugin API                                               | CLI para su servidor MCP                                                       |
| Exportación de código    | Design JSX, HTML, Vue y React con CSS o Tailwind                                                             | React con CSS o Tailwind                                                       |
| Exportación              | PNG, JPG, WEBP, SVG y `.fig`; PDF desde la CLI                                                               | PNG, SVG, PDF y vídeo                                                          |
| Colaboración             | Salas peer-to-peer u OpenPencil Cloud, con comentarios e historial de versiones                              | Edición en tiempo real con compañeros y agentes, y comentarios                 |

## Archivos y alojamiento

Paper guarda los diseños en su propio servicio. OpenPencil guarda archivos `.fig` normales que Figma también abre, y te deja tenerlos en tu dispositivo, en tu propio [bucket de almacenamiento](/user-guide/cloud-storage) o en [OpenPencil Cloud](/cloud/), alojado o en un [servidor gestionado por tu equipo](/cloud/self-hosting/). Abre archivos de Figma directamente, mientras que Paper recibe capas pegadas desde Figma.

## IA y agentes

Ambos están hechos para agentes. Paper no tiene asistente integrado: diseñas con él a través de un agente externo como Claude Code o Cursor sobre su servidor MCP, y su plan gratuito permite 100 llamadas MCP a la semana.

OpenPencil tiene un [asistente de IA](/es/user-guide/ai-chat) dentro del editor, que usa tu propia clave de proveedor o créditos de Cloud, y las mismas más de 100 herramientas están abiertas a agentes externos a través del [servidor MCP](/developers/mcp-server) sin límites de llamadas. La aplicación de escritorio también puede ejecutar [agentes de código](/user-guide/coding-agents) dentro del editor, cada uno con su propio cursor en el lienzo. La [CLI](/es/developers/cli/inspecting) y [`eval`](/es/developers/cli/scripting) trabajan con documentos sin abrir el editor en absoluto.

## Dónde va por delante Paper

- **Lienzo HTML y CSS.** Las capas de Paper son maquetación web, así que lo que diseñas es lo que renderiza un navegador. OpenPencil maqueta con flexbox y CSS Grid mediante Taffy y exporta HTML, pero su lienzo no es una página web.
- **Medios generados.** Paper genera imágenes y SVG y exporta vídeo.
- **MCP remoto.** El servidor MCP alojado de Paper funciona con la aplicación cerrada.

## Cuál elegir

Elige OpenPencil si quieres un editor de código abierto, archivos `.fig` que conservas tú, IA integrada además de a través de agentes, o ningún límite de llamadas de agentes. Elige Paper si quieres un lienzo que sea HTML y CSS de principio a fin.
