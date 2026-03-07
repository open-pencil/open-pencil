# Contribuir

## Estructura del proyecto

```
packages/
  core/              @open-pencil/core — motor (sin deps DOM)
    src/             Grafo de escena, renderer, layout, codec, kiwi, tipos
  cli/               @open-pencil/cli — CLI headless para operaciones .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — servidor MCP para herramientas IA
    src/             Transportes stdio + HTTP (Hono), 75 herramientas
src/
  components/        Vue SFCs (canvas, paneles, barra de herramientas, selector de color)
    properties/      Secciones del panel de propiedades (Apariencia, Relleno, Trazo, etc.)
  composables/       Entrada de canvas, atajos de teclado, hooks de renderizado
  stores/            Estado del editor (reactividad Vue)
  engine/            Shims de re-exportación desde @open-pencil/core
  kiwi/              Shims de re-exportación desde @open-pencil/core
  types.ts           Tipos compartidos (re-exportados desde core)
  constants.ts       Colores UI, valores por defecto, umbrales
desktop/             Tauri v2 (Rust + config)
tests/
  e2e/               Regresión visual Playwright
  engine/            Tests unitarios (bun:test)
docs/                Sitio de documentación VitePress
openspec/
  specs/             Especificaciones de capacidades (fuente de verdad)
  changes/           Cambios activos y archivados
```

## Entorno de desarrollo

```sh
bun install
bun run dev          # Editor en localhost:1420
bun run docs:dev     # Docs en localhost:5173
```

## Estilo de código

### Herramientas

| Herramienta | Comando | Propósito |
|-------------|---------|-----------|
| oxlint | `bun run lint` | Linting (basado en Rust, rápido) |
| oxfmt | `bun run format` | Formateo de código |
| tsgo | `bun run typecheck` | Verificación de tipos (checker TypeScript basado en Go) |

Ejecutar todas las verificaciones:

```sh
bun run check
```

### Convenciones

- **Nombres de archivo** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Componentes** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Constantes** — SCREAMING_SNAKE_CASE
- **Funciones/variables** — camelCase
- **Tipos/interfaces** — PascalCase

### Convenciones para agentes IA

Desarrolladores y agentes IA deben leer `AGENTS.md` en la raíz del repo ([ver en GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Cubre renderizado, grafo de escena, componentes e instancias, layout, UI, formato de archivo, convenciones Tauri y problemas conocidos.

## Realizar cambios

1. Consultar las [specs de openspec](/development/openspec) existentes para la capacidad que estás modificando
2. Crear un cambio openspec si añades nuevo comportamiento: `openspec new change "mi-cambio"`
3. Implementar el cambio
4. Ejecutar `bun run check` y `bun run test`
5. Enviar un pull request

## Archivos clave

El código fuente del motor vive en `packages/core/src/`. Los directorios `src/engine/` y `src/kiwi/` de la app son shims de re-exportación — edita el paquete core, no los shims.

| Archivo | Propósito |
|---------|-----------|
| `packages/core/src/scene-graph.ts` | Grafo de escena: nodos, variables, instancias, hit testing |
| `packages/core/src/renderer.ts` | Pipeline de renderizado CanvasKit |
| `packages/core/src/layout.ts` | Adaptador de layout Yoga |
| `packages/core/src/undo.ts` | Gestor de deshacer/rehacer |
| `packages/core/src/clipboard.ts` | Portapapeles compatible con Figma |
| `packages/core/src/vector.ts` | Modelo de red vectorial |
| `packages/core/src/render-image.ts` | Exportación de imagen offscreen (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/codec.ts` | Codificador/decodificador binario Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Lógica de importación de archivos .fig |
| `packages/cli/src/index.ts` | Punto de entrada del CLI |
| `packages/core/src/tools/schema.ts` | Definiciones unificadas de herramientas (IA, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Implementación de Figma Plugin API |
| `packages/mcp/src/server.ts` | Factory del servidor MCP |
| `packages/cli/src/commands/` | Comandos CLI (info, tree, find, export, eval, analyze) |
| `src/stores/editor.ts` | Estado global del editor |
| `src/composables/use-canvas.ts` | Composable de renderizado del canvas |
| `src/composables/use-canvas-input.ts` | Manejo de entrada ratón/touch |
| `src/composables/use-keyboard.ts` | Manejo de atajos de teclado |
