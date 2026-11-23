---
title: OpenPencil vs Penpot
description: En qué se diferencian OpenPencil y Penpot, dos herramientas de diseño de código abierto, en compatibilidad con archivos de Figma, IA y automatización, colaboración, autoalojamiento y la aplicación de escritorio.
---

# OpenPencil vs Penpot

OpenPencil y Penpot son herramientas de diseño de código abierto que puedes usar en lugar de Figma. Parten de lugares distintos: Penpot es una plataforma web construida en torno a su propio formato de archivo y un servidor de equipo, y OpenPencil es un editor que abre los archivos de Figma que ya tienes, se ejecuta en tu dispositivo y puede manejarse por ti, por scripts o por agentes de IA. Esta página los compara según Penpot 2.19 y OpenPencil 0.17.

## De un vistazo

|                          | OpenPencil                                                                                                     | Penpot                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Licencia                 | MIT (editor), Apache 2.0 (servidor Cloud)                                                                      | MPL 2.0                                                         |
| Archivos `.fig` de Figma | Los abre y los guarda; copiar y pegar con Figma en ambos sentidos                                              | Convertidos con un plugin que se ejecuta en Figma               |
| Dónde se ejecuta         | Aplicación de escritorio para macOS, Windows y Linux, y el navegador                                           | Navegador                                                       |
| Sin conexión             | Sí; los documentos pueden quedarse en tu dispositivo                                                           | Necesita su servidor                                            |
| Cuentas                  | No hacen falta para editar; opcionales para Cloud                                                              | Obligatorias                                                    |
| Colaboración             | Salas peer-to-peer sin cuenta, u OpenPencil Cloud con uso compartido, comentarios e historial                  | Basada en servidor, con uso compartido, comentarios e historial |
| Autoalojamiento          | Servidor de OpenPencil Cloud                                                                                   | Despliegue con Docker                                           |
| IA integrada             | Asistente de chat con más de 100 herramientas de diseño; tu propia clave de proveedor o créditos de Cloud      | —                                                               |
| Agentes y scripts        | Servidor MCP, CLI sin interfaz y scripts compatibles con la Figma Plugin API                                   | Servidor MCP y Plugin API                                       |
| Maquetación              | Disposición automática con flexbox y CSS Grid                                                                  | Maquetación flex y grid                                         |
| Tokens de diseño         | Variables con modos; importación y exportación de tokens de diseño W3C                                         | Tokens de diseño nativos                                        |
| Exportación de código    | Design JSX, HTML, Vue y React con CSS o Tailwind                                                               | Inspección de CSS, SVG y HTML                                   |
| Prototipado              | Comportamientos de componentes en vivo; flujos y transiciones están en la [hoja de ruta](/development/roadmap) | Flujos, interacciones y modo de visualización                   |

## Archivos de Figma

OpenPencil abre archivos `.fig` directamente y vuelve a guardar en `.fig`, así que un equipo puede cambiar sin convertir antes su biblioteca, y quien siga en Figma puede abrir el resultado. Los archivos complejos pueden verse distintos al reabrirlos en Figma, así que conserva el original hasta comprobar el resultado. Copiar capas en Figma y pegarlas en OpenPencil conserva rellenos, contornos, disposición automática, texto, efectos y redes vectoriales, y también funciona en sentido contrario. Consulta [Compatibilidad con Figma](/es/reference/figma-compatibility) para saber qué se conserva y qué no.

Penpot usa su propio formato `.penpot` y no abre archivos `.fig`. Pasar desde Figma implica ejecutar el plugin exportador de Penpot dentro de Figma e importar lo que genera.

## IA y automatización

OpenPencil está hecho para programarse. El [asistente de IA](/es/user-guide/ai-chat) crea y edita capas con las mismas más de 100 herramientas que el [servidor MCP](/developers/mcp-server) ofrece a Claude Code, Cursor, Codex y otros agentes de código, y la aplicación de escritorio puede ejecutar esos agentes dentro del editor. La [CLI](/es/developers/cli/inspecting) inspecciona, revisa, convierte y exporta documentos sin abrir el editor, y su [comando `eval`](/es/developers/cli/scripting) ejecuta scripts escritos para la Figma Plugin API.

Penpot tiene un servidor MCP oficial que permite a los agentes de código trabajar con sus archivos, y un sistema de plugins para extensiones que se ejecutan en el editor. No tiene asistente integrado ni scripts sin interfaz.

## Colaboración y alojamiento

Penpot es cliente y servidor: los documentos viven en una instancia de Penpot, la alojada o una que despliegues con Docker, y todos inician sesión en ella.

OpenPencil guarda los documentos en tu dispositivo por defecto. Para editar en equipo puedes abrir una [sala peer-to-peer](/es/user-guide/collaboration) sin cuenta y sin nada que alojar, con cursores en vivo, modo seguimiento y llamadas de voz. Para almacenamiento compartido, permisos, comentarios e historial de versiones, usa [OpenPencil Cloud](/cloud/): el servicio alojado o un [servidor gestionado por tu equipo](/cloud/self-hosting/) a partir del mismo código abierto.

## Aplicación de escritorio

OpenPencil tiene una aplicación de escritorio nativa para macOS, Windows y Linux, con menús nativos, edición sin conexión y guardado automático. También funciona en el navegador en [cloud.openpencil.dev](https://cloud.openpencil.dev). Penpot funciona en el navegador.

## Dónde va por delante Penpot

- **Madurez.** Penpot lleva años en producción en equipos grandes; OpenPencil es más joven y todavía tiene asperezas.
- **Prototipado.** Penpot tiene flujos, interacciones y modo presentación. OpenPencil previsualiza los componentes como controles funcionales, pero aún no tiene flujos de prototipo.
- **Ecosistema de plugins.** Penpot tiene un catálogo de plugins de la comunidad; los puntos de extensión de OpenPencil hoy son los scripts, MCP y el [SDK de Vue](/es/developers/sdk/).

## Cuál elegir

Elige OpenPencil si tienes archivos de Figma con los que seguir trabajando, quieres una aplicación de escritorio que funcione sin conexión o quieres que agentes de IA y scripts trabajen en tus diseños. Elige Penpot si necesitas prototipado hoy o una plataforma con más trayectoria.
