---
title: OpenPencil vs Lunacy
description: En qué se diferencian OpenPencil y Lunacy, dos editores de diseño de escritorio gratuitos que abren archivos de Figma, en licencia, guardado de vuelta a Figma, IA y automatización, y autoalojamiento.
---

# OpenPencil vs Lunacy

[Lunacy](https://icons8.com/lunacy), de Icons8, y OpenPencil son editores de diseño gratuitos con aplicaciones de escritorio nativas para macOS, Windows y Linux, y ambos abren los archivos `.fig` de Figma. Se diferencian en quién controla el software y en adónde va tu trabajo después. Esta página los compara según Lunacy 14 y OpenPencil 0.17.

## De un vistazo

|                       | OpenPencil                                                                                                     | Lunacy                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Licencia              | Código abierto: MIT (editor), Apache 2.0 (servidor Cloud)                                                      | Freeware propietario                                                                     |
| Precio                | Gratis; los planes de Cloud añaden almacenamiento, editores y créditos de IA                                   | Gratis; planes de pago para funciones de nube y equipo y gráficos sin atribución         |
| Plataformas           | Aplicación de escritorio para macOS, Windows y Linux, y el navegador                                           | Aplicación de escritorio para macOS, Windows y Linux, y el navegador                     |
| Formato nativo        | Figma `.fig`                                                                                                   | `.free` y Sketch `.sketch`                                                               |
| Archivos `.fig`       | Los abre y los guarda; copiar y pegar con Figma en ambos sentidos                                              | Los abre                                                                                 |
| Sin conexión          | Sí                                                                                                             | Sí, con documentos locales                                                               |
| Colaboración          | Salas peer-to-peer, u OpenPencil Cloud con comentarios e historial de versiones                                | La nube de Lunacy o una nube privada, con comentarios                                    |
| Autoalojamiento       | Servidor de OpenPencil Cloud                                                                                   | Nube privada en tus propios servidores, con licencia de pago                             |
| IA integrada          | Asistente de chat con más de 100 herramientas de diseño; tus propias claves de proveedor o créditos de Cloud   | Chat de IA en el servicio de Icons8, además de herramientas de imagen                    |
| Agentes de código     | Servidor MCP, además de Claude Code, Codex, Cursor y otros ejecutándose dentro del editor                      | Servidor MCP                                                                             |
| Scripts               | CLI sin interfaz y scripts compatibles con la Figma Plugin API                                                 | Plugins a través de su API MCP                                                           |
| Exportación de código | Design JSX, HTML, Vue y React con CSS o Tailwind                                                               | Inspección de CSS                                                                        |
| Prototipado           | Comportamientos de componentes en vivo; flujos y transiciones están en la [hoja de ruta](/development/roadmap) | Flujos, smart animate y animaciones de muelle                                            |
| Recursos integrados   | Conjuntos de iconos                                                                                            | Iconos, fotos, ilustraciones y kits de UI de Icons8                                      |

## Trabajar con archivos de Figma

Lunacy abre archivos `.fig` y guarda en su propio formato `.free` o en archivos de Sketch, así que un diseño que sale de Figma hacia Lunacy no vuelve como `.fig`. OpenPencil guarda `.fig` directamente: puedes abrir un archivo de un compañero que usa Figma, cambiarlo y devolvérselo, y copiar y pegar capas entre las dos aplicaciones en cualquier sentido. Los archivos complejos pueden verse distintos al reabrirlos en Figma, así que conserva el original hasta comprobar el resultado; consulta [Compatibilidad con Figma](/es/reference/figma-compatibility).

## Código abierto y alojamiento

Lunacy es gratis pero de código cerrado, y ejecutar su nube privada en tus propios servidores requiere una licencia de pago. El código de OpenPencil es abierto, y los documentos pueden quedarse en tu dispositivo, en tu propio [bucket de almacenamiento](/user-guide/cloud-storage) o en [OpenPencil Cloud](/cloud/), incluido un [servidor gestionado por tu equipo](/cloud/self-hosting/).

## IA y automatización

El chat de IA de Lunacy funciona en el servicio de Icons8 sin necesidad de clave de API. El [asistente de IA](/es/user-guide/ai-chat) de OpenPencil usa tu propia clave de proveedor o créditos de Cloud, y las mismas más de 100 herramientas están abiertas a los agentes de código a través del [servidor MCP](/developers/mcp-server). La [CLI](/es/developers/cli/inspecting) inspecciona, revisa y exporta documentos sin abrir el editor, y [`eval`](/es/developers/cli/scripting) ejecuta scripts escritos para la Figma Plugin API.

## Dónde va por delante Lunacy

- **Prototipado.** Lunacy tiene flujos, smart animate y animaciones de muelle; OpenPencil aún no tiene flujos de prototipo.
- **Gráficos integrados.** Lunacy incluye los iconos, fotos, ilustraciones y kits de UI de Icons8.
- **Madurez.** Lunacy lleva años en desarrollo y ha llegado a la versión 14.

## Cuál elegir

Elige OpenPencil si necesitas seguir intercambiando archivos `.fig` con usuarios de Figma, quieres software y alojamiento que controlas tú, o quieres que agentes de código y scripts trabajen en tus diseños. Elige Lunacy si quieres prototipado y una gran biblioteca de gráficos integrada en una aplicación gratuita.
