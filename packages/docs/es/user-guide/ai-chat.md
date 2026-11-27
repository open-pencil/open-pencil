---
pageClass: guide
title: Chat IA
description: Pide a la IA que cree y modifique diseños, deshaz lo que hizo, obtén revisiones y enséñale con habilidades.
---

# Chat IA

Describe lo que quieres y la IA lo crea en el lienzo: una pantalla, un componente, un cambio en todos los botones de la página. Pulsa <Keys mac="⌘ J" other="Ctrl J" /> para abrir el chat, o haz clic en la pestaña **IA** junto a **Diseño**.

## Configurar la IA

La primera vez, la configuración guiada te pregunta en qué quieres que te ayude la IA y qué usas ya:

- un [agente de programación](./coding-agents) que tengas, como Claude Code o Codex, en la app de escritorio;
- una cuenta con un proveedor de IA, como OpenRouter, Anthropic, OpenAI o Google, o tu plan de ChatGPT;
- un modelo que se ejecute en tu ordenador o en el servidor de tu empresa;
- tu cuenta de [OpenPencil Cloud](/cloud/ai).

[Modelos y proveedores](./models-and-providers) indica lo que necesita cada uno. Para volver a ejecutar la configuración, abre **Ajustes → Modelos → Iniciar la configuración guiada**.

La IA usa un modelo para cada tipo de trabajo, que puedes cambiar en el menú de modelos bajo el campo de mensaje, en **Gestionar modelos y roles…**:

