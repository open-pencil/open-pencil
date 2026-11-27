---
pageClass: guide
title: Agentes de programación
description: Usa Claude Code, Codex, Cursor u otro agente de programación que ya tengas como IA en la app de escritorio de OpenPencil.
---

# Agentes de programación

La app de escritorio puede usar como IA un agente de programación que ya tengas: Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursor](#cursor), [Grok Build](#grok-build) o [Pi](#pi). El agente se ejecuta en tu ordenador con tu propia suscripción, y OpenPencil le da las herramientas para trabajar en el lienzo.

Los agentes de programación necesitan la [app de escritorio](/es/download): el navegador no puede iniciar programas en tu ordenador.

## Configurar un agente

1. Instala el conector del agente, como se indica en su sección más abajo. Claude Code y Codex no necesitan ningún otro programa.
2. Instala el servidor MCP de OpenPencil, que da al agente las herramientas del lienzo:

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Abre **Ajustes → Modelos → Iniciar la configuración guiada** y elige el agente en **Agentes de programación en este equipo**.
4. Comprueba que el agente y el servidor MCP aparecen como instalados. **Instalar adaptador** instala el conector por ti.
5. Si el agente no ha iniciado sesión, haz clic en **Iniciar sesión**. La configuración guiada muestra la cuenta que usa el agente, como su plan y su correo electrónico.

**Herramientas de OpenPencil** muestra si el agente puede acceder a las herramientas del lienzo. **Comprobar de nuevo** vuelve a mirar después de instalar algo o de iniciar sesión.

Si ya usas el agente en un terminal, puede configurarse solo: haz clic en **Copiar prompt de configuración** en su tarjeta y pega el prompt en el agente.

## Elegir el modelo y el modo

Un agente es un modelo como cualquier otro en **Ajustes → Modelos**, así que puede ser el **Agente de diseño**, encargarse de las **Tareas rápidas**, escribir **revisiones** o, si lee imágenes, ser el modelo de **Visión**. En **Tareas rápidas**, un agente pone nombre a las conversaciones, pero el agente de diseño sigue escribiendo los resúmenes, y Pi no hace ninguna de las dos cosas. Puedes añadir el mismo agente dos veces con ajustes distintos.

En los ajustes de un agente:

- **Modelo**: **Predeterminado del agente** deja la elección al agente; también puedes elegir uno de los modelos que ofrece. Si la lista no se carga, elige **Modelo personalizado…** y escribe el ID de un modelo.
- **Nivel de razonamiento**: los niveles propios del agente para el modelo que has elegido, como Max en Claude Code o Ultra en Codex.
- **Modo**: lo que el agente puede hacer antes de preguntarte, con los nombres propios del agente, como Manual, Accept edits, Plan, Auto y Bypass permissions en Claude Code, o de Read-only a Full access en Codex.
- **Entrada de imágenes**: desactívala cuando el modelo que has elegido no pueda leer imágenes.

El menú junto al botón de enviar cambia el modelo, el nivel de razonamiento y el modo del chat en el que estás, a partir del siguiente mensaje.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Inicia sesión desde la configuración guiada, o ejecuta `claude` y escribe `/login`. Si el navegador no puede devolver el inicio de sesión, la página de inicio de sesión muestra un código para pegarlo en la configuración guiada.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Inicia sesión con ChatGPT desde la configuración guiada, o ejecuta `codex login`.

Un conector anterior, `@zed-industries/codex-acp`, instala un programa con el mismo nombre, pero no puede iniciar sesión. La configuración guiada te pide que lo quites.

## Antigravity CLI {#antigravity}

Antigravity CLI es el agente de Google para Gemini. No necesita conector. Instálalo desde el [sitio de Antigravity](https://antigravity.google):

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

En Windows, ejecuta esto en PowerShell:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Ejecuta `agy` una vez y elige cómo iniciar sesión. La configuración guiada lo muestra como instalado, pero no puede mostrar su cuenta.

Antes de empezar, el agente a veces pide listar su propia carpeta, `~/.gemini/antigravity-cli/mcp`. Permítelo: si lo rechazas, termina su turno.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

No necesita conector. Ejecuta `gemini` una vez y elige cómo iniciar sesión. Las cuentas personales de Google ya no pueden iniciar sesión en Gemini CLI: con ellas, usa [Antigravity CLI](#antigravity).

## Cursor

La CLI de Cursor no necesita conector. Instálala siguiendo la [guía de instalación de la CLI](https://cursor.com/docs/cli/installation):

```sh
curl https://cursor.com/install -fsS | bash
```

En Windows, usa el comando de PowerShell de esa página. Ejecuta `cursor-agent login` una vez para iniciar sesión. Los modelos de Cursor incluyen su nivel de razonamiento en el nombre.

## Grok Build

Grok Build no necesita conector. Instálalo siguiendo la [guía de Grok Build](https://docs.x.ai/build/overview):

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

En Windows, usa el comando de PowerShell de esa página. Ejecuta `grok login` una vez para iniciar sesión.

## Pi

Pi funciona a través del programa complementario de OpenPencil, que necesita Node.js 22.15 o posterior, o Bun. La configuración guiada lo instala con un clic, o puedes instalarlo tú mismo:

```sh
npm install -g @open-pencil/harness
```

Pi usa los proveedores con los que has iniciado sesión en Pi, así que no hay ninguna clave que pegar. Ejecuta `pi`, inicia sesión con `/login` y elige un modelo predeterminado con `/model`. Para usar otro modelo en OpenPencil, escríbelo como `provider/model` en los ajustes de Pi dentro de OpenPencil. Con una clave de [AI Gateway](https://vercel.com/ai-gateway), Pi usa el gateway.

Pi no puede leer imágenes. Después de reiniciar Pi u OpenPencil, la conversación continúa en una sesión nueva de Pi.

## Solución de problemas

- **No se encuentra después de instalarlo.** Las apps iniciadas desde el Dock o el menú Inicio no ven todas las carpetas que ve tu terminal. OpenPencil busca en las carpetas habituales de npm, Bun, Volta, mise y Homebrew. Si la tuya está en otro sitio, añádela al `PATH` de tu shell de inicio de sesión y reinicia OpenPencil.
- **Hace falta actualizar.** El servidor MCP o el programa complementario de Pi no coinciden con la versión de la app. Haz clic en el botón de actualizar, o ejecuta el comando que muestra la configuración guiada, y luego en **Comprobar de nuevo**.
- **El agente no puede acceder a las herramientas de OpenPencil** o no puede editar el lienzo. Comprueba que el servidor MCP aparece como instalado en la configuración guiada y que está en marcha en **Ajustes → MCP**. Codex omite el servidor de OpenPencil cuando su propio `config.toml` tiene un servidor llamado `open-pencil`: elimina esa entrada.
- **El agente te pide que inicies sesión.** Haz clic en **Iniciar sesión** en la configuración guiada, o inicia sesión con el comando propio del agente, y vuelve a enviar tu mensaje.

El agente trabaja en una carpeta propia dentro de los datos de la app de OpenPencil, así que no toma los ajustes de proyecto de tu carpeta personal. Aun así, usa sus propios ajustes, como los servidores MCP y las reglas de `~/.codex` o `~/.claude`.
