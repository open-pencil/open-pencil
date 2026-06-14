---
title: MCP Server
description: Conecta herramientas de IA a OpenPencil para inspección y edición de diseños vía Model Context Protocol.
---

# MCP Server

OpenPencil incluye un servidor MCP (Model Context Protocol) que permite a herramientas de IA — Claude Code, Cursor, Windsurf, etc. — leer y modificar diseños en la app en ejecución. Dos binarios:

- **`openpencil-mcp`** — transporte stdio para clientes MCP
- **`openpencil-mcp-http`** — servidor HTTP + WebSocket para navegadores, scripts y el puente interno de la app

## Requisitos previos

Antes de conectar cualquier cliente:

1. La app de escritorio OpenPencil debe estar ejecutándose **con un documento abierto**. El servidor MCP es un puente, no un renderizador — no funciona sin la app.
2. La versión del paquete MCP debe coincidir con la versión de la app. El endpoint `/health` reporta las versiones para que los clientes puedan detectar incompatibilidades.

El servidor MCP se inicia automáticamente al abrir la app de escritorio (los builds Tauri ejecutan `openpencil-mcp-http`; en modo dev usa un plugin de Vite). También puedes ejecutarlo de forma independiente.

## Arquitectura

```text
  Cliente MCP          Servidor MCP             App OpenPencil
  (Claude Code,       (openpencil-mcp-http)    (desktop / browser)
   Cursor, etc.)
                      ┌──────────────────┐
  stdio ◄───────────► │  /rpc (HTTP)     │ ◄──── JSON-RPC ─────► Stdio bridge
  (openpencil-mcp)    │                  │
                      │  / (WS)          │ ◄──── WebSocket ────► Pestaña del navegador
                      │                  │
                      │  /mcp (HTTP)     │ ◄── Streamable HTTP ──► Herramientas externas
                      │                  │
                      │  /health         │
                      └──────┬───────────┘
                             │
                    socket o TCP (127.0.0.1)
```

El puente stdio (`openpencil-mcp`) se conecta al servidor HTTP vía socket Unix (en macOS/Linux) o TCP (en Windows, donde no hay soporte para sockets Unix). No habla MCP directamente con la app — envía las llamadas MCP por HTTP al servidor, que las retransmite a la app vía WebSocket.

## Cómo se conecta

El servidor escribe un **archivo de descubrimiento** al iniciarse. El puente stdio lee este archivo para encontrar el servidor. No se necesita configuración manual.

### Ubicación del archivo de descubrimiento

| Plataforma | Ruta |
|------------|------|
| macOS | `~/Library/Application Support/OpenPencil/mcp.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/mcp.json` (fallback: `~/.openpencil/mcp.json`) |
| Windows | `%LOCALAPPDATA%\OpenPencil\mcp.json` |

`OPENPENCIL_MCP_SOCKET` sobrescribe solo la ruta del socket — el archivo de descubrimiento siempre permanece en la ruta de la plataforma indicada arriba.

### Contenido del archivo de descubrimiento

```json
{
  "pid": 12345,
  "socketPath": "~/Library/Application Support/OpenPencil/mcp.sock",
  "httpPort": 7600,
  "authRequired": true,
  "authToken": "a1b2c3...32-hex-chars",
  "version": "0.13.2",
  "startedAt": "2026-06-01T12:00:00.000Z"
}
```

El archivo se escribe con permisos `0o600` (solo lectura/escritura del propietario). Esto impide que otros usuarios del SO lean el token de autenticación, pero cualquier proceso ejecutándose como **tu usuario** puede leerlo.

### Selección de transporte

| Plataforma | Primario | Fallback |
|------------|----------|----------|
| macOS / Linux | Socket Unix | TCP en `127.0.0.1:7600` |
| Windows | TCP en `127.0.0.1:7600` | — |

En macOS/Linux, el puente stdio prefiere el socket Unix. Si el servidor se inició solo con TCP, el puente usa `httpPort` del archivo de descubrimiento. En Windows, el puente usa TCP exclusivamente ya que Windows no soporta sockets Unix.

## Instalar

