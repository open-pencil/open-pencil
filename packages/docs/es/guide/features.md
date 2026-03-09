# Características

## Archivos .fig de Figma

Abre y guarda archivos nativos de Figma directamente. El pipeline de importación/exportación usa el mismo códec binario Kiwi que Figma — 194 definiciones de esquema, ~390 campos por nodo. Guardar con <kbd>⌘</kbd><kbd>S</kbd>, Guardar como con <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copiar y pegar con Figma** — selecciona nodos en Figma, <kbd>⌘</kbd><kbd>C</kbd>, cambia a OpenPencil, <kbd>⌘</kbd><kbd>V</kbd>. Rellenos, trazos, auto-layout, texto, efectos, radios de esquina y redes vectoriales se preservan. Funciona en ambas direcciones.

## Dibujo y edición

- **Formas** — Rectángulo (<kbd>R</kbd>), Elipse (<kbd>O</kbd>), Línea (<kbd>L</kbd>), Polígono, Estrella
- **Herramienta pluma** — redes vectoriales (no rutas simples), curvas de Bézier con asas de tangente
- **Texto** — edición nativa en el canvas con soporte IME, doble clic para entrar en modo de edición
- **Texto enriquecido** — negrita por carácter (<kbd>⌘</kbd><kbd>B</kbd>), cursiva (<kbd>⌘</kbd><kbd>I</kbd>), subrayado (<kbd>⌘</kbd><kbd>U</kbd>), tachado
- **Auto-layout** — flexbox vía Yoga WASM: dirección, gap, padding, justify, align, dimensionado de hijos. <kbd>⇧</kbd><kbd>A</kbd> para alternar
- **Componentes** — crear (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), conjuntos de componentes (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instancias con soporte de overrides, sincronización en vivo
- **Variables** — tokens de diseño con colecciones, modos (Claro/Oscuro), tipos color/float/string/boolean, vinculación de variables
- **Secciones** — contenedores organizacionales con adopción automática de hijos y píldoras de título

## Panel de propiedades

Pestañas contextuales Diseño | Código | IA:

- **Apariencia** — opacidad, radio de esquina (uniforme o por esquina), visibilidad
- **Relleno** — sólido, gradiente (lineal/radial/angular/diamante), imagen
- **Trazo** — color, grosor, alineación (interior/centro/exterior), grosores por lado, cap, join, dash
- **Efectos** — sombra paralela, sombra interior, desenfoque de capa, desenfoque de fondo, desenfoque de primer plano
- **Tipografía** — selector de fuentes con scroll virtual y búsqueda, peso, tamaño, alineación, botones de estilo
- **Layout** — controles de auto-layout cuando está habilitado
- **Exportación** — escala, formato (PNG/JPG/WEBP/SVG), vista previa en vivo

## Renderizado

Skia (CanvasKit WASM) — el mismo motor de renderizado que Figma:

- Rellenos de gradiente (lineal, radial, angular, diamante)
- Rellenos de imagen con modos de escala
- Efectos con caché por nodo
- Datos de arco (elipses parciales, donuts)
- Culling de viewport y reutilización de Paint
- Guías de snap con alineación consciente de rotación
- Reglas del canvas con badges de selección
- Resaltado al pasar que sigue la geometría real

## Deshacer/Rehacer

Toda operación es deshacible — creación, eliminación, movimientos, redimensionamientos, cambios de propiedades, cambios de padre, cambios de layout, operaciones de variables. Usa un patrón de comando inverso. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Documentos multi-página

Añadir, eliminar, renombrar páginas. Cada página tiene estado de viewport independiente. Doble clic para renombrar en línea.

## Pestañas multi-archivo

Abre múltiples documentos en pestañas. <kbd>⌘</kbd><kbd>T</kbd> nueva pestaña, <kbd>⌘</kbd><kbd>W</kbd> cerrar, <kbd>⌘</kbd><kbd>O</kbd> abrir archivo.

## Exportación

- **Imagen** — PNG, JPG, WEBP a escala configurable (0,5×–4×). Vía panel, menú contextual, o <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — formas, texto con style runs, gradientes, efectos, modos de mezcla
- **Tailwind JSX** — HTML con clases de utilidad Tailwind v4, listo para React o Vue
- **Copiar como** — texto, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), o JSX vía menú contextual

CLI: `open-pencil export design.fig -f jsx --style tailwind`

## Chat IA

Pulsa <kbd>⌘</kbd><kbd>J</kbd> para abrir el asistente IA. 87 herramientas que pueden crear formas, aplicar estilos, gestionar layout, trabajar con componentes y variables, ejecutar operaciones booleanas, analizar tokens de diseño y exportar assets. Trae tu propia clave API de OpenRouter.

Las llamadas a herramientas se muestran como entradas colapsables en una línea de tiempo. Selector de modelo con Claude, Gemini, GPT, DeepSeek y otros.

## Servidor MCP

Conecta Claude Code, Cursor, Windsurf, o cualquier cliente MCP para leer y escribir archivos `.fig` de forma headless. 90 herramientas (87 core + 3 de gestión de archivos). Dos transportes: stdio y HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Consulta la [referencia de herramientas MCP](/programmable/mcp-server) para la lista completa.

## CLI

Inspecciona, exporta y analiza archivos `.fig` desde el terminal:

```sh
open-pencil tree design.fig          # Árbol de nodos
open-pencil find design.fig --type TEXT  # Buscar
open-pencil export design.fig -f png     # Renderizar
open-pencil analyze colors design.fig    # Auditoría de colores
open-pencil analyze clusters design.fig  # Patrones repetidos
open-pencil eval design.fig -c "..."     # Figma Plugin API
```

Cuando la app de escritorio está en ejecución, omite el archivo para controlar el editor en vivo vía RPC:

```sh
open-pencil tree                     # Documento en vivo
open-pencil export -f png            # Captura del canvas
```

Todos los comandos soportan `--json`. Instalar: `bun add -g @open-pencil/cli`

## Colaboración en tiempo real

P2P vía WebRTC — sin servidor requerido. Comparte un enlace y edita junto.

- Cursores en vivo con flechas de colores y píldoras de nombre
- Avatares de presencia
- Modo seguimiento — clic en un par para seguir su viewport
- Persistencia local vía IndexedDB
- IDs de sala seguros vía `crypto.getRandomValues()`

## Escritorio y web

**Escritorio** — Tauri v2, ~7 MB. macOS (firmado y notarizado), Windows, Linux. Menús nativos, offline, autoguardado.

**Web** — funciona en [app.openpencil.dev](https://app.openpencil.dev), instalable como PWA en móvil con interfaz optimizada para táctil.

**Homebrew:**

```sh
brew install open-pencil/tap/open-pencil
```

## Fallback de Google Fonts

Cuando una fuente no está disponible localmente, OpenPencil la carga automáticamente desde Google Fonts. No requiere instalación manual al abrir archivos .fig con fuentes desconocidas.