| Rol | Qué hace |
| --- | -------- |
| **Agente de diseño** | El propio chat. |
| **Visión** | Lee las imágenes que adjuntas. |
| **Revisión** | Escribe las [revisiones de diseño](#pedir-una-revision). Usa el agente de diseño salvo que elijas otro. |
| **Tareas rápidas** | Pone nombre a las conversaciones y, cuando es un modelo de API, escribe resúmenes de las largas; si no, los escribe el agente de diseño. Pi no pone nombre a las conversaciones. Sin un modelo que lo haga, una conversación toma su primer mensaje como nombre. |

## Pedir un diseño

Escribe lo que quieres y pulsa <Keys mac="Enter" other="Enter" />. La IA ve qué capas están seleccionadas, así que selecciona aquello a lo que te refieres antes de pedir que lo cambie.

<GuideImage name="ai-chat/reply" alt="El chat de IA junto al lienzo: una petición de una tarjeta de viaje, la edición que hizo la IA, su respuesta y la tarjeta nueva en el lienzo" />

- Escribe **@** para mencionar una capa, una página o una habilidad. Las capas mencionadas aparecen como etiquetas; haz clic en una para encontrar la capa en el lienzo. El botón del puntero menciona las capas seleccionadas.
- Adjunta imágenes, como un boceto o un sitio que te guste, con el botón de imagen. Para ello se necesita un modelo de visión.
- Cada edición que hace la IA aparece en su respuesta. Haz clic en una para ver lo que hizo.

Algunas cosas que puedes probar:

- «Crea una tarjeta con un título, una descripción y un botón azul.»
- «Haz que todos los botones de esta página usen el mismo radio de esquina.»
- «Convierte el fondo de este marco en un degradado de azul a morado.»
- «Convierte este componente en un interruptor que pueda probar en la vista previa.»

Con un modelo que lee imágenes, la IA revisa su trabajo mirando una imagen de lo que ha hecho, así que puede corregir lo que le haya salido mal.

## Mientras la IA trabaja

- Sigue trabajando: la IA se queda en la página donde empezó el mensaje. El chat indica dónde está trabajando, con **Ir a la página** para volver.
- Para verla trabajar, activa **Seguir a los agentes mientras trabajan**, el botón de diana en la parte superior del chat. Tu vista sigue a la IA, también a otra página. Hacer clic, desplazarte o pulsar <Keys mac="Esc" other="Esc" /> deja de seguirla.
- Escribe otro mensaje y pulsa <Keys mac="Enter" other="Enter" /> para enviarlo en cuanto termine el paso actual, para que la IA pueda cambiar de rumbo. <Keys mac="⌥ Enter" other="Alt Enter" /> espera a que termine con todo. Los mensajes en espera aparecen atenuados debajo de la respuesta.
- **Detener generación** termina la respuesta. Una edición que ya se está haciendo se completa; el siguiente mensaje le dice a la IA qué ha cambiado.

**Máximo de pasos por mensaje**, en **Chat** dentro de **Ajustes → Modelos**, limita cuánto puede trabajar una respuesta de la IA integrada: 50 pasos salvo que lo cambies. Los agentes de programación definen sus propios límites. Cuando una respuesta llega al límite, **Continuar** sigue adelante.

## Deshacer lo que hizo la IA

Cada edición que hace la IA es un paso de <Keys mac="⌘ Z" other="Ctrl Z" />, y el chat marca las ediciones deshechas.

- **Revertir cambios**, bajo una respuesta, deshace todas sus ediciones, y **Restaurar cambios** las recupera.
- **Revertir y regenerar** las deshace y vuelve a preguntar.

Tu siguiente mensaje le dice a la IA lo que has deshecho, para que no construya sobre ediciones que ya no existen.

## Pedir una revisión

Escribe **/review** para que el modelo de revisión examine la selección, o la página cuando no hay nada seleccionado, como lo haría un director de arte: alineación, espaciado, contraste, jerarquía y cualquier cosa que parezca rota.

- Añade en qué fijarse, como `/review typography`.
- Adjunta imágenes con las que comparar, como una captura de un sitio que admires. Para ello se necesita un modelo que lea imágenes.
- Bajo una edición que hizo la IA, **Revisar este cambio** pregunta si ha mejorado el diseño.

La revisión aparece como una tarjeta, y cada hallazgo enlaza con su capa. **Corregir** envía los hallazgos a la IA como mensaje tuyo.

## Enseñar a la IA con habilidades

Una habilidad es un conjunto de instrucciones para un tipo de trabajo, como las normas de marca de tu equipo, en el formato [Agent Skills](https://agentskills.io/specification): una carpeta con un `SKILL.md` y los archivos a los que hace referencia. La IA lee una habilidad cuando una petición la necesita. Para usar una tú mismo, escribe **/** y elígela.

Añade habilidades en **Ajustes → Habilidades**:

- **Upload** sube un ZIP con la carpeta de una habilidad, o un único `SKILL.md`.
- En la app de escritorio, también se encuentran las habilidades de las carpetas `.agents/skills` y `.claude/skills` que haya junto al archivo abierto. Se quedan desactivadas hasta que eliges **Confiar en la carpeta**, ya que una habilidad le da instrucciones a la IA.
- Las habilidades que instalaron otros agentes de programación, en `~/.agents/skills` y `~/.claude/skills`, aparecen desactivadas. Activa las que te ayuden con el diseño.

Los agentes de programación como Claude Code cargan sus propias habilidades.

## Conversaciones largas

La IA solo puede leer cierta cantidad de una conversación a la vez. El indicador de la parte superior del chat muestra cuánto se ha llenado; haz clic en él para ver los detalles.

Cuando la conversación está casi llena, la IA la compacta: escribe un resumen que sustituye a los mensajes más antiguos, que puedes seguir leyendo. **Compactar automáticamente**, en **Chat** dentro de **Ajustes → Modelos**, lo hace cuando hace falta. Escribe **/compact** para hacerlo ahora, indicando qué conservar después, como `/compact keep the color decisions`.

**Historial de chats**, arriba a la izquierda del chat, abre tus conversaciones anteriores, guardadas en este ordenador. **Nuevo chat** empieza de cero.

## Elegir lo que puede hacer la IA

**Ajustes → Acceso a herramientas** muestra las herramientas que puede usar la IA, como cambiar capas, exportar o ejecutar scripts. Desactiva herramientas o grupos enteros para que la IA no los use. El cambio se aplica a partir del siguiente mensaje. Una herramienta de scripts puede seguir haciendo lo que hacen las herramientas desactivadas, así que estos interruptores no son un entorno aislado.

La pestaña **Local MCP** define las herramientas para los [agentes de programación y otros clientes MCP](/developers/mcp-server).

## Cambiar las instrucciones de la IA

::: v-pre

**Ajustes → Prompts** contiene lo que OpenPencil le dice a la IA:

- **Agente de diseño**: tus instrucciones para el chat, añadidas después de las de OpenPencil. **Replace OpenPencil's** usa las tuyas en su lugar; sin las de OpenPencil, la IA puede usar mal sus herramientas.
- **Revisión**, **Títulos de chats** y **Resúmenes de compactación**: los prompts de esas tareas. Son plantillas de [Knap](https://knap.md), donde `{{ focus }}` inserta un valor. El editor marca los errores y muestra una vista previa del resultado.

:::

**Restablecer valores predeterminados** recupera las de OpenPencil.

## Conectar otras herramientas {#external-mcp-connections}

En la app de escritorio, los agentes de programación también pueden usar otros servidores [MCP](https://modelcontextprotocol.io/), como tu gestor de incidencias. En **Ajustes → MCP**, en **Conexiones MCP**, añade la dirección del servidor y, si lo necesita, su token, y activa la conexión: los agentes no reciben las conexiones desactivadas. Añade solo servidores de confianza: sus herramientas actúan con el acceso que les des.

## Recibir notificaciones

Cuando la IA pide permiso y no respondes en unos segundos, OpenPencil envía una notificación, para que puedas trabajar mientras tanto en otra app. **Ajustes → Notificaciones** también puede avisarte cuando termina una respuesta. En el navegador, haz clic primero ahí en **Permitir notificaciones**.