```sh
npm install -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor, etc.)

El puente stdio descubre automáticamente el servidor MCP vía el archivo de descubrimiento. No necesitas configurar ruta de socket ni puerto — solo asegúrate de que la app esté abierta.

### Claude Code

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

Verificar:

```sh
claude mcp list
```

Claude Code pregunta antes de usar cada herramienta MCP. Para auto-aprobar herramientas de OpenPencil, añade a `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__open-pencil__*"]
  }
}
```

Ejemplo de prompt:

```text
Usa el servidor MCP open-pencil para inspeccionar la página actual y crear una sección hero pequeña en el canvas.
```

### Otros clientes MCP

Añade a tu configuración MCP (ej. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Ejecutar desde el código fuente sin instalar:

::: code-group

```json [Bun]
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["/ruta/a/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
```json [Node.js]
{
  "mcpServers": {
    "open-pencil": {
      "command": "npx",
      "args": ["tsx", "/ruta/a/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
:::

## HTTP

Para extensiones de navegador, scripts, CI, o cualquier cliente HTTP:

```sh
openpencil-mcp-http
```

O desde el código fuente: `bun packages/mcp/src/index.ts` / `npx tsx packages/mcp/src/index.ts`

### Endpoints

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/health` | GET | No | Estado del servidor, versión, comando de instalación, ruta de descubrimiento |
| `/rpc` | POST | Bearer token | Puente JSON-RPC a la app en ejecución |
| `/mcp` | POST, DELETE | Bearer token o `x-mcp-token` | MCP Streamable HTTP. Sesiones vía header `mcp-session-id`. DELETE cierra una sesión |

### Autenticación

Un token de autenticación se **genera automáticamente al iniciar** (32-hex aleatorio de `crypto.randomBytes`). Los clientes deben enviarlo como `Authorization: Bearer <token>` para `/rpc`, o como `Authorization: Bearer <token>` o cabecera `x-mcp-token` para `/mcp`. La comparación usa tiempo constante (`crypto.timingSafeEqual`) para prevenir ataques de timing.

| Escenario | De dónde viene el token |
|-----------|------------------------|
| Puente stdio (`openpencil-mcp`) | Lee `authToken` del archivo de descubrimiento automáticamente |
| Interno (Tauri/browser) | Lee el archivo de descubrimiento vía `/health` → `discoveryPath` |
| Cliente HTTP personalizado | Configura `OPENPENCIL_MCP_AUTH_TOKEN` en servidor y cliente, o lee el archivo de descubrimiento |

Para **desactivar** la autenticación (ej. desarrollo local detrás de un firewall), configura `OPENPENCIL_MCP_AUTH_TOKEN=""` antes de iniciar el servidor:

```sh
OPENPENCIL_MCP_AUTH_TOKEN="" openpencil-mcp-http
```

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `7600` | Puerto TCP. `0` para desactivar TCP (en Windows desactiva el único transporte disponible). |
| `OPENPENCIL_MCP_SOCKET` | Por plataforma | Sobreescribir ruta de socket (solo macOS/Linux) |
| `OPENPENCIL_MCP_TCP` | Obsoleto | Sin efecto — TCP se controla con `PORT` (>0 = activado, 0 = desactivado) |
| `OPENPENCIL_MCP_AUTH_TOKEN` | Auto-generado | Token de autenticación del servidor. Si no se establece, se genera automáticamente; si se establece como cadena vacía (`""`), la autenticación se deshabilita. |
| `OPENPENCIL_MCP_ROOT` | `cwd()` | Directorio alcance para `open_file`, `new_document` y export con escritura. `save_file` siempre está disponible; la ruta se valida contra este directorio cuando se establece |
| `OPENPENCIL_MCP_EVAL` | Desactivado | `1` para habilitar `eval` (solo stdio, nunca HTTP) |
| `OPENPENCIL_MCP_CORS_ORIGIN` | Desactivado | Origen CORS permitido para acceso desde navegador |

### Seguridad por defecto

- Enlaza a `127.0.0.1` — no expuesto a la red
- Herramienta `eval` desactivada por defecto; solo disponible vía stdio, nunca HTTP
- Operaciones de archivo limitadas a `OPENPENCIL_MCP_ROOT` — symlinks se resuelven para prevenir path traversal
- CORS desactivado por defecto
- Permisos del socket `0o600` en Unix — restringe acceso a tu usuario
- Permisos del archivo de descubrimiento `0o600` — misma restricción

**Limitación conocida:** En Unix, hay una ventana breve entre `listen()` y `chmod(0o600)` donde el socket tiene permisos por defecto. El token de autenticación mitiga esto — aunque otro proceso se conecte durante la ventana, necesita el token. No hay mitigación para `authToken: null` en máquinas compartidas.

## Solución de problemas

### "OpenPencil app is not connected"

El servidor MCP está ejecutándose pero ninguna pestaña del navegador está conectada. **Abre la app de escritorio OpenPencil** (o navega a la URL de la app en un navegador) y asegúrate de que un documento esté cargado. La app se conecta al servidor vía WebSocket al abrirse.

### "Port 7600 already in use"

Otra instancia de OpenPencil (u otro proceso) está usando el puerto 7600. Soluciones:

- Cierra la otra instancia
- Configura `PORT=7601` (o cualquier puerto libre) antes de iniciar
- Configura `PORT=0` para desactivar TCP y usar solo socket

### Errores de "stale socket" en macOS/Linux

Si la app se cierra sin limpieza, el archivo de socket puede quedar. El servidor limpia sockets stale al iniciar (verifica si el socket está vivo antes de eliminarlo). Si la limpieza falla:

```sh
rm ~/Library/Application\ Support/OpenPencil/mcp.sock
```

### Versión incompatible

El endpoint `/health` retorna la `version` del servidor. La app lo verifica al conectarse y advierte si las versiones no coinciden. Actualiza el paquete global:

```sh
npm install -g @open-pencil/mcp@latest
```

### El puente stdio no encuentra el servidor

El puente lee el archivo de descubrimiento para localizar el servidor. Si falta o está stale (PID ya no vivo):

1. Comprueba que el archivo de descubrimiento existe en la ruta de tu plataforma
2. Si TCP está habilitado (`PORT` no es `0`), verifica que el servidor esté ejecutándose: `curl http://127.0.0.1:${PORT:-7600}/health`
3. En Windows (transporte solo TCP, sin socket Unix), verifica que `httpPort` del servidor sea accesible. `PORT=0` en Windows deshabilita el único transporte disponible

## Flujo de trabajo

1. **Abrir** — `open_file` para cargar un `.fig` existente, o `new_document` para canvas vacío
2. **Leer** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
3. **Crear** — `create_shape`, `render` (JSX)
4. **Modificar** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
5. **Estructura** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
6. **Guardar** — `save_file` para escribir a `.fig`

## AI Agent Skill

Enseña a tu agente de IA a usar las herramientas de OpenPencil:

```sh
npx skills add open-pencil/skills@open-pencil
```

Funciona con Claude Code, Cursor, Windsurf, Codex y cualquier agente que soporte [skills](https://skills.sh). El skill cubre el CLI, herramientas MCP, renderizado JSX, eval y el puente de automatización de la app.

## Herramientas (90)

### Documento

| Herramienta | Descripción |
|-------------|-------------|
| `open_file` | Abrir un archivo `.fig` para edición |
| `save_file` | Guardar el documento actual a un archivo `.fig` |
| `new_document` | Crear un documento vacío nuevo |

### Lectura

| Herramienta | Descripción |
|-------------|-------------|
| `get_selection` | Obtener nodos seleccionados actualmente |
| `get_page_tree` | Obtener el árbol completo de nodos de la página actual |
| `get_current_page` | Obtener el nombre y ID de la página actual |
| `get_node` | Obtener propiedades detalladas de un nodo por ID |
| `find_nodes` | Buscar nodos por patrón de nombre y/o tipo |
| `get_components` | Listar todos los componentes del documento |
| `list_pages` | Listar todas las páginas |
| `list_variables` | Listar variables de diseño |
| `list_collections` | Listar colecciones de variables |
| `list_fonts` | Listar fuentes usadas en la página actual |
| `page_bounds` | Obtener bounding box de todos los objetos en la página |
| `node_bounds` | Obtener bounding box de un nodo |
| `node_ancestors` | Obtener cadena de ancestros de un nodo |
| `node_children` | Obtener hijos directos de un nodo |
| `node_tree` | Obtener el subárbol de un nodo |
| `node_bindings` | Obtener bindings de variables en un nodo |

### Creación

| Herramienta | Descripción |
|-------------|-------------|
| `create_shape` | Crear una forma (`FRAME`, `RECTANGLE`, `ELLIPSE`, `TEXT`, `LINE`, `STAR`, `POLYGON`, `SECTION`) |
| `create_vector` | Crear un nodo vectorial desde un string de path |
| `create_slice` | Crear un slice de exportación |
| `create_page` | Crear una página nueva |
| `render` | Renderizar JSX a nodos de diseño — crear árboles de componentes en una llamada |
| `create_component` | Convertir un frame/group en componente |
| `create_instance` | Crear una instancia de un componente |
| `node_to_component` | Convertir un nodo existente en componente in-place |

### Modificación

| Herramienta | Descripción |
|-------------|-------------|
| `set_fill` | Establecer color de relleno (hex) |
| `set_stroke` | Establecer color, peso y alineación de borde |
| `set_effects` | Añadir sombras o efectos de desenfoque |
| `update_node` | Actualizar posición, tamaño, opacidad, radio de esquina, texto, fuente |
| `set_layout` | Establecer auto-layout (flexbox) — dirección, espaciado, padding, alineación |
| `set_constraints` | Establecer restricciones de redimensión |
| `set_rotation` | Establecer ángulo de rotación en grados |
| `set_opacity` | Establecer opacidad (0–1) |
| `set_radius` | Establecer radio de esquina (uniforme o por esquina) |
| `set_minmax` | Establecer restricciones min/max de ancho y alto |
| `set_text` | Establecer contenido de texto de un nodo `TEXT` |
| `set_font` | Establecer familia y peso de fuente |
| `set_font_range` | Establecer propiedades de fuente en un rango de caracteres |
| `set_text_resize` | Establecer modo de auto-redimensión de texto |
| `set_visible` | Mostrar u ocultar un nodo |
| `set_blend` | Establecer modo de mezcla |
| `set_locked` | Bloquear o desbloquear un nodo |
| `set_stroke_align` | Establecer alineación de borde (interior/centro/exterior) |
| `set_text_properties` | Establecer layout de texto: alineación, auto-redimensión, decoración, truncado |
| `set_layout_child` | Configurar hijo de auto-layout: sizing, grow, alineación, posicionamiento absoluto |
| `node_move` | Mover un nodo a una nueva posición |
| `node_resize` | Redimensionar un nodo |
| `node_replace_with` | Reemplazar un nodo con otro |
| `arrange` | Alinear o distribuir nodos seleccionados |

### Estructura

| Herramienta | Descripción |
|-------------|-------------|
| `delete_node` | Eliminar un nodo |
| `clone_node` | Duplicar un nodo |
| `rename_node` | Renombrar un nodo |
| `reparent_node` | Mover un nodo a otro padre |
| `select_nodes` | Seleccionar nodos por ID |
| `group_nodes` | Agrupar nodos |
| `ungroup_node` | Desagrupar un grupo |
| `flatten_nodes` | Aplanar nodos en un vector único |
| `boolean_union` | Unión booleana de dos o más nodos |
| `boolean_subtract` | Sustracción booleana |
| `boolean_intersect` | Intersección booleana |
| `boolean_exclude` | Exclusión booleana |

### Path vectorial

| Herramienta | Descripción |
|-------------|-------------|
| `path_get` | Obtener datos de path de un nodo vectorial |
| `path_set` | Establecer datos de path en un nodo vectorial |
| `path_scale` | Escalar un path vectorial |
| `path_flip` | Voltear un path horizontal o verticalmente |
| `path_move` | Trasladar un path vectorial |

### Exportación

| Herramienta | Descripción |
|-------------|-------------|
| `export_image` | Exportar nodos como PNG, JPG o WEBP. Retorna datos imagen en base64 |
| `export_svg` | Exportar nodos como markup SVG |

### Viewport

| Herramienta | Descripción |
|-------------|-------------|
| `viewport_get` | Obtener posición y zoom actual del viewport |
| `viewport_set` | Establecer posición y zoom del viewport |
| `viewport_zoom_to_fit` | Ajustar zoom para mostrar los nodos especificados |

### Variables

| Herramienta | Descripción |
|-------------|-------------|
| `get_variable` | Obtener una variable por ID o nombre |
| `find_variables` | Buscar variables por patrón de nombre o tipo |
| `create_variable` | Crear una variable nueva en una colección |
| `set_variable` | Establecer valor de variable en un modo |
| `delete_variable` | Eliminar una variable |
| `bind_variable` | Vincular variable a propiedad de un nodo |
| `get_collection` | Obtener colección de variables por ID o nombre |
| `create_collection` | Crear una colección de variables nueva |
| `delete_collection` | Eliminar una colección de variables |

### Análisis

| Herramienta | Descripción |
|-------------|-------------|
| `analyze_colors` | Analizar paleta de colores del documento |
| `analyze_typography` | Analizar distribución de fuentes/tamaños/pesos |
| `analyze_spacing` | Analizar valores de gap y padding |
| `analyze_clusters` | Detectar patrones repetidos (posibles componentes) |

### Diff

| Herramienta | Descripción |
|-------------|-------------|
| `diff_create` | Crear snapshot del estado actual del documento |
| `diff_show` | Mostrar diferencias entre el estado actual y un snapshot |

### Navegación

| Herramienta | Descripción |
|-------------|-------------|
| `switch_page` | Cambiar a una página por nombre o ID |

### Escape Hatch

| Herramienta | Descripción |
|-------------|-------------|
| `eval` | Ejecutar JavaScript con acceso completo a la Figma Plugin API |

Nota: `eval` está disponible vía stdio, pero desactivado en modo HTTP por seguridad.
